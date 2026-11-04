/**
 * baileys-caller — WhatsApp voice calling for Node.js.
 *
 * Wraps WhatsApp Web's official VoIP WASM stack and routes signaling through
 * Baileys. Public surface:
 *
 *   const client = new VoipClient({ authDir })
 *   await client.connect()
 *   const call = await client.call("12345678901", { audioSource: "./hi.mp3" })
 *
 * @author ShellTear
 */
import { EventEmitter } from "node:events";
import { randomBytes, createHmac } from "node:crypto";
import { resolve } from "node:path";
import fs from "node:fs";
import { Readable } from "node:stream";
import { WasmEngine } from "./wasm-engine.mjs";
import { RelayRtcTransport } from "./relay-transport.mjs";
import { SignalingBridge } from "./signaling.mjs";
import { AudioFeeder } from "./audio-feeder.mjs";
import { CallState } from "./types.mjs";
export { CallState } from "./types.mjs";
const SHA256_LEN = 32;
let _baileysModule = null;
const loadBaileys = async () => {
    if (_baileysModule) return _baileysModule;
    const candidates = [
        "../../index.js",
        "../../../lib/index.js",
        "../../../../lib/index.js",
        "@areumtecnologia/wasockets",
        "@whiskeysockets/baileys"
    ];
    for (const c of candidates) {
        try {
            const mod = await import(c);
            if (mod.useMultiFileAuthState || mod.default?.useMultiFileAuthState) {
                _baileysModule = {
                    ...mod,
                    ...(mod.default || {})
                };
                return _baileysModule;
            }
        } catch {}
    }
    return _baileysModule;
};
const toBareJid = (jid) => {
    if (!jid)
        return jid;
    const at = jid.indexOf("@");
    if (at < 0)
        return jid;
    const user = jid.slice(0, at).split(":")[0];
    return `${user}@${jid.slice(at + 1)}`;
};
const computeHkdf = (key, salt, info, length) => {
    const effectiveSalt = salt && salt.length > 0 ? Buffer.from(salt) : Buffer.alloc(SHA256_LEN, 0);
    const prk = createHmac("sha256", effectiveSalt).update(key).digest();
    const blocks = Math.ceil(length / SHA256_LEN);
    const okm = Buffer.alloc(blocks * SHA256_LEN);
    let prev = Buffer.alloc(0);
    for (let i = 1; i <= blocks; i += 1) {
        prev = createHmac("sha256", prk)
            .update(prev)
            .update(info)
            .update(Buffer.from([i]))
            .digest();
        prev.copy(okm, (i - 1) * SHA256_LEN);
    }
    return new Uint8Array(okm.buffer, okm.byteOffset, length);
};
const computeHmacSha256 = (data, key) => {
    const result = createHmac("sha256", Buffer.from(key)).update(data).digest();
    return new Uint8Array(result.buffer, result.byteOffset, result.byteLength);
};
const isCallReceiptNode = (node) => {
    if (node?.tag !== "receipt")
        return false;
    const child = Array.isArray(node.content) ? node.content[0] : null;
    return !!(child?.attrs?.["call-id"] || child?.attrs?.call_id);
};
function convertAndResampleAudio(input, options = {}) {
    const fromRate = Number(options.sampleRate) || 16000;
    const toRate = 16000;
    
    let float32;
    if (input instanceof Float32Array) {
        float32 = input;
    } else if (Buffer.isBuffer(input)) {
        const numSamples = Math.floor(input.length / 2);
        float32 = new Float32Array(numSamples);
        for (let i = 0; i < numSamples; i++) {
            const val = input.readInt16LE(i * 2);
            float32[i] = val < 0 ? val / 32768 : val / 32767;
        }
    } else if (input instanceof Int16Array) {
        float32 = new Float32Array(input.length);
        for (let i = 0; i < input.length; i++) {
            float32[i] = input[i] < 0 ? input[i] / 32768 : input[i] / 32767;
        }
    } else if (Array.isArray(input)) {
        float32 = new Float32Array(input);
    } else {
        throw new Error("Formato de áudio não suportado em pushAudio. Esperado Float32Array, Int16Array ou Buffer PCM.");
    }

    if (fromRate === toRate) {
        return float32;
    }

    const ratio = fromRate / toRate;
    const outLength = Math.round(float32.length / ratio);
    const out = new Float32Array(outLength);
    for (let i = 0; i < outLength; i++) {
        const srcPos = i * ratio;
        const index = Math.floor(srcPos);
        const frac = srcPos - index;
        const s1 = float32[index] || 0;
        const s2 = float32[index + 1] !== undefined ? float32[index + 1] : s1;
        out[i] = s1 + frac * (s2 - s1);
    }
    return out;
}

function rgbaToI420(rgbaBuffer, width, height) {
    const ySize = width * height;
    const uvWidth = width >> 1;
    const uvHeight = height >> 1;
    const uvSize = uvWidth * uvHeight;
    const out = Buffer.alloc(ySize + uvSize * 2);
    
    let uIndex = ySize;
    let vIndex = ySize + uvSize;

    for (let y = 0; y < height; y++) {
        const rowOffset = y * width;
        const isEvenRow = (y & 1) === 0;
        for (let x = 0; x < width; x++) {
            const pixelIndex = (rowOffset + x) << 2;
            const r = rgbaBuffer[pixelIndex];
            const g = rgbaBuffer[pixelIndex + 1];
            const b = rgbaBuffer[pixelIndex + 2];

            out[rowOffset + x] = ((66 * r + 129 * g + 25 * b + 128) >> 8) + 16;

            if (isEvenRow && ((x & 1) === 0)) {
                out[uIndex++] = ((-38 * r - 74 * g + 112 * b + 128) >> 8) + 128;
                out[vIndex++] = ((112 * r - 94 * g - 18 * b + 128) >> 8) + 128;
            }
        }
    }
    return out;
}

class WavFileWriter {
    filePath;
    channels;
    sampleRate;
    bytesWritten = 0;
    fd = null;
    source = "mixed";

    constructor(filePath, channels = 1, sampleRate = 16000) {
        this.filePath = filePath;
        this.channels = channels;
        this.sampleRate = sampleRate;
        try {
            this.fd = fs.openSync(filePath, "w");
            fs.writeSync(this.fd, Buffer.alloc(44, 0), 0, 44, 0);
        } catch (err) {
            this.fd = null;
        }
    }

    writeMono(pcmFloat32) {
        if (!this.fd || !pcmFloat32) return;
        try {
            const buf = Buffer.alloc(pcmFloat32.length * 2);
            for (let i = 0; i < pcmFloat32.length; i++) {
                const s = Math.max(-1, Math.min(1, pcmFloat32[i]));
                buf.writeInt16LE(s < 0 ? s * 0x8000 : s * 0x7fff, i * 2);
            }
            fs.writeSync(this.fd, buf);
            this.bytesWritten += buf.byteLength;
        } catch {}
    }

    writeStereo(rxFloat32, txFloat32) {
        if (!this.fd) return;
        try {
            const len = Math.max(rxFloat32?.length || 0, txFloat32?.length || 0);
            const buf = Buffer.alloc(len * 4);
            for (let i = 0; i < len; i++) {
                const rxSample = rxFloat32 && i < rxFloat32.length ? rxFloat32[i] : 0;
                const txSample = txFloat32 && i < txFloat32.length ? txFloat32[i] : 0;
                const sRx = Math.max(-1, Math.min(1, rxSample));
                const sTx = Math.max(-1, Math.min(1, txSample));
                buf.writeInt16LE(sRx < 0 ? sRx * 0x8000 : sRx * 0x7fff, i * 4);
                buf.writeInt16LE(sTx < 0 ? sTx * 0x8000 : sTx * 0x7fff, i * 4 + 2);
            }
            fs.writeSync(this.fd, buf);
            this.bytesWritten += buf.byteLength;
        } catch {}
    }

    close() {
        if (!this.fd) return;
        try {
            const header = Buffer.alloc(44);
            const blockAlign = this.channels * 2;
            const byteRate = this.sampleRate * blockAlign;
            const dataLength = this.bytesWritten;
            const riffLength = dataLength + 36;

            header.write("RIFF", 0);
            header.writeUInt32LE(riffLength, 4);
            header.write("WAVE", 8);
            header.write("fmt ", 12);
            header.writeUInt32LE(16, 16);
            header.writeUInt16LE(1, 20); // PCM format
            header.writeUInt16LE(this.channels, 22);
            header.writeUInt32LE(this.sampleRate, 24);
            header.writeUInt32LE(byteRate, 28);
            header.writeUInt16LE(blockAlign, 32);
            header.writeUInt16LE(16, 34); // 16-bit
            header.write("data", 36);
            header.writeUInt32LE(dataLength, 40);

            fs.writeSync(this.fd, header, 0, 44, 0);
            fs.closeSync(this.fd);
        } catch {}
        this.fd = null;
    }
}

/** A live or recently-ended call. */
export class ActiveCall extends EventEmitter {
    callId;
    engine;
    isVideo;
    peer = null;
    caller = null;
    direction = "outbound";
    telemetry = null;

    #state = CallState.Idle;
    #endResolver;
    #endPromise;
    #endTimer = null;
    #ended = false;
    #feeder = null;
    #relay = null;

    // Timing
    #offerTimestamp = Date.now();
    #ringingTimestamp = null;
    #connectedTimestamp = null;
    #endedTimestamp = null;

    // Audio & VAD metrics
    #inputVolumeGain = 1.0;
    #outputVolumeGain = 1.0;
    #vadEnabled = true;
    #vadThresholdDbfs = -38;
    #vadSilenceTimeoutMs = 600;
    #vadSpeechDebounceFrames = 2;
    #consecutiveSpeechFrames = 0;
    #isSpeaking = false;
    #lastSpeechTime = 0;

    #packetsReceived = 0;
    #packetsSent = 0;
    #bytesReceived = 0;
    #bytesSent = 0;
    #speechFrames = 0;
    #silenceFrames = 0;
    #sumVolumeDbfs = 0;
    #peakVolumeDbfs = -96;
    #lastTxChunk = null;

    // Video controls
    #videoPaused = false;
    #videoFps = 15;

    // Streams & Recording
    #rxStreams = [];
    #txStreams = [];
    #recorder = null;
    #statsInterval = null;
    #lastStatsRxBytes = 0;
    #lastStatsTxBytes = 0;
    #lastStatsTime = Date.now();

    /** @internal mirrors the source path for the audio feeder */
    _audioSource = "silence";

    constructor(callId, engine, durationMs, isVideo = false) {
        super();
        this.callId = callId;
        this.engine = engine;
        this.isVideo = isVideo;
        this.#endPromise = new Promise((res) => { this.#endResolver = res; });
        if (durationMs > 0) {
            this.#endTimer = setTimeout(() => this.end(), durationMs);
        }
    }

    get state() { return this.#state; }

    end = () => {
        if (this.#ended)
            return;
        this.#ended = true;
        if (this.#endTimer) {
            clearTimeout(this.#endTimer);
            this.#endTimer = null;
        }
        try {
            this.engine.endCall(0, true);
        }
        catch { }
    };

    mute = (muted) => {
        try {
            this.engine.setMute(muted);
        }
        catch { }
    };

    waitForEnd = () => this.#endPromise;

    /** @internal — called by VoipClient on WASM call-state change */
    _updateState = (state) => {
        this.#state = state;
        if (state === CallState.PreacceptReceived) {
            this.#ringingTimestamp = Date.now();
            this.emit("ringing");
        } else if (state === CallState.AcceptReceived || state === CallState.Active) {
            if (!this.#connectedTimestamp) {
                this.#connectedTimestamp = Date.now();
                this.emit("connected");
            }
            if (!this.#statsInterval) {
                this.#statsInterval = setInterval(() => {
                    if (this.#state !== CallState.Active && this.#state !== CallState.AcceptReceived) return;
                    const stats = this.getStats();
                    this.emit("stats", stats);
                }, 1000);
                this.#statsInterval.unref?.();
            }
        } else if (state === CallState.Idle || state === CallState.Ending) {
            this._forceEnd("ended");
        }
    };

    pushAudio = (audioData, options = {}) => {
        const float32 = convertAndResampleAudio(audioData, options);
        this.emit("audio_tx", float32);
    };

    pushVideoRgba = (rgbaBuffer, width, height) => {
        const i420 = rgbaToI420(rgbaBuffer, width, height);
        this.pushVideo(i420, width, height);
    };

    pushVideo = (frameBuffer, width, height) => {
        this.emit("video_tx", { frameBuffer, width, height });
    };

    /** @internal */
    _setFeeder = (feeder) => {
        this.#feeder = feeder;
        if (this.#outputVolumeGain !== 1.0) {
            feeder?.setVolume?.(this.#outputVolumeGain);
        }
    };

    /** @internal */
    _setRelay = (relay) => {
        this.#relay = relay;
    };

    /** @internal */
    _emitVideo = (data) => { this.emit("video", data); };

    /** @internal */
    _emitVideoOut = (data) => {
        this.emit("video_out", data);
        this.emit("video:out", data);
    };

    /** @internal */
    _emitAudio = (pcm) => {
        this.#packetsReceived++;
        this.#bytesReceived += pcm.byteLength;

        let effectivePcm = pcm;
        if (this.#inputVolumeGain !== 1.0) {
            effectivePcm = new Float32Array(pcm.length);
            for (let i = 0; i < pcm.length; i++) {
                effectivePcm[i] = Math.max(-1, Math.min(1, pcm[i] * this.#inputVolumeGain));
            }
        }

        // Calculate RMS and volume in dBFS
        let sumSquares = 0;
        for (let i = 0; i < effectivePcm.length; i++) {
            sumSquares += effectivePcm[i] * effectivePcm[i];
        }
        const rms = Math.sqrt(sumSquares / effectivePcm.length);
        const dbfs = rms > 1e-5 ? 20 * Math.log10(rms) : -96;

        if (this.#vadEnabled) {
            if (dbfs >= this.#vadThresholdDbfs) {
                this.#speechFrames++;
                this.#sumVolumeDbfs += dbfs;
                if (dbfs > this.#peakVolumeDbfs) this.#peakVolumeDbfs = dbfs;

                this.#consecutiveSpeechFrames++;
                this.#lastSpeechTime = Date.now();

                if (this.#consecutiveSpeechFrames >= this.#vadSpeechDebounceFrames && !this.#isSpeaking) {
                    this.#isSpeaking = true;
                    this.emit("speaking", { volumeDbfs: Number(dbfs.toFixed(1)), rms });
                }
            } else {
                this.#silenceFrames++;
                this.#consecutiveSpeechFrames = 0;

                if (this.#isSpeaking && (Date.now() - this.#lastSpeechTime >= this.#vadSilenceTimeoutMs)) {
                    this.#isSpeaking = false;
                    this.emit("silence", { durationMs: Date.now() - this.#lastSpeechTime });
                }
            }
        }

        // Deliver to Rx streams
        if (this.#rxStreams.length > 0) {
            for (const item of this.#rxStreams) {
                if (item.format === "int16") {
                    const buf = Buffer.alloc(effectivePcm.length * 2);
                    for (let i = 0; i < effectivePcm.length; i++) {
                        const s = Math.max(-1, Math.min(1, effectivePcm[i]));
                        buf.writeInt16LE(s < 0 ? s * 0x8000 : s * 0x7fff, i * 2);
                    }
                    item.stream.push(buf);
                } else {
                    item.stream.push(Buffer.from(effectivePcm.buffer, effectivePcm.byteOffset, effectivePcm.byteLength));
                }
            }
        }

        // Deliver to file recorder
        if (this.#recorder) {
            if (this.#recorder.channels === 2) {
                this.#recorder.writeStereo(effectivePcm, this.#lastTxChunk);
            } else {
                if (this.#recorder.source === "rx" || this.#recorder.source === "mixed") {
                    this.#recorder.writeMono(effectivePcm);
                }
            }
        }

        this.emit("audio", effectivePcm);
    };

    /** @internal */
    _emitAudioOut = (pcm) => {
        this.#packetsSent++;
        this.#bytesSent += pcm.byteLength;
        this.#lastTxChunk = pcm;

        // Deliver to Tx streams
        if (this.#txStreams.length > 0) {
            for (const item of this.#txStreams) {
                if (item.format === "int16") {
                    const buf = Buffer.alloc(pcm.length * 2);
                    for (let i = 0; i < pcm.length; i++) {
                        const s = Math.max(-1, Math.min(1, pcm[i]));
                        buf.writeInt16LE(s < 0 ? s * 0x8000 : s * 0x7fff, i * 2);
                    }
                    item.stream.push(buf);
                } else {
                    item.stream.push(Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength));
                }
            }
        }

        // Deliver to file recorder if mono and source is tx
        if (this.#recorder && this.#recorder.channels === 1 && this.#recorder.source === "tx") {
            this.#recorder.writeMono(pcm);
        }

        this.emit("audio_out", pcm);
        this.emit("audio:out", pcm);
    };

    /** @internal */
    _forceEnd = (reason) => {
        if (this.#ended)
            return;
        this.#ended = true;
        this.#endedTimestamp = Date.now();

        if (this.#endTimer) {
            clearTimeout(this.#endTimer);
            this.#endTimer = null;
        }
        if (this.#statsInterval) {
            clearInterval(this.#statsInterval);
            this.#statsInterval = null;
        }

        this.stopRecording();

        for (const item of this.#rxStreams) item.stream.push(null);
        for (const item of this.#txStreams) item.stream.push(null);
        this.#rxStreams = [];
        this.#txStreams = [];

        try {
            this.engine.endCall(0, false);
        } catch {}

        const telemetry = this.#buildTelemetry(reason);
        this.telemetry = telemetry;
        this.emit("telemetry", telemetry);

        this.emit("ended", reason);
        this.#endResolver(reason);
    };

    // ── Streams & Recording ───────────────────────────────────────────────────
    getRxStream = (options = {}) => {
        const format = options.format || "int16";
        const stream = new Readable({ read() {} });
        this.#rxStreams.push({ stream, format });
        return stream;
    };

    getTxStream = (options = {}) => {
        const format = options.format || "int16";
        const stream = new Readable({ read() {} });
        this.#txStreams.push({ stream, format });
        return stream;
    };

    recordToFile = (filePath, options = {}) => {
        if (this.#recorder) {
            this.#recorder.close();
        }
        const channels = options.channels || 1;
        const sampleRate = options.sampleRate || 16000;
        this.#recorder = new WavFileWriter(filePath, channels, sampleRate);
        this.#recorder.source = options.source || "mixed";
        return this.#recorder;
    };

    stopRecording = () => {
        if (this.#recorder) {
            this.#recorder.close();
            this.#recorder = null;
        }
    };

    // ── Controls ─────────────────────────────────────────────────────────────
    setInputVolume = (gain) => {
        this.#inputVolumeGain = Math.max(0, Number(gain) || 1.0);
    };

    setOutputVolume = (gain) => {
        this.#outputVolumeGain = Math.max(0, Number(gain) || 1.0);
        this.#feeder?.setVolume?.(this.#outputVolumeGain);
    };

    pauseAudio = () => {
        this.#feeder?.pause?.();
    };

    resumeAudio = () => {
        this.#feeder?.resume?.();
    };

    playFile = (filePath) => {
        this._audioSource = filePath;
        this.#feeder?.playFile?.(filePath);
    };

    pauseVideo = () => {
        this.#videoPaused = true;
    };

    resumeVideo = () => {
        this.#videoPaused = false;
    };

    get isVideoPaused() {
        return this.#videoPaused;
    }

    setVideoFps = (fps) => {
        this.#videoFps = Math.max(1, Math.min(30, Number(fps) || 15));
    };

    setVadOptions = (options = {}) => {
        if (options.thresholdDbfs !== undefined) this.#vadThresholdDbfs = Number(options.thresholdDbfs);
        if (options.silenceTimeoutMs !== undefined) this.#vadSilenceTimeoutMs = Number(options.silenceTimeoutMs);
        if (options.speechDebounceFrames !== undefined) this.#vadSpeechDebounceFrames = Number(options.speechDebounceFrames);
        if (options.enabled !== undefined) this.#vadEnabled = !!options.enabled;
    };

    getStats = () => {
        const now = Date.now();
        const deltaSeconds = Math.max(0.1, (now - this.#lastStatsTime) / 1000);
        const relayStats = this.#relay?.getStats?.() || {};
        const activeRelay = relayStats.connections?.find?.(c => c.state === "open") || relayStats.connections?.[0];

        const currentRxBytes = relayStats.receivedBytes || this.#bytesReceived;
        const currentTxBytes = relayStats.sentBytes || this.#bytesSent;

        const downlinkBps = Math.round(((currentRxBytes - this.#lastStatsRxBytes) * 8) / deltaSeconds);
        const uplinkBps = Math.round(((currentTxBytes - this.#lastStatsTxBytes) * 8) / deltaSeconds);

        this.#lastStatsRxBytes = currentRxBytes;
        this.#lastStatsTxBytes = currentTxBytes;
        this.#lastStatsTime = now;

        const connTs = this.#connectedTimestamp;
        const talkDurationSeconds = connTs ? Math.max(0, Math.round((now - connTs) / 1000)) : 0;

        return {
            callId: this.callId,
            state: this.#state,
            talkDurationSeconds,
            rttMs: activeRelay?.rttMs || null,
            packetsSent: this.#packetsSent,
            packetsReceived: this.#packetsReceived,
            droppedPackets: relayStats.droppedPackets || 0,
            bytesSent: currentTxBytes,
            bytesReceived: currentRxBytes,
            uplinkBps,
            downlinkBps,
            isSpeaking: this.#isSpeaking,
            audioFeeder: this.#feeder?.getStats?.() || null
        };
    };

    getTelemetry = () => {
        return this.telemetry || this.#buildTelemetry("in_progress");
    };

    #buildTelemetry = (endReason) => {
        const now = this.#endedTimestamp || Date.now();
        const offerTs = this.#offerTimestamp;
        const ringTs = this.#ringingTimestamp;
        const connTs = this.#connectedTimestamp;
        const timeToRingMs = ringTs ? ringTs - offerTs : null;
        const timeToAnswerMs = connTs ? connTs - offerTs : null;
        const talkDurationSeconds = connTs ? Math.max(0, Math.round((now - connTs) / 1000)) : 0;
        const totalDurationSeconds = Math.max(0, Math.round((now - offerTs) / 1000));

        const totalAudioFrames = this.#speechFrames + this.#silenceFrames;
        const speechRatio = totalAudioFrames > 0 ? Number((this.#speechFrames / totalAudioFrames).toFixed(2)) : 0;
        const avgVolumeDbfs = this.#speechFrames > 0 ? Number((this.#sumVolumeDbfs / this.#speechFrames).toFixed(1)) : -96;
        const peakVolumeDbfs = this.#peakVolumeDbfs > -96 ? Number(this.#peakVolumeDbfs.toFixed(1)) : -96;

        const relayStats = this.#relay?.getStats?.() || {};
        const activeRelay = relayStats.connections?.find?.(c => c.state === "open") || relayStats.connections?.[0];

        return {
            callId: this.callId,
            direction: this.direction,
            peer: this.peer || { phoneNumber: "", pnJid: "", lidJid: "" },
            caller: this.caller || { pnJid: "", lidJid: "", displayName: "" },
            timing: {
                offerTimestamp: offerTs,
                ringingTimestamp: ringTs,
                connectedTimestamp: connTs,
                endedTimestamp: now,
                timeToRingMs,
                timeToAnswerMs,
                talkDurationSeconds,
                totalDurationSeconds
            },
            status: {
                finalState: "ended",
                endReason: endReason || "hangup",
                answered: !!connTs
            },
            audioMetrics: {
                sampleRate: 16000,
                channels: 1,
                frameDurationMs: 20,
                samplesPerChunk: 320,
                packetsReceived: this.#packetsReceived,
                packetsSent: this.#packetsSent,
                bytesReceived: this.#bytesReceived,
                bytesSent: this.#bytesSent,
                voiceActivity: {
                    avgVolumeDbfs,
                    peakVolumeDbfs,
                    speechFrames: this.#speechFrames,
                    silenceFrames: this.#silenceFrames,
                    speechRatio
                }
            },
            networkMetrics: {
                transport: "TURN/STUN Relay",
                relayServer: activeRelay?.relay || "edgeray.wt.whatsapp.com",
                iceRttMs: activeRelay?.rttMs || null,
                droppedPackets: relayStats.droppedPackets || 0,
                bytesReceived: relayStats.receivedBytes || this.#bytesReceived,
                bytesSent: relayStats.sentBytes || this.#bytesSent
            }
        };
    };
}
/** Top-level client. Connects to WhatsApp and lets you place calls. */
export class VoipClient {
    #config;
    #engine = null;
    #relay = null;
    #signaling = null;
    #sock = null;
    #activeCall = null;
    #baileys = null;
    // Capture state populated when WASM negotiates audio params
    #capturePtr = 0;
    #captureChunkBytes = 0;
    #captureSampleRate = 16000;
    #captureChannels = 1;
    #captureFramesPerChunk = 320;
    #feeder = null;
    constructor(config) {
        this.#config = config;
    }
    /** Connect to WhatsApp and bring up the WASM VoIP stack. */
    connect = async () => {
        this.#baileys = await loadBaileys();
        const useMultiFileAuthState = this.#baileys.useMultiFileAuthState || this.#baileys.default?.useMultiFileAuthState;
        const makeSocket = this.#baileys.default?.default || this.#baileys.default || this.#baileys.makeWASocket || this.#baileys;
        const DisconnectReason = this.#baileys.DisconnectReason || this.#baileys.default?.DisconnectReason;
        const authDir = resolve(this.#config.authDir);
        const { state, saveCreds } = await useMultiFileAuthState(authDir);
        const silentLogger = {
            level: "silent",
            child: () => silentLogger,
            trace: () => { },
            debug: () => { },
            info: () => { },
            warn: () => { },
            error: () => { },
            fatal: () => { },
        };
        const createSocket = () => makeSocket({
            auth: state,
            emitOwnEvents: true,
            logger: silentLogger,
        });
        // Connect with auto-reconnect on the post-QR 515 stream-error path.
        await new Promise((resolveOpen, rejectOpen) => {
            let opened = false;
            let retries = 0;
            const maxRetries = 5;
            const connectSocket = () => {
                this.#sock = createSocket();
                this.#sock.ev.on("creds.update", saveCreds);
                process.removeAllListeners("uncaughtException");
                process.on("uncaughtException", (err) => {
                    const code = err?.output?.statusCode ?? err?.data?.attrs?.code;
                    if ((code === 515 || code === "515") && !opened && retries < maxRetries) {
                        retries += 1;
                        setTimeout(connectSocket, 1500);
                    }
                    else if (!opened) {
                        rejectOpen(err);
                    }
                });
                this.#sock.ev.on("connection.update", (update) => {
                    if (update.qr) {
                        this.#config.onQr?.(update.qr);
                        void import("qrcode-terminal")
                            .then((qrt) => (qrt.default ?? qrt).generate(update.qr, { small: true }))
                            .catch(() => {
                            console.log("Scan this QR code in WhatsApp > Linked Devices:");
                            console.log(update.qr);
                        });
                    }
                    this.#config.onConnectionUpdate?.(update);
                    if (update.connection === "open") {
                        opened = true;
                        process.removeAllListeners("uncaughtException");
                        resolveOpen();
                        return;
                    }
                    if (update.connection === "close" && !opened) {
                        const statusCode = update.lastDisconnect?.error?.output?.statusCode;
                        const shouldReconnect = statusCode === 515 || statusCode === DisconnectReason?.restartRequired;
                        if (shouldReconnect && retries < maxRetries) {
                            retries += 1;
                            setTimeout(connectSocket, 1000);
                        }
                        else {
                            rejectOpen(update.lastDisconnect?.error ?? new Error("socket closed before open"));
                        }
                    }
                });
            };
            connectSocket();
        });
        this.#signaling = new SignalingBridge({ sock: this.#sock });
        await this.#signaling.init();
        this.#relay = new RelayRtcTransport({
            onTransportMessage: (data, ip, port) => this.#engine?.handleOnTransportMessage(data, ip, port),
            onIceRtt: (rttMs, ip, port) => this.#engine?.updateIceRtt(rttMs, ip, port),
            onRelayConnected: (ip, port) => this.#engine?.markRelayConnected(ip, port),
        });
        this.#engine = new WasmEngine({
            enableLogs: true,
            callbacks: {
                onLog: (level, msg) => console.log(`[VoIP-WASM ${level}] ${msg}`),
                onSignalingXmpp: (peerJid, callId, xmlPayload) => this.#signaling.sendSignaling(peerJid, callId, xmlPayload),
                onCallEvent: (eventType, eventData) => this.#handleCallEvent(eventType, eventData),
                sendDataToRelay: (data, ip, port) => {
                    console.log(`[VoIP sendDataToRelay] ${data?.byteLength || 0} bytes to ${ip}:${port}`);
                    return this.#relay.send(data, ip, port);
                },
                onAudioCaptureInit: (config) => this.#handleAudioCaptureInit(config),
                onAudioCaptureStart: () => this.#handleAudioCaptureStart(),
                onAudioCaptureStop: () => this.#handleAudioCaptureStop(),
                onAudioPlaybackData: (audioData) => this.#activeCall?._emitAudio(audioData),
                onVideoFrame: (videoData) => this.#activeCall?._emitVideo(videoData),
                cryptoHkdf: computeHkdf,
                hmacSha256: computeHmacSha256,
            },
        });
        await this.#engine.initialize();
        this.#signaling.attachEngine(this.#engine);
        this.#signaling.attachRelay(this.#relay);
        const selfPnJid = this.#sock.authState.creds.me?.id;
        const selfLidJid = this.#sock.authState.creds.me?.lid;
        this.#engine.initVoipStack(selfPnJid, toBareJid(selfPnJid), selfLidJid);
        await this.#engine.waitForVoipStackReady();
        try {
            this.#engine.updateNetworkMedium(2, 0);
        }
        catch { }
        this.#sock.ws.on("CB:call", (node) => {
            const children = Array.isArray(node?.content) ? node.content : [];
            const tags = children.map(c => c?.tag).join(", ");
            console.log(`[VoIP-Client CB:call] Stanza from=${node.attrs?.from} tags=[${tags}]`);
            const isHangup = children.some(c => c?.tag === "terminate" || c?.tag === "reject");
            if (isHangup) {
                this.#activeCall?._forceEnd("remote_hangup");
            }
            if (children.some(c => c?.tag === "accept")) {
                console.log("[VoIP-Client] Inbound <accept> detected! Transitioning activeCall to AcceptReceived (5)...");
                this.#activeCall?._updateState(CallState.AcceptReceived);
            } else if (children.some(c => c?.tag === "preaccept")) {
                this.#activeCall?._updateState(CallState.PreacceptReceived);
            }
            this.#signaling.processIncomingCall(node, this.#engine, this.#activeCall?.callId ?? "");
        });
        this.#sock.ev.on("call", (calls) => {
            for (const c of calls) {
                console.log(`[VoIP-Client ev:call] status=${c.status} id=${c.id} from=${c.from}`);
                if (c.status === "terminate" || c.status === "reject") {
                    this.#activeCall?._forceEnd("remote_hangup");
                }
            }
        });
        this.#sock.ws.on("CB:receipt", (node) => {
            if (!isCallReceiptNode(node))
                return;
            this.#signaling.processIncomingReceipt(node, this.#engine, this.#activeCall?.callId ?? "");
        });
    };
    get sock() {
        return this.#sock;
    }
    /** Place an outbound voice call. */
    call = async (phoneNumber, opts = {}) => {
        if (!this.#engine || !this.#signaling)
            throw new Error("Not connected. Call connect() first.");
        if (this.#activeCall)
            throw new Error("A call is already active.");
        const targetNumber = phoneNumber.replace(/\D/g, "");
        let targetPnJid = `${targetNumber}@s.whatsapp.net`;
        try {
            const waResults = await this.#sock.onWhatsApp(targetNumber);
            if (waResults && waResults[0]?.exists && waResults[0]?.jid) {
                targetPnJid = waResults[0].jid;
                console.log(`[VoIP-Client] Destination verified via onWhatsApp: ${targetPnJid}`);
            }
        } catch {}
        const durationMs = opts.durationMs ?? 120_000;
        const audioSource = opts.audioSource ?? "silence";
        const isVideo = opts.isVideo ?? false;
        const peerLid = await this.#signaling.resolveLid(targetPnJid);
        if (!peerLid)
            throw new Error(`Could not resolve LID for ${targetPnJid}`);
        for (const jid of [targetPnJid, peerLid]) {
            try {
                await this.#sock.presenceSubscribe(jid);
            }
            catch { }
        }
        await new Promise((r) => setTimeout(r, 750));
        const peerDeviceJids = await this.#signaling.discoverPeerDevices(peerLid);
        const deviceList = peerDeviceJids.length ? peerDeviceJids : [toBareJid(peerLid)];
        await this.#signaling.ensureSessionsForPeers(deviceList);
        await new Promise((r) => setTimeout(r, 500));
        await this.#signaling.issueTcToken(peerLid);
        const tcToken = await this.#signaling.ensureTcToken(peerLid, targetPnJid);
        const callId = ("00" + randomBytes(16).toString("hex").slice(2)).toUpperCase();
        try { this.#engine?.resetVideoUplink?.(); } catch {}
        const call = new ActiveCall(callId, this.#engine, durationMs, isVideo);
        call._audioSource = audioSource;
        call.peer = { phoneNumber, pnJid: targetPnJid, lidJid: peerLid };
        call.caller = { pnJid: this.#sock?.user?.id ? toBareJid(this.#sock.user.id) : null, lidJid: this.#sock?.user?.lid || null, displayName: this.#sock?.user?.name || "Unity Chat" };
        call._setRelay(this.#relay);
        if (this.#feeder) call._setFeeder(this.#feeder);
        this.#activeCall = call;
        this.#signaling.registerOutboundCall(callId, peerLid, targetPnJid);
        call.on("connected", () => {
            if (!this.#feeder) {
                this.#handleAudioCaptureStart();
            }
            if (isVideo) {
                startVideoHeartbeat();
            }
        });
        call.on("audio_tx", (pcm) => {
            this.#feeder?.pushChunk(pcm);
        });

        let videoHeartbeatInterval = null;
        let lastManualVideoTime = 0;

        const startVideoHeartbeat = () => {
            if (!isVideo || videoHeartbeatInterval) return;
            const blackFrame = Buffer.alloc(320 * 240 * 1.5);
            blackFrame.fill(16, 0, 320 * 240);
            blackFrame.fill(128, 320 * 240);

            videoHeartbeatInterval = setInterval(() => {
                if (this.#activeCall !== call || (call.state !== CallState.Active && call.state !== CallState.AcceptReceived)) {
                    if (call.state === CallState.Idle || call.state === CallState.Ending) {
                        clearInterval(videoHeartbeatInterval);
                        videoHeartbeatInterval = null;
                    }
                    return;
                }
                if (Date.now() - lastManualVideoTime > 250) {
                    this.#engine?.pushVideoFrame(blackFrame, 320, 240, 15, 0);
                }
            }, 66);
        };

        call.on("video_tx", ({ frameBuffer, width, height }) => {
            if ((call.state !== CallState.Active && call.state !== CallState.AcceptReceived) || call.isVideoPaused) return;
            lastManualVideoTime = Date.now();
            this.#engine?.pushVideoFrame(frameBuffer, width, height, 15, 0);
            call._emitVideoOut?.({ frameBuffer, width, height });
        });
        call.on("ended", async () => {
            if (callId) this.#signaling?.unregisterCall?.(callId);
            if (videoHeartbeatInterval) {
                clearInterval(videoHeartbeatInterval);
                videoHeartbeatInterval = null;
            }
            this.#handleAudioCaptureStop(true);
            try { this.#engine?.resetVideoUplink?.(); } catch {}
            try { this.#engine?.endCall(0, false); } catch {}
            await this.#relay?.closeAll?.();
            if (this.#activeCall === call) {
                this.#activeCall = null;
            }
        });
        this.#engine.startCall({
            peerJid: peerLid,
            peerPn: targetPnJid,
            peerList: deviceList,
            callId,
            isVideo,
            isLidCall: true,
            isFromDialer: false,
            extraData: tcToken,
        });
        return call;
    };
    /** Tear down the WhatsApp socket and release resources. */
    disconnect = () => {
        this.#activeCall?._forceEnd("disconnect");
        this.#activeCall = null;
        this.#relay?.closeAll();
        this.#engine?.destroy();
        this.#sock?.end?.();
        this.#engine = null;
        this.#relay = null;
        this.#signaling = null;
        this.#sock = null;
    };
    get sock() { return this.#sock; }
    get activeCall() { return this.#activeCall; }
    clearActiveCall = async () => {
        this.#handleAudioCaptureStop(true);
        try { this.#engine?.resetVideoUplink?.(); } catch {}
        try { this.#engine?.endCall(0, false); } catch {}
        await this.#relay?.closeAll?.();
        this.#activeCall = null;
    };
    // ─── private ──────────────────────────────────────────────────────────────
    #handleCallEvent = (eventType, eventData) => {
        console.log(`[VoIP onCallEvent] type=${eventType} data=${eventData ? eventData.substring(0, 140) : "null"}`);
        if (eventType === 16 && eventData) {
            try {
                const parsed = JSON.parse(eventData);
                const info = parsed.call_info ?? parsed.callInfo ?? {};
                const callState = Number(info.call_state ?? info.callState ?? 0);
                const stateName = Object.keys(CallState).find(k => CallState[k] === callState) || ("Unknown(" + callState + ")");
                console.log(`[VoIP State] call_state -> ${callState} (${stateName})`);
                this.#activeCall?._updateState(callState);
            }
            catch { }
        }
        else if (eventType === 156 && eventData) {
            try {
                console.log(`[VoIP] Relay list update received (event 156)! Updating relay transport...`);
                const update = JSON.parse(eventData);
                this.#relay?.updateRelayList(update);
            }
            catch (err) {
                console.error(`[VoIP] Error processing event 156:`, err);
            }
        }
        else if (eventType === 2) {
            console.log(`[VoIP] Remote end received (event 2)`);
            this.#activeCall?._forceEnd("remote_end");
        }
    };
    #handleAudioCaptureInit = (config) => {
        if (!this.#engine)
            return;
        this.#captureSampleRate = config.sampleRate || 16000;
        this.#captureChannels = config.channels || 1;
        this.#captureFramesPerChunk = config.framesPerChunk || 320;
        const chunkSamples = this.#captureFramesPerChunk * this.#captureChannels;
        this.#captureChunkBytes = chunkSamples * Float32Array.BYTES_PER_ELEMENT;
        this.#capturePtr = this.#engine.malloc(this.#captureChunkBytes);
    };
    #handleAudioCaptureStart = () => {
        if (!this.#engine)
            return;
        if (!this.#capturePtr) {
            const chunkSamples = (this.#captureFramesPerChunk || 320) * (this.#captureChannels || 1);
            this.#captureChunkBytes = chunkSamples * Float32Array.BYTES_PER_ELEMENT;
            this.#capturePtr = this.#engine.malloc(this.#captureChunkBytes);
        }
        if (!this.#capturePtr)
            return;
        const audioSource = this.#activeCall?._audioSource ?? "silence";
        if (this.#feeder) {
            console.log(`[VoIP] AudioFeeder already running, keeping active`);
            return;
        }
        this.#feeder = new AudioFeeder(this.#captureSampleRate || 16000, this.#captureChannels || 1, this.#captureFramesPerChunk || 320, (chunk) => {
            this.#activeCall?._emitAudioOut?.(chunk);
            if (this.#engine && this.#capturePtr)
                this.#engine.sendAudioData(chunk, this.#capturePtr);
        }, audioSource);
        this.#activeCall?._setFeeder(this.#feeder);
        this.#feeder.start();
        console.log(`[VoIP] AudioFeeder uplink running (source: ${audioSource})`);
    };
    #handleAudioCaptureStop = (force = false) => {
        if (!force && this.#activeCall && this.#activeCall.state !== CallState.Idle && this.#activeCall.state !== CallState.Ending) {
            console.log(`[VoIP] Ignoring stopCaptureJS while call is in progress! (callId: ${this.#activeCall.callId})`);
            return;
        }
        console.log("[VoIP] AudioFeeder stopped");
        this.#feeder?.stop();
        this.#feeder = null;
        // Keep this.#capturePtr allocated for reuse across calls
    };
}


/**
 * VoipEngine — Attached directly to a live WaSockets instance (makeWASocket).
 * Shares the socket's connection, signal sessions, auth state, and message queue.
 */
export class VoipEngine {
    #sock;
    #options;
    #engine = null;
    #relay = null;
    #signaling = null;
    #activeCall = null;
    #capturePtr = 0;
    #captureChunkBytes = 0;
    #captureSampleRate = 16000;
    #captureChannels = 1;
    #captureFramesPerChunk = 320;
    #feeder = null;
    #initPromise = null;
    #destroyed = false;

    constructor(sock, options = {}) {
        this.#sock = sock;
        this.#options = options;
    }

    init = async () => {
        if (this.#initPromise) return this.#initPromise;
        this.#initPromise = this.#doInit();
        return this.#initPromise;
    };

    #doInit = async () => {
        if (!this.#sock.authState?.creds?.me) {
            await new Promise((resolve) => {
                if (this.#sock.authState?.creds?.me) return resolve();
                const check = () => {
                    if (this.#sock.authState?.creds?.me) {
                        this.#sock.ev.off("connection.update", check);
                        resolve();
                    }
                };
                this.#sock.ev.on("connection.update", check);
            });
        }

        this.#signaling = new SignalingBridge({ sock: this.#sock });
        await this.#signaling.init();

        this.#relay = new RelayRtcTransport({
            onTransportMessage: (data, ip, port) => this.#engine?.handleOnTransportMessage(data, ip, port),
            onIceRtt: (rttMs, ip, port) => this.#engine?.updateIceRtt(rttMs, ip, port),
            onRelayConnected: (ip, port) => this.#engine?.markRelayConnected(ip, port),
        });

        this.#engine = new WasmEngine({
            enableLogs: true,
            callbacks: {
                onLog: (level, msg) => console.log(`[VoIP-WASM ${level}] ${msg}`),
                onSignalingXmpp: (peerJid, callId, xmlPayload) => this.#signaling.sendSignaling(peerJid, callId, xmlPayload),
                onCallEvent: (eventType, eventData) => this.#handleCallEvent(eventType, eventData),
                sendDataToRelay: (data, ip, port) => {
                    console.log(`[VoIP sendDataToRelay] ${data?.byteLength || 0} bytes to ${ip}:${port}`);
                    return this.#relay.send(data, ip, port);
                },
                onAudioCaptureInit: (config) => this.#handleAudioCaptureInit(config),
                onAudioCaptureStart: () => this.#handleAudioCaptureStart(),
                onAudioCaptureStop: () => this.#handleAudioCaptureStop(),
                onAudioPlaybackData: (audioData) => this.#activeCall?._emitAudio(audioData),
                onVideoFrame: (videoData) => this.#activeCall?._emitVideo(videoData),
                cryptoHkdf: computeHkdf,
                hmacSha256: computeHmacSha256,
            },
        });

        await this.#engine.initialize();
        this.#signaling.attachEngine(this.#engine);
        this.#signaling.attachRelay(this.#relay);

        const selfPnJid = this.#sock.authState.creds.me?.id;
        const selfLidJid = this.#sock.authState.creds.me?.lid;
        this.#engine.initVoipStack(selfPnJid, toBareJid(selfPnJid), selfLidJid);
        await this.#engine.waitForVoipStackReady();

        try {
            this.#engine.updateNetworkMedium(2, 0);
        } catch {}

        if (this.#sock.ws) {
            this.#sock.ws.on("CB:call", (node) => {
                const children = Array.isArray(node?.content) ? node.content : [];
                const tags = children.map(c => c?.tag).join(", ");
                console.log("[VoIP-Engine CB:call] Stanza tags: [" + tags + "]");
                
                const hangupChild = children.find(c => c?.tag === "terminate" || c?.tag === "reject");
                if (hangupChild && this.#activeCall) {
                    const stanzaCallId = String(hangupChild.attrs?.["call-id"] || hangupChild.attrs?.call_id || node.attrs?.id || "");
                    const fromJid = String(node.attrs?.from || "");
                    const myPn = this.#sock.authState?.creds?.me?.id?.split(":")[0];
                    const myLid = this.#sock.authState?.creds?.me?.lid?.split(":")[0];
                    const isFromSelf = (myPn && fromJid.includes(myPn)) || (myLid && fromJid.includes(myLid));
                    
                    if (!isFromSelf && (!stanzaCallId || stanzaCallId.toLowerCase() === this.#activeCall.callId.toLowerCase())) {
                        console.log("[VoIP-Engine CB:call] Hangup received for active call! Forcing call end.");
                        this.#activeCall._forceEnd("remote_hangup");
                    }
                }
                if (children.some(c => c?.tag === "accept")) {
                    console.log("[VoIP-Engine] Inbound <accept> detected! Transitioning activeCall to AcceptReceived (5)...");
                    this.#activeCall?._updateState(CallState.AcceptReceived);
                } else if (children.some(c => c?.tag === "preaccept")) {
                    this.#activeCall?._updateState(CallState.PreacceptReceived);
                }
                this.#signaling.processIncomingCall(node, this.#engine, this.#activeCall?.callId ?? "");
            });

            this.#sock.ws.on("CB:receipt", (node) => {
                if (!isCallReceiptNode(node)) return;
                this.#signaling.processIncomingReceipt(node, this.#engine, this.#activeCall?.callId ?? "");
            });
        }

        this.#sock.ev.on("call", (calls) => {
            for (const c of calls) {
                console.log(`[VoIP-Engine ev:call] status=${c.status} id=${c.id} from=${c.from}`);
                if (c.status === "terminate" || c.status === "reject") {
                    if (this.#activeCall && c.id && this.#activeCall.callId.toLowerCase() === c.id.toLowerCase()) {
                        this.#activeCall._forceEnd("remote_hangup");
                    }
                }
            }
        });
    };

    get activeCall() { return this.#activeCall; }
    get sock() { return this.#sock; }

    startCall = async (phoneNumber, opts = {}) => {
        await this.init();
        if (this.#activeCall) {
            throw new Error("A call is already active.");
        }
        const targetNumber = phoneNumber.replace(/\D/g, "");
        let targetPnJid = `${targetNumber}@s.whatsapp.net`;
        try {
            const waResults = await this.#sock.onWhatsApp(targetNumber);
            if (waResults && waResults[0]?.exists && waResults[0]?.jid) {
                targetPnJid = waResults[0].jid;
                console.log(`[VoIP-Client] Destination verified via onWhatsApp: ${targetPnJid}`);
            }
        } catch {}
        const durationMs = opts.durationMs ?? 120_000;
        const audioSource = opts.audioSource ?? "silence";
        const isVideo = opts.isVideo ?? false;

        const peerLid = await this.#signaling.resolveLid(targetPnJid);
        if (!peerLid) throw new Error(`Could not resolve LID for ${targetPnJid}`);

        for (const jid of [targetPnJid, peerLid]) {
            try { await this.#sock.presenceSubscribe(jid); } catch {}
        }
        await new Promise((r) => setTimeout(r, 750));

        const peerDeviceJids = await this.#signaling.discoverPeerDevices(peerLid);
        const deviceList = peerDeviceJids.length ? peerDeviceJids : [toBareJid(peerLid)];
        await this.#signaling.ensureSessionsForPeers(deviceList);
        await new Promise((r) => setTimeout(r, 500));

        await this.#signaling.issueTcToken(peerLid);
        const tcToken = await this.#signaling.ensureTcToken(peerLid, targetPnJid);

        const callId = ("00" + randomBytes(16).toString("hex").slice(2)).toUpperCase();
        const call = new ActiveCall(callId, this.#engine, durationMs, isVideo);
        call._audioSource = audioSource;
        call.peer = { phoneNumber: targetNumber, pnJid: targetPnJid, lidJid: peerLid };
        call.caller = { pnJid: this.#sock?.user?.id ? toBareJid(this.#sock.user.id) : null, lidJid: this.#sock?.user?.lid || null, displayName: this.#sock?.user?.name || "Unity Chat" };
        call._setRelay(this.#relay);
        if (this.#feeder) call._setFeeder(this.#feeder);
        this.#activeCall = call;
        this.#signaling.registerOutboundCall(callId, peerLid, targetPnJid);

        // Emit events on sock.ev
        try {
            this.#sock.ev.emit("call.created", { callId, to: targetPnJid, isVideo });
        } catch {}
        call.on("ringing", () => {
            try { this.#sock.ev.emit("call.ringing", { callId, to: targetPnJid }); } catch {}
        });
        call.on("connected", () => {
            if (!this.#feeder) {
                this.#handleAudioCaptureStart();
            }
            if (isVideo) {
                startVideoHeartbeat();
            }
            try { this.#sock.ev.emit("call.connected", { callId, to: targetPnJid, isVideo }); } catch {}
        });
        call.on("ended", (reason) => {
            try { this.#sock.ev.emit("call.ended", { callId, to: targetPnJid, reason }); } catch {}
        });

        call.on("audio_tx", (pcm) => {
            this.#feeder?.pushChunk(pcm);
        });

        let videoHeartbeatInterval = null;
        let lastManualVideoTime = 0;

        const startVideoHeartbeat = () => {
            if (!isVideo || videoHeartbeatInterval) return;
            const blackFrame = Buffer.alloc(320 * 240 * 1.5);
            blackFrame.fill(16, 0, 320 * 240);
            blackFrame.fill(128, 320 * 240);

            videoHeartbeatInterval = setInterval(() => {
                if (this.#activeCall !== call || (call.state !== CallState.Active && call.state !== CallState.AcceptReceived)) {
                    if (call.state === CallState.Idle || call.state === CallState.Ending) {
                        clearInterval(videoHeartbeatInterval);
                        videoHeartbeatInterval = null;
                    }
                    return;
                }
                if (Date.now() - lastManualVideoTime > 250) {
                    this.#engine?.pushVideoFrame(blackFrame, 320, 240, 15, 0);
                }
            }, 66);
        };

        call.on("video_tx", ({ frameBuffer, width, height }) => {
            if ((call.state !== CallState.Active && call.state !== CallState.AcceptReceived) || call.isVideoPaused) return;
            lastManualVideoTime = Date.now();
            this.#engine?.pushVideoFrame(frameBuffer, width, height, 15, 0);
            call._emitVideoOut?.({ frameBuffer, width, height });
        });
        call.on("ended", async () => {
            if (callId) this.#signaling?.unregisterCall?.(callId);
            if (videoHeartbeatInterval) {
                clearInterval(videoHeartbeatInterval);
                videoHeartbeatInterval = null;
            }
            this.#handleAudioCaptureStop(true);
            try { this.#engine?.resetVideoUplink?.(); } catch {}
            try { this.#engine?.endCall(0, false); } catch {}
            await this.#relay?.closeAll?.();
            if (this.#activeCall === call) {
                this.#activeCall = null;
            }
        });

        this.#engine.startCall({
            peerJid: peerLid,
            peerPn: targetPnJid,
            peerList: deviceList,
            callId,
            isVideo,
            isLidCall: true,
            isFromDialer: false,
            extraData: tcToken,
        });

        return call;
    };

    acceptCall = async (callId, from, opts = {}) => {
        await this.init();
        if (this.#activeCall && this.#activeCall.callId.toLowerCase() !== String(callId).toLowerCase()) {
            throw new Error(`A different call is already active (${this.#activeCall.callId}).`);
        }
        const isVideo = Boolean(opts.isVideo);
        const durationMs = opts.durationMs ?? 180_000;
        const audioSource = opts.audioSource ?? "live";

        const targetNumber = String(from || "").replace(/\D/g, "");
        const targetPnJid = from?.includes("@") ? from : `${targetNumber}@s.whatsapp.net`;

        let call = this.#activeCall;
        if (!call) {
            call = new ActiveCall(callId, this.#engine, durationMs, isVideo);
            call.direction = "inbound";
            call._audioSource = audioSource;
            call.peer = { phoneNumber: targetNumber, pnJid: targetPnJid };
            call.caller = { pnJid: this.#sock?.user?.id ? toBareJid(this.#sock.user.id) : null, lidJid: this.#sock?.user?.lid || null, displayName: this.#sock?.user?.name || "Unity Chat" };
            call._setRelay(this.#relay);
            if (this.#feeder) call._setFeeder(this.#feeder);
            this.#activeCall = call;

            call.on("ringing", () => {
                try { this.#sock.ev.emit("call.ringing", { callId, to: targetPnJid }); } catch {}
            });
            call.on("connected", () => {
                if (!this.#feeder) {
                    this.#handleAudioCaptureStart();
                }
                if (isVideo) {
                    startVideoHeartbeat();
                }
                try { this.#sock.ev.emit("call.connected", { callId, to: targetPnJid, isVideo }); } catch {}
            });
            call.on("ended", (reason) => {
                try { this.#sock.ev.emit("call.ended", { callId, to: targetPnJid, reason }); } catch {}
            });

            call.on("audio_tx", (pcm) => {
                this.#feeder?.pushChunk(pcm);
            });

            let videoHeartbeatInterval = null;
            let lastManualVideoTime = 0;

            const startVideoHeartbeat = () => {
                if (!isVideo || videoHeartbeatInterval) return;
                const blackFrame = Buffer.alloc(320 * 240 * 1.5);
                blackFrame.fill(16, 0, 320 * 240);
                blackFrame.fill(128, 320 * 240);

                videoHeartbeatInterval = setInterval(() => {
                    if (this.#activeCall !== call || (call.state !== CallState.Active && call.state !== CallState.AcceptReceived)) {
                        if (call.state === CallState.Idle || call.state === CallState.Ending) {
                            clearInterval(videoHeartbeatInterval);
                            videoHeartbeatInterval = null;
                        }
                        return;
                    }
                    if (Date.now() - lastManualVideoTime > 250) {
                        this.#engine?.pushVideoFrame(blackFrame, 320, 240, 15, 0);
                    }
                }, 66);
            };

            call.on("video_tx", ({ frameBuffer, width, height }) => {
                if ((call.state !== CallState.Active && call.state !== CallState.AcceptReceived) || call.isVideoPaused) return;
                lastManualVideoTime = Date.now();
                this.#engine?.pushVideoFrame(frameBuffer, width, height, 15, 0);
                call._emitVideoOut?.({ frameBuffer, width, height });
            });
            call.on("ended", async () => {
                if (videoHeartbeatInterval) {
                    clearInterval(videoHeartbeatInterval);
                    videoHeartbeatInterval = null;
                }
                this.#handleAudioCaptureStop(true);
                try { this.#engine?.resetVideoUplink?.(); } catch {}
                try { this.#engine?.endCall(0, false); } catch {}
                await this.#relay?.closeAll?.();
                if (this.#activeCall === call) {
                    this.#activeCall = null;
                }
            });
        }

        // Delegate to WASM acceptCall
        this.#engine.acceptCall(callId, isVideo);
        return call;
    };

    rejectCall = async (callId, from, reason = 0) => {
        await this.init();
        try {
            this.#engine?.rejectCall(callId, typeof reason === "number" ? reason : 0);
        } catch {}
        if (this.#activeCall && (!callId || this.#activeCall.callId.toLowerCase() === String(callId).toLowerCase())) {
            this.#activeCall.end();
            this.#activeCall = null;
        }
    };

    clearActiveCall = async () => {
        const callId = this.#activeCall?.callId;
        if (callId) this.#signaling?.unregisterCall?.(callId);
        this.#handleAudioCaptureStop(true);
        try { this.#engine?.resetVideoUplink?.(); } catch {}
        try { this.#engine?.endCall(0, false); } catch {}
        await this.#relay?.closeAll?.();
        this.#activeCall = null;
    };

    destroy = () => {
        if (this.#destroyed) return;
        this.#destroyed = true;
        this.#handleAudioCaptureStop(true);
        this.#activeCall?._forceEnd("destroy");
        this.#activeCall = null;
        this.#relay?.closeAll();
        this.#engine?.destroy();
        this.#engine = null;
        this.#relay = null;
        this.#signaling = null;
    };

    #handleCallEvent = (eventType, eventData) => {
        console.log("[VoIP-Engine Event] type=" + eventType + ": " + (eventData ? eventData.slice(0, 160) : ""));
        if (eventType === 16 && eventData) {
            try {
                const parsed = JSON.parse(eventData);
                const info = parsed.call_info ?? parsed.callInfo ?? {};
                const callState = Number(info.call_state ?? info.callState ?? 0);
                const stateName = Object.keys(CallState).find(k => CallState[k] === callState) || ("Unknown(" + callState + ")");
                console.log("[VoIP-Engine State] call_state -> " + callState + " (" + stateName + ")");
                this.#activeCall?._updateState(callState);
            } catch {}
        } else if (eventType === 156 && eventData) {
            try {
                console.log("[VoIP-Engine] Relay list update received (event 156)");
                const update = JSON.parse(eventData);
                this.#relay?.updateRelayList(update);
            } catch {}
        } else if (eventType === 2) {
            console.log("[VoIP-Engine] Remote end received (event 2)");
            this.#activeCall?._forceEnd("remote_end");
        }
    };

    #handleAudioCaptureInit = (config) => {
        if (!this.#engine) return;
        this.#captureSampleRate = config.sampleRate || 16000;
        this.#captureChannels = config.channels || 1;
        this.#captureFramesPerChunk = config.framesPerChunk || 320;
        const chunkSamples = this.#captureFramesPerChunk * this.#captureChannels;
        this.#captureChunkBytes = chunkSamples * Float32Array.BYTES_PER_ELEMENT;
        if (!this.#capturePtr) {
            this.#capturePtr = this.#engine.malloc(this.#captureChunkBytes);
        }
    };

    #handleAudioCaptureStart = () => {
        if (!this.#engine) return;
        if (!this.#capturePtr) {
            const chunkSamples = (this.#captureFramesPerChunk || 320) * (this.#captureChannels || 1);
            this.#captureChunkBytes = chunkSamples * Float32Array.BYTES_PER_ELEMENT;
            this.#capturePtr = this.#engine.malloc(this.#captureChunkBytes);
        }
        if (!this.#capturePtr) return;
        const audioSource = this.#activeCall?._audioSource ?? "silence";
        if (this.#feeder) {
            console.log(`[VoIP] AudioFeeder already running, keeping active`);
            return;
        }
        this.#feeder = new AudioFeeder(
            this.#captureSampleRate || 16000,
            this.#captureChannels || 1,
            this.#captureFramesPerChunk || 320,
            (chunk) => {
                this.#activeCall?._emitAudioOut?.(chunk);
                if (this.#engine && this.#capturePtr) {
                    this.#engine.sendAudioData(chunk, this.#capturePtr);
                }
            },
            audioSource
        );
        this.#activeCall?._setFeeder(this.#feeder);
        this.#feeder.start();
        console.log(`[VoIP] AudioFeeder uplink running (source: ${audioSource})`);
    };

    #handleAudioCaptureStop = (force = false) => {
        if (!force && this.#activeCall && this.#activeCall.state !== CallState.Idle && this.#activeCall.state !== CallState.Ending) {
            console.log(`[VoIP] Ignoring stopCaptureJS while call is in progress! (callId: ${this.#activeCall.callId})`);
            return;
        }
        console.log("[VoIP] AudioFeeder stopped");
        this.#feeder?.stop();
        this.#feeder = null;
        // Keep this.#capturePtr allocated across calls for reuse
    };
}
