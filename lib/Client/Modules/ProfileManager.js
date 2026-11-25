"use strict"

Object.defineProperty(exports, "__esModule", { value: true })

const { JidNormalizer } = require("../Normalizers/JidNormalizer")

class ProfileManager {
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
     * Atualiza o nome de exibição (pushName) do bot
     * @param {string} name
     */
    async updateName(name) {
        const sock = this._getSock()
        return sock.updateProfileName(name)
    }

    /**
     * Atualiza o recado / status de texto da conta
     * @param {string} aboutText
     */
    async updateAbout(aboutText) {
        const sock = this._getSock()
        return sock.updateProfileStatus(aboutText)
    }

    /**
     * Obtém o recado de um contato ou da própria conta (compatível com UnityChat)
     * @param {string} [jid]
     * @returns {Promise<{ id: string, status: string|null, isPrivate: boolean, setAt?: Date }|null>}
     */
    async getAbout(jid) {
        const sock = this._getSock()
        let targetJid = jid ? JidNormalizer.toJid(jid).replace(/:.*?@/, '@') : sock.user?.id?.replace(/:.*?@/, '@')

        // Resolve PN <-> LID alternativo para tentar ambos se o primeiro retornar vazio
        let altJid = null
        if (targetJid && targetJid.endsWith('@lid') && this.client.users?.getPnForLid) {
            altJid = await this.client.users.getPnForLid(targetJid, true).catch(() => null)
        } else if (targetJid && targetJid.endsWith('@s.whatsapp.net') && this.client.users?.getLidForPn) {
            altJid = await this.client.users.getLidForPn(targetJid, true).catch(() => null)
        }

        const parseStatusResponse = (raw) => {
            if (!raw) return null
            let statusText = null
            let setAt = null

            if (Array.isArray(raw) && raw.length > 0) {
                const first = raw[0]
                if (typeof first === 'string') statusText = first
                else if (typeof first?.status === 'string') {
                    statusText = first.status
                    setAt = first.setAt || null
                } else if (typeof first?.status === 'object') {
                    statusText = first.status?.status || null
                    setAt = first.status?.setAt || first.setAt || null
                }
            } else if (typeof raw === 'string') {
                statusText = raw
            } else if (raw && typeof raw === 'object') {
                if (typeof raw.status === 'string') {
                    statusText = raw.status
                    setAt = raw.setAt || null
                } else if (typeof raw.status === 'object') {
                    statusText = raw.status?.status || null
                    setAt = raw.status?.setAt || raw.setAt || null
                }
            }

            const text = (typeof statusText === 'string')
                ? statusText
                : null

            return { text, setAt }
        }

        try {
            let parsed = null
            let raw = await sock.fetchStatus(targetJid).catch(() => null)
            if (raw) {
                parsed = parseStatusResponse(raw)
            }

            // Se não encontrou texto e temos JID alternativo (ex: LID ou PN), tenta com ele
            if ((!parsed || parsed.text === null) && altJid) {
                const altRaw = await sock.fetchStatus(altJid).catch(() => null)
                if (altRaw) {
                    const altParsed = parseStatusResponse(altRaw)
                    if (altParsed && altParsed.text !== null) {
                        parsed = altParsed
                    } else if (!parsed && altParsed) {
                        parsed = altParsed
                    }
                }
            }

            const statusText = parsed?.text ?? null
            const setAt = parsed?.setAt || null

            return {
                id: targetJid,
                status: statusText,
                isPrivate: statusText === null,
                setAt,
                toString() {
                    return this.status || ''
                }
            }
        } catch {
            return null
        }
    }

    /**
     * Atualiza a foto de perfil da conta ou de um grupo
     * @param {string} jidOrSelf - 'me' ou JID
     * @param {string|Buffer|Object} imageSource
     */
    async updatePicture(jidOrSelf, imageSource) {
        const sock = this._getSock()
        const isSelf = !jidOrSelf || jidOrSelf === 'me'
        const targetJid = isSelf ? sock.user?.id : JidNormalizer.toJid(jidOrSelf)
        const content = typeof imageSource === 'string' ? { url: imageSource } : imageSource
        return sock.updateProfilePicture(targetJid, content)
    }

    /**
     * Remove a foto de perfil
     * @param {string} [jidOrSelf]
     */
    async removePicture(jidOrSelf) {
        const sock = this._getSock()
        const isSelf = !jidOrSelf || jidOrSelf === 'me'
        const targetJid = isSelf ? sock.user?.id : JidNormalizer.toJid(jidOrSelf)
        return sock.removeProfilePicture(targetJid)
    }

    /**
     * Obtém a URL da foto de perfil
     * @param {string} jid
     * @param {boolean} [highRes=true] - Se true, busca imagem em alta resolução
     * @returns {Promise<string|null>}
     */
    async getPictureUrl(jid, highRes = true) {
        const sock = this._getSock()
        const targetJid = JidNormalizer.toJid(jid)
        try {
            return await sock.profilePictureUrl(targetJid, highRes ? 'image' : 'preview')
        } catch {
            return null
        }
    }
}

exports.ProfileManager = ProfileManager
exports.default = ProfileManager
