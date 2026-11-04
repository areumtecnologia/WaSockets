"use strict";

Object.defineProperty(exports, "__esModule", { value: true });

const { VoIPCrypto, deriveVoIPKeys, computeSRTPIV, encryptRTPPayload, decryptRTPPayload, computeAuthTag } = require("./VoIPCrypto");
const { VoIPProtocol, buildOfferStanza, buildAcceptStanza, buildRejectStanza, buildTerminateStanza, buildRelayQueryIq, parseRelayEndpoints, parseCallNode } = require("./VoIPProtocol");
const { VoIPRelayTransport } = require("./VoIPRelayTransport");
const { VoIPMediaEngine } = require("./VoIPMediaEngine");
const { VoIPSession, CallState } = require("./VoIPSession");
const { VoIPManager, makeVoIPManager } = require("./VoIPManager");
const { makeVoipSocket } = require("../Socket/voip");
const audioUtils = require("./utils/audio");

module.exports = {
    // Socket Mixin
    makeVoipSocket,

    // Audio DSP & Format Helpers
    audioUtils,
    ...audioUtils,

    // High-Level Manager & Engine
    VoIPManager,
    makeVoIPManager,

    // Session & States
    VoIPSession,
    CallState,

    // Media & Transport
    VoIPMediaEngine,
    VoIPRelayTransport,

    // Protocol Stanzas
    VoIPProtocol,
    buildOfferStanza,
    buildAcceptStanza,
    buildRejectStanza,
    buildTerminateStanza,
    buildRelayQueryIq,
    parseRelayEndpoints,
    parseCallNode,

    // Crypto
    VoIPCrypto,
    deriveVoIPKeys,
    computeSRTPIV,
    encryptRTPPayload,
    decryptRTPPayload,
    computeAuthTag
};
