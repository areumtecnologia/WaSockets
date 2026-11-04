"use strict";

Object.defineProperty(exports, "__esModule", { value: true });

const { EventEmitter } = require("events");
const { deriveVoIPKeys } = require("./VoIPCrypto");
const { VoIPRelayTransport } = require("./VoIPRelayTransport");
const { VoIPMediaEngine } = require("./VoIPMediaEngine");
const { buildAcceptStanza, buildRejectStanza, buildTerminateStanza } = require("./VoIPProtocol");

/**
 * Call States
 */
const CallState = {
    OFFERING: "offering",
    RINGING: "ringing",
    ACCEPTED: "accepted",
    CONNECTED: "connected",
    REJECTED: "rejected",
    TERMINATED: "terminated"
};

/**
 * WhatsApp VoIP Active Call Session
 */
class VoIPSession extends EventEmitter {
    constructor({
        callId,
        callCreator,
        peerJid,
        direction = "inbound", // "inbound" | "outbound"
        isVideo = false,
        callKey = null,
        relayEndpoints = [],
        socketClient,
        logger = console
    }) {
        super();
        this.callId = callId;
        this.callCreator = callCreator;
        this.peerJid = peerJid;
        this.direction = direction;
        this.isVideo = isVideo;
        this.callKey = callKey;
        this.relayEndpoints = relayEndpoints;
        this.socketClient = socketClient;
        this.logger = logger;

        this.state = direction === "inbound" ? CallState.RINGING : CallState.OFFERING;
        this.startTime = null;
        this.endTime = null;
        this.relayTransport = null;
        this.mediaEngine = null;
        this.derivedKeys = null;
        this.mediaStreamTimer = null;

        if (this.callKey) {
            this.initCrypto(this.callKey);
        }
    }

    /**
     * Dynamically adds or updates relay endpoints received from network stanzas
     */
    addRelayEndpoints(endpoints) {
        if (!endpoints || !endpoints.length) return;
        let added = 0;
        for (const ep of endpoints) {
            if (!this.relayEndpoints.some(e => e.ip === ep.ip && e.port === ep.port)) {
                this.relayEndpoints.push(ep);
                added++;
            }
        }
        if (added > 0) {
            this.logger.info?.({ count: this.relayEndpoints.length }, "Updated VoIP relay endpoints");
            if ((this.state === CallState.ACCEPTED || this.state === CallState.CONNECTED) && (!this.relayTransport || !this.relayTransport.isConnected)) {
                this.connectRelay().catch(err => {
                    this.logger.warn?.({ err: err?.message }, "Failed to connect relay on update");
                });
            }
        }
    }

    /**
     * Initializes SRTP keys derived from the 32-byte callKey
     */
    initCrypto(callKey) {
        this.callKey = Buffer.isBuffer(callKey) ? callKey : Buffer.from(callKey);
        this.derivedKeys = deriveVoIPKeys(this.callKey);

        // If we are the caller (outbound): TX = callerAudio, RX = calleeAudio
        // If we are the callee (inbound): TX = calleeAudio, RX = callerAudio
        const isCaller = this.direction === "outbound";
        const txKeys = isCaller ? this.derivedKeys.callerAudio : this.derivedKeys.calleeAudio;
        const rxKeys = isCaller ? this.derivedKeys.calleeAudio : this.derivedKeys.callerAudio;

        this.mediaEngine = new VoIPMediaEngine({
            txKey: txKeys.masterKey,
            txSalt: txKeys.masterSalt,
            rxKey: rxKeys.masterKey,
            rxSalt: rxKeys.masterSalt,
            logger: this.logger
        });

        // Forward media events
        this.mediaEngine.on("audio", (audioData) => this.emit("audio", audioData));
        this.mediaEngine.on("video", (videoData) => this.emit("video", videoData));
    }

    /**
     * Connects to the primary Meta relay server
     */
    async connectRelay() {
        if (!this.relayEndpoints || this.relayEndpoints.length === 0) {
            this.logger.warn?.({ callId: this.callId }, "No relay endpoints available, waiting for relay stanza");
            return;
        }

        const endpoint = this.relayEndpoints[0];
        this.logger.info?.({ endpoint }, "Connecting to WhatsApp VoIP Relay server");

        this.relayTransport = new VoIPRelayTransport({
            ip: endpoint.ip,
            port: endpoint.port,
            token: endpoint.token,
            logger: this.logger
        });

        // When receiving UDP packets from relay, route to media engine
        this.relayTransport.on("rtp", (rtpBuffer) => {
            if (this.mediaEngine) {
                this.mediaEngine.unpackPacket(rtpBuffer);
            }
        });

        this.relayTransport.on("relay.bound", () => {
            this.logger.info?.({ callId: this.callId }, "Relay session successfully bound and ready");
            this.setState(CallState.CONNECTED);
            this.startActiveMedia();
        });

        await this.relayTransport.connect();
    }

    /**
     * Starts continuous RTP comfort-noise transmission to open two-way relay media flow
     */
    startActiveMedia() {
        if (this.mediaStreamTimer) return;
        const silence = VoIPMediaEngine.createSilenceFrame();
        this.mediaStreamTimer = setInterval(() => {
            if (this.state !== CallState.CONNECTED || !this.relayTransport?.isConnected) {
                this.stopActiveMedia();
                return;
            }
            if (this.mediaEngine && this.relayTransport) {
                const srtpPacket = this.mediaEngine.packAudio(silence);
                this.relayTransport.sendRtp(srtpPacket);
            }
        }, 20);
    }

    /**
     * Stops continuous media stream
     */
    stopActiveMedia() {
        if (this.mediaStreamTimer) {
            clearInterval(this.mediaStreamTimer);
            this.mediaStreamTimer = null;
        }
    }

    /**
     * Answers an incoming WhatsApp call
     */
    async accept(options = {}) {
        if (this.state !== CallState.RINGING && this.state !== CallState.OFFERING) {
            throw new Error(`Cannot accept call in state: ${this.state}`);
        }

        this.setState(CallState.ACCEPTED);
        this.startTime = new Date();

        const meId = this.socketClient.authState?.creds?.me?.id;
        const meLid = this.socketClient.authState?.creds?.me?.lid;
        const isLid = (this.callCreator && this.callCreator.endsWith("@lid")) || (this.peerJid && this.peerJid.endsWith("@lid"));
        const myJid = (isLid && meLid) ? meLid : meId;

        // Build and send <call><accept> stanza
        const acceptStanza = buildAcceptStanza({
            callId: this.callId,
            callCreator: this.callCreator,
            myJid,
            isVideo: this.isVideo,
            audioRate: options.audioRate || "16000"
        });

        if (this.socketClient.sendNode) {
            await this.socketClient.sendNode(acceptStanza);
        } else {
            await this.socketClient.query(acceptStanza);
        }

        // Connect relay transport if endpoints exist
        if (this.relayEndpoints.length > 0) {
            await this.connectRelay();
        } else {
            this.setState(CallState.CONNECTED);
        }

        return this;
    }

    /**
     * Rejects an incoming WhatsApp call
     */
    async reject(reason = "0") {
        this.setState(CallState.REJECTED);
        this.cleanup();

        const myJid = this.socketClient.authState?.creds?.me?.id;
        const rejectStanza = buildRejectStanza({
            callId: this.callId,
            callCreator: this.callCreator,
            myJid,
            reason
        });

        if (this.socketClient.sendNode) {
            await this.socketClient.sendNode(rejectStanza);
        } else {
            await this.socketClient.query(rejectStanza);
        }
    }

    /**
     * Terminates (hangs up) an active WhatsApp call
     */
    async terminate(reason = "hangup") {
        this.setState(CallState.TERMINATED);
        this.cleanup();

        const myJid = this.socketClient.authState?.creds?.me?.id;
        const terminateStanza = buildTerminateStanza({
            callId: this.callId,
            callCreator: this.callCreator,
            myJid,
            reason
        });

        if (this.socketClient.sendNode) {
            await this.socketClient.sendNode(terminateStanza);
        } else {
            await this.socketClient.query(terminateStanza);
        }
    }

    /**
     * Sends a single Opus audio frame over the call
     * @param {Buffer} opusBuffer Opus compressed frame (20ms, 16kHz)
     * @param {boolean} isMarker True if start of talkspurt
     */
    sendAudio(opusBuffer, isMarker = false) {
        if (!this.mediaEngine || !this.relayTransport) return;
        const srtpPacket = this.mediaEngine.packAudio(opusBuffer, isMarker);
        this.relayTransport.sendRtp(srtpPacket);
    }

    /**
     * Streams an array of audio frames (TTS or recording)
     */
    streamAudio(frames) {
        if (!this.mediaEngine || !this.relayTransport) return;
        this.mediaEngine.startStreaming(frames, (packet) => {
            this.relayTransport?.sendRtp(packet);
        });
    }

    /**
     * Updates internal call state and emits state event
     */
    setState(newState) {
        const oldState = this.state;
        this.state = newState;
        this.emit("state", { from: oldState, to: newState });

        if (newState === CallState.TERMINATED || newState === CallState.REJECTED) {
            this.endTime = new Date();
            this.emit("ended", {
                durationSec: this.startTime ? Math.round((this.endTime - this.startTime) / 1000) : 0,
                reason: newState
            });
        }
    }

    /**
     * Cleans up media engines and network sockets
     */
    cleanup() {
        this.stopActiveMedia();
        if (this.mediaEngine) {
            this.mediaEngine.stopStreaming();
        }
        if (this.relayTransport) {
            this.relayTransport.close();
            this.relayTransport = null;
        }
    }
}

module.exports = {
    CallState,
    VoIPSession,
};
