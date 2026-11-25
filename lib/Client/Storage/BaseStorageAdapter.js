"use strict"

Object.defineProperty(exports, "__esModule", { value: true })

/**
 * Abstract storage interface for persisting messages and session data.
 */
class BaseStorageAdapter {
    /**
     * Saves a message to the store
     * @param {string} chatId
     * @param {Object} message
     * @returns {Promise<void>}
     */
    async saveMessage(chatId, message) {
        throw new Error('BaseStorageAdapter.saveMessage: Not implemented.')
    }

    /**
     * Alias for saveMessage providing backward compatibility with UnityChat
     * @param {string} chatId
     * @param {Object} message
     * @returns {Promise<void>}
     */
    async setMessage(chatId, message) {
        return this.saveMessage(chatId, message)
    }

    /**
     * Retrieves a single message by ID
     * @param {string} chatId
     * @param {string} messageId
     * @returns {Promise<Object|null>}
     */
    async getMessage(chatId, messageId) {
        throw new Error('BaseStorageAdapter.getMessage: Not implemented.')
    }

    /**
     * Retrieves multiple messages from a chat
     * @param {string} chatId
     * @param {Object} [options={}]
     * @param {number} [options.limit=50]
     * @returns {Promise<Array<Object>>}
     */
    async getMessages(chatId, options = {}) {
        throw new Error('BaseStorageAdapter.getMessages: Not implemented.')
    }

    /**
     * Deletes a message from the store
     * @param {string} chatId
     * @param {string} messageId
     * @returns {Promise<void>}
     */
    async deleteMessage(chatId, messageId) {
        throw new Error('BaseStorageAdapter.deleteMessage: Not implemented.')
    }

    /**
     * Clears messages for a chat or all chats
     * @param {string} [chatId]
     * @returns {Promise<void>}
     */
    async clear(chatId) {
        throw new Error('BaseStorageAdapter.clear: Not implemented.')
    }
}

exports.BaseStorageAdapter = BaseStorageAdapter
exports.default = BaseStorageAdapter
