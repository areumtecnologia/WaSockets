/// <reference types="node" />

export interface WavHeaderOptions {
    sampleRate?: number;
    numChannels?: number;
    bitDepth?: number;
    dataByteLength?: number;
}

export interface AudioMetrics {
    rms: number;
    volumeDbfs: number;
}

export declare function float32ToInt16(float32: Float32Array, asBuffer?: false): Int16Array;
export declare function float32ToInt16(float32: Float32Array, asBuffer: true): Buffer;
export declare function float32ToInt16(float32: Float32Array, asBuffer?: boolean): Int16Array | Buffer;

export declare function int16ToFloat32(int16OrBuffer: Int16Array | Buffer | Uint8Array): Float32Array;

export declare function resampleFloat32(inputSamples: Float32Array, fromRate: number, toRate: number): Float32Array;

export declare function createWavHeader(options?: WavHeaderOptions): Buffer;

export declare function calculateRmsDbfs(float32: Float32Array): AudioMetrics;

export declare function createSilenceBuffer(durationMs: number, sampleRate?: number): Float32Array;

