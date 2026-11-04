"use strict";

/**
 * Pure, zero-dependency audio DSP and format conversion utilities for WaSockets VoIP
 */

/**
 * Converts a Float32Array (-1.0 to 1.0) to 16-bit signed PCM (Int16Array or Buffer)
 * @param {Float32Array} float32 Samples normalized between -1.0 and 1.0
 * @param {boolean} [asBuffer=false] Whether to return a Node.js Buffer instead of Int16Array
 * @returns {Int16Array|Buffer} 16-bit PCM samples
 */
function float32ToInt16(float32, asBuffer = false) {
    const len = float32.length;
    const int16 = new Int16Array(len);
    for (let i = 0; i < len; i++) {
        const s = Math.max(-1, Math.min(1, float32[i]));
        int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    if (asBuffer) {
        return Buffer.from(int16.buffer, int16.byteOffset, int16.byteLength);
    }
    return int16;
}

/**
 * Converts a 16-bit signed PCM (Int16Array or Buffer) to Float32Array (-1.0 to 1.0)
 * @param {Int16Array|Buffer|Uint8Array} int16OrBuffer
 * @returns {Float32Array}
 */
function int16ToFloat32(int16OrBuffer) {
    let int16;
    if (int16OrBuffer instanceof Int16Array) {
        int16 = int16OrBuffer;
    } else {
        const buf = Buffer.isBuffer(int16OrBuffer) ? int16OrBuffer : Buffer.from(int16OrBuffer);
        int16 = new Int16Array(buf.buffer, buf.byteOffset, Math.floor(buf.byteLength / 2));
    }
    const len = int16.length;
    const float32 = new Float32Array(len);
    for (let i = 0; i < len; i++) {
        float32[i] = int16[i] / 32768.0;
    }
    return float32;
}

/**
 * Fast linear interpolation resampler for PCM audio
 * @param {Float32Array} inputSamples Mono Float32Array samples
 * @param {number} fromRate Source sample rate (e.g. 16000)
 * @param {number} toRate Destination sample rate (e.g. 8000, 24000, 48000)
 * @returns {Float32Array} Resampled Float32Array
 */
function resampleFloat32(inputSamples, fromRate, toRate) {
    if (fromRate === toRate || inputSamples.length === 0) {
        return new Float32Array(inputSamples);
    }
    const ratio = fromRate / toRate;
    const outputLength = Math.round(inputSamples.length / ratio);
    const output = new Float32Array(outputLength);

    for (let i = 0; i < outputLength; i++) {
        const srcPos = i * ratio;
        const index = Math.floor(srcPos);
        const frac = srcPos - index;

        const s0 = inputSamples[index] ?? 0;
        const s1 = inputSamples[index + 1] ?? s0;
        output[i] = s0 + frac * (s1 - s0);
    }
    return output;
}

/**
 * Creates a standard 44-byte RIFF/WAVE header
 * @param {Object} options
 * @param {number} [options.sampleRate=16000]
 * @param {number} [options.numChannels=1]
 * @param {number} [options.bitDepth=16]
 * @param {number} [options.dataByteLength=0]
 * @returns {Buffer}
 */
function createWavHeader({ sampleRate = 16000, numChannels = 1, bitDepth = 16, dataByteLength = 0 } = {}) {
    const header = Buffer.alloc(44);
    const byteRate = (sampleRate * numChannels * bitDepth) / 8;
    const blockAlign = (numChannels * bitDepth) / 8;
    const chunkSize = 36 + dataByteLength;

    // RIFF chunk descriptor
    header.write("RIFF", 0);
    header.writeUInt32LE(chunkSize, 4);
    header.write("WAVE", 8);

    // "fmt " sub-chunk
    header.write("fmt ", 12);
    header.writeUInt32LE(16, 16); // Subchunk1Size for PCM
    header.writeUInt16LE(1, 20);  // AudioFormat 1 = PCM
    header.writeUInt16LE(numChannels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(byteRate, 28);
    header.writeUInt16LE(blockAlign, 32);
    header.writeUInt16LE(bitDepth, 34);

    // "data" sub-chunk
    header.write("data", 36);
    header.writeUInt32LE(dataByteLength, 40);

    return header;
}

/**
 * Calculates Root Mean Square (RMS) and volume level in dBFS
 * @param {Float32Array} float32
 * @returns {{ rms: number, volumeDbfs: number }}
 */
function calculateRmsDbfs(float32) {
    let sum = 0;
    const len = float32.length;
    if (len === 0) return { rms: 0, volumeDbfs: -100 };

    for (let i = 0; i < len; i++) {
        sum += float32[i] * float32[i];
    }
    const rms = Math.sqrt(sum / len);
    const volumeDbfs = rms > 0.00001 ? Math.round(20 * Math.log10(rms)) : -100;
    return { rms, volumeDbfs };
}

/**
 * Creates a silent audio frame (Float32Array) of specified duration
 * @param {number} durationMs Duration in milliseconds
 * @param {number} [sampleRate=16000] Sample rate in Hz
 * @returns {Float32Array}
 */
function createSilenceBuffer(durationMs, sampleRate = 16000) {
    const totalSamples = Math.floor((durationMs / 1000) * sampleRate);
    return new Float32Array(totalSamples);
}

module.exports = {
    float32ToInt16,
    int16ToFloat32,
    resampleFloat32,
    createWavHeader,
    calculateRmsDbfs,
    createSilenceBuffer
};

