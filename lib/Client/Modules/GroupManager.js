"use strict"

Object.defineProperty(exports, "__esModule", { value: true })

const { JidNormalizer } = require("../Normalizers/JidNormalizer")

class GroupManager {
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
     * Cria um novo grupo
     * @param {string} subject - Nome do grupo
     * @param {string[]} participants - Lista de telefones ou JIDs
     */
    async create(subject, participants = []) {
        const sock = this._getSock()
        const jids = participants.map(JidNormalizer.toJid)
        return sock.groupCreate(subject, jids)
    }

    /**
     * Retorna os metadados do grupo (usa cache em memória quando disponível)
     * @param {string} groupJid
     */
    async getMetadata(groupJid) {
        const sock = this._getSock()
        const targetJid = JidNormalizer.toJid(groupJid)
        return sock.groupMetadata(targetJid)
    }

    /**
     * Adiciona participantes ao grupo
     * @param {string} groupJid
     * @param {string[]} participants
     */
    async addMembers(groupJid, participants = []) {
        const sock = this._getSock()
        const targetJid = JidNormalizer.toJid(groupJid)
        const jids = participants.map(JidNormalizer.toJid)
        return sock.groupParticipantsUpdate(targetJid, jids, 'add')
    }

    /**
     * Remove participantes do grupo
     * @param {string} groupJid
     * @param {string[]} participants
     */
    async removeMembers(groupJid, participants = []) {
        const sock = this._getSock()
        const targetJid = JidNormalizer.toJid(groupJid)
        const jids = participants.map(JidNormalizer.toJid)
        return sock.groupParticipantsUpdate(targetJid, jids, 'remove')
    }

    /**
     * Promove membros a administradores do grupo
     * @param {string} groupJid
     * @param {string[]} participants
     */
    async promote(groupJid, participants = []) {
        const sock = this._getSock()
        const targetJid = JidNormalizer.toJid(groupJid)
        const jids = participants.map(JidNormalizer.toJid)
        return sock.groupParticipantsUpdate(targetJid, jids, 'promote')
    }

    /**
     * Rebaixa administradores a membros normais
     * @param {string} groupJid
     * @param {string[]} participants
     */
    async demote(groupJid, participants = []) {
        const sock = this._getSock()
        const targetJid = JidNormalizer.toJid(groupJid)
        const jids = participants.map(JidNormalizer.toJid)
        return sock.groupParticipantsUpdate(targetJid, jids, 'demote')
    }

    /**
     * Obtém o código de convite do grupo
     * @param {string} groupJid
     * @returns {Promise<string>} Código de convite
     */
    async getInviteCode(groupJid) {
        const sock = this._getSock()
        const targetJid = JidNormalizer.toJid(groupJid)
        return sock.groupInviteCode(targetJid)
    }

    /**
     * Revoga o código de convite atual e gera um novo
     * @param {string} groupJid
     * @returns {Promise<string>} Novo código
     */
    async revokeInviteCode(groupJid) {
        const sock = this._getSock()
        const targetJid = JidNormalizer.toJid(groupJid)
        return sock.groupRevokeInvite(targetJid)
    }

    /**
     * Entra em um grupo através de um código de convite
     * @param {string} inviteCode
     * @returns {Promise<string>} JID do grupo
     */
    async joinWithCode(inviteCode) {
        const sock = this._getSock()
        const cleanCode = inviteCode.replace('https://chat.whatsapp.com/', '').trim()
        return sock.groupAcceptInvite(cleanCode)
    }

    /**
     * Altera o assunto/nome do grupo
     * @param {string} groupJid
     * @param {string} subject
     */
    async setSubject(groupJid, subject) {
        const sock = this._getSock()
        const targetJid = JidNormalizer.toJid(groupJid)
        return sock.groupUpdateSubject(targetJid, subject)
    }

    /**
     * Altera a descrição do grupo
     * @param {string} groupJid
     * @param {string} description
     */
    async setDescription(groupJid, description) {
        const sock = this._getSock()
        const targetJid = JidNormalizer.toJid(groupJid)
        return sock.groupUpdateDescription(targetJid, description)
    }

    /**
     * Define se apenas administradores podem enviar mensagens
     * @param {string} groupJid
     * @param {boolean} announceOnly
     */
    async setAnnounceOnly(groupJid, announceOnly = true) {
        const sock = this._getSock()
        const targetJid = JidNormalizer.toJid(groupJid)
        return sock.groupSettingUpdate(targetJid, announceOnly ? 'announcement' : 'not_announcement')
    }

    /**
     * Define se apenas administradores podem alterar as configurações do grupo
     * @param {string} groupJid
     * @param {boolean} locked
     */
    async setLocked(groupJid, locked = true) {
        const sock = this._getSock()
        const targetJid = JidNormalizer.toJid(groupJid)
        return sock.groupSettingUpdate(targetJid, locked ? 'locked' : 'unlocked')
    }

    /**
     * Menciona todos os membros do grupo em uma mensagem
     * @param {string} groupJid
     * @param {string|Object} textOrContent
     * @param {Object} [options={}]
     */
    async mentionAll(groupJid, textOrContent, options = {}) {
        const sock = this._getSock()
        const targetJid = JidNormalizer.toJid(groupJid)
        const content = typeof textOrContent === 'string' ? { text: textOrContent } : textOrContent

        if (sock.groupSendMentionAll) {
            return sock.groupSendMentionAll(targetJid, content, options)
        }

        // Fallback: busca participantes e anexa em mentions
        const meta = await this.getMetadata(targetJid)
        const participants = (meta.participants || []).map(p => p.id)
        return this.client.sendMessage(targetJid, {
            ...content,
            mentions: participants
        }, options)
    }
}

exports.GroupManager = GroupManager
exports.default = GroupManager
