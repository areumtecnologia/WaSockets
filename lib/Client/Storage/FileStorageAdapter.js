"use strict"

Object.defineProperty(exports, "__esModule", { value: true })

const { promises: fs } = require("fs")
const { join, dirname } = require("path")
const { BaseStorageAdapter } = require("./BaseStorageAdapter")

/**
 * File-based JSON storage adapter compatible with UnityChat message store layout.
 */
class FileStorageAdapter extends BaseStorageAdapter {
    /**
     * @param {Object} [options={}]
     * @param {string} [options.basePath='./data/message_store']
     */
    constructor(options = {}) {
        super()
        this.basePath = options.basePath || './data/message_store'
        this._writeLocks = new Map()
    }

    _getFilePath(chatId) {
        const sanitized = chatId.replace(/[^a-zA-Z0-9@._-]/g, '_')
        return join(this.basePath, `${sanitized}.json`)
    }

    async _readChatFile(chatId) {
        try {
            const filePath = this._getFilePath(chatId)
            const content = await fs.readFile(filePath, 'utf-8')
            return JSON.parse(content)
        } catch (err) {
            if (err.code === 'ENOENT') return []
            return []
        }
    }

    async _writeChatFile(chatId, messages) {
        const filePath = this._getFilePath(chatId)
        await fs.mkdir(dirname(filePath), { recursive: true })
        // Atomic write via temp file
        const tmpPath = `${filePath}.tmp.${Date.now()}`
        await fs.writeFile(tmpPath, JSON.stringify(messages, null, 2), 'utf-8')
        await fs.rename(tmpPath, filePath)
    }

    async saveMessage(chatId, message) {
        if (!chatId || !message) return
        const msgId = message.id || message.key?.id
        if (!msgId) return

        // Simple mutex queue per chatId
        let lock = this._writeLocks.get(chatId) || Promise.resolve()
        const nextLock = lock.then(async () => {
            const messages = await this._readChatFile(chatId)
            const idx = messages.findIndex(m => (m.id || m.key?.id) === msgId)
            if (idx !== -1) {
                messages[idx] = message
            } else {
                messages.push(message)
                if (messages.length > 500) messages.shift()
            }
            await this._writeChatFile(chatId, messages)
        }).catch(() => {})

        this._writeLocks.set(chatId, nextLock)
        return nextLock
    }

    async getMessage(chatId, messageId) {
        if (!chatId || !messageId) return null
        const messages = await this._readChatFile(chatId)
        return messages.find(m => (m.id || m.key?.id) === messageId) || null
    }

    async getMessages(chatId, options = {}) {
        if (!chatId) return []
        const limit = options.limit || 50
        const messages = await this._readChatFile(chatId)
        return messages.slice(-limit)
    }

    async deleteMessage(chatId, messageId) {
        if (!chatId || !messageId) return
        let lock = this._writeLocks.get(chatId) || Promise.resolve()
        const nextLock = lock.then(async () => {
            const messages = await this._readChatFile(chatId)
            const filtered = messages.filter(m => (m.id || m.key?.id) !== messageId)
            await this._writeChatFile(chatId, filtered)
        }).catch(() => {})

        this._writeLocks.set(chatId, nextLock)
        return nextLock
    }

    async clear(chatId) {
        if (chatId) {
            try {
                await fs.unlink(this._getFilePath(chatId))
            } catch {}
        } else {
            try {
                await fs.rm(this.basePath, { recursive: true, force: true })
            } catch {}
        }
    }
}

exports.FileStorageAdapter = FileStorageAdapter
exports.default = FileStorageAdapter
