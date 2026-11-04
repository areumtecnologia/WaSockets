"use strict";

Object.defineProperty(exports, "__esModule", { value: true });

const crypto = require("crypto");
const { EventEmitter } = require("events");
const { VoIPSession, CallState } = require("./VoIPSession");
const { 
    buildOfferStanza, 
    buildRelayQueryIq, 
    parseRelayEndpoints, 
    parseCallNode 
} = require("./VoIPProtocol");
const { 
    jidEncode, 
    jidDecode, 
    jidNormalizedUser,
    areJidsSameUser,
    S_WHATSAPP_NET 
} = require("../WABinary");
const { encodeSignedDeviceIdentity, unpadRandomMax16 } = require("../Utils");
const { proto } = require("../../WAProto");

/**
 * WhatsApp VoIP Manager
 * High-level coordinator for direct WhatsApp VoIP calling in WaSockets
 */
class VoIPManager extends EventEmitter {
    constructor(sock, options = {}) {
        super();
        this.sock = sock;
        this.options = options;
        this.logger = sock.logger || console;
        this.activeSessions = new Map();
        this.cachedRelayEndpoints = [];
        this.lastRelayFetchTime = 0;

        this.initListeners();
    }

    /**
     * Initializes listeners for WhatsApp call events and stanzas
     */
    initListeners() {
        // Listen to WaSockets 'call' events
        this.sock.ev.on("call", async (callEvents) => {
            for (const callEvent of callEvents) {
                await this.handleCallEvent(callEvent);
            }
        });

        // Listen to receipt for offer delivery / remote ringing
        if (this.sock.ws) {
            this.sock.ws.on("CB:receipt", (node) => {
                const children = node.content || [];
                const hasOffer = Array.isArray(children) && children.some(c => c?.tag === "offer");
                const isRinging = node.attrs?.type === "ringing" || hasOffer;
                if (isRinging) {
                    for (const session of this.activeSessions.values()) {
                        if (session.state === CallState.OFFERING) {
                            console.log(`[VoIPManager] Peer device confirmed call offer / ringing for call ${session.callId}`);
                            session.setState(CallState.RINGING);
                        }
                    }
                }
            });
        }
    }

    /**
     * Handles an incoming call event from WaSockets
     */
    async handleCallEvent(callEvent) {
        const { id: callId, from, chatId, status, isVideo, rawNode, infoNode } = callEvent;

        this.logger.info?.({ callId, from, status, isVideo, reason: infoNode?.attrs?.reason }, "VoIPManager handling call event");
        console.log(`[VoIPManager] Call Event: ${callId} -> status=${status}, from=${from}, reason=${infoNode?.attrs?.reason || 'none'}`);

        // 1. Check for Meta VoIP relay endpoints in the stanza (pushed as <relay> or <relaylatency> with <te> nodes)
        if (rawNode) {
            const relayEndpoints = parseRelayEndpoints(rawNode);
            if (relayEndpoints.length > 0) {
                console.log(`[VoIPManager] Received ${relayEndpoints.length} relay endpoint(s) for call ${callId}:`, relayEndpoints.map(e => `${e.ip}:${e.port}`));
                this.cachedRelayEndpoints = relayEndpoints;
                const session = this.activeSessions.get(callId);
                if (session) {
                    session.addRelayEndpoints(relayEndpoints);
                }
            }
        }

        if (status === "offer") {
            try {
                // Attempt to extract or decrypt callKey from raw offer node if available
                let callKey = null;
                if (rawNode) {
                    const senderDeviceJid = rawNode.attrs?.from || from;
                    callKey = await this.extractCallKeyFromOffer(rawNode, senderDeviceJid);
                }

                // If no key extracted, generate fallback or wait for key negotiation
                if (!callKey) {
                    this.logger.warn?.({ callId }, "Could not decrypt destination callKey, using fallback");
                    callKey = crypto.randomBytes(32);
                } else {
                    console.log(`[VoIPManager] Successfully decrypted 32-byte callKey for incoming call ${callId}!`);
                }

                const meId = this.sock.authState?.creds?.me?.id;
                const meLid = this.sock.authState?.creds?.me?.lid;
                const isLidCall = (from && from.endsWith("@lid")) || (chatId && chatId.endsWith("@lid"));
                const myCalleeJid = isLidCall && meLid ? meLid : meId;

                const session = new VoIPSession({
                    callId,
                    callCreator: from,
                    peerJid: chatId || from,
                    myJid: myCalleeJid,
                    direction: "inbound",
                    isVideo: !!isVideo,
                    callKey,
                    relayEndpoints: this.cachedRelayEndpoints,
                    socketClient: this.sock,
                    logger: this.logger
                });

                this.activeSessions.set(callId, session);

                session.on("ended", () => {
                    this.activeSessions.delete(callId);
                });

                this.emit("call.incoming", session);
                this.emit("call", session);
            } catch (err) {
                this.logger.error?.({ err, callId }, "Error processing incoming VoIP call offer");
            }
        } else if (status === "ringing" || status === "ring") {
            const session = this.activeSessions.get(callId);
            if (session && session.state === CallState.OFFERING) {
                session.setState(CallState.RINGING);
            }
        } else if (status === "accept") {
            const session = this.activeSessions.get(callId);
            if (session && session.direction === "outbound") {
                console.log(`[VoIPManager] Outbound call ${callId} accepted by peer!`);
                session.setState(CallState.ACCEPTED);
                if (session.relayEndpoints.length > 0) {
                    await session.connectRelay();
                } else {
                    session.setState(CallState.CONNECTED);
                }
            }
        } else if (status === "terminate" || status === "reject" || status === "timeout") {
            const session = this.activeSessions.get(callId);
            if (session) {
                const reason = infoNode?.attrs?.reason || status;
                console.log(`[VoIPManager] Call ${callId} ended: ${status} (reason: ${reason})`);
                session.setState(status === "reject" ? CallState.REJECTED : CallState.TERMINATED);
                session.cleanup();
                this.activeSessions.delete(callId);
            }
        }
    }

    /**
     * Extracts and decrypts the callKey from incoming offer destination nodes
     */
    async extractCallKeyFromOffer(offerNode, callerJid) {
        try {
            const parsed = parseCallNode(offerNode);
            if (!parsed || !parsed.destinations || parsed.destinations.length === 0) {
                return null;
            }

            const meId = this.sock.authState?.creds?.me?.id;
            const meLid = this.sock.authState?.creds?.me?.lid;
            const myPnUser = meId ? jidDecode(meId)?.user : null;
            const myLidUser = meLid ? jidDecode(meLid)?.user : null;

            console.log(`[VoIPManager] Searching destination nodes for own identity (meId=${meId}, meLid=${meLid})...`);

            // Find destination node targeting this client's user/device (PN or LID)
            for (const destNode of parsed.destinations) {
                const targetJid = destNode.attrs?.jid;
                const targetUser = targetJid ? jidDecode(targetJid)?.user : null;
                const isMatch = (parsed.destinations.length === 1) || (targetJid === meId || targetJid === meLid || targetUser === myPnUser || (myLidUser && targetUser === myLidUser));

                if (isMatch) {
                    console.log(`[VoIPManager] Found matching destination node for ${targetJid || 'direct'}!`);
                    const encNode = destNode.tag === "enc" ? destNode : destNode.content?.find?.(c => c.tag === "enc");
                    if (encNode && (encNode.content instanceof Uint8Array || Buffer.isBuffer(encNode.content))) {
                        const ciphertext = Buffer.from(encNode.content);
                        const decryptJid = callerJid;
                        console.log(`[VoIPManager] Decrypting Signal payload from ${decryptJid} (type: ${encNode.attrs?.type || 'pkmsg'})...`);

                        const decrypted = await this.sock.signalRepository?.decryptMessage?.({
                            jid: decryptJid,
                            type: encNode.attrs?.type || "pkmsg",
                            ciphertext
                        });

                        if (decrypted) {
                            try {
                                const unpadded = unpadRandomMax16(decrypted);
                                const decodedMsg = proto.Message.decode(unpadded);
                                if (decodedMsg?.call?.callKey) {
                                    return Buffer.from(decodedMsg.call.callKey);
                                }
                            } catch (decodeErr) {
                                console.warn(`[VoIPManager] Protobuf decode fallback:`, decodeErr?.message);
                                if (decrypted.length >= 32) {
                                    return Buffer.from(decrypted.subarray(0, 32));
                                }
                            }
                        }
                    }
                }
            }
        } catch (err) {
            this.logger.debug?.({ err: err?.message }, "Could not decrypt destination callKey, using fallback");
            console.warn(`[VoIPManager] extractCallKeyFromOffer error:`, err?.message);
        }
        return null;
    }

    /**
     * Queries Meta VoIP relay tokens and server endpoints
     */
    async getRelayEndpoints(forceRefresh = false) {
        const now = Date.now();
        // Cache endpoints for 10 minutes
        if (!forceRefresh && this.cachedRelayEndpoints.length > 0 && now - this.lastRelayFetchTime < 600000) {
            return this.cachedRelayEndpoints;
        }

        try {
            const iq = buildRelayQueryIq();
            const result = await this.sock.query(iq, 2000);
            const endpoints = parseRelayEndpoints(result);

            if (endpoints.length > 0) {
                this.cachedRelayEndpoints = endpoints;
                this.lastRelayFetchTime = now;
                this.logger.info?.({ count: endpoints.length }, "Retrieved Meta VoIP Relay endpoints");
            }

            return this.cachedRelayEndpoints;
        } catch (err) {
            this.logger.debug?.({ err: err?.message }, "Relay query skipped, continuing with direct/pushed relay mode");
            return this.cachedRelayEndpoints;
        }
    }

    /**
     * Initiates an outgoing WhatsApp VoIP call
     * @param {string} toJid Target WhatsApp user JID or phone number
     * @param {object} options Calling options { isVideo: boolean, audioRate: string }
     * @returns {Promise<VoIPSession>} Active call session
     */
    async startCall(toJid, options = {}) {
        const isVideo = !!options.isVideo;
        const callId = crypto.randomBytes(16).toString("hex").toUpperCase().substring(0, 64);
        const callKey = crypto.randomBytes(32);
        const myJid = this.sock.authState?.creds?.me?.id;
        const myLid = this.sock.authState?.creds?.me?.lid;

        // Normalize destination number to phone-number JID (s.whatsapp.net) for proper contact recognition
        let resolvedJid = toJid;
        const cleanNumber = resolvedJid.replace(/\D/g, "");
        try {
            if (resolvedJid.endsWith("@lid")) {
                // Keep explicitly requested LID
            } else {
                if (this.sock.onWhatsApp) {
                    const [waCheck] = await this.sock.onWhatsApp(cleanNumber);
                    if (waCheck && waCheck.exists && waCheck.jid) {
                        resolvedJid = waCheck.jid;
                    }
                }
                if (!resolvedJid.includes("@")) {
                    resolvedJid = `${cleanNumber}@s.whatsapp.net`;
                }
            }
        } catch (_) {
            if (!resolvedJid.includes("@")) {
                resolvedJid = `${cleanNumber}@s.whatsapp.net`;
            }
        }

        const isLidTarget = resolvedJid.endsWith("@lid");
        const callerJid = (isLidTarget && myLid) ? myLid : myJid;
        const callerCreator = jidNormalizedUser(callerJid);
        const ownSyncJid = isLidTarget && myLid ? jidNormalizedUser(myLid) : jidNormalizedUser(myJid);

        this.logger.info?.({ toJid: resolvedJid, callerJid, callId, isVideo }, "Initiating outgoing WhatsApp VoIP call");
        console.log(`\n[VoIP DEBUG] Step 1: Starting VoIP call to ${resolvedJid} (callId: ${callId}, isVideo: ${isVideo}, caller: ${callerJid})`);

        // 1. Fetch recipient devices ONLY (1:1 call offers must not include caller devices)
        let devices = [];
        try {
            const syncResult = await this.sock.getUSyncDevices([resolvedJid], true, false);
            if (Array.isArray(syncResult) && syncResult.length > 0) {
                devices = syncResult.map(item => {
                    if (item.jid) return item.jid;
                    const server = item.server || (isLidTarget ? "lid" : "s.whatsapp.net");
                    return jidEncode(item.user, server, item.device);
                });
            }
        } catch (err) {
            this.logger.warn?.({ err: err?.message }, "Could not fetch USync devices");
        }

        if (!devices.length) {
            devices = [resolvedJid];
        }

        // Callee devices only: strictly filter out any device belonging to the caller
        devices = [...new Set(devices)].filter(d => !areJidsSameUser(d, myJid) && (!myLid || !areJidsSameUser(d, myLid)));

        // For WhatsApp calls, include all callee devices in destination nodes
        const targetDevices = devices;
        console.log(`[VoIP DEBUG] Step 2: Target devices: ${targetDevices.join(", ")}`);

        try {
            await this.sock.assertSessions(targetDevices, false);
            console.log(`[VoIP DEBUG] Step 3: Asserted Signal sessions for ${targetDevices.length} devices`);
        } catch (err) {
            console.warn(`[VoIP DEBUG] Step 3 Warning: Could not assert sessions:`, err?.message);
        }

        // 2. Encrypt callKey for target device using Signal
        let destinations = [];
        let shouldIncludeDeviceIdentity = false;

        try {
            const partResult = await this.sock.createParticipantNodes(
                targetDevices,
                { call: { callKey: new Uint8Array(callKey) } },
                { count: "0" }
            );
            destinations = partResult.nodes;
            shouldIncludeDeviceIdentity = partResult.shouldIncludeDeviceIdentity;
            console.log(`[VoIP DEBUG] Step 4: Encrypted callKey into destination node(s)`);
        } catch (err) {
            console.warn(`[VoIP DEBUG] Step 4 Warning: Could not create participant nodes:`, err?.message);
        }

        let deviceIdentity = null;
        if (this.sock.authState?.creds?.account) {
            deviceIdentity = encodeSignedDeviceIdentity(this.sock.authState.creds.account, true);
        }

        // 3. Meta Relay endpoints (from cache or pushed upon offer)
        const relayEndpoints = this.cachedRelayEndpoints.length > 0 ? this.cachedRelayEndpoints : [];
        console.log(`[VoIP DEBUG] Step 5: Relay endpoints: ${relayEndpoints.length} available`);

        const callerPn = myJid ? jidNormalizedUser(myJid) : null;
        let callerCountryCode = "BR";
        if (callerPn) {
            const pnDigits = callerPn.replace(/\D/g, "");
            if (pnDigits.startsWith("55")) callerCountryCode = "BR";
            else if (pnDigits.startsWith("1")) callerCountryCode = "US";
            else if (pnDigits.startsWith("44")) callerCountryCode = "GB";
            else if (pnDigits.startsWith("351")) callerCountryCode = "PT";
        }

        // Fetch Trusted Contact Token (tctoken) if available
        let tcTokenNode = null;
        try {
            const contactTcTokenData = await this.sock.authState?.keys?.get?.("tctoken", [
                resolvedJid, 
                `${cleanNumber}@s.whatsapp.net`
            ]);
            const entry = contactTcTokenData?.[resolvedJid] || contactTcTokenData?.[`${cleanNumber}@s.whatsapp.net`];
            if (entry?.token) {
                const tokenBuf = Buffer.isBuffer(entry.token) 
                    ? entry.token 
                    : (entry.token.data ? Buffer.from(entry.token.data, "base64") : Buffer.from(entry.token, "base64"));
                tcTokenNode = {
                    tag: "tctoken",
                    attrs: entry.timestamp ? { t: String(entry.timestamp) } : {},
                    content: tokenBuf
                };
                console.log(`[VoIP DEBUG] Attached Trusted Contact Token (tctoken) for ${resolvedJid}!`);
            }
        } catch (tcErr) {
            console.warn(`[VoIP DEBUG] Note: Could not retrieve tctoken:`, tcErr?.message);
        }

        // 4. Build and send offer stanza via sendNode matching verified message 5 spec
        const offerStanza = buildOfferStanza({
            toJid: resolvedJid,
            myJid: callerJid,
            callerPn,
            callerCountryCode,
            deviceClass: "2015",
            joinable: "1",
            callId,
            destinations,
            deviceIdentity,
            isVideo,
            audioRate: options.audioRate || "16000"
        });

        console.log(`[VoIP DEBUG] Step 6: Dispatching <call><offer> stanza via sendNode...`);
        if (this.sock.sendNode) {
            await this.sock.sendNode(offerStanza);
        } else {
            await this.sock.query(offerStanza);
        }
        console.log(`[VoIP DEBUG] Step 7: <call><offer> dispatched to WhatsApp network successfully!`);

        // 5. Create and return active outbound VoIP session
        const session = new VoIPSession({
            callId,
            callCreator: callerCreator,
            peerJid: resolvedJid,
            myJid: callerJid,
            direction: "outbound",
            isVideo,
            callKey,
            relayEndpoints,
            socketClient: this.sock,
            logger: this.logger
        });

        this.activeSessions.set(callId, session);

        session.on("ended", () => {
            this.activeSessions.delete(callId);
        });

        return session;
    }

    /**
     * Retrieves an active session by call ID
     */
    getSession(callId) {
        return this.activeSessions.get(callId);
    }

    /**
     * Lists all current active VoIP sessions
     */
    listSessions() {
        return Array.from(this.activeSessions.values()).map(s => ({
            callId: s.callId,
            peerJid: s.peerJid,
            direction: s.direction,
            state: s.state,
            isVideo: s.isVideo,
            startTime: s.startTime
        }));
    }
}

/**
 * Factory function to attach VoIPManager to a WaSockets instance
 */
function makeVoIPManager(sock, options = {}) {
    return new VoIPManager(sock, options);
}

module.exports = {
    VoIPManager,
    makeVoIPManager,
};
