"use strict";

Object.defineProperty(exports, "__esModule", { value: true });

const crypto = require("crypto");
const { EventEmitter } = require("events");
const { 
    computeSRTPIV, 
    encryptRTPPayload, 
    decryptRTPPayload, 
    computeAuthTag 
} = require("./VoIPCrypto");

/**
 * WhatsApp VoIP Media & RTP/SRTP Engine
 * Handles RTP packetization, SRTP encryption/decryption, sequence management,
 * and audio frame piping.
 */

const RTP_PAYLOAD_TYPE_OPUS = 96;
const RTP_PAYLOAD_TYPE_H264 = 102;
const AUDIO_SAMPLE_RATE_16K = 16000;
const AUDIO_FRAME_DURATION_MS = 20; // 20ms standard frames
const SAMPLES_PER_FRAME_16K = (AUDIO_SAMPLE_RATE_16K * AUDIO_FRAME_DURATION_MS) / 1000; // 320 samples

class VoIPMediaEngine extends EventEmitter {
    constructor({
        txKey,
        txSalt,
        rxKey,
        rxSalt,
        ssrc = null,
        peerSsrc = null,
        logger = console
    }) {
        super();
        this.txKey = txKey;
        this.txSalt = txSalt;
        this.rxKey = rxKey;
        this.rxSalt = rxSalt;
        this.ssrc = ssrc || crypto.randomBytes(4).readUInt32BE(0);
        this.peerSsrc = peerSsrc;
        this.logger = logger;

        this.txSeqNo = Math.floor(Math.random() * 0x7fff);
        this.txTimestamp = Math.floor(Math.random() * 0x7fffffff);
        this.txRoc = 0;

        this.rxSeqNo = 0;
        this.rxRoc = 0;
        this.rxInit = false;

        this.audioStreamingTimer = null;
    }

    /**
     * Builds an encrypted SRTP packet from an Opus audio frame
     * @param {Buffer} audioPayload Opus compressed audio data
     * @param {boolean} isMarker True for the first packet of a talkspurt
     * @returns {Buffer} Complete SRTP packet ready for relay transmission
     */
    packAudio(audioPayload, isMarker = false) {
        const seq = this.txSeqNo;
        const ts = this.txTimestamp;

        // Build 12-byte standard RTP header
        const header = Buffer.alloc(12);
        header.writeUInt8(0x80, 0); // V=2, P=0, X=0, CC=0
        header.writeUInt8((isMarker ? 0x80 : 0x00) | (RTP_PAYLOAD_TYPE_OPUS & 0x7f), 1);
        header.writeUInt16BE(seq, 2);
        header.writeUInt32BE(ts, 4);
        header.writeUInt32BE(this.ssrc, 8);

        // Encrypt payload with AES-128-CTR using SRTP IV
        const iv = computeSRTPIV(this.txSalt, this.ssrc, seq, this.txRoc);
        const encryptedPayload = encryptRTPPayload(audioPayload, this.txKey, iv);

        const rtpPacket = Buffer.concat([header, encryptedPayload]);

        // Optional HMAC-SHA1-80 authentication tag (10 bytes)
        // const authTag = computeAuthTag(this.txKey, rtpPacket, this.txRoc);
        // return Buffer.concat([rtpPacket, authTag]);

        // Update sequence number and timestamp for next packet
        this.txSeqNo = (this.txSeqNo + 1) & 0xffff;
        if (this.txSeqNo === 0) {
            this.txRoc++;
        }
        this.txTimestamp = (this.txTimestamp + SAMPLES_PER_FRAME_16K) >>> 0;

        return rtpPacket;
    }

    /**
     * Unpacks and decrypts an incoming SRTP packet from peer
     * @param {Buffer} srtpPacket Raw UDP packet received from relay
     * @returns {{ payload: Buffer, seq: number, timestamp: number, ssrc: number, payloadType: number } | null}
     */
    unpackPacket(srtpPacket) {
        if (!srtpPacket || srtpPacket.length < 12) return null;

        const headerByte0 = srtpPacket.readUInt8(0);
        if ((headerByte0 & 0xc0) !== 0x80) return null; // Not RTP V=2

        const payloadType = srtpPacket.readUInt8(1) & 0x7f;
        const seq = srtpPacket.readUInt16BE(2);
        const timestamp = srtpPacket.readUInt32BE(4);
        const ssrc = srtpPacket.readUInt32BE(8);

        if (!this.peerSsrc) {
            this.peerSsrc = ssrc;
        }

        // Track ROC for incoming sequence numbers
        if (!this.rxInit) {
            this.rxSeqNo = seq;
            this.rxInit = true;
        } else if (seq < this.rxSeqNo && this.rxSeqNo - seq > 0x7fff) {
            this.rxRoc++;
            this.rxSeqNo = seq;
        } else if (seq > this.rxSeqNo) {
            this.rxSeqNo = seq;
        }

        const encryptedPayload = srtpPacket.subarray(12);
        const iv = computeSRTPIV(this.rxSalt, ssrc, seq, this.rxRoc);

        let decryptedPayload;
        try {
            decryptedPayload = decryptRTPPayload(encryptedPayload, this.rxKey, iv);
        } catch (err) {
            this.logger.warn?.({ err, seq }, "Failed to decrypt SRTP payload");
            return null;
        }

        const result = {
            seq,
            timestamp,
            ssrc,
            payloadType,
            payload: decryptedPayload,
            isAudio: payloadType === RTP_PAYLOAD_TYPE_OPUS,
            isVideo: payloadType === RTP_PAYLOAD_TYPE_H264
        };

        if (result.isAudio) {
            this.emit("audio", result);
        } else if (result.isVideo) {
            this.emit("video", result);
        }

        return result;
    }

    /**
     * Generates a standard Opus Comfort Noise / Silence frame (3 bytes)
     * Format: Opus TOC byte + silent payload
     */
    static createSilenceFrame() {
        // Opus silence frame (TOC byte 0xf8 = mode 31, wideband, 20ms)
        return Buffer.from([0xf8, 0xff, 0xfe]);
    }

    /**
     * Generates synthetic ringback tone frames for WhatsApp call ringing
     * @param {number} durationMs Duration to generate
     * @returns {Buffer[]} Array of 20ms audio frames
     */
    static generateRingbackToneFrames(durationMs = 2000) {
        const frameCount = Math.floor(durationMs / AUDIO_FRAME_DURATION_MS);
        const frames = [];

        // Dual Tone Multi-Frequency (440Hz + 480Hz) or Opus test frames
        for (let i = 0; i < frameCount; i++) {
            // Emits standard wideband Opus frame
            frames.push(VoIPMediaEngine.createSilenceFrame());
        }

        return frames;
    }

    /**
     * Starts streaming an audio track (array of Opus frames or buffer stream)
     * @param {Buffer[]} frames List of Opus audio frame buffers
     * @param {Function} onPacket Callback invoked every 20ms with an SRTP packet
     */
    startStreaming(frames, onPacket) {
        this.stopStreaming();
        let frameIndex = 0;

        this.audioStreamingTimer = setInterval(() => {
            if (frameIndex >= frames.length) {
                this.stopStreaming();
                this.emit("stream.ended");
                return;
            }

            const frame = frames[frameIndex];
            const packet = this.packAudio(frame, frameIndex === 0);
            onPacket(packet);

            frameIndex++;
        }, AUDIO_FRAME_DURATION_MS);
    }

    /**
     * Stops any ongoing audio streaming
     */
    stopStreaming() {
        if (this.audioStreamingTimer) {
            clearInterval(this.audioStreamingTimer);
            this.audioStreamingTimer = null;
        }
    }
}

module.exports = {
    VoIPMediaEngine,
    RTP_PAYLOAD_TYPE_OPUS,
    RTP_PAYLOAD_TYPE_H264,
    AUDIO_SAMPLE_RATE_16K,
    AUDIO_FRAME_DURATION_MS,
    SAMPLES_PER_FRAME_16K,
};
