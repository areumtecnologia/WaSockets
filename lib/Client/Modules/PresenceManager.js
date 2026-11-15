"use strict"

Object.defineProperty(exports, "__esModule", { value: true })

const { JidNormalizer } = require("../Normalizers/JidNormalizer")

class PresenceManager {
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
     * Inicia estado 'digitando' com retorno de objeto cancelador
     * @param {string} jid
     * @returns {{ stop: () => Promise<void> }}
     */
    startTyping(jid) {
        return this.client.startTyping(jid)
    }

    /**
     * Inicia simulação de gravação de áudio com cancelador
     * @param {string} jid
     * @returns {{ stop: () => Promise<void> }}
     */
    startRecording(jid) {
        return this.client.startRecording(jid)
    }

    /**
     * Define a presença da conta como online/disponível
     */
    async setOnline() {
        const sock = this._getSock()
        return sock.sendPresenceUpdate('available')
    }

    /**
     * Define a presença da conta como offline/indisponível
     */
    async setOffline() {
        const sock = this._getSock()
        return sock.sendPresenceUpdate('unavailable')
    }

    /**
     * Assina atualizações de presença em tempo real de um contato
     * @param {string} jid
     */
    async subscribe(jid) {
        const sock = this._getSock()
        const targetJid = JidNormalizer.toJid(jid)
        return sock.presenceSubscribe(targetJid)
    }
}

exports.PresenceManager = PresenceManager
exports.default = PresenceManager
