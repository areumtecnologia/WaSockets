"use strict"

Object.defineProperty(exports, "__esModule", { value: true })

const { JidNormalizer } = require("../Normalizers/JidNormalizer")

class GroupManager {
    /**
     * @param {import('../WaClient').WaClient} client
     */
    constructor(client) {
        this.client = client
        this._metadataCache = new Map()
        this._metadataTtlMs = 5 * 60 * 1000
    }

    _getCachedMetadata(groupJid) {
        const targetJid = JidNormalizer.toJid(groupJid)
        const entry = this._metadataCache.get(targetJid)
        if (!entry) return undefined
        if (Date.now() > entry.expiresAt) {
            this._metadataCache.delete(targetJid)
            return undefined
        }
        return entry.data
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
        const cached = this._getCachedMetadata(targetJid)
        if (cached) {
            return cached
        }
        const meta = await sock.groupMetadata(targetJid)
        if (meta) {
            this._metadataCache.set(targetJid, {
                data: meta,
                expiresAt: Date.now() + this._metadataTtlMs
            })
        }
        return meta
    }

    /**
     * Sai de um grupo
     * @param {string} groupJid
     */
    async leave(groupJid) {
        const sock = this._getSock()
        const targetJid = JidNormalizer.toJid(groupJid)
        this._metadataCache.delete(targetJid)
        return sock.groupLeave(targetJid)
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

    /**
     * Adiciona participantes ao grupo (alias compatível com UnityChat)
     */
    async addParticipants(groupJid, participants = []) {
        return this.addMembers(groupJid, participants)
    }

    /**
     * Remove participantes do grupo (alias compatível com UnityChat)
     */
    async removeParticipants(groupJid, participants = []) {
        return this.removeMembers(groupJid, participants)
    }

    /**
     * Promove participantes a administradores (alias compatível com UnityChat)
     */
    async promoteParticipants(groupJid, participants = []) {
        return this.promote(groupJid, participants)
    }

    /**
     * Rebaixa administradores a membros comuns (alias compatível com UnityChat)
     */
    async demoteParticipants(groupJid, participants = []) {
        return this.demote(groupJid, participants)
    }

    /**
     * Atualização dinâmica de participantes (compatível com UnityChat)
     */
    async updateParticipants(groupJid, participants = [], action = 'add') {
        switch (action) {
            case 'add': return this.addMembers(groupJid, participants)
            case 'remove': return this.removeMembers(groupJid, participants)
            case 'promote': return this.promote(groupJid, participants)
            case 'demote': return this.demote(groupJid, participants)
            default: throw new Error(`Ação de participante inválida: ${action}`)
        }
    }

    /**
     * Atualiza o nome do grupo (alias compatível com UnityChat)
     */
    async updateName(groupJid, newName) {
        return this.setSubject(groupJid, newName)
    }

    /**
     * Atualiza a descrição do grupo (alias compatível com UnityChat)
     */
    async updateDescription(groupJid, newDescription) {
        return this.setDescription(groupJid, newDescription)
    }

    /**
     * Retorna todos os grupos em que o cliente participa (compatível com UnityChat)
     */
    async getAllGroups() {
        const sock = this._getSock()
        const groups = await sock.groupFetchAllParticipating()
        return Object.values(groups || {})
    }

    /**
     * Retorna a URL da foto de perfil do grupo ou usuário (compatível com UnityChat)
     */
    async getProfilePicture(jid) {
        return this.client.profile.getPictureUrl(jid)
    }

    /**
     * Define a etiqueta de membro própria no grupo (se suportado pelo socket)
     */
    async updateMemberLabel(groupJid, label) {
        const sock = this._getSock()
        if (sock.updateMemberLabel) {
            return sock.updateMemberLabel(groupJid, label)
        }
        return null
    }
}

exports.GroupManager = GroupManager
exports.default = GroupManager
