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
     * Obtém o recado de um contato ou da própria conta
     * @param {string} [jid]
     */
    async getAbout(jid) {
        const sock = this._getSock()
        const targetJid = jid ? JidNormalizer.toJid(jid) : sock.user?.id
        return sock.fetchStatus(targetJid)
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
