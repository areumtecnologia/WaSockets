"use strict";

Object.defineProperty(exports, "__esModule", { value: true });

/**
 * VoIP Socket Mixin for WaSockets
 * Extends the unified 'sock' instance with direct WebAssembly WhatsApp calling
 */
const makeVoipSocket = (config, baseSocket) => {
    let voipEngine = null;
    let enginePromise = null;

    const getVoipEngine = async () => {
        if (voipEngine) return voipEngine;
        if (enginePromise) return enginePromise;

        enginePromise = (async () => {
            const { VoipEngine } = await import("../VoIP/engine/index.mjs");
            const engine = new VoipEngine(baseSocket, config.voip && typeof config.voip === "object" ? config.voip : {});
            await engine.init();
            voipEngine = engine;
            return engine;
        })();

        return enginePromise;
    };

    // Auto-init eagerly whenever VoIP is enabled (boolean true or object with autoInit !== false)
    const shouldAutoInit = config.voip === true || (typeof config.voip === "object" && config.voip?.autoInit !== false);
    if (shouldAutoInit) {
        getVoipEngine().catch(err => {
            config.logger?.warn?.({ err: err?.message }, "Failed to eagerly auto-init VoIP engine");
        });
    }

    // Intercept socket end to clean up VoIP worker threads cleanly
    const originalEnd = baseSocket.end ? baseSocket.end.bind(baseSocket) : undefined;
    baseSocket.end = (error) => {
        try {
            voipEngine?.destroy?.();
        } catch {}
        return originalEnd ? originalEnd(error) : undefined;
    };

    return {
        ...baseSocket,

        /**
         * Place an outbound WhatsApp VoIP call (voice or video)
         * @param phoneNumber Destination phone number or JID
         * @param options Call options (durationMs, isVideo, audioSource)
         * @returns ActiveCall instance
         */
        call: async (phoneNumber, options = {}) => {
            const engine = await getVoipEngine();
            return engine.startCall(phoneNumber, options);
        },

        /**
         * Place an outbound WhatsApp video call
         * @param phoneNumber Destination phone number or JID
         * @param options Call options
         * @returns ActiveCall instance
         */
        callVideo: async (phoneNumber, options = {}) => {
            const engine = await getVoipEngine();
            return engine.startCall(phoneNumber, { ...options, isVideo: true });
        },

        /**
         * Currently active call on this socket, or null if idle
         */
        get activeCall() {
            return voipEngine?.activeCall || null;
        },

        /**
         * Clears any active call state to allow a new call
         */
        clearActiveCall: () => {
            voipEngine?.clearActiveCall?.();
        },

        /**
         * Accept an incoming WhatsApp call (voice or video) via WebAssembly VoIP stack
         * @param callId Unique Call ID from offer
         * @param from Caller JID or phone number
         * @param options Call options (isVideo, audioSource)
         * @returns ActiveCall instance
         */
        acceptCall: async (callId, from, options = {}) => {
            const engine = await getVoipEngine();
            return engine.acceptCall(callId, from, options);
        },

        /**
         * Answer an incoming call (alias for acceptCall)
         */
        answerCall: async (callId, from, options = {}) => {
            const engine = await getVoipEngine();
            return engine.acceptCall(callId, from, options);
        },

        /**
         * Reject an incoming call
         */
        rejectCall: async (callId, from, reason = 0) => {
            const engine = await getVoipEngine();
            return engine.rejectCall(callId, from, reason);
        },

        /**
         * Low-level VoIP engine controller
         */
        voip: {
            getEngine: getVoipEngine,
            destroy: () => voipEngine?.destroy?.()
        }
    };
};

exports.makeVoipSocket = makeVoipSocket;

