/**
 * baileys-caller — WhatsApp voice calling for Node.js.
 *
 * Wraps WhatsApp Web's official VoIP WASM stack and routes signaling through
 * Baileys.
 *
 * @author ShellTear
 */
import { EventEmitter } from "node:events";
import type { Readable } from "node:stream";
import { WasmEngine } from "./wasm-engine.mjs";
import { CallState, type VoipSdkConfig, type CallRealtimeStats, type CallTelemetry, type VadOptions, type StreamOptions, type RecordOptions } from "./types.mjs";
export type { VoipSdkConfig, CallOptions, CallEvents, AudioConfig, CallRealtimeStats, CallTelemetry, VadOptions, StreamOptions, RecordOptions } from "./types.mjs";
export { CallState } from "./types.mjs";

/** A live or recently-ended call. */
export declare class ActiveCall extends EventEmitter {
    #private;
    readonly callId: string;
    private readonly engine: WasmEngine;
    readonly isVideo: boolean;
    peer: { phoneNumber: string; pnJid: string; lidJid: string } | null;
    caller: { pnJid: string | null; lidJid: string | null; displayName: string } | null;
    readonly direction: string;
    telemetry: CallTelemetry | null;
    /** @internal mirrors the source path for the audio feeder */
    _audioSource: string;

    constructor(callId: string, engine: WasmEngine, durationMs: number, isVideo?: boolean);
    get state(): CallState;
    get isVideoPaused(): boolean;

    end: () => void;
    mute: (muted: boolean) => void;
    waitForEnd: () => Promise<string>;

    pushAudio: (audioData: Float32Array | Int16Array | Buffer, options?: { sampleRate?: number }) => void;
    pushVideo: (frameBuffer: Buffer, width: number, height: number) => void;
    pushVideoRgba: (rgbaBuffer: Buffer, width: number, height: number) => void;

    getRxStream: (options?: StreamOptions) => Readable;
    getTxStream: (options?: StreamOptions) => Readable;
    recordToFile: (filePath: string, options?: RecordOptions) => any;
    stopRecording: () => void;

    setInputVolume: (gain: number) => void;
    setOutputVolume: (gain: number) => void;
    pauseAudio: () => void;
    resumeAudio: () => void;
    playFile: (filePath: string) => void;

    pauseVideo: () => void;
    resumeVideo: () => void;
    setVideoFps: (fps: number) => void;

    setVadOptions: (options?: VadOptions) => void;
    getStats: () => CallRealtimeStats;
    getTelemetry: () => CallTelemetry;

    /** @internal */
    _updateState: (state: number) => void;
    /** @internal */
    _emitAudio: (pcm: Float32Array) => void;
    /** @internal */
    _emitAudioOut: (pcm: Float32Array) => void;
    /** @internal */
    _emitVideo: (data: any) => void;
    /** @internal */
    _emitVideoOut: (data: any) => void;
    /** @internal */
    _forceEnd: (reason: string) => void;
}

/** Top-level client. Connects to WhatsApp and lets you place calls. */
export declare class VoipClient {
    #private;
    constructor(config: VoipSdkConfig);
    /** Connect to WhatsApp and bring up the WASM VoIP stack. */
    connect: () => Promise<void>;
    /** Place an outbound voice or video call. */
    call: (phoneNumber: string, opts?: {
        audioSource?: string;
        durationMs?: number;
        isVideo?: boolean;
    }) => Promise<ActiveCall>;
    /** Tear down the WhatsApp socket and release resources. */
    disconnect: () => void;
}
