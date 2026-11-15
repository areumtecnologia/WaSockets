"use strict"

Object.defineProperty(exports, "__esModule", { value: true })

const { JidNormalizer } = require("../Normalizers/JidNormalizer")

class UserManager {
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
     * Verifica se um número ou JID existe no WhatsApp
     * @param {string} phoneOrJid
     * @returns {Promise<{ exists: boolean, jid: string } | null>}
     */
    async isOnWhatsApp(phoneOrJid) {
        return this.client.isOnWhatsApp(phoneOrJid)
    }

    /**
     * Resolve um JID de forma transparente para PN ou LID
     * @param {string} jidOrPhone
     * @param {boolean} [fetchIfMissing=false]
     * @returns {Promise<string>} JID canônico resolvido
     */
    async resolveJid(jidOrPhone, fetchIfMissing = false) {
        const sock = this._getSock()
        if (sock.resolveJid) {
            return sock.resolveJid(jidOrPhone, fetchIfMissing)
        }
        return JidNormalizer.toJid(jidOrPhone)
    }

    /**
     * Converte um identificador LID (@lid) para o número de telefone (@s.whatsapp.net)
     * @param {string} lidJid
     * @param {boolean} [fetchIfMissing=false]
     * @returns {Promise<string|null>} Telefone no formato JID
     */
    async getPnForLid(lidJid, fetchIfMissing = false) {
        const sock = this._getSock()
        if (sock.toPn) {
            return sock.toPn(lidJid, fetchIfMissing)
        }
        return null
    }

    /**
     * Converte um telefone (@s.whatsapp.net) para seu LID (@lid) correspondente
     * @param {string} pnJid
     * @param {boolean} [fetchIfMissing=false]
     * @returns {Promise<string|null>} LID no formato JID
     */
    async getLidForPn(pnJid, fetchIfMissing = false) {
        const sock = this._getSock()
        if (sock.toLid) {
            return sock.toLid(pnJid, fetchIfMissing)
        }
        return null
    }

    /**
     * Obtém o perfil comercial de uma conta WhatsApp Business
     * @param {string} jid
     */
    async getBusinessProfile(jid) {
        const sock = this._getSock()
        const targetJid = JidNormalizer.toJid(jid)
        if (!sock.getBusinessProfile) {
            return null
        }
        try {
            return await sock.getBusinessProfile(targetJid)
        } catch {
            return null
        }
    }
}

exports.UserManager = UserManager
exports.default = UserManager
