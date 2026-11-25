"use strict"

Object.defineProperty(exports, "__esModule", { value: true })

const { EventEmitter } = require("events")
const { JidNormalizer } = require("../Normalizers/JidNormalizer")

class CallContext extends EventEmitter {
    /**
     * @param {import('../WaClient').WaClient} client
     * @param {Object} callData - Inbound call offer or active call metadata
     * @param {Object} [activeCallInstance] - Low-level WebAssembly ActiveCall instance
     */
    constructor(client, callData, activeCallInstance = null) {
        super()
        this.client = client
        this.raw = callData || {}

        this.id = this.raw.id || this.raw.callId || ''
        this.from = this.raw.from || this.raw.chatId || ''
        this.fromNumber = JidNormalizer.toPhoneNumber(this.from)
        this.isVideo = Boolean(this.raw.isVideo)
        this.status = this.raw.status || 'calling'
        this.startTime = this.raw.date ? new Date(this.raw.date).getTime() : Date.now()
        this.instance = activeCallInstance || null

        if (this.instance) {
            this._bindInstanceEvents(this.instance)
        }
    }

    _bindInstanceEvents(instance) {
        if (!instance || typeof instance.on !== 'function') return
        instance.on("audio", (audioData) => this.emit("audio", audioData))
        instance.on("audio_out", (audioData) => this.emit("audio_out", audioData))
        instance.on("video", (videoData) => this.emit("video", videoData))
        instance.on("video_out", (videoData) => this.emit("video_out", videoData))
        instance.on("speaking", (vad) => this.emit("speaking", vad))
        instance.on("silence", (vad) => this.emit("silence", vad))
        instance.on("stats", (stats) => this.emit("stats", stats))
        instance.on("screenshare:started", (info) => this.emit("screenshare:started", info))
        instance.on("screenshare:stopped", (code) => this.emit("screenshare:stopped", code))
        instance.on("screenshare:error", (err) => this.emit("screenshare:error", err))
        instance.on("ringing", () => {
            this.status = 'ringing'
            this.emit("ringing")
        })
        instance.on("connected", (data) => {
            this.status = 'connected'
            this.emit("connected", data)
            this.emit("accepted", data)
        })
        instance.on("state", (stateData) => {
            const st = typeof stateData === 'object' ? (stateData?.to || stateData?.state) : stateData
            this.status = String(st)
            this.emit("state", stateData)
            if (st === 'accepted' || st === 'connected' || st === 5 || st === 6) {
                this.emit("accepted", stateData)
                this.emit("connected", stateData)
            }
        })
        instance.on("ended", (endData) => {
            this.status = 'ended'
            this.emit("ended", endData)
        })
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
            rawNode: this.raw?.rawNode || this.rawNode,
            ...options
        }

        const activeCall = await sock.acceptCall(this.id, this.from, callOptions)
        this.instance = activeCall
        this._bindInstanceEvents(activeCall)
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

    get isConnected() {
        const state = this.instance?.state
        return this.status === 'connected' || this.status === 'accepted' || state === 5 || state === 6 || state === 'connected' || state === 'accepted'
    }

    get isEnded() {
        const state = this.instance?.state
        return this.status === 'ended' || this.status === 'rejected' || Boolean(this.instance?.ended) || state === 0 || state === 13
    }

    /**
     * Encerra a chamada em andamento
     */
    async hangup() {
        if (this.isEnded) return
        if (this.instance && typeof this.instance.end === 'function') {
            await this.instance.end()
        } else if (this.instance && typeof this.instance.terminate === 'function') {
            await this.instance.terminate()
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
        if (this.instance && typeof this.instance.pushAudio === 'function') {
            const fs = require('fs')
            const buf = typeof audioPathOrBuffer === 'string' ? fs.readFileSync(audioPathOrBuffer) : audioPathOrBuffer
            return this.instance.pushAudio(buf)
        }
        throw new Error('No active audio stream or call is not connected yet.')
    }

        pushAudio(audioData, options = {}) {
        return this.instance?.pushAudio?.(audioData, options)
    }

    pushVideo(frameBuffer, width, height) {
        return this.instance?.pushVideo?.(frameBuffer, width, height)
    }

    pushVideoRgba(rgbaBuffer, width, height) {
        return this.instance?.pushVideoRgba?.(rgbaBuffer, width, height)
    }

    get isSharingScreen() {
        return Boolean(this.instance?.isSharingScreen)
    }

    startScreenShare(options = {}) {
        return this.instance?.startScreenShare?.(options)
    }

    stopScreenShare() {
        return this.instance?.stopScreenShare?.()
    }

    recordToFile(filePath, options = {}) {
        return this.instance?.recordToFile?.(filePath, options)
    }

    stopRecording() {
        return this.instance?.stopRecording?.()
    }

    getStats() {
        return this.instance?.getStats?.()
    }

    async end() {
        return this.hangup()
    }

    toString() {
        return `[Call ${this.id}] ${this.fromNumber} (${this.isVideo ? 'Vídeo' : 'Voz'}) - status: ${this.status}`
    }

    toJSON() {
        return {
            id: this.id,
            from: this.from,
            fromNumber: this.fromNumber,
            isVideo: this.isVideo,
            status: this.status,
            startTime: this.startTime
        }
    }

    [Symbol.toPrimitive]() {
        return this.toString()
    }
}

exports.CallContext = CallContext
exports.default = CallContext
