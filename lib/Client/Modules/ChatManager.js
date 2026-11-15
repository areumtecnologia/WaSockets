"use strict"

Object.defineProperty(exports, "__esModule", { value: true })

const { JidNormalizer } = require("../Normalizers/JidNormalizer")

class ChatManager {
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
     * Fixa a conversa no topo
     * @param {string} jid
     */
    async pin(jid) {
        const sock = this._getSock()
        const targetJid = JidNormalizer.toJid(jid)
        return sock.chatModify({ pin: true }, targetJid)
    }

    /**
     * Desafixa a conversa do topo
     * @param {string} jid
     */
    async unpin(jid) {
        const sock = this._getSock()
        const targetJid = JidNormalizer.toJid(jid)
        return sock.chatModify({ pin: false }, targetJid)
    }

    /**
     * Silencia notificações do chat
     * @param {string} jid
     * @param {number} [durationMs=86400000] - Duração em ms (padrão: 24h, null para permanente)
     */
    async mute(jid, durationMs = 86400000) {
        const sock = this._getSock()
        const targetJid = JidNormalizer.toJid(jid)
        return sock.chatModify({ mute: durationMs }, targetJid)
    }

    /**
     * Reativa o som do chat
     * @param {string} jid
     */
    async unmute(jid) {
        const sock = this._getSock()
        const targetJid = JidNormalizer.toJid(jid)
        return sock.chatModify({ mute: null }, targetJid)
    }

    /**
     * Arquiva uma conversa
     * @param {string} jid
     */
    async archive(jid) {
        const sock = this._getSock()
        const targetJid = JidNormalizer.toJid(jid)
        return sock.chatModify({ archive: true }, targetJid)
    }

    /**
     * Desarquiva uma conversa
     * @param {string} jid
     */
    async unarchive(jid) {
        const sock = this._getSock()
        const targetJid = JidNormalizer.toJid(jid)
        return sock.chatModify({ archive: false }, targetJid)
    }

    /**
     * Marca ou desmarca o chat como favorito
     * @param {string} jid
     * @param {boolean} [isFavorite=true]
     */
    async setFavorite(jid, isFavorite = true) {
        const sock = this._getSock()
        const targetJid = JidNormalizer.toJid(jid)
        if (!sock.updateFavorite) {
            throw new Error('updateFavorite indisponível no socket.')
        }
        return sock.updateFavorite(targetJid, isFavorite)
    }

    /**
     * Salva uma anotação interna no contato (recurso exclusivo WaSockets)
     * @param {string} jid
     * @param {string} note
     */
    async setChatNote(jid, note) {
        const sock = this._getSock()
        const targetJid = JidNormalizer.toJid(jid)
        if (!sock.updateChatNote) {
            throw new Error('updateChatNote indisponível no socket.')
        }
        return sock.updateChatNote(targetJid, note)
    }
}

exports.ChatManager = ChatManager
exports.default = ChatManager
