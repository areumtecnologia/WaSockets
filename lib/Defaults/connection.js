"use strict"

Object.defineProperty(exports, "__esModule", { value: true })

const { Browsers } = require("../Utils") 
const { default: logger } = require("../Utils/logger")
const { makeLibSignalRepository } = require("../Signal/libsignal")
const { version } = require("./baileys-version.json")

const createGroupMetadataCache = (ttlMs = 300000, maxSize = 250) => {
    const cache = new Map()

    const get = async (jid) => {
        const item = cache.get(jid)
        if (!item) return undefined
        if (Date.now() - item.time > ttlMs) {
            cache.delete(jid)
            return undefined
        }
        return item.metadata
    }

    get.set = (jid, metadata) => {
        if (cache.size >= maxSize) {
            const oldestKey = cache.keys().next().value
            if (oldestKey) cache.delete(oldestKey)
        }
        cache.set(jid, { metadata, time: Date.now() })
    }

    get.delete = (jid) => cache.delete(jid)
    get.clear = () => cache.clear()

    return get
}

const DEFAULT_CONNECTION_CONFIG = {
    version, 
    browser: Browsers.windows('Chrome'),
    waWebSocketUrl: 'wss://web.whatsapp.com/ws/chat',
    connectTimeoutMs: 20000,
    keepAliveIntervalMs: 30000,
    logger: logger.child({ class: 'baileys' }),
    printQRInTerminal: false,
    emitOwnEvents: true,
    defaultQueryTimeoutMs: 60000,
    customUploadHosts: [],
    retryRequestDelayMs: 250,
    maxMsgRetryCount: 5,
    fireInitQueries: true,
    auth: undefined,
    markOnlineOnConnect: true,
    syncFullHistory: false,
    patchMessageBeforeSending: msg => msg,
    shouldSyncHistoryMessage: () => true,
    shouldIgnoreJid: () => false,
    linkPreviewImageThumbnailWidth: 192,
    transactionOpts: { 
    	maxCommitRetries: 10, 
    	delayBetweenTriesMs: 3000 
    },
    generateHighQualityLinkPreview: false,
    enableAutoSessionRecreation: true, 
    enableRecentMessageCache: true, 
    enableMessageQueue: true,
    messageQueueTtlMs: 300000,
    maxReconnectAttempts: 15,
    enableGroupCache: true,
    options: {},
    appStateMacVerification: {
        patch: false,
        snapshot: false,
    },
    countryCode: 'US',
    getMessage: async () => undefined,
    cachedGroupMetadata: createGroupMetadataCache(),
    makeSignalRepository: makeLibSignalRepository
}

module.exports = {
  DEFAULT_CONNECTION_CONFIG,
  createGroupMetadataCache
}