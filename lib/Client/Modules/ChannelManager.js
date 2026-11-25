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
     * @param {string|Buffer|Object} [picture]
     */
    async create(name, description = '', picture) {
        const sock = this._getSock()
        const created = await sock.newsletterCreate(name, description)
        if (picture && created?.id) {
            await this.updatePicture(created.id, picture).catch(() => {})
        }
        return created
    }

    /**
     * Exclui permanentemente um canal criado pelo bot
     * @param {string} channelJid
     */
    async delete(channelJid) {
        const sock = this._getSock()
        const targetJid = JidNormalizer.toJid(channelJid)
        return sock.newsletterDelete(targetJid)
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
     * @param {number} [duration]
     */
    async mute(channelJid, duration) {
        const sock = this._getSock()
        const targetJid = JidNormalizer.toJid(channelJid)
        return sock.newsletterMute(targetJid, duration)
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
     * @returns {Promise<Array<Object>>}
     */
    async listSubscribed() {
        const sock = this._getSock()
        const res = await sock.newsletterSubscribed().catch(() => [])
        if (Array.isArray(res)) return res
        if (Array.isArray(res?.xwa2_newsletter_subscribed)) return res.xwa2_newsletter_subscribed
        return []
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

    /**
     * Atualiza a imagem do canal
     * @param {string} channelJid
     * @param {string|Buffer|Object} picture
     */
    async updatePicture(channelJid, picture) {
        const sock = this._getSock()
        const targetJid = JidNormalizer.toJid(channelJid)
        const media = typeof picture === 'string' ? { url: picture } : picture
        return sock.newsletterUpdatePicture(targetJid, media)
    }

    /**
     * Alias para updatePicture
     * @param {string} channelJid
     * @param {string|Buffer|Object} picture
     */
    async setPicture(channelJid, picture) {
        return this.updatePicture(channelJid, picture)
    }

    /**
     * Atualiza múltiplos campos do canal em paralelo
     * @param {string} channelJid
     * @param {{ name?: string, description?: string, picture?: string|Buffer|Object }} data
     */
    async update(channelJid, { name, description, picture } = {}) {
        return Promise.all([
            name ? this.setName(channelJid, name) : Promise.resolve(),
            description ? this.setDescription(channelJid, description) : Promise.resolve(),
            picture ? this.updatePicture(channelJid, picture) : Promise.resolve()
        ])
    }

    /**
     * Atualiza o modo de reação de um canal (`'ALL' | 'BASIC' | 'NONE'`)
     * @param {string} channelJid
     * @param {'ALL'|'BASIC'|'NONE'} [mode='ALL']
     */
    async updateReactionMode(channelJid, mode = 'ALL') {
        const sock = this._getSock()
        const targetJid = JidNormalizer.toJid(channelJid)
        if (!sock.newsletterReactionMode) {
            throw new Error('newsletterReactionMode indisponível no socket.')
        }
        return sock.newsletterReactionMode(targetJid, mode)
    }

    /** Alias para updateReactionMode */
    async setReactionMode(channelJid, mode = 'ALL') {
        return this.updateReactionMode(channelJid, mode)
    }

    /** Alias compatível com UnityChat */
    async follow(channelJid) {
        return this.subscribe(channelJid)
    }

    /** Alias compatível com UnityChat */
    async unfollow(channelJid) {
        return this.unsubscribe(channelJid)
    }

    /** Alias compatível com UnityChat */
    async getAllNewsletters() {
        return this.listSubscribed()
    }

    /** Alias compatível com UnityChat */
    async updateName(channelJid, name) {
        return this.setName(channelJid, name)
    }

    /** Alias compatível com UnityChat */
    async updateDescription(channelJid, description) {
        return this.setDescription(channelJid, description)
    }
}

exports.ChannelManager = ChannelManager
exports.default = ChannelManager
