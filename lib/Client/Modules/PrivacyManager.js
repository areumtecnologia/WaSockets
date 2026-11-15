"use strict"

Object.defineProperty(exports, "__esModule", { value: true })

const { JidNormalizer } = require("../Normalizers/JidNormalizer")

class PrivacyManager {
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
     * Bloqueia um contato
     * @param {string} jid
     */
    async block(jid) {
        const sock = this._getSock()
        const targetJid = JidNormalizer.toJid(jid)
        return sock.updateBlockStatus(targetJid, 'block')
    }

    /**
     * Desbloqueia um contato
     * @param {string} jid
     */
    async unblock(jid) {
        const sock = this._getSock()
        const targetJid = JidNormalizer.toJid(jid)
        return sock.updateBlockStatus(targetJid, 'unblock')
    }

    /**
     * Retorna a lista de todos os JIDs bloqueados
     * @returns {Promise<string[]>}
     */
    async getBlocklist() {
        const sock = this._getSock()
        return sock.fetchBlocklist()
    }

    /**
     * Configura privacidade de Visto por Último
     * @param {'all'|'contacts'|'contact_blacklist'|'none'} privacy
     */
    async setLastSeen(privacy) {
        const sock = this._getSock()
        return sock.updateLastSeenPrivacy(privacy)
    }

    /**
     * Configura privacidade de Online
     * @param {'all'|'match_last_seen'} privacy
     */
    async setOnline(privacy) {
        const sock = this._getSock()
        return sock.updateOnlinePrivacy(privacy)
    }

    /**
     * Configura privacidade da Foto de Perfil
     * @param {'all'|'contacts'|'contact_blacklist'|'none'} privacy
     */
    async setProfilePicture(privacy) {
        const sock = this._getSock()
        return sock.updateProfilePicturePrivacy(privacy)
    }

    /**
     * Configura privacidade do Recado/Status
     * @param {'all'|'contacts'|'contact_blacklist'|'none'} privacy
     */
    async setAbout(privacy) {
        const sock = this._getSock()
        return sock.updateStatusPrivacy(privacy)
    }

    /**
     * Ativa ou desativa confirmações de leitura (ticks azuis)
     * @param {boolean} enabled
     */
    async setReadReceipts(enabled) {
        const sock = this._getSock()
        return sock.updateReadReceiptsPrivacy(enabled ? 'all' : 'none')
    }
}

exports.PrivacyManager = PrivacyManager
exports.default = PrivacyManager
