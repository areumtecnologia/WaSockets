"use strict"

Object.defineProperty(exports, "__esModule", { value: true })

const { LRUCache } = require("lru-cache")
const { BaseStorageAdapter } = require("./BaseStorageAdapter")

/**
 * Ultra-fast in-memory storage adapter powered by an LRU cache.
 */
class MemoryStorageAdapter extends BaseStorageAdapter {
    /**
     * @param {Object} [options={}]
     * @param {number} [options.maxMessages=20000] - Total maximum messages in memory
     * @param {number} [options.ttl=604800000] - Message TTL in ms (default 7 days)
     */
    constructor(options = {}) {
        super()
        this.cache = new LRUCache({
            max: options.maxMessages || 20000,
            ttl: options.ttl || 1000 * 60 * 60 * 24 * 7 // 7 days
        })
        this.chatIndex = new Map()
        this.idIndex = new Map()
    }

    _makeKey(chatId, messageId) {
        return `${chatId}:${messageId}`
    }

    async saveMessage(chatId, message) {
        if (!chatId || !message) return
        const msgId = message.id || message.key?.id
        if (!msgId) return

        const key = this._makeKey(chatId, msgId)
        this.cache.set(key, message)
        this.idIndex.set(msgId, key)

        if (!this.chatIndex.has(chatId)) {
            this.chatIndex.set(chatId, [])
        }
        const list = this.chatIndex.get(chatId)
        if (!list.includes(msgId)) {
            list.push(msgId)
            if (list.length > 500) list.shift()
        }
    }

    async getMessage(chatId, messageId) {
        if (!messageId) return null
        if (chatId) {
            const direct = this.cache.get(this._makeKey(chatId, messageId))
            if (direct) return direct
        }
        const indexedKey = this.idIndex.get(messageId)
        return indexedKey ? (this.cache.get(indexedKey) || null) : null
    }

    async getMessages(chatId, options = {}) {
        if (!chatId) return []
        const limit = options.limit || 50
        const ids = this.chatIndex.get(chatId) || []
        const slice = ids.slice(-limit)
        const result = []

        for (const id of slice) {
            const msg = this.cache.get(this._makeKey(chatId, id))
            if (msg) result.push(msg)
        }

        return result
    }

    async deleteMessage(chatId, messageId) {
        if (!chatId || !messageId) return
        const key = this._makeKey(chatId, messageId)
        this.cache.delete(key)
        const list = this.chatIndex.get(chatId)
        if (list) {
            const idx = list.indexOf(messageId)
            if (idx !== -1) list.splice(idx, 1)
        }
    }

    async clear(chatId) {
        if (chatId) {
            const list = this.chatIndex.get(chatId) || []
            for (const id of list) {
                this.cache.delete(this._makeKey(chatId, id))
            }
            this.chatIndex.delete(chatId)
        } else {
            this.cache.clear()
            this.chatIndex.clear()
        }
    }
}

exports.MemoryStorageAdapter = MemoryStorageAdapter
exports.default = MemoryStorageAdapter
