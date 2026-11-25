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
     * Obtém metadados normalizados de um contato (busca em cache ou normaliza)
     * @param {string} jid
     */
    async getMetadata(jid) {
        const targetJid = JidNormalizer.toJid(jid)
        const cached = this.client.contacts?.get(targetJid)
        if (cached) {
            return cached
        }
        return this.client.contacts.normalize({ key: { remoteJid: targetJid } })
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
     * Converte um identificador LID (@lid) para o número de telefone (@s.whatsapp.net) (compatível com UnityChat)
     * @param {string} lidJid
     * @param {boolean} [fetchIfMissing=false]
     * @returns {Promise<string|null>} Telefone no formato JID
     */
    async getPnForLid(lidJid, fetchIfMissing = false) {
        if (!lidJid) return null
        const cleanLid = JidNormalizer.toJid(lidJid).replace(/:.*?@/, '@')
        const sock = this._getSock()

        // 1. Tenta obter do Signal Repository (idêntico ao UnityChat)
        if (sock.signalRepository?.lidMapping?.getPNForLID) {
            try {
                const pn = await sock.signalRepository.lidMapping.getPNForLID(cleanLid)
                if (pn) {
                    const normalized = JidNormalizer.toJid(pn).replace(/:.*?@/, '@')
                    if (this.client.contacts?.lidToPnMap) {
                        this.client.contacts.lidToPnMap.set(cleanLid, normalized)
                    }
                    return normalized
                }
            } catch {}
        }

        // 2. Tenta método toPn do sock Baileys
        if (sock.toPn) {
            try {
                const pn = await sock.toPn(cleanLid, fetchIfMissing)
                if (pn) {
                    const normalized = JidNormalizer.toJid(pn).replace(/:.*?@/, '@')
                    if (this.client.contacts?.lidToPnMap) {
                        this.client.contacts.lidToPnMap.set(cleanLid, normalized)
                    }
                    return normalized
                }
            } catch {}
        }

        // 3. Tenta do cache em memória do ContactManager
        if (this.client.contacts?.lidToPnMap?.has(cleanLid)) {
            return this.client.contacts.lidToPnMap.get(cleanLid)
        }

        return null
    }

    /**
     * Converte um telefone (@s.whatsapp.net) para seu LID (@lid) correspondente (compatível com UnityChat)
     * @param {string} pnJid
     * @param {boolean} [fetchIfMissing=false]
     * @returns {Promise<string|null>} LID no formato JID
     */
    async getLidForPn(pnJid, fetchIfMissing = false) {
        if (!pnJid) return null
        const cleanPn = JidNormalizer.toJid(pnJid).replace(/:.*?@/, '@')
        const sock = this._getSock()

        if (sock.signalRepository?.lidMapping?.getLIDForPN) {
            try {
                const lid = await sock.signalRepository.lidMapping.getLIDForPN(cleanPn)
                if (lid) {
                    return JidNormalizer.toJid(lid).replace(/:.*?@/, '@')
                }
            } catch {}
        }

        if (sock.toLid) {
            try {
                const lid = await sock.toLid(cleanPn, fetchIfMissing)
                if (lid) {
                    return JidNormalizer.toJid(lid).replace(/:.*?@/, '@')
                }
            } catch {}
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

    /**
     * Obtém o recado/status de um usuário diretamente via sock.fetchStatus (100% compatível com UnityChat)
     * @param {string} id - O ID ou JID do contato.
     * @returns {Promise<object[]>} - O array bruto retornado pelo Baileys sock.fetchStatus.
     */
    async getStatus(id) {
        const sock = this._getSock()
        let targetId = id ? JidNormalizer.toJid(id).replace(/:.*?@/, '@') : sock.user?.id?.replace(/:.*?@/, '@')
        return sock.fetchStatus(targetId)
    }

    /**
     * Obtém a URL da foto de perfil de um usuário (compatível com UnityChat)
     */
    async getProfilePicture(jid) {
        return this.client.profile.getPictureUrl(jid)
    }

    /**
     * Obtém o recado da própria conta autenticada do bot (100% compatível com UnityChat)
     * @returns {Promise<object[]>} - O array de status retornado pelo Baileys sock.fetchStatus.
     */
    async getMyStatus() {
        const sock = this._getSock()
        const wid = sock.user?.id ? sock.user.id.replace(/:.*?@/, '@') : null
        if (!wid) return null
        return this.getStatus(wid)
    }

    /**
     * Atualiza o nome de perfil do próprio bot (compatível com UnityChat)
     */
    async updateProfileName(name) {
        return this.client.profile.updateName(name)
    }

    /**
     * Atualiza o recado/bio do próprio bot (compatível com UnityChat)
     */
    async updateProfileStatus(status) {
        return this.client.profile.updateAbout(status)
    }

    /**
     * Bloqueia um contato (compatível com UnityChat)
     */
    async block(jid) {
        return this.client.privacy.block(jid)
    }

    /**
     * Desbloqueia um contato (compatível com UnityChat)
     */
    async unblock(jid) {
        return this.client.privacy.unblock(jid)
    }

    /**
     * Retorna a lista de JIDs bloqueados (compatível com UnityChat)
     */
    async getBlocklist() {
        return this.client.privacy.getBlocklist()
    }

    /**
     * Envia atualização de presença para um contato
     */
    async sendPresence(jid, presenceStatus) {
        const sock = this._getSock()
        const targetJid = JidNormalizer.toJid(jid)
        return sock.sendPresenceUpdate(presenceStatus, targetJid)
    }

    /** Atualiza privacidade do Visto por Último (alias compatível com UnityChat) */
    async updateLastSeenPrivacy(value) {
        return this.client.privacy.setLastSeen(value)
    }

    /** Atualiza privacidade do Visto Online (alias compatível com UnityChat) */
    async updateOnlinePrivacy(value) {
        return this.client.privacy.setOnline(value)
    }

    /** Atualiza privacidade das confirmações de leitura (alias compatível com UnityChat) */
    async updateReadReceiptsPrivacy(value) {
        const enabled = typeof value === 'boolean' ? value : value === 'all'
        return this.client.privacy.setReadReceipts(enabled)
    }
}

exports.UserManager = UserManager
exports.default = UserManager
