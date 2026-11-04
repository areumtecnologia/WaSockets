"use strict";

Object.defineProperty(exports, "__esModule", { value: true });

const crypto = require("crypto");
const { 
    getBinaryNodeChild, 
    getBinaryNodeChildren, 
    getBinaryNodeChildString, 
    getBinaryNodeChildBuffer,
    S_WHATSAPP_NET,
    jidEncode,
    jidDecode
} = require("../WABinary");
const { generateMessageID } = require("../Utils");

/**
 * WhatsApp VoIP Protocol Stanza Builder & Parser
 */

const VOIP_CAPABILITY = Buffer.from("0105f509e0fa53", "hex");

/**
 * Builds an outgoing <call> offer stanza matching official WhatsApp Android wire spec:
 * audio (16000) -> audio (8000) -> (video) -> capability -> enc / destination -> encopt -> net
 */
function buildOfferStanza({
    toJid,
    myJid,
    callId,
    destinations,
    deviceIdentity,
    isVideo = false,
    audioRate = "16000",
    keygen = "2",
    callerPn = null,
    callerCountryCode = "BR",
    deviceClass = "2015",
    joinable = "1",
    tcTokenNode = null,
    callerNotify = null,
    callerPlatform = null,
    callerVersion = null
}) {
    const offerContent = [];

    // 1. Audio codecs: rate="8000" then rate="16000"
    offerContent.push({ tag: "audio", attrs: { rate: "8000", enc: "opus" }, content: undefined });
    offerContent.push({ tag: "audio", attrs: { rate: "16000", enc: "opus" }, content: undefined });

    // Video codec (if video call)
    if (isVideo) {
        offerContent.push({
            tag: "video",
            attrs: {
                enc: "vp8",
                dec: "vp8",
                orientation: "0",
                screen_width: "1920",
                screen_height: "1080",
                device_orientation: "0"
            },
            content: undefined
        });
    }

    // 2. Capability node
    offerContent.push({ tag: "capability", attrs: { ver: "1" }, content: VOIP_CAPABILITY });

    // 3. Signal encrypted destination keys
    if (destinations && destinations.length > 0) {
        if (destinations[0].tag === "to") {
            offerContent.push({ tag: "destination", attrs: {}, content: destinations });
        } else if (destinations[0].tag === "enc") {
            offerContent.push(...destinations);
        } else {
            offerContent.push({ tag: "destination", attrs: {}, content: destinations });
        }
    }

    // 4. Encopt (keygen="2")
    offerContent.push({ tag: "encopt", attrs: { keygen }, content: undefined });

    // 5. Network medium (medium="3")
    offerContent.push({ tag: "net", attrs: { medium: "3" }, content: undefined });

    // 6. Signed device identity
    if (deviceIdentity) {
        offerContent.push({
            tag: "device-identity",
            attrs: {},
            content: deviceIdentity
        });
    }

    const { jidNormalizedUser } = require("../WABinary");
    const callCreator = jidNormalizedUser(myJid);

    const offerAttrs = {
        "call-creator": callCreator,
        "call-id": callId,
        "device_class": deviceClass || "2015",
        "joinable": joinable || "1"
    };

    if (callerPn) {
        offerAttrs["caller_pn"] = callerPn;
    }
    if (callerCountryCode) {
        offerAttrs["caller_country_code"] = callerCountryCode;
    }

    return {
        tag: "call",
        attrs: {
            id: generateMessageID(),
            to: toJid
        },
        content: [{
            tag: "offer",
            attrs: offerAttrs,
            content: offerContent
        }]
    };
}

/**
 * Builds an <accept> stanza to answer an incoming WhatsApp call
 */
function buildAcceptStanza({
    callId,
    callCreator,
    myJid,
    isVideo = false,
    audioRate = "16000",
    destinations = null,
    deviceIdentity = null
}) {
    const acceptContent = [];

    acceptContent.push({ tag: "audio", attrs: { enc: "opus", rate: audioRate }, content: undefined });
    if (isVideo) {
        acceptContent.push({
            tag: "video",
            attrs: {
                enc: "vp8",
                dec: "vp8",
                orientation: "0",
                screen_width: "1920",
                screen_height: "1080",
                device_orientation: "0"
            },
            content: undefined
        });
    }

    acceptContent.push({ tag: "net", attrs: { medium: "3" }, content: undefined });
    acceptContent.push({ tag: "capability", attrs: { ver: "1" }, content: VOIP_CAPABILITY });
    acceptContent.push({ tag: "encopt", attrs: { keygen: "2" }, content: undefined });

    if (destinations && destinations.length > 0) {
        acceptContent.push({ tag: "destination", attrs: {}, content: destinations });
    }

    if (deviceIdentity) {
        acceptContent.push({
            tag: "device-identity",
            attrs: {},
            content: deviceIdentity
        });
    }

    return {
        tag: "call",
        attrs: {
            id: generateMessageID(),
            from: myJid,
            to: callCreator
        },
        content: [{
            tag: "accept",
            attrs: {
                "call-id": callId,
                "call-creator": callCreator
            },
            content: acceptContent
        }]
    };
}

/**
 * Builds a <reject> stanza
 */
function buildRejectStanza({ callId, callCreator, myJid, reason = "0" }) {
    return {
        tag: "call",
        attrs: {
            id: generateMessageID(),
            from: myJid,
            to: callCreator
        },
        content: [{
            tag: "reject",
            attrs: {
                "call-id": callId,
                "call-creator": callCreator,
                count: reason
            },
            content: undefined
        }]
    };
}

/**
 * Builds a <terminate> stanza (hangup / timeout / error)
 */
function buildTerminateStanza({ callId, callCreator, myJid, reason = "hangup" }) {
    return {
        tag: "call",
        attrs: {
            id: generateMessageID(),
            from: myJid,
            to: callCreator
        },
        content: [{
            tag: "terminate",
            attrs: {
                "call-id": callId,
                "call-creator": callCreator,
                reason
            },
            content: undefined
        }]
    };
}

/**
 * Builds a relay query IQ stanza to retrieve Meta relay servers
 */
function buildRelayQueryIq() {
    return {
        tag: "iq",
        attrs: {
            id: generateMessageID(),
            to: S_WHATSAPP_NET,
            type: "get",
            xmlns: "w:p"
        },
        content: [{
            tag: "relay",
            attrs: {
                latency: "15"
            },
            content: undefined
        }]
    };
}

/**
 * Parses relay tokens and endpoints from a relay IQ result
 */
function parseRelayEndpoints(node) {
    if (!node) return [];

    const endpoints = [];
    const findTeNodes = (curr) => {
        if (!curr || typeof curr !== "object") return;
        if (curr.tag === "te") {
            const ip = curr.attrs?.ip;
            const port = parseInt(curr.attrs?.port, 10);
            const token = curr.content instanceof Uint8Array 
                ? Buffer.from(curr.content) 
                : (curr.attrs?.token ? Buffer.from(curr.attrs.token, "base64") : null);

            if (ip && port) {
                endpoints.push({
                    ip,
                    port,
                    token,
                    type: curr.attrs?.type || "udp"
                });
            }
        }
        if (Array.isArray(curr.content)) {
            for (const child of curr.content) {
                findTeNodes(child);
            }
        }
    };

    findTeNodes(node);
    return endpoints;
}

/**
 * Parses an incoming <call> node and extracts metadata, offer/accept parameters,
 * destination encrypted payloads, and video attributes.
 */
function parseCallNode(node) {
    const { attrs } = node;
    const children = getBinaryNodeChildren(node);
    if (!children.length) return null;

    const actionNode = children[0];
    const action = actionNode.tag; // offer, accept, reject, terminate, relaylatency

    const callId = actionNode.attrs["call-id"];
    const callCreator = actionNode.attrs["call-creator"] || attrs.from;
    const from = attrs.from || callCreator;

    const audioChild = getBinaryNodeChild(actionNode, "audio");
    const videoChild = getBinaryNodeChild(actionNode, "video");
    const netChild = getBinaryNodeChild(actionNode, "net");
    const destinationChild = getBinaryNodeChild(actionNode, "destination");

    // Extract destinations (encrypted callKey for each participant device)
    let destinationNodes = destinationChild ? getBinaryNodeChildren(destinationChild, "to") : [];
    if (!destinationNodes.length) {
        destinationNodes = getBinaryNodeChildren(actionNode, "to");
    }
    if (!destinationNodes.length) {
        const encChild = getBinaryNodeChild(actionNode, "enc");
        if (encChild) {
            destinationNodes = [{ tag: "to", attrs: { jid: attrs.to }, content: [encChild] }];
        }
    }

    return {
        action,
        callId,
        callCreator,
        from,
        chatId: attrs.from,
        timestamp: attrs.t ? new Date(+attrs.t * 1000) : new Date(),
        offline: !!attrs.offline,
        isVideo: !!videoChild,
        audioRate: audioChild?.attrs?.rate || "16000",
        audioCodec: audioChild?.attrs?.enc || "opus",
        netMedium: netChild?.attrs?.medium,
        destinations: destinationNodes,
        rawNode: node
    };
}

module.exports = {
    VOIP_CAPABILITY,
    buildOfferStanza,
    buildAcceptStanza,
    buildRejectStanza,
    buildTerminateStanza,
    buildRelayQueryIq,
    parseRelayEndpoints,
    parseCallNode,
};
