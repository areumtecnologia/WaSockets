"use strict"

Object.defineProperty(exports, "__esModule", { value: true })

const { JidNormalizer } = require("../Normalizers/JidNormalizer")

class LabelManager {
    /**
     * @param {import('../WaClient').WaClient} client
     */
    constructor(client) {
        this.client = client
    }

    _getSock() {
        if (!this.client.sock) {
            throw new Error('Socket is not connected.')
        }
        return this.client.sock
    }

    /**
     * Cria uma nova etiqueta no WhatsApp Business
     * @param {string} name - Nome da etiqueta
     * @param {number} color - Índice numérico da cor (0 a 19)
     * @param {number} [predefinedId=0]
     */
    async create(name, color = 0, predefinedId = 0) {
        const sock = this._getSock()
        if (!sock.createLabel) {
            throw new Error('createLabel indisponível no socket.')
        }
        return sock.createLabel(name, color, predefinedId)
    }

    /**
     * Atualiza dados de uma etiqueta existente
     * @param {string} id
     * @param {string} name
     * @param {number} color
     * @param {number} [predefinedId=0]
     */
    async update(id, name, color = 0, predefinedId = 0) {
        const sock = this._getSock()
        if (!sock.updateLabel) {
            throw new Error('updateLabel indisponível no socket.')
        }
        return sock.updateLabel(id, name, color, predefinedId)
    }

    /**
     * Remove uma etiqueta
     * @param {string} id
     */
    async delete(id) {
        const sock = this._getSock()
        if (!sock.deleteLabel) {
            throw new Error('deleteLabel indisponível no socket.')
        }
        return sock.deleteLabel(id)
    }

    /**
     * Associa uma etiqueta a uma conversa
     * @param {string} jid
     * @param {string} labelId
     */
    async addChat(jid, labelId) {
        const sock = this._getSock()
        const targetJid = JidNormalizer.toJid(jid)
        if (!sock.addChatLabel) {
            throw new Error('addChatLabel indisponível no socket.')
        }
        return sock.addChatLabel(targetJid, labelId)
    }

    /**
     * Remove uma etiqueta de uma conversa
     * @param {string} jid
     * @param {string} labelId
     */
    async removeChat(jid, labelId) {
        const sock = this._getSock()
        const targetJid = JidNormalizer.toJid(jid)
        if (!sock.removeChatLabel) {
            throw new Error('removeChatLabel indisponível no socket.')
        }
        return sock.removeChatLabel(targetJid, labelId)
    }

    /**
     * Associa uma etiqueta a uma mensagem específica
     * @param {string} jid
     * @param {string} messageId
     * @param {string} labelId
     */
    async addMessage(jid, messageId, labelId) {
        const sock = this._getSock()
        const targetJid = JidNormalizer.toJid(jid)
        if (!sock.addMessageLabel) {
            throw new Error('addMessageLabel indisponível no socket.')
        }
        return sock.addMessageLabel(targetJid, messageId, labelId)
    }

    /**
     * Remove uma etiqueta de uma mensagem
     * @param {string} jid
     * @param {string} messageId
     * @param {string} labelId
     */
    async removeMessage(jid, messageId, labelId) {
        const sock = this._getSock()
        const targetJid = JidNormalizer.toJid(jid)
        if (!sock.removeMessageLabel) {
            throw new Error('removeMessageLabel indisponível no socket.')
        }
        return sock.removeMessageLabel(targetJid, messageId, labelId)
    }
}

exports.LabelManager = LabelManager
exports.default = LabelManager
