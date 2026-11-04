/**
 * Audio feeder.
 *
 * Spawns ffmpeg to decode `source` into f32le PCM at the requested rate, then
 * meters frames out at chunk-cadence to the WASM uplink.
 *
 * @author ShellTear
 */
import { spawn } from "node:child_process";
const LOW_WATERMARK_CHUNKS = 16;
const MAX_QUEUED_CHUNKS = 1024;
const DEFAULT_WARMUP_MS = 500;

export class AudioFeeder {
    sampleRate;
    channels;
    framesPerChunk;
    onChunk;
    source;
    #proc = null;
    #pending = Buffer.alloc(0);
    #queue = [];
    #emitTimer = null;
    #nextEmitAtMs = 0;
    #warmupUntilMs = 0;
    #paused = false;
    #volume = 1.0;

    droppedChunks = 0;
    underflowChunks = 0;
    bytesProduced = 0;
    chunksEmitted = 0;

    constructor(sampleRate, channels, framesPerChunk, onChunk, source = "silence") {
        this.sampleRate = sampleRate;
        this.channels = channels;
        this.framesPerChunk = framesPerChunk;
        this.onChunk = onChunk;
        this.source = source;
    }

    start = () => {
        if (this.#proc || this.#emitTimer)
            return;
        const chunkSamples = this.framesPerChunk * this.channels;
        const chunkBytes = chunkSamples * Float32Array.BYTES_PER_ELEMENT;
        const chunkIntervalMs = (this.framesPerChunk / this.sampleRate) * 1000;
        
        if (!this.source || this.source === "silence" || this.source === "live") {
            const silentChunk = new Float32Array(chunkSamples);
            for (let i = 0; i < chunkSamples; i++) { silentChunk[i] = (Math.random() - 0.5) * 1e-4; }
            this.#emitTimer = setInterval(() => {
                this.chunksEmitted += 1;
                const nextChunk = (!this.#paused ? this.#queue.shift() : null) || silentChunk;
                this.onChunk(this.#applyVolume(nextChunk));
            }, chunkIntervalMs);
            return;
        }

        this.#spawnFfmpeg(chunkSamples, chunkBytes, chunkIntervalMs);
    };

    stop = () => {
        if (this.#emitTimer) {
            clearInterval(this.#emitTimer);
            clearTimeout(this.#emitTimer);
            this.#emitTimer = null;
        }
        this.#proc?.kill("SIGTERM");
        this.#proc = null;
        this.#pending = Buffer.alloc(0);
        this.#queue = [];
        this.#warmupUntilMs = 0;
    };

    pause = () => {
        this.#paused = true;
    };

    resume = () => {
        this.#paused = false;
    };

    setVolume = (gain) => {
        this.#volume = Math.max(0, Number(gain) || 1.0);
    };

    clearQueue = () => {
        this.#queue = [];
        this.#pending = Buffer.alloc(0);
    };

    pushChunk = (chunk) => {
        if (chunk && chunk.length && this.#queue.length < 50) {
            this.#queue.push(chunk);
        }
    };

    playFile = (filePath) => {
        if (this.#proc) {
            this.#proc.kill("SIGTERM");
            this.#proc = null;
        }
        this.clearQueue();
        this.source = filePath;

        const chunkSamples = this.framesPerChunk * this.channels;
        const chunkBytes = chunkSamples * Float32Array.BYTES_PER_ELEMENT;
        const chunkIntervalMs = (this.framesPerChunk / this.sampleRate) * 1000;

        // If interval is already active, spawn ffmpeg to feed into #queue
        if (this.#emitTimer) {
            const inputArgs = this.#resolveInputArgs();
            this.#proc = spawn("ffmpeg", [
                "-hide_banner",
                "-loglevel", "error",
                "-thread_queue_size", "512",
                ...inputArgs,
                "-f", "f32le",
                "-ac", String(this.channels),
                "-ar", String(this.sampleRate),
                "pipe:1",
            ]);
            this.#setupProcHandlers(chunkSamples, chunkBytes);
        } else {
            this.#spawnFfmpeg(chunkSamples, chunkBytes, chunkIntervalMs);
        }
    };

    getStats = () => ({
        droppedChunks: this.droppedChunks,
        underflowChunks: this.underflowChunks,
        bytesProduced: this.bytesProduced,
        chunksEmitted: this.chunksEmitted,
        queueLength: this.#queue.length,
        isPaused: this.#paused,
        volume: this.#volume
    });

    #applyVolume = (chunk) => {
        if (this.#volume === 1.0 || !chunk) return chunk;
        const out = new Float32Array(chunk.length);
        for (let i = 0; i < chunk.length; i++) {
            out[i] = Math.max(-1, Math.min(1, chunk[i] * this.#volume));
        }
        return out;
    };

    #spawnFfmpeg = (chunkSamples, chunkBytes, chunkIntervalMs) => {
        const inputArgs = this.#resolveInputArgs();
        this.#proc = spawn("ffmpeg", [
            "-hide_banner",
            "-loglevel", "error",
            "-thread_queue_size", "512",
            ...inputArgs,
            "-f", "f32le",
            "-ac", String(this.channels),
            "-ar", String(this.sampleRate),
            "pipe:1",
        ]);
        this.#setupProcHandlers(chunkSamples, chunkBytes);
        this.#nextEmitAtMs = 0;
        this.#warmupUntilMs = Date.now() + DEFAULT_WARMUP_MS;
        this.#scheduleNext(chunkSamples, chunkIntervalMs);
    };

    #setupProcHandlers = (chunkSamples, chunkBytes) => {
        this.#proc.stdout.on("data", (chunk) => {
            this.#pending = Buffer.concat([this.#pending, chunk]);
            while (this.#pending.length >= chunkBytes) {
                if (this.#queue.length >= MAX_QUEUED_CHUNKS) {
                    this.#proc?.stdout.pause();
                    break;
                }
                const frame = this.#pending.subarray(0, chunkBytes);
                this.#pending = this.#pending.subarray(chunkBytes);
                const out = new Float32Array(chunkSamples);
                out.set(new Float32Array(frame.buffer, frame.byteOffset, chunkSamples));
                this.bytesProduced += chunkBytes;
                this.#queue.push(out);
            }
        });
        this.#proc.stderr.on("data", (chunk) => {
            process.stderr.write(`[AudioFeeder] ${chunk.toString().trim()}\n`);
        });
        this.#proc.on("exit", (code) => {
            if (code !== 0 && code !== null) {
                process.stderr.write(`[AudioFeeder] ffmpeg exited with code=${code}\n`);
            }
            this.#proc = null;
        });
    };

    #resolveInputArgs = () => {
        if (!this.source || this.source === "silence") {
            return ["-f", "lavfi", "-i", `aevalsrc=0:d=3600:s=${this.sampleRate}`];
        }
        if (this.source.startsWith("lavfi:")) {
            return ["-f", "lavfi", "-i", this.source.slice("lavfi:".length)];
        }
        return ["-i", this.source];
    };

    #scheduleNext = (chunkSamples, chunkIntervalMs) => {
        if (!this.#proc && this.#queue.length === 0) {
            // Keep timer running with silence keepalives if proc exited
            this.#emitTimer = setTimeout(() => {
                this.#flushOne(chunkSamples);
                this.#scheduleNext(chunkSamples, chunkIntervalMs);
            }, chunkIntervalMs);
            return;
        }
        const now = Date.now();
        if (this.#nextEmitAtMs === 0)
            this.#nextEmitAtMs = now;
        const delayMs = Math.max(0, this.#nextEmitAtMs - now);
        this.#emitTimer = setTimeout(() => {
            this.#emitTimer = null;
            if (this.#queue.length < LOW_WATERMARK_CHUNKS && Date.now() < this.#warmupUntilMs) {
                this.#nextEmitAtMs = Date.now() + 10;
                this.#scheduleNext(chunkSamples, chunkIntervalMs);
                return;
            }
            this.#flushOne(chunkSamples);
            this.#nextEmitAtMs += chunkIntervalMs;
            this.#scheduleNext(chunkSamples, chunkIntervalMs);
        }, delayMs);
    };

    #flushOne = (chunkSamples) => {
        let nextChunk = !this.#paused ? this.#queue.shift() : null;
        if (!nextChunk) {
            nextChunk = new Float32Array(chunkSamples);
            for (let i = 0; i < chunkSamples; i++) { nextChunk[i] = (Math.random() - 0.5) * 1e-4; }
            this.underflowChunks += 1;
        }
        this.chunksEmitted += 1;
        this.onChunk(this.#applyVolume(nextChunk));
        if (this.#proc?.stdout.isPaused() && this.#queue.length <= MAX_QUEUED_CHUNKS / 4) {
            this.#proc.stdout.resume();
        }
    };
}
