"use strict"

Object.defineProperty(exports, "__esModule", { value: true })

const { JidNormalizer } = require("../Normalizers/JidNormalizer")
const { CallContext } = require("../Context/CallContext")

class VoipManager {
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
     * Realiza uma chamada de voz WhatsApp via WebAssembly
     * @param {string} phoneNumber - Telefone ou JID de destino
     * @param {Object} [options={}]
     * @returns {Promise<CallContext>}
     */
    async call(phoneNumber, options = {}) {
        const sock = this._getSock()
        if (!sock.call) {
            throw new Error('VoIP engine is not enabled in this WaSockets build.')
        }
        const cleanNumber = JidNormalizer.toPhoneNumber(phoneNumber) || phoneNumber
        const activeCall = await sock.call(cleanNumber, { ...options, isVideo: false })
        return new CallContext(this.client, {
            id: activeCall.callId,
            from: cleanNumber,
            isVideo: false,
            status: 'calling'
        }, activeCall)
    }

    /**
     * Realiza uma chamada de vídeo WhatsApp
     * @param {string} phoneNumber
     * @param {Object} [options={}]
     * @returns {Promise<CallContext>}
     */
    async callVideo(phoneNumber, options = {}) {
        const sock = this._getSock()
        if (!sock.callVideo && !sock.call) {
            throw new Error('VoIP engine is not enabled in this WaSockets build.')
        }
        const cleanNumber = JidNormalizer.toPhoneNumber(phoneNumber) || phoneNumber
        const fn = sock.callVideo ? sock.callVideo.bind(sock) : (num, opts) => sock.call(num, { ...opts, isVideo: true })
        const activeCall = await fn(cleanNumber, options)
        return new CallContext(this.client, {
            id: activeCall.callId,
            from: cleanNumber,
            isVideo: true,
            status: 'calling'
        }, activeCall)
    }

    /**
     * Retorna a chamada ativa no momento ou null
     * @returns {CallContext|null}
     */
    get activeCall() {
        const sock = this.client.sock
        const rawCall = sock?.activeCall
        if (!rawCall) return null

        return new CallContext(this.client, {
            id: rawCall.callId,
            from: rawCall.target,
            isVideo: Boolean(rawCall.isVideo),
            status: rawCall.state || 'active'
        }, rawCall.instance || rawCall)
    }

    /**
     * Limpa o estado da chamada ativa atual
     */
    clearActiveCall() {
        const sock = this.client.sock
        if (sock?.clearActiveCall) {
            sock.clearActiveCall()
        }
    }

    /**
     * Atende uma chamada recebida diretamente pelo ID
     * @param {string} callId
     * @param {string} from
     * @param {Object} [options={}]
     */
    async acceptCall(callId, from, options = {}) {
        const ctx = new CallContext(this.client, { id: callId, from, isVideo: options.isVideo })
        return ctx.accept(options)
    }

    /**
     * Rejeita uma chamada recebida
     * @param {string} callId
     * @param {string} from
     * @param {number|string} [reason=0]
     */
    async rejectCall(callId, from, reason = 0) {
        const ctx = new CallContext(this.client, { id: callId, from })
        return ctx.reject(reason)
    }
}

exports.VoipManager = VoipManager
exports.default = VoipManager
