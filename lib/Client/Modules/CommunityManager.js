"use strict"

Object.defineProperty(exports, "__esModule", { value: true })

const { JidNormalizer } = require("../Normalizers/JidNormalizer")

class CommunityManager {
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
     * Cria uma nova comunidade (grupo pai de avisos)
     * @param {string} subject - Nome da comunidade
     * @param {string} [description=''] - Descrição da comunidade
     */
    async create(subject, description = '') {
        const sock = this._getSock()
        if (!sock.communityCreate) {
            throw new Error('communityCreate indisponível no socket.')
        }
        return sock.communityCreate(subject, description)
    }

    /**
     * Obtém metadados da comunidade
     * @param {string} communityJid
     */
    async getMetadata(communityJid) {
        const sock = this._getSock()
        const targetJid = JidNormalizer.toJid(communityJid)
        if (!sock.communityMetadata) {
            throw new Error('communityMetadata indisponível no socket.')
        }
        return sock.communityMetadata(targetJid)
    }

    /**
     * Cria um novo subgrupo já vinculado à comunidade
     * @param {string} communityJid
     * @param {string} subject - Nome do subgrupo
     * @param {string[]} [participants=[]]
     */
    async createSubgroup(communityJid, subject, participants = []) {
        const sock = this._getSock()
        const targetJid = JidNormalizer.toJid(communityJid)
        const jids = participants.map(JidNormalizer.toJid)
        if (!sock.communityCreateGroup) {
            throw new Error('communityCreateGroup indisponível no socket.')
        }
        return sock.communityCreateGroup(subject, jids, targetJid)
    }

    /**
     * Vincula um grupo existente à comunidade
     * @param {string} communityJid
     * @param {string} groupJid
     */
    async linkSubgroup(communityJid, groupJid) {
        const sock = this._getSock()
        const parentJid = JidNormalizer.toJid(communityJid)
        const childJid = JidNormalizer.toJid(groupJid)
        if (!sock.communityLinkGroup) {
            throw new Error('communityLinkGroup indisponível no socket.')
        }
        return sock.communityLinkGroup(childJid, parentJid)
    }

    /**
     * Desvincula um subgrupo da comunidade
     * @param {string} communityJid
     * @param {string} groupJid
     */
    async unlinkSubgroup(communityJid, groupJid) {
        const sock = this._getSock()
        const parentJid = JidNormalizer.toJid(communityJid)
        const childJid = JidNormalizer.toJid(groupJid)
        if (!sock.communityUnlinkGroup) {
            throw new Error('communityUnlinkGroup indisponível no socket.')
        }
        return sock.communityUnlinkGroup(childJid, parentJid)
    }

    /**
     * Retorna a lista de subgrupos vinculados à comunidade
     * @param {string} communityJid
     */
    async getSubgroups(communityJid) {
        const sock = this._getSock()
        const targetJid = JidNormalizer.toJid(communityJid)
        if (!sock.communityFetchLinkedGroups) {
            throw new Error('communityFetchLinkedGroups indisponível no socket.')
        }
        return sock.communityFetchLinkedGroups(targetJid)
    }

    /**
     * Sai da comunidade
     * @param {string} communityJid
     */
    async leave(communityJid) {
        const sock = this._getSock()
        const targetJid = JidNormalizer.toJid(communityJid)
        if (!sock.communityLeave) {
            throw new Error('communityLeave indisponível no socket.')
        }
        return sock.communityLeave(targetJid)
    }

    /**
     * Altera o nome da comunidade
     * @param {string} communityJid
     * @param {string} subject
     */
    async setName(communityJid, subject) {
        const sock = this._getSock()
        const targetJid = JidNormalizer.toJid(communityJid)
        if (!sock.communityUpdateSubject) {
            throw new Error('communityUpdateSubject indisponível no socket.')
        }
        return sock.communityUpdateSubject(targetJid, subject)
    }
}

exports.CommunityManager = CommunityManager
exports.default = CommunityManager
