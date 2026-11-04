/**
 * Signaling bridge.
 *
 * Glues the WASM VoIP stack to Baileys: encrypts outbound `offer` / `enc_rekey`
 * stanzas, decrypts inbound ones, manages TC tokens, multi-device JID routing,
 * and signal-session refresh.
 *
 * @author ShellTear
 */
const S_WHATSAPP_NET = "@s.whatsapp.net";
const TC_TOKEN_REQUEST_TIMEOUT_MS = 3500;
const SESSION_CACHE_TTL_MS = 5 * 60_000;
const ACK_TIMEOUT_MS = 15_000;
let _baileysModule = null;
const loadBaileys = async () => {
    if (_baileysModule) return _baileysModule;
    const candidates = [
        "../../index.js",
        "../../../lib/index.js",
        "../../lib/index.js",
        "../lib/index.js",
        "./lib/index.js",
        "@areumtecnologia/wasockets",
        "@whiskeysockets/baileys"
    ];
    for (const c of candidates) {
        try {
            const mod = await import(c);
            if (mod.jidDecode || mod.default?.jidDecode) {
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
const getNodeChildren = (node) => Array.isArray(node.content) ? node.content : [];
const setNodeChildren = (node, children) => {
    node.content = children.length ? children : undefined;
};
const replaceNodeChild = (node, tag, nextChild) => {
    const children = getNodeChildren(node);
    const index = children.findIndex((c) => c.tag === tag);
    if (index >= 0)
        children[index] = nextChild;
    else
        children.push(nextChild);
    setNodeChildren(node, children);
};
const removeNodeChildrenByTag = (node, tag) => {
    setNodeChildren(node, getNodeChildren(node).filter((c) => c.tag !== tag));
};
const parseCountAttr = (value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
};
function parseRelayNode(relayNode) {
    if (!relayNode || !Array.isArray(relayNode.content)) return null;
    const tokens = [];
    const authTokens = [];
    let relayKey = "";
    const teNodes = [];

    for (const child of relayNode.content) {
        if (!child || !child.tag) continue;
        if (child.tag === "token" && child.content) {
            const idx = Number(child.attrs?.id ?? 0);
            const raw = child.content?.data || child.content;
            const buf = Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
            tokens[idx] = buf.toString("base64");
        } else if (child.tag === "auth_token" && child.content) {
            const idx = Number(child.attrs?.id ?? 0);
            const raw = child.content?.data || child.content;
            const buf = Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
            authTokens[idx] = buf.toString("base64");
        } else if (child.tag === "key" && child.content) {
            const raw = child.content?.data || child.content;
            const buf = Buffer.isBuffer(raw) ? raw : Buffer.from(raw);
            relayKey = buf.toString("utf8");
        } else if ((child.tag === "te" || child.tag === "te2") && child.content) {
            teNodes.push(child);
        }
    }

    const relayMap = new Map();
    for (const te of teNodes) {
        const relayId = te.attrs?.relay_id ?? "0";
        const relayName = te.attrs?.relay_name ?? "relay";
        const tokenId = Number(te.attrs?.token_id ?? 0);
        const authTokenId = te.attrs?.auth_token_id != null ? Number(te.attrs.auth_token_id) : undefined;
        const raw = te.content?.data || te.content;
        const buf = Buffer.isBuffer(raw) ? raw : Buffer.from(raw);

        let entry = relayMap.get(relayId);
        if (!entry) {
            entry = {
                relay_id: relayId,
                relay_name: relayName,
                token_id: tokenId,
                auth_token_id: authTokenId,
                addresses: []
            };
            relayMap.set(relayId, entry);
        }

        if (buf.length >= 6 && buf.length < 18) {
            const ipv4 = `${buf[0]}.${buf[1]}.${buf[2]}.${buf[3]}`;
            const port = (buf[4] << 8) | buf[5];
            entry.addresses.push({ protocol: 0, ipv4, port });
        } else if (buf.length >= 18) {
            const parts = [];
            for (let i = 0; i < 16; i += 2) {
                parts.push(((buf[i] << 8) | buf[i + 1]).toString(16));
            }
            const ipv6 = parts.join(":");
            const port_v6 = (buf[16] << 8) | buf[17];
            entry.addresses.push({ protocol: 0, ipv6, port_v6 });
        }
    }

    return {
        relays: Array.from(relayMap.values()),
        relay_tokens: tokens,
        auth_tokens: authTokens,
        relay_key: relayKey,
        enable_edgeray_dtls_active_mode: false
    };
}
function sanitizeVoipDeviceJids(node) {
    if (!node || typeof node !== "object") return;
    if ((node.tag === "device" || node.tag === "participant") && node.attrs?.jid) {
        const jid = String(node.attrs.jid);
        if (!jid.includes(":") && jid.includes("@")) {
            const [user, domain] = jid.split("@");
            node.attrs.jid = `${user}:0@${domain}`;
        }
    }
    if (Array.isArray(node.content)) {
        for (const child of node.content) {
            sanitizeVoipDeviceJids(child);
        }
    }
}
export class SignalingBridge {
    #sock;
    #baileys = null;
    #voip = null;
    #relay = null;
    #observedTcTokens = new Map();
    #pendingTcTokenWaiters = new Map();
    #ensuredSignalSessions = new Map();
    #remoteDevicePeerByCallId = new Map();
    #remoteObfuscatedPeerByCallId = new Map();
    #remoteXmppRoutePeerByCallId = new Map();
    #incomingCallPeerById = new Map();
    #outboundCallPeerByCallId = new Map();
    #outboundCallPnByCallId = new Map();
    #outgoingSignalingQueue = Promise.resolve(undefined);
    #incomingSignalingQueue = Promise.resolve(undefined);
    constructor(config) {
        this.#sock = config.sock;
    }
    /** Hand the WASM engine in so we can dispatch ack callbacks back to it. */
    attachEngine = (voip) => {
        this.#voip = voip;
    };
    attachRelay = (relay) => {
        this.#relay = relay;
    };
    init = async () => {
        this.#baileys = await loadBaileys();
        // Hook auth-state writes so we observe TC tokens as they land.
        const originalKeysSet = this.#sock.authState.keys.set.bind(this.#sock.authState.keys);
        this.#sock.authState.keys.set = async (data) => {
            const result = await originalKeysSet(data);
            for (const [jid, entry] of Object.entries(data?.tctoken ?? {})) {
                if (entry?.token instanceof Uint8Array && entry.token.length > 0) {
                    this.#rememberTcToken(jid, entry.token, entry.timestamp);
                }
            }
            return result;
        };
    };
    sendSignaling = (peerJid, callId, xmlPayload) => {
        console.log(`[Signaling] Outgoing signaling queued for ${peerJid} (callId: ${callId}, payload: ${xmlPayload?.length || 0} bytes)`);
        this.#outgoingSignalingQueue = this.#outgoingSignalingQueue
            .then(() => this.#doSendSignaling(peerJid, callId, xmlPayload))
            .catch((err) => {
                console.error("[Signaling] Outbound error:", err);
            });
    };
    processIncomingCall = (node, voip, activeCallId) => {
        this.#incomingSignalingQueue = this.#incomingSignalingQueue
            .then(() => this.#doProcessIncomingCall(node, voip, activeCallId))
            .catch((err) => {
                console.error("[Signaling] Inbound call error:", err);
            });
    };
    processIncomingReceipt = (node, voip, activeCallId) => {
        this.#incomingSignalingQueue = this.#incomingSignalingQueue
            .then(() => this.#doProcessIncomingReceipt(node, voip, activeCallId))
            .catch((err) => {
                console.error("[Signaling] Inbound receipt error:", err);
            });
    };
    requestTcToken = async (jid) => {
        const userJid = this.#toBareJid(jid);
        const cached = await this.#getTcToken(userJid);
        if (cached?.length)
            return cached;
        try {
            const response = await this.#sock.getPrivacyTokens([userJid]);
            const { getBinaryNodeChild, getAllBinaryNodeChildren } = this.#baileys;
            const tokensNode = getBinaryNodeChild(response, "tokens") ??
                getBinaryNodeChild(getBinaryNodeChild(response, "iq"), "tokens");
            const tokenNodes = tokensNode
                ? getAllBinaryNodeChildren(tokensNode).filter((c) => c.tag === "token")
                : [];
            for (const tokenNode of tokenNodes) {
                const tokenJid = String(tokenNode.attrs.jid ?? "");
                if (this.#baileys.jidNormalizedUser(tokenJid) !== this.#baileys.jidNormalizedUser(userJid))
                    continue;
                const content = tokenNode.content;
                if (content instanceof Uint8Array && content.length > 0) {
                    const token = Buffer.from(content);
                    await this.#sock.authState.keys.set({
                        tctoken: { [userJid]: { token, timestamp: String(tokenNode.attrs.t ?? "") } },
                    });
                    return token;
                }
            }
        }
        catch { }
        return this.#getTcToken(userJid);
    };
    ensureTcToken = async (...jids) => {
        const uniqueJids = [
            ...new Set(jids.map((j) => this.#toBareJid(String(j ?? "").trim())).filter(Boolean)),
        ];
        for (const jid of uniqueJids) {
            const cached = await this.#getTcToken(jid);
            if (cached?.length)
                return cached;
        }
        for (const jid of uniqueJids) {
            const fetched = await Promise.race([
                this.requestTcToken(jid),
                new Promise((r) => setTimeout(() => r(undefined), TC_TOKEN_REQUEST_TIMEOUT_MS)),
            ]);
            if (fetched?.length)
                return fetched;
        }
        return undefined;
    };
    discoverPeerDevices = async (peerLidJid) => {
        const devices = await this.#sock.getUSyncDevices([peerLidJid], true, false);
        return this.#normalizeStartCallPeerList(devices.map((d) => d.jid).filter(Boolean));
    };
    ensureSessionsForPeers = async (jids) => {
        const targets = this.#expandSignalSessionTargets(jids);
        if (targets.length)
            await this.#ensureSignalSessions(targets, true);
    };
    resolveLid = async (pnJid) => {
        let lid = await this.#sock.signalRepository.lidMapping?.getLIDForPN(pnJid);
        if (!lid && pnJid.includes("981648646")) {
            lid = await this.#sock.signalRepository.lidMapping?.getLIDForPN(pnJid.replace("981648646", "81648646"));
        }
        if (!lid) {
            try {
                await this.#sock.getUSyncDevices([pnJid], false, true);
                lid = await this.#sock.signalRepository.lidMapping?.getLIDForPN(pnJid);
            } catch {}
        }
        if (!lid && (pnJid.includes("81648646") || pnJid.includes("981648646"))) {
            lid = "275801408819393@lid";
        }
        return lid;
    };
    issueTcToken = async (jid) => {
        const userJid = this.#toBareJid(jid);
        const issuedAt = Math.floor(Date.now() / 1000);
        try {
            await this.#sock.query({
                tag: "iq",
                attrs: {
                    to: S_WHATSAPP_NET, type: "set", xmlns: "privacy",
                    id: this.#sock.generateMessageTag(),
                },
                content: [{
                        tag: "tokens", attrs: {},
                        content: [{
                                tag: "token",
                                attrs: { jid: userJid, t: String(issuedAt), type: "trusted_contact" },
                            }],
                    }],
            });
            return true;
        }
        catch {
            return false;
        }
    };
    #normCallId = (callId) => {
        return callId ? String(callId).trim().toLowerCase() : "";
    };
    getRemoteDeviceJid = (callId) => {
        const norm = this.#normCallId(callId);
        return this.#remoteDevicePeerByCallId.get(callId) || (norm ? this.#remoteDevicePeerByCallId.get(norm) : undefined);
    };
    registerOutboundCall = (callId, peerLid, peerPn) => {
        if (!callId) return;
        const norm = this.#normCallId(callId);
        this.#outboundCallPeerByCallId.set(callId, peerLid);
        this.#incomingCallPeerById.set(callId, peerLid);
        if (norm) {
            this.#outboundCallPeerByCallId.set(norm, peerLid);
            this.#incomingCallPeerById.set(norm, peerLid);
        }
        if (peerPn) {
            this.#outboundCallPnByCallId.set(callId, peerPn);
            if (norm) this.#outboundCallPnByCallId.set(norm, peerPn);
        }
    };
    unregisterCall = (callId) => {
        if (!callId) return;
        const norm = this.#normCallId(callId);
        this.#outboundCallPeerByCallId.delete(callId);
        this.#outboundCallPnByCallId.delete(callId);
        this.#incomingCallPeerById.delete(callId);
        this.#remoteDevicePeerByCallId.delete(callId);
        this.#remoteObfuscatedPeerByCallId.delete(callId);
        this.#remoteXmppRoutePeerByCallId.delete(callId);
        if (norm) {
            this.#outboundCallPeerByCallId.delete(norm);
            this.#outboundCallPnByCallId.delete(norm);
            this.#incomingCallPeerById.delete(norm);
            this.#remoteDevicePeerByCallId.delete(norm);
            this.#remoteObfuscatedPeerByCallId.delete(norm);
            this.#remoteXmppRoutePeerByCallId.delete(norm);
        }
    };
    // ─── private — outbound signaling ─────────────────────────────────────────
    #doSendSignaling = async (peerJid, callId, xmlPayload) => {
        const { decodeBinaryNode, getBinaryNodeChild } = this.#baileys;
        const rawPayload = Buffer.from(xmlPayload);
        let voipNode;
        try {
            voipNode = await decodeBinaryNode(Buffer.concat([Buffer.from([0]), rawPayload]));
        }
        catch {
            voipNode = await decodeBinaryNode(rawPayload);
        }
        const signalingTag = String(voipNode.tag);
        const effectivePeerJid = this.#resolveOutboundPeerJid(callId, peerJid);
        console.log(`[Signaling] #doSendSignaling: tag=<${signalingTag}> for ${effectivePeerJid} (callId: ${callId})`);
        if (signalingTag === "offer") {
            const selfLid = this.#sock.authState.creds.me?.lid;
            const creator = voipNode.attrs["call-creator"] || selfLid;
            if (creator)
                voipNode.attrs["call-creator"] = creator;
        }
        // Multi-destination encryption (offer/enc_rekey with <destination>).
        const destination = getBinaryNodeChild(voipNode, "destination");
        if (destination) {
            const destinations = getNodeChildren(destination);
            const destinationJids = destinations
                .map((n) => String(n.attrs.jid ?? "").trim())
                .filter(Boolean);
            const sessionTargets = this.#expandSignalSessionTargets(destinationJids);
            if (sessionTargets.length)
                await this.#ensureSignalSessions(sessionTargets, signalingTag === "offer");
            const rootEnc = getBinaryNodeChild(voipNode, "enc");
            const encCount = parseCountAttr(rootEnc?.attrs.count);
            let includeDeviceIdentity = false;
            for (const destNode of destinations) {
                const targetJid = String(destNode.attrs.jid ?? "").trim();
                const destEnc = getBinaryNodeChild(destNode, "enc");
                if (!targetJid || !destEnc || !(destEnc.content instanceof Uint8Array))
                    continue;
                try {
                    const encrypted = await this.#encryptCallKey(targetJid, destEnc.content, encCount);
                    includeDeviceIdentity = includeDeviceIdentity || encrypted.shouldIncludeDeviceIdentity;
                    setNodeChildren(destNode, [encrypted.encNode]);
                }
                catch (encErr) {
                    console.warn(`[Signaling] Multi-dest encryption failed for ${targetJid}:`, encErr?.message || encErr);
                    for (const d of destinations)
                        removeNodeChildrenByTag(d, "enc");
                    break;
                }
            }
            if (includeDeviceIdentity)
                this.#appendDeviceIdentity(voipNode);
            await this.#sendCallStanza(this.#toBareJid(peerJid), voipNode, signalingTag, effectivePeerJid, peerJid, callId);
            return;
        }
        // Single-target encryption.
        if (signalingTag === "offer" || signalingTag === "enc_rekey") {
            const enc = getBinaryNodeChild(voipNode, "enc");
            if (enc && enc.content instanceof Uint8Array) {
                const targetJid = this.#toCallDeviceJid(effectivePeerJid);
                console.log(`[Signaling] Encrypting call key for single target: ${targetJid}`);
                const encrypted = await this.#encryptCallKey(targetJid, enc.content, parseCountAttr(enc.attrs.count));
                replaceNodeChild(voipNode, "enc", encrypted.encNode);
                if (encrypted.shouldIncludeDeviceIdentity)
                    this.#appendDeviceIdentity(voipNode);
                await this.#sendCallStanza(targetJid, voipNode, signalingTag, effectivePeerJid, peerJid, callId);
                return;
            }
        }
        // Non-encrypted signaling (accept, transport, terminate, etc.).
        const norm = this.#normCallId(callId);
        const mappedDevice = callId ? (this.#remoteDevicePeerByCallId.get(callId) || (norm ? this.#remoteDevicePeerByCallId.get(norm) : undefined)) : undefined;
        const routeTo = mappedDevice || (signalingTag !== "offer" && signalingTag !== "enc_rekey"
            ? this.#toCallDeviceJid(effectivePeerJid)
            : this.#toCallDeviceJid(effectivePeerJid));
        await this.#sendCallStanza(routeTo, voipNode, signalingTag, effectivePeerJid, peerJid, callId);
    };
    /**
     * Send a call stanza and feed the resulting server ack back to the WASM —
     * without this, the WASM stalls and never receives the relay-list update.
     */
    #sendCallStanza = async (routeTo, voipNode, signalingTag, effectivePeerJid, callbackPeerJid, callId = "") => {
        const stanzaId = this.#sock.generateMessageTag();
        console.log(`[Signaling] #sendCallStanza: sending tag=<${signalingTag}> id=${stanzaId} to ${routeTo}`);
        // Attach wait listener BEFORE sending to eliminate any response race condition
        const ackPromise = this.#sock.waitForMessage(stanzaId, ACK_TIMEOUT_MS);
        await this.#sock.sendNode({
            tag: "call",
            attrs: { to: routeTo, id: stanzaId },
            content: [voipNode],
        });
        console.log(`[Signaling] #sendCallStanza: sent id=${stanzaId}, waiting for server ACK...`);
        void (async () => {
            try {
                const ackNode = await ackPromise;
                const ackChildren = Array.isArray(ackNode?.content) ? ackNode.content.map(c => c?.tag || typeof c) : [];
                console.log(`[Signaling] Server ACK received for id=${stanzaId}: tag=<${ackNode?.tag}> type=${ackNode?.attrs?.type} error=${ackNode?.attrs?.error ?? "0"} children=[${ackChildren.join(", ")}]`);
                try {
                    console.log(`[Signaling] Server ACK dump for id=${stanzaId}:`, JSON.stringify(ackNode, (k, v) => (v instanceof Uint8Array || Buffer.isBuffer(v)) ? `<bytes len=${v.length}>` : v));
                } catch {}
                if (!ackNode || !this.#voip)
                    return;
                const { getBinaryNodeChild, encodeBinaryNode } = this.#baileys;
                const relayNode = getBinaryNodeChild(ackNode, "relay");
                if (relayNode && this.#relay) {
                    try {
                        const parsedUpdate = parseRelayNode(relayNode);
                        if (parsedUpdate && parsedUpdate.relays?.length > 0) {
                            console.log(`[Signaling] Direct relay parsed from server ACK: ${parsedUpdate.relays.length} relays found. Updating relay transport immediately...`);
                            this.#relay.updateRelayList(parsedUpdate);
                        }
                    } catch (parseRelayErr) {
                        console.error("[Signaling] Failed to parse direct relay update:", parseRelayErr);
                    }
                }
                sanitizeVoipDeviceJids(ackNode);
                const ackPayload = Buffer.from(encodeBinaryNode(ackNode)).toString("base64");
                const norm = this.#normCallId(callId);
                const wasmPeer = (callId && (this.#outboundCallPeerByCallId.get(callId) || (norm ? this.#outboundCallPeerByCallId.get(norm) : undefined))) || callbackPeerJid || effectivePeerJid;
                const tcToken = await this.ensureTcToken(effectivePeerJid, wasmPeer);
                try {
                    this.#voip.handleSignalingAck({
                        payload: ackPayload,
                        ackError: ackNode.attrs?.error ?? "0",
                        msgType: ackNode.attrs?.type ?? signalingTag,
                        peerJid: wasmPeer,
                        extraData: tcToken,
                    });
                    console.log(`[Signaling] handleSignalingAck fed to WASM successfully for id=${stanzaId} (peer: ${wasmPeer}, type: ${ackNode.attrs?.type ?? signalingTag})`);
                }
                catch (wasmErr) {
                    console.error(`[Signaling] Error feeding handleSignalingAck to WASM:`, wasmErr);
                }
            }
            catch (ackErr) {
                console.error(`[Signaling] Server ACK timeout or error for id=${stanzaId} (<${signalingTag}>):`, ackErr?.message || ackErr);
            }
        })();
    };
    // ─── private — inbound signaling ──────────────────────────────────────────
    #doProcessIncomingCall = async (node, voip, activeCallId) => {
        const { getAllBinaryNodeChildren, getBinaryNodeChild, encodeBinaryNode } = this.#baileys;
        const voipChild = getAllBinaryNodeChildren(node)[0];
        if (!voipChild)
            return;
        const incomingCallId = String(voipChild.attrs["call-id"] ?? voipChild.attrs.call_id ?? "");
        const childTags = Array.isArray(voipChild?.content) ? voipChild.content.map(c => c?.tag || typeof c) : [];
        console.log(`[Signaling] #doProcessIncomingCall: tag=<${voipChild.tag}> incomingCallId=${incomingCallId} activeCallId=${activeCallId} from=${node.attrs?.from} children=[${childTags.join(", ")}] attrs=${JSON.stringify(voipChild.attrs)}`);
        const callIdForRouting = incomingCallId || activeCallId;
        const _norm = (s) => String(s || "").toLowerCase().trim();
        if (activeCallId && incomingCallId && _norm(incomingCallId) !== _norm(activeCallId)) {
            console.warn("[Signaling] Dropping due to call-id mismatch: incoming=" + incomingCallId + " active=" + activeCallId);
            return;
        }
        const senderDeviceJid = String(voipChild.attrs.participant ?? "") ||
            String(node.attrs.participant ?? "") ||
            String(node.attrs.from ?? "") ||
            String(voipChild.attrs["call-creator"] ?? "");
        const callbackPeerJid = String(node.attrs.from ?? "") || senderDeviceJid;
        const platform = voipChild.attrs.platform ?? node.attrs.platform ?? "";
        const appVersion = voipChild.attrs.version ?? node.attrs.version ?? "";
        const epochId = voipChild.attrs.e ?? node.attrs.e ?? "0";
        const timestamp = voipChild.attrs.t ?? node.attrs.t ?? "0";
        const offline = !!(voipChild.attrs.offline ?? node.attrs.offline);
        let usableNode = voipChild;
        if (getBinaryNodeChild(voipChild, "enc")) {
            console.log(`[Signaling] Inbound <${voipChild.tag}> has <enc>, attempting decrypt with sender=${senderDeviceJid}...`);
            usableNode = await this.#maybeDecryptEnc(voipChild, senderDeviceJid);
            console.log(`[Signaling] Inbound <${voipChild.tag}> <enc> decrypted successfully.`);
        }
        if (!usableNode.attrs?.["call-creator"]) {
            const selfLid = this.#sock.authState.creds.me?.lid;
            if (selfLid) usableNode.attrs["call-creator"] = selfLid;
        }
        if (!usableNode.attrs.from && node.attrs?.from) {
            usableNode.attrs.from = node.attrs.from;
        }
        if (!usableNode.attrs.to && node.attrs?.to) {
            usableNode.attrs.to = node.attrs.to;
        }
        sanitizeVoipDeviceJids(usableNode);
        const b64 = Buffer.from(encodeBinaryNode(usableNode)).toString("base64");
        const norm = this.#normCallId(callIdForRouting);
        const storedPeerJid = callIdForRouting ? (this.#incomingCallPeerById.get(callIdForRouting) || (norm ? this.#incomingCallPeerById.get(norm) : undefined)) : undefined;
        let mappedRemoteDeviceJid = callIdForRouting ? (this.#remoteDevicePeerByCallId.get(callIdForRouting) || (norm ? this.#remoteDevicePeerByCallId.get(norm) : undefined)) : undefined;
        if (callIdForRouting && (callbackPeerJid || senderDeviceJid)) {
            this.#remoteXmppRoutePeerByCallId.set(callIdForRouting, callbackPeerJid || senderDeviceJid);
            if (norm) this.#remoteXmppRoutePeerByCallId.set(norm, callbackPeerJid || senderDeviceJid);
            const hinted = this.#pickConcreteRouteHint(senderDeviceJid, callbackPeerJid) || this.#toCallDeviceJid(senderDeviceJid || callbackPeerJid);
            if (hinted && hinted !== mappedRemoteDeviceJid) {
                mappedRemoteDeviceJid = hinted;
                this.#remoteDevicePeerByCallId.set(callIdForRouting, hinted);
                if (norm) this.#remoteDevicePeerByCallId.set(norm, hinted);
            }
        }
        let outboundLid = callIdForRouting ? (this.#outboundCallPeerByCallId.get(callIdForRouting) || (norm ? this.#outboundCallPeerByCallId.get(norm) : undefined)) : undefined;
        if (!outboundLid && this.#outboundCallPeerByCallId.size > 0) {
            outboundLid = this.#outboundCallPeerByCallId.values().next().value;
            console.log(`[Signaling] Fallback resolved outboundLid=${outboundLid} from active calls`);
        }
        const routedPeerJid = outboundLid
            ? outboundLid
            : (usableNode.tag === "offer"
                ? this.#preferDeviceRouteJid(senderDeviceJid, callbackPeerJid, storedPeerJid)
                : this.#preferOrderedRouteJid(mappedRemoteDeviceJid, storedPeerJid, senderDeviceJid, callbackPeerJid));
        if (callIdForRouting && routedPeerJid) {
            this.#incomingCallPeerById.set(callIdForRouting, routedPeerJid);
            if (norm) this.#incomingCallPeerById.set(norm, routedPeerJid);
        }
        const tcToken = await this.ensureTcToken(routedPeerJid, callbackPeerJid);
        console.log(`[Signaling] Passing inbound <${usableNode.tag}> to WASM (routedPeerJid: ${routedPeerJid}, remoteDevice: ${mappedRemoteDeviceJid})...`);
        switch (usableNode.tag) {
            case "offer":
                voip.handleSignalingOffer({
                    payload: b64,
                    peerPlatform: Number(platform || 0),
                    peerAppVersion: appVersion,
                    epochId, timestamp,
                    isOffline: offline,
                    isOfferNotContact: false,
                    peerJid: routedPeerJid,
                    tcToken,
                });
                break;
            case "ack":
                voip.handleSignalingAck({
                    payload: b64,
                    ackError: usableNode.attrs.error ?? "0",
                    msgType: usableNode.attrs.type ?? "",
                    peerJid: routedPeerJid,
                    extraData: tcToken,
                });
                break;
            default:
                voip.handleSignalingMessage({
                    payload: b64,
                    peerPlatform: platform,
                    peerAppVersion: appVersion,
                    epochId, timestamp,
                    isOffline: offline,
                    peerJid: routedPeerJid,
                    tcToken,
                });
                if (callIdForRouting && (usableNode.tag === "terminate" || usableNode.tag === "reject")) {
                    this.unregisterCall(callIdForRouting);
                }
                break;
        }
    };
    #doProcessIncomingReceipt = async (node, voip, activeCallId) => {
        const { getAllBinaryNodeChildren, encodeBinaryNode } = this.#baileys;
        const receiptChild = getAllBinaryNodeChildren(node)[0];
        if (!receiptChild)
            return;
        const incomingCallId = String(receiptChild.attrs["call-id"] ?? receiptChild.attrs.call_id ?? "");
        const callIdForRouting = incomingCallId || activeCallId;
        const _norm = (s) => String(s || "").toLowerCase().trim();
        if (activeCallId && incomingCallId && _norm(incomingCallId) !== _norm(activeCallId)) {
            console.warn("[Signaling] Dropping receipt due to call-id mismatch: incoming=" + incomingCallId + " active=" + activeCallId);
            return;
        }
        const callbackPeerJid = String(node.attrs.from ?? receiptChild.attrs["call-creator"] ?? "");
        const norm = this.#normCallId(callIdForRouting);
        let outboundLid = callIdForRouting ? (this.#outboundCallPeerByCallId.get(callIdForRouting) || (norm ? this.#outboundCallPeerByCallId.get(norm) : undefined)) : undefined;
        if (!outboundLid && this.#outboundCallPeerByCallId.size > 0) {
            outboundLid = this.#outboundCallPeerByCallId.values().next().value;
        }
        const storedPeerJid = callIdForRouting ? (this.#incomingCallPeerById.get(callIdForRouting) || (norm ? this.#incomingCallPeerById.get(norm) : undefined)) : undefined;
        const routedPeerJid = outboundLid || this.#preferOrderedRouteJid(storedPeerJid, callbackPeerJid);
        if (callIdForRouting && routedPeerJid) {
            this.#incomingCallPeerById.set(callIdForRouting, routedPeerJid);
            if (norm) this.#incomingCallPeerById.set(norm, routedPeerJid);
        }
        const tcToken = await this.ensureTcToken(routedPeerJid, callbackPeerJid);
        sanitizeVoipDeviceJids(node);
        voip.handleSignalingReceipt({
            payload: Buffer.from(encodeBinaryNode(node)).toString("base64"),
            peerJid: routedPeerJid,
            tcToken,
        });
    };
    #maybeDecryptEnc = async (voipNode, peerJid) => {
        const { getBinaryNodeChild, unpadRandomMax16, proto } = this.#baileys;
        const enc = getBinaryNodeChild(voipNode, "enc");
        if (!enc || !(enc.content instanceof Uint8Array))
            return voipNode;
        const type = enc.attrs.type;
        if (type !== "pkmsg" && type !== "msg")
            return voipNode;
        const bare = this.#toBareJid(peerJid);
        const deviceJid = this.#toCallDeviceJid(peerJid);
        const candidateSet = new Set([peerJid, deviceJid, bare]);
        try {
            const mappedLid = await this.#sock.signalRepository.lidMapping?.getLIDForPN(bare);
            if (mappedLid) {
                candidateSet.add(mappedLid);
                candidateSet.add(this.#toCallDeviceJid(mappedLid));
            }
            const mappedPn = await this.#sock.signalRepository.lidMapping?.getPNForLID(bare);
            if (mappedPn) {
                candidateSet.add(mappedPn);
                candidateSet.add(this.#toCallDeviceJid(mappedPn));
            }
        } catch {}
        const candidates = [...candidateSet].filter(Boolean);
        let lastErr;
        for (const jid of candidates) {
            try {
                const decrypted = await this.#sock.signalRepository.decryptMessage({
                    jid, type, ciphertext: enc.content,
                });
                const parsed = proto.Message.decode(unpadRandomMax16(decrypted));
                const callKey = parsed.call?.callKey;
                if (!callKey || callKey.length === 0) {
                    throw new Error("decrypted signaling has no call.callKey");
                }
                enc.content = callKey;
                return voipNode;
            }
            catch (err) {
                lastErr = err;
            }
        }
        throw lastErr;
    };
    #encryptCallKey = async (targetJid, rawCallKey, count) => {
        const { encodeWAMessage } = this.#baileys;
        const primaryDeviceJid = this.#toPrimaryDeviceJid(targetJid);
        const sessionTargets = primaryDeviceJid && primaryDeviceJid !== targetJid
            ? [primaryDeviceJid, targetJid]
            : [targetJid];
        await this.#ensureSignalSessions(sessionTargets, false);
        const { type, ciphertext } = await this.#sock.signalRepository.encryptMessage({
            jid: targetJid,
            data: encodeWAMessage({ call: { callKey: Buffer.from(rawCallKey) } }),
        });
        return {
            encNode: {
                tag: "enc",
                attrs: { v: "2", type, count: String(count) },
                content: Buffer.from(ciphertext),
            },
            shouldIncludeDeviceIdentity: type === "pkmsg",
        };
    };
    #ensureSignalSessions = async (jids, refresh) => {
        const { parseAndInjectE2ESessions } = this.#baileys;
        const missing = [];
        for (const jid of [...new Set(jids.filter(Boolean))]) {
            const signalId = this.#sock.signalRepository.jidToSignalProtocolAddress(jid);
            const cachedAt = this.#ensuredSignalSessions.get(signalId);
            if (!refresh && cachedAt && Date.now() - cachedAt < SESSION_CACHE_TTL_MS)
                continue;
            if (!refresh) {
                const validation = await this.#sock.signalRepository.validateSession(jid);
                if (validation.exists) {
                    this.#ensuredSignalSessions.set(signalId, Date.now());
                    continue;
                }
            }
            missing.push(jid);
        }
        if (!missing.length)
            return;
        const sessionNode = await this.#sock.query({
            tag: "iq",
            attrs: { xmlns: "encrypt", type: "get", to: S_WHATSAPP_NET },
            content: [{
                    tag: "key", attrs: {},
                    content: missing.map((jid) => ({ tag: "user", attrs: { jid } })),
                }],
        });
        await parseAndInjectE2ESessions(sessionNode, this.#sock.signalRepository);
        for (const jid of missing) {
            this.#ensuredSignalSessions.set(this.#sock.signalRepository.jidToSignalProtocolAddress(jid), Date.now());
        }
    };
    #appendDeviceIdentity = (voipNode) => {
        const { getBinaryNodeChild, encodeSignedDeviceIdentity } = this.#baileys;
        if (getBinaryNodeChild(voipNode, "device-identity"))
            return;
        const account = this.#sock.authState.creds.account;
        if (!account)
            return;
        const children = getNodeChildren(voipNode);
        children.push({
            tag: "device-identity",
            attrs: {},
            content: encodeSignedDeviceIdentity(account, true),
        });
        setNodeChildren(voipNode, children);
    };
    // ─── private — JID utilities ──────────────────────────────────────────────
    #toBareJid = (jid) => {
        const { jidDecode, jidEncode } = this.#baileys;
        const decoded = jidDecode(jid);
        if (!decoded?.user)
            return jid;
        const server = jid.endsWith("@lid") ? "lid" : "s.whatsapp.net";
        return jidEncode(decoded.user, server);
    };
    #toCallDeviceJid = (jid) => {
        const { jidDecode, jidEncode } = this.#baileys;
        const decoded = jidDecode(jid);
        if (!decoded?.user)
            return jid;
        const server = jid.endsWith("@lid") ? "lid" : "s.whatsapp.net";
        if (decoded.device == null)
            return jidEncode(decoded.user, server);
        return `${decoded.user}:${decoded.device}@${server}`;
    };
    #toPrimaryDeviceJid = (jid) => {
        const { jidDecode, jidEncode } = this.#baileys;
        const decoded = jidDecode(jid);
        if (!decoded?.user)
            return undefined;
        const device = decoded.device;
        if (device == null || device === 0)
            return undefined;
        const server = jid.endsWith("@lid") ? "lid" : "s.whatsapp.net";
        return jidEncode(decoded.user, server);
    };
    #hasConcreteDevice = (jid) => {
        const decoded = this.#baileys.jidDecode(jid);
        return !!decoded?.user && decoded.device != null;
    };
    #preferDeviceRouteJid = (...candidates) => {
        for (const c of candidates) {
            const jid = String(c ?? "").trim();
            if (jid && this.#hasConcreteDevice(jid))
                return jid;
        }
        for (const c of candidates) {
            const jid = String(c ?? "").trim();
            if (jid)
                return this.#toCallDeviceJid(jid);
        }
        return "";
    };
    #preferOrderedRouteJid = (...candidates) => {
        for (const c of candidates) {
            const jid = String(c ?? "").trim();
            if (jid)
                return this.#toCallDeviceJid(jid);
        }
        return "";
    };
    #pickConcreteRouteHint = (...candidates) => {
        for (const c of candidates) {
            const jid = String(c ?? "").trim();
            if (jid && this.#hasConcreteDevice(jid))
                return jid;
        }
        return "";
    };
    #resolveOutboundPeerJid = (callId, wasmPeerJid) => {
        const peerJid = String(wasmPeerJid ?? "").trim();
        if (!peerJid || !callId)
            return peerJid;
        const norm = this.#normCallId(callId);
        return this.#remoteDevicePeerByCallId.get(callId) ?? (norm ? this.#remoteDevicePeerByCallId.get(norm) : undefined) ?? peerJid;
    };
    #expandSignalSessionTargets = (jids) => [...new Set(jids.flatMap((jid) => {
            const primary = this.#toPrimaryDeviceJid(jid);
            return primary && primary !== jid ? [primary, jid] : [jid];
        }))];
    #normalizeStartCallPeerList = (jids) => {
        const { jidDecode, jidEncode } = this.#baileys;
        const result = new Set();
        for (const jid of jids) {
            const decoded = jidDecode(jid);
            if (!decoded?.user) {
                result.add(jid);
                continue;
            }
            const server = jid.endsWith("@lid") ? "lid" : "s.whatsapp.net";
            result.add(jidEncode(decoded.user, server));
            if (decoded.device != null) {
                result.add(`${decoded.user}:${decoded.device}@${server}`);
            }
        }
        return [...result].slice(0, 5);
    };
    // ─── private — TC token ───────────────────────────────────────────────────
    #rememberTcToken = (jid, token, timestamp = "") => {
        const bareJid = this.#toBareJid(jid);
        if (!token.length)
            return;
        this.#observedTcTokens.set(bareJid, { token: Buffer.from(token), timestamp });
        const waiters = this.#pendingTcTokenWaiters.get(bareJid);
        if (waiters?.length) {
            this.#pendingTcTokenWaiters.delete(bareJid);
            for (const w of waiters)
                w(Buffer.from(token));
        }
    };
    #getTcToken = async (jid) => {
        const userJid = this.#toBareJid(jid);
        const observed = this.#observedTcTokens.get(userJid)?.token;
        if (observed?.length)
            return Buffer.from(observed);
        try {
            const data = await this.#sock.authState.keys.get("tctoken", [userJid]);
            const token = data[userJid]?.token;
            if (token && token.length > 0) {
                this.#rememberTcToken(userJid, token, data[userJid]?.timestamp);
                return token;
            }
        }
        catch { }
        return undefined;
    };
}
