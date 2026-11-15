"use strict"

Object.defineProperty(exports, "__esModule", { value: true })

const { JidNormalizer } = require("../Normalizers/JidNormalizer")

class CallContext {
    /**
     * @param {import('../WaClient').WaClient} client
     * @param {Object} callData - Inbound call offer or active call metadata
     * @param {Object} [activeCallInstance] - Low-level WebAssembly ActiveCall instance
     */
    constructor(client, callData, activeCallInstance = null) {
        this.client = client
        this.raw = callData || {}

        this.id = this.raw.id || this.raw.callId || ''
        this.from = this.raw.from || this.raw.chatId || ''
        this.fromNumber = JidNormalizer.toPhoneNumber(this.from)
        this.isVideo = Boolean(this.raw.isVideo)
        this.status = this.raw.status || 'calling'
        this.startTime = this.raw.date ? new Date(this.raw.date).getTime() : Date.now()
        this.instance = activeCallInstance || null
    }

    _getSock() {
        if (!this.client.sock) {
            throw new Error('Socket is not connected.')
        }
        return this.client.sock
    }

    /**
     * Atende a chamada recebida via WebAssembly VoIP
     * @param {Object} [options={}]
     */
    async accept(options = {}) {
        const sock = this._getSock()
        if (!sock.acceptCall) {
            throw new Error('VoIP stack is not initialized on the underlying socket.')
        }

        const callOptions = {
            isVideo: this.isVideo,
            ...options
        }

        const activeCall = await sock.acceptCall(this.id, this.from, callOptions)
        this.instance = activeCall
        this.status = 'connected'
        return activeCall
    }

    /**
     * Rejeita a chamada recebida
     * @param {number|string} [reason=0]
     */
    async reject(reason = 0) {
        const sock = this._getSock()
        if (sock.rejectCall) {
            await sock.rejectCall(this.id, this.from, reason)
        }
        this.status = 'rejected'
    }

    /**
     * Encerra a chamada em andamento
     */
    async hangup() {
        if (this.instance && typeof this.instance.terminate === 'function') {
            await this.instance.terminate()
        } else if (this.instance && typeof this.instance.end === 'function') {
            await this.instance.end()
        } else {
            const sock = this._getSock()
            if (sock.rejectCall) {
                await sock.rejectCall(this.id, this.from, 0)
            }
        }
        this.status = 'ended'
    }

    /**
     * Transmite áudio na chamada conectada
     * @param {string|Buffer} audioPathOrBuffer
     */
    async playAudio(audioPathOrBuffer) {
        if (this.instance && typeof this.instance.playAudio === 'function') {
            return this.instance.playAudio(audioPathOrBuffer)
        }
        throw new Error('No active audio stream or call is not connected yet.')
    }
}

exports.CallContext = CallContext
exports.default = CallContext
