"use strict"

Object.defineProperty(exports, "__esModule", { value: true })

const EventEmitter = require("events")
const { join } = require("path")
const { default: makeWASocket } = require("../Socket")
const { useMultiFileAuthState } = require("../Utils/use-multi-file-auth-state")
const { shouldReconnect, getReconnectDelay } = require("../Utils/reconnect")
const { Events, ConnectionStatus } = require("./Constants")
const {
    ConnectionStatusChange,
    QrCodeEvent,
    PairingCodeEvent,
    ConnectedEvent,
    DisconnectedEvent,
    LoggedOutEvent
} = require("./Events/ConnectionEvents")
const { JidNormalizer } = require("./Normalizers/JidNormalizer")
const { EventNormalizer } = require("./Normalizers/EventNormalizer")
const {
    MessageManager,
    GroupManager,
    ChannelManager,
    PresenceManager,
    ProfileManager,
    PrivacyManager,
    UserManager,
    ChatManager,
    VoipManager,
    BusinessManager,
    CommunityManager,
    LabelManager
} = require("./Modules")

/**
 * WaClient - High-Level Unified WhatsApp Client
 */
class WaClient extends EventEmitter {
    /**
     * @param {Object} [options={}]
     * @param {string} [options.sessionName='default']
     * @param {string} [options.dataPath='./sessions']
     * @param {Object} [options.auth] - Optional custom auth { state, saveCreds }
     * @param {string} [options.phoneNumber] - Phone number to authenticate via Pairing Code
     * @param {boolean} [options.printQRInTerminal=true]
     * @param {boolean} [options.restartOnClose=true]
     * @param {number} [options.maxReconnectAttempts=15]
     * @param {boolean} [options.syncFullHistory=false]
     * @param {boolean} [options.markOnlineOnConnect=true]
     * @param {Object} [options.socketOptions={}] - Raw socket configuration overrides
     * @param {any} [options.logger]
     */
    constructor(options = {}) {
        super()

        this.options = {
            sessionName: 'default',
            dataPath: './sessions',
            printQRInTerminal: true,
            restartOnClose: true,
            maxReconnectAttempts: 15,
            syncFullHistory: false,
            markOnlineOnConnect: true,
            socketOptions: {},
            ...options
        }

        this.status = ConnectionStatus.IDLE
        this.sock = null
        this.authState = null
        this.saveCreds = null
        this.reconnectAttempts = 0
        this._reconnectTimer = null
        this._isDestroyed = false

        // Specialized Domain Managers
        this.messages = new MessageManager(this)
        this.groups = new GroupManager(this)
        this.channels = new ChannelManager(this)
        this.presence = new PresenceManager(this)
        this.profile = new ProfileManager(this)
        this.privacy = new PrivacyManager(this)
        this.users = new UserManager(this)
        this.chat = new ChatManager(this)
        this.voip = new VoipManager(this)
        this.business = new BusinessManager(this)
        this.communities = new CommunityManager(this)
        this.labels = new LabelManager(this)
    }

    /**
     * Connects to WhatsApp
     * @returns {Promise<this>}
     */
    async connect() {
        if (this._isDestroyed) {
            throw new Error('WaClient instance was destroyed. Create a new instance.')
        }

        this._clearReconnectTimer()
        this._setStatus(ConnectionStatus.INITIALIZING)

        try {
            // 1. Initialize or load auth state
            if (this.options.auth?.state && this.options.auth?.saveCreds) {
                this.authState = this.options.auth.state
                this.saveCreds = this.options.auth.saveCreds
            } else {
                const sessionFolder = join(this.options.dataPath, this.options.sessionName)
                const { state, saveCreds } = await useMultiFileAuthState(sessionFolder)
                this.authState = state
                this.saveCreds = saveCreds
            }

            this._setStatus(ConnectionStatus.CONNECTING)

            // 2. Configure and create underlying socket
            const hasPhoneNumber = Boolean(this.options.phoneNumber)
            const socketConfig = {
                auth: this.authState,
                printQRInTerminal: hasPhoneNumber ? false : this.options.printQRInTerminal,
                syncFullHistory: this.options.syncFullHistory,
                markOnlineOnConnect: this.options.markOnlineOnConnect,
                logger: this.options.logger,
                ...this.options.socketOptions
            }

            this.sock = makeWASocket(socketConfig)

            // 3. Set up credentials persistence
            this.sock.ev.on('creds.update', async () => {
                if (typeof this.saveCreds === 'function') {
                    try {
                        await this.saveCreds()
                    } catch (err) {
                        this.emit(Events.ERROR, err)
                    }
                }
            })

            // 4. Set up connection lifecycle
            this._setupConnectionLifecycle()

            // 5. Bind normalized events (messages, contacts, presence)
            EventNormalizer.bindSocketEvents(this)

            // 6. Handle pairing code if configured
            if (hasPhoneNumber && !this.sock.authState.creds.registered) {
                this._handlePairingCode(this.options.phoneNumber)
            }

            return this
        } catch (error) {
            this._setStatus(ConnectionStatus.DISCONNECTED)
            this.emit(Events.ERROR, error)
            throw error
        }
    }

    /**
     * Sets up low-level connection listeners
     * @private
     */
    _setupConnectionLifecycle() {
        this.sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update

            // QR Code issued
            if (qr) {
                this._setStatus(ConnectionStatus.QR_READY)
                this.emit(Events.QR_CODE, new QrCodeEvent(qr))
            }

            // Connection successfully established
            if (connection === 'open') {
                this.reconnectAttempts = 0
                this._setStatus(ConnectionStatus.CONNECTED)
                this.emit(Events.CONNECTED, new ConnectedEvent(this.sock.user))
            }

            // Connection closed or dropped
            if (connection === 'close') {
                const error = lastDisconnect?.error
                const canReconnect = shouldReconnect(error)

                if (!canReconnect) {
                    this._setStatus(ConnectionStatus.LOGGED_OUT)
                    this.emit(Events.LOGGED_OUT, new LoggedOutEvent(error))
                } else if (this.options.restartOnClose && !this._isDestroyed) {
                    this._scheduleReconnect(error)
                } else {
                    this._setStatus(ConnectionStatus.DISCONNECTED)
                    this.emit(Events.DISCONNECTED, new DisconnectedEvent({ error, willReconnect: false }))
                }
            }
        })
    }

    /**
     * Handles pairing code requests
     * @private
     */
    _handlePairingCode(phoneNumber) {
        const cleanNumber = JidNormalizer.toPhoneNumber(phoneNumber)
        if (!cleanNumber) return

        const attemptPairing = async (retryCount = 0) => {
            if (this._isDestroyed || !this.sock || this.sock.authState.creds.registered) return

            try {
                this._setStatus(ConnectionStatus.PAIRING_READY)
                const code = await this.sock.requestPairingCode(cleanNumber)
                this.emit(Events.PAIRING_CODE, new PairingCodeEvent(code))
            } catch (err) {
                if (retryCount < 3 && !this._isDestroyed) {
                    setTimeout(() => attemptPairing(retryCount + 1), 3000)
                } else {
                    this.emit(Events.ERROR, err)
                }
            }
        }

        // Slight delay to ensure socket handshake allows pairing node
        setTimeout(() => attemptPairing(0), 2000)
    }

    /**
     * Schedules reconnection with exponential backoff and jitter
     * @private
     */
    _scheduleReconnect(error) {
        if (this.reconnectAttempts >= this.options.maxReconnectAttempts) {
            this._setStatus(ConnectionStatus.DISCONNECTED)
            this.emit(Events.DISCONNECTED, new DisconnectedEvent({
                error,
                willReconnect: false,
                reason: 'Max reconnect attempts exceeded'
            }))
            return
        }

        this.reconnectAttempts++
        const delayMs = getReconnectDelay(this.reconnectAttempts, {
            statusCode: error?.output?.statusCode || error?.statusCode
        })

        this._setStatus(ConnectionStatus.RECONNECTING)
        this.emit(Events.DISCONNECTED, new DisconnectedEvent({
            error,
            willReconnect: true,
            attempt: this.reconnectAttempts,
            delayMs
        }))

        this._clearReconnectTimer()
        this._reconnectTimer = setTimeout(() => {
            if (!this._isDestroyed) {
                this.connect().catch((err) => {
                    this.emit(Events.ERROR, err)
                })
            }
        }, delayMs)
    }

    /**
     * Updates internal status and emits STATUS_CHANGE event
     * @private
     */
    _setStatus(newStatus) {
        const previousStatus = this.status
        if (previousStatus === newStatus) return

        this.status = newStatus
        this.emit(Events.STATUS_CHANGE, new ConnectionStatusChange(newStatus, previousStatus))
    }

    _clearReconnectTimer() {
        if (this._reconnectTimer) {
            clearTimeout(this._reconnectTimer)
            this._reconnectTimer = null
        }
    }

    /**
     * Sends a message to a recipient
     * @param {string} jid - Destination phone number or JID
     * @param {Object} content - Message content object
     * @param {Object} [options={}] - Additional options (quoted, etc.)
     */
    async sendMessage(jid, content, options = {}) {
        if (!this.sock) {
            throw new Error('Cannot send message: socket is not connected.')
        }
        const targetJid = JidNormalizer.toJid(jid)
        return this.sock.sendMessage(targetJid, content, options)
    }

    /**
     * Sends an interactive message, buttons, list or card
     * @param {string} jid
     * @param {Object|InteractiveMessage} interactiveOrBuilder
     * @param {Object} [options={}]
     */
    async sendInteractive(jid, interactiveOrBuilder, options = {}) {
        const payload = typeof interactiveOrBuilder?.build === 'function'
            ? interactiveOrBuilder.build()
            : interactiveOrBuilder
        return this.sendMessage(jid, payload, options)
    }

    /**
     * Sends a poll to a user or group
     * @param {string} jid
     * @param {Object|PollBuilder} pollOrBuilder
     * @param {Object} [options={}]
     */
    async sendPoll(jid, pollOrBuilder, options = {}) {
        const payload = typeof pollOrBuilder?.build === 'function'
            ? pollOrBuilder.build()
            : pollOrBuilder
        return this.sendMessage(jid, payload, options)
    }

    /**
     * Sends a group event invitation
     * @param {string} jid
     * @param {Object|EventBuilder} eventOrBuilder
     * @param {Object} [options={}]
     */
    async sendEvent(jid, eventOrBuilder, options = {}) {
        const payload = typeof eventOrBuilder?.build === 'function'
            ? eventOrBuilder.build()
            : eventOrBuilder
        return this.sendMessage(jid, payload, options)
    }

    /**
     * Starts typing (composing) state
     * @param {string} jid
     * @returns {{ stop: () => Promise<void> }}
     */
    startTyping(jid) {
        const targetJid = JidNormalizer.toJid(jid)
        if (this.sock?.sendPresenceUpdate) {
            this.sock.sendPresenceUpdate('composing', targetJid).catch(() => {})
        }
        return {
            stop: async () => {
                if (this.sock?.sendPresenceUpdate) {
                    await this.sock.sendPresenceUpdate('paused', targetJid).catch(() => {})
                }
            }
        }
    }

    /**
     * Starts voice recording state
     * @param {string} jid
     * @returns {{ stop: () => Promise<void> }}
     */
    startRecording(jid) {
        const targetJid = JidNormalizer.toJid(jid)
        if (this.sock?.sendPresenceUpdate) {
            this.sock.sendPresenceUpdate('recording', targetJid).catch(() => {})
        }
        return {
            stop: async () => {
                if (this.sock?.sendPresenceUpdate) {
                    await this.sock.sendPresenceUpdate('paused', targetJid).catch(() => {})
                }
            }
        }
    }

    /**
     * Verifies if a phone number or JID exists on WhatsApp
     * @param {string} jidOrNumber
     * @returns {Promise<{ exists: boolean, jid: string } | null>}
     */
    async isOnWhatsApp(jidOrNumber) {
        if (!this.sock?.onWhatsApp) {
            throw new Error('Socket is not connected.')
        }
        const cleanNumber = JidNormalizer.toPhoneNumber(jidOrNumber) || jidOrNumber
        const results = await this.sock.onWhatsApp(cleanNumber)
        if (Array.isArray(results) && results.length > 0) {
            return {
                exists: Boolean(results[0]?.exists),
                jid: results[0]?.jid || ''
            }
        }
        return null
    }

    /**
     * Closes the connection gracefully without deleting credentials
     */
    async disconnect() {
        this._isDestroyed = true
        this._clearReconnectTimer()
        this._setStatus(ConnectionStatus.DISCONNECTED)
        if (this.sock) {
            this.sock.end(undefined)
        }
    }

    /**
     * Logs out from WhatsApp and revokes device credentials
     */
    async logout() {
        this._isDestroyed = true
        this._clearReconnectTimer()
        this._setStatus(ConnectionStatus.LOGGED_OUT)
        if (this.sock) {
            await this.sock.logout('WaClient Intentional Logout')
        }
    }

    /**
     * The authenticated user profile or null
     */
    get user() {
        return this.sock?.user || null
    }

    /**
     * True if currently connected and open
     */
    get isConnected() {
        return this.status === ConnectionStatus.CONNECTED
    }

    /**
     * Direct access to underlying low-level socket
     */
    get rawSocket() {
        return this.sock
    }
}

exports.WaClient = WaClient
exports.ConnectionStatusChange = ConnectionStatusChange
exports.default = WaClient
