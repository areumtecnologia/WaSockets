"use strict"

Object.defineProperty(exports, "__esModule", { value: true })

const { JidNormalizer } = require("../Normalizers/JidNormalizer")

class ChannelManager {
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
     * Cria um novo canal / Newsletter
     * @param {string} name
     * @param {string} [description='']
     */
    async create(name, description = '') {
        const sock = this._getSock()
        return sock.newsletterCreate(name, description)
    }

    /**
     * Obtém metadados de um canal por JID ou código de convite
     * @param {string} channelJidOrInvite
     */
    async getMetadata(channelJidOrInvite) {
        const sock = this._getSock()
        const isInvite = !channelJidOrInvite.includes('@')
        const type = isInvite ? 'invite' : 'jid'
        return sock.newsletterMetadata(type, channelJidOrInvite)
    }

    /**
     * Segue / Inscreve-se em um canal
     * @param {string} channelJid
     */
    async subscribe(channelJid) {
        const sock = this._getSock()
        const targetJid = JidNormalizer.toJid(channelJid)
        return sock.newsletterFollow(targetJid)
    }

    /**
     * Deixa de seguir um canal
     * @param {string} channelJid
     */
    async unsubscribe(channelJid) {
        const sock = this._getSock()
        const targetJid = JidNormalizer.toJid(channelJid)
        return sock.newsletterUnfollow(targetJid)
    }

    /**
     * Silencia notificações do canal
     * @param {string} channelJid
     */
    async mute(channelJid) {
        const sock = this._getSock()
        const targetJid = JidNormalizer.toJid(channelJid)
        return sock.newsletterMute(targetJid)
    }

    /**
     * Reativa notificações do canal
     * @param {string} channelJid
     */
    async unmute(channelJid) {
        const sock = this._getSock()
        const targetJid = JidNormalizer.toJid(channelJid)
        return sock.newsletterUnmute(targetJid)
    }

    /**
     * Retorna a lista de todos os canais inscritos da conta
     */
    async listSubscribed() {
        const sock = this._getSock()
        return sock.newsletterSubscribed()
    }

    /**
     * Busca mensagens recentes do canal
     * @param {string} channelJid
     * @param {number} [count=20]
     * @param {number} [sinceTimestamp]
     */
    async fetchMessages(channelJid, count = 20, sinceTimestamp) {
        const sock = this._getSock()
        const targetJid = JidNormalizer.toJid(channelJid)
        if (!sock.newsletterFetchMessages) {
            throw new Error('newsletterFetchMessages indisponível no socket.')
        }
        return sock.newsletterFetchMessages(targetJid, count, sinceTimestamp)
    }

    /**
     * Busca as reações de uma mensagem do canal
     * @param {string} channelJid
     * @param {string} messageServerId
     */
    async fetchReactions(channelJid, messageServerId) {
        const sock = this._getSock()
        const targetJid = JidNormalizer.toJid(channelJid)
        if (!sock.newsletterFetchReactions) {
            throw new Error('newsletterFetchReactions indisponível no socket.')
        }
        return sock.newsletterFetchReactions(targetJid, messageServerId)
    }

    /**
     * Altera o nome do canal
     * @param {string} channelJid
     * @param {string} name
     */
    async setName(channelJid, name) {
        const sock = this._getSock()
        const targetJid = JidNormalizer.toJid(channelJid)
        return sock.newsletterUpdate(targetJid, { name })
    }

    /**
     * Altera a descrição do canal
     * @param {string} channelJid
     * @param {string} description
     */
    async setDescription(channelJid, description) {
        const sock = this._getSock()
        const targetJid = JidNormalizer.toJid(channelJid)
        return sock.newsletterUpdate(targetJid, { description })
    }
}

exports.ChannelManager = ChannelManager
exports.default = ChannelManager
