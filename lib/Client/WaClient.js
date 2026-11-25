"use strict"

Object.defineProperty(exports, "__esModule", { value: true })

const EventEmitter = require("events")
const { join } = require("path")
const pino = require("pino")
const { default: makeWASocket } = require("../Socket")
const { useMultiFileAuthState } = require("../Utils/use-multi-file-auth-state")
const { shouldReconnect, getReconnectDelay } = require("../Utils/reconnect")
const { Events, ConnectionStatus, CanonicalToLegacyMap } = require("./Constants")
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
    LabelManager,
    ContactManager,
    StoriesManager
} = require("./Modules")
const { MemoryStorageAdapter } = require("./Storage/MemoryStorageAdapter")

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

        if (!this.options.logger) {
            this.options.logger = pino({ level: this.options.loggerLevel || 'silent' })
        }

        this.status = ConnectionStatus.IDLE
        this.sock = null
        this.authState = null
        this.saveCreds = null
        this.reconnectAttempts = 0
        this._reconnectTimer = null
        this._presenceInterval = null
        this._isDestroyed = false

        // Specialized Domain Managers
        this.messages = new MessageManager(this)
        this.groups = new GroupManager(this)
        this.channels = new ChannelManager(this)
        this.newsletters = this.channels
        this.presence = new PresenceManager(this)
        this.profile = new ProfileManager(this)
        this.privacy = new PrivacyManager(this)
        this.users = new UserManager(this)
        this.chat = new ChatManager(this)
        this.voip = new VoipManager(this)
        this.calls = this.voip
        this.business = new BusinessManager(this)
        this.communities = new CommunityManager(this)
        this.labels = new LabelManager(this)
        this.contacts = new ContactManager(this)
        this.stories = new StoriesManager(this)
        this.store = options.store || new MemoryStorageAdapter()
        this.historySyncLastMessageOnly = options.historySyncLastMessageOnly ?? options.historyOptions?.lastMessageOnly ?? false
        this.historySyncFilterStatus = options.historySyncFilterStatus ?? options.historyOptions?.filterStatus ?? 'all'
        this._qrAttempts = 0
    }

    /**
     * Smart emit override providing zero-overhead backward compatibility
     * with legacy UnityChat event aliases.
     * @param {string|symbol} event
     * @param {...any} args
     * @returns {boolean}
     */
    emit(event, ...args) {
        const result = super.emit(event, ...args)
        const aliases = CanonicalToLegacyMap[event]
        if (aliases && aliases.length > 0) {
            for (let i = 0; i < aliases.length; i++) {
                const alias = aliases[i]
                if (this.listenerCount(alias) > 0) {
                    super.emit(alias, ...args)
                }
            }
        }
        return result
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
        this.emit(Events.INIT)

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
            this.emit(Events.CONNECTING)

            // 2. Configure and create underlying socket
            const hasPhoneNumber = Boolean(this.options.phoneNumber)
            const socketConfig = {
                auth: this.authState,
                printQRInTerminal: hasPhoneNumber ? false : this.options.printQRInTerminal,
                syncFullHistory: this.options.syncFullHistory,
                markOnlineOnConnect: this.options.markOnlineOnConnect,
                logger: this.options.logger || pino({ level: 'silent' }),
                voip: this.options.voip ?? true,
                ...(this.options.environment ? { browser: this.options.environment } : {}),
                ...(this.options.waVersion ? { version: this.options.waVersion } : {}),
                cachedGroupMetadata: async (jid) => this.groups?._getCachedMetadata(jid),
                getMessage: async (key) => {
                    if (!key?.remoteJid || !key?.id) return undefined
                    const normalizedJid = JidNormalizer.toJid(key.remoteJid)
                    let msg = await this.store.getMessage(normalizedJid, key.id)
                    if (!msg && normalizedJid !== key.remoteJid) {
                        msg = await this.store.getMessage(key.remoteJid, key.id)
                    }
                    if (!msg) return undefined
                    return msg.raw?.message || msg.message || undefined
                },
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
            const { connection, lastDisconnect, qr, isNewLogin } = update

            // QR Code issued
            if (qr) {
                this._qrAttempts = (this._qrAttempts || 0) + 1
                const qrEvent = new QrCodeEvent(qr, this._qrAttempts)

                // If legacy 'pairing_code' listeners exist, resolve base64 prior to dispatch
                if (this.listenerCount('pairing_code') > 0) {
                    qrEvent.toDataURL().then((b64) => {
                        qrEvent.base64 = b64
                        this._setStatus(ConnectionStatus.QR_READY)
                        this.emit(Events.QR_CODE, qrEvent)
                    }).catch(() => {
                        this._setStatus(ConnectionStatus.QR_READY)
                        this.emit(Events.QR_CODE, qrEvent)
                    })
                    return
                }

                this._setStatus(ConnectionStatus.QR_READY)
                this.emit(Events.QR_CODE, qrEvent)
                return
            }

            // Pairing success notification (QR scanned and validated)
            if (isNewLogin && qr === undefined) {
                this._qrAttempts = 0
                this.emit(Events.PAIRING_SUCCESS, update)
            }

            // Connection successfully established
            if (connection === 'open') {
                this.reconnectAttempts = 0
                this._qrAttempts = 0
                this._setStatus(ConnectionStatus.CONNECTED)
                this.emit(Events.CONNECTED, new ConnectedEvent(this.sock.user))

                this._clearPresenceInterval()
                if (this.options.markOnlineOnConnect && this.options.keepAlivePresence !== false) {
                    const intervalMs = this.options.keepAlivePresenceIntervalMs || 30_000
                    this._presenceInterval = setInterval(() => {
                        if (this.sock?.sendPresenceUpdate) {
                            this.sock.sendPresenceUpdate('available').catch(() => {})
                        }
                    }, intervalMs)
                    if (typeof this._presenceInterval.unref === 'function') {
                        this._presenceInterval.unref()
                    }
                }
            }

            // Connection closed or dropped
            if (connection === 'close') {
                this._clearPresenceInterval()
                const error = lastDisconnect?.error
                const canReconnect = shouldReconnect(error)
                const statusCode = error?.output?.statusCode || error?.statusCode
                const isFatal = [401, 403, 405, 500].includes(statusCode) || !canReconnect

                // Auto-cleanup corrupted session files on fatal disconnection
                if (isFatal && this.options.cleanSessionOnLogout !== false) {
                    try {
                        const sessionFolder = join(this.options.dataPath, this.options.sessionName)
                        const { promises: fs } = require("fs")
                        fs.rm(sessionFolder, { recursive: true, force: true }).catch(() => { })
                    } catch { }
                }

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

    _clearPresenceInterval() {
        if (this._presenceInterval) {
            clearInterval(this._presenceInterval)
            this._presenceInterval = null
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
        if (options.composing && this.sock.sendPresenceUpdate) {
            await this.sock.sendPresenceUpdate('composing', targetJid).catch(() => { })
            if (options.composing.timeout) {
                await new Promise((resolve) => setTimeout(resolve, options.composing.timeout))
            }
        }
        if (options.recording && this.sock.sendPresenceUpdate) {
            await this.sock.sendPresenceUpdate('recording', targetJid).catch(() => { })
            if (options.recording.timeout) {
                await new Promise((resolve) => setTimeout(resolve, options.recording.timeout))
            }
        }
        const sent = await this.sock.sendMessage(targetJid, content, options)
        if (sent && this.store?.saveMessage) {
            await this.store.saveMessage(targetJid, sent).catch(() => { })
        }
        return sent
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
        const send = () => {
            if (this.sock?.sendPresenceUpdate) {
                this.sock.sendPresenceUpdate('composing', targetJid).catch(() => { })
            }
        }
        send()
        const interval = setInterval(send, 2500)
        return {
            stop: async () => {
                clearInterval(interval)
                if (this.sock?.sendPresenceUpdate) {
                    await this.sock.sendPresenceUpdate('paused', targetJid).catch(() => { })
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
        const send = () => {
            if (this.sock?.sendPresenceUpdate) {
                this.sock.sendPresenceUpdate('recording', targetJid).catch(() => { })
            }
        }
        send()
        const interval = setInterval(send, 2500)
        return {
            stop: async () => {
                clearInterval(interval)
                if (this.sock?.sendPresenceUpdate) {
                    await this.sock.sendPresenceUpdate('paused', targetJid).catch(() => { })
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
     * Configures filter options for message history synchronization (compatible with UnityChat)
     * @param {Object} options
     * @param {boolean} [options.lastMessageOnly] - If true, only syncs the latest message per chat
     * @param {'all'|'read'|'unread'} [options.filterStatus] - Filter messages by status
     */
    setHistorySyncOptions({ lastMessageOnly, filterStatus } = {}) {
        if (lastMessageOnly !== undefined) {
            this.historySyncLastMessageOnly = Boolean(lastMessageOnly)
        }
        if (filterStatus !== undefined && ['all', 'read', 'unread'].includes(filterStatus)) {
            this.historySyncFilterStatus = filterStatus
        }
    }

    /**
     * Retorna o perfil completo do usuário autenticado incluindo grupos e canais (compatível com UnityChat)
     * Ou se um jid for fornecido, verifica se o jid corresponde ao usuário autenticado.
     * @param {string} [jid]
     * @returns {Promise<Object|boolean|null>}
     */
    async itsMe(jid) {
        if (!this.sock?.user) return jid ? false : null
        const myJid = JidNormalizer.toJid(this.sock.user.id)
        if (jid) {
            return JidNormalizer.toJid(jid) === myJid
        }
        const me = await this.contacts.normalize({ key: { remoteJid: myJid, fromMe: true } })

        // Obtém o recado (slogan/about) da própria conta diretamente via sock.fetchStatus (100% UnityChat)
        const myStatus = await this.sock.fetchStatus(myJid).catch(() => null)
        const first = Array.isArray(myStatus) && myStatus[0] ? myStatus[0] : null
        me.slogan = first?.status?.status || (first?.status ? String(first.status) : null)

        // Consulta e enriquece perfil de negócio caso a conta seja WhatsApp Business
        const bizProfile = await this.users.getBusinessProfile(myJid).catch(() => null)
        if (bizProfile) {
            me.isBusiness = true
            me.type = 'business'
            me.businessProfile = bizProfile
            me.metadata = bizProfile
            this.contacts.set(myJid, me)
        }

        me.environment = this.options.environment || ['Mac OS', 'Chrome', '144.0.7559.110']
        me.groups = await this.groups.getAllGroups().catch(() => [])
        me.newsletters = this.channels?.listSubscribed ? await this.channels.listSubscribed().catch(() => []) : []
        return me
    }

    /**
     * Consulta status / recado de usuários via USync diretamente pelo sock Baileys (compatível com UnityChat)
     * @param {...string} jids
     * @returns {Promise<Array<Object>>}
     */
    async fetchStatus(...jids) {
        if (!this.sock?.fetchStatus) return []
        return this.sock.fetchStatus(...jids)
    }

    /**
     * Notifica estado "digitando" para um destinatário
     * @param {string} jid
     */
    composing(jid) {
        return this.startTyping(jid)
    }

    /**
     * Descriptografa votos de enquete (suporta parâmetros explícitos ou resolução automática via store/LID)
     * @param {Object} voteOrPollUpdate
     * @param {Object} [voteParams={}]
     */
    async decryptPollVote(voteOrPollUpdate, voteParams = {}) {
        const crypto = require("crypto")
        const { decryptPollVote } = require("../Utils/process-message")
        const { jidNormalizedUser } = require("../WABinary")
        const { getKeyAuthor } = require("../Utils/generics")

        const voteNode = voteOrPollUpdate?.vote || voteOrPollUpdate
        if (!voteNode?.encPayload || !voteNode?.encIv) {
            throw new Error('Invalid encrypted poll vote payload')
        }

        const creationMsgKey = voteParams.creationMsgKey || voteOrPollUpdate?.pollCreationMessageKey
        let pollEncKey = voteParams.pollEncKey
        let pollMsg = null

        if (creationMsgKey && this.store?.getMessage) {
            const candidateJids = [
                voteParams.chatId ? JidNormalizer.toJid(voteParams.chatId) : null,
                voteParams.voterKey?.remoteJidAlt ? JidNormalizer.toJid(voteParams.voterKey.remoteJidAlt) : null,
                voteParams.voterKey?.remoteJid,
                voteParams.sender ? JidNormalizer.toJid(voteParams.sender) : null,
                JidNormalizer.toJid(creationMsgKey.remoteJid),
                creationMsgKey.remoteJid
            ].filter(Boolean)

            for (const cJid of candidateJids) {
                pollMsg = await this.store.getMessage(cJid, creationMsgKey.id)
                if (pollMsg) break
            }

            if (!pollEncKey && pollMsg) {
                pollEncKey = pollMsg?.raw?.message?.messageContextInfo?.messageSecret
                    || pollMsg?.message?.messageContextInfo?.messageSecret
                    || pollMsg?.raw?.messageContextInfo?.messageSecret
                    || pollMsg?.messageContextInfo?.messageSecret
            }
        }

        if (!pollEncKey) {
            throw new Error('Missing poll encryption key (messageSecret). Poll creation message not found in store.')
        }

        const meLid = jidNormalizedUser(this.sock?.user?.lid || this.sock?.user?.id || '')
        const mePn = jidNormalizedUser(this.sock?.user?.id || '')
        const creatorKey = pollMsg?.raw?.key || pollMsg?.key || creationMsgKey
        const pollMsgId = voteParams.pollMsgId || creationMsgKey?.id

        const creatorCandidates = Array.from(new Set([
            voteParams.pollCreatorJid,
            creatorKey ? getKeyAuthor(creatorKey, meLid) : null,
            meLid,
            mePn
        ].filter(Boolean)))

        const voterCandidates = Array.from(new Set([
            voteParams.voterKey ? getKeyAuthor(voteParams.voterKey, meLid) : null,
            voteParams.voterKey?.remoteJid,
            voteParams.voterKey?.remoteJidAlt,
            voteParams.voterKey?.participant,
            voteParams.voterKey?.participantAlt,
            voteParams.voterJid,
            voteParams.sender ? JidNormalizer.toJid(voteParams.sender) : null
        ].filter(Boolean)))

        let decrypted = null
        let lastErr = null
        for (const cJid of creatorCandidates) {
            for (const vJid of voterCandidates) {
                try {
                    decrypted = decryptPollVote(voteNode, {
                        pollEncKey,
                        pollCreatorJid: cJid,
                        pollMsgId,
                        voterJid: vJid
                    })
                    break
                } catch (err) {
                    lastErr = err
                }
            }
            if (decrypted) break
        }

        if (!decrypted) {
            throw lastErr || new Error('Failed to decrypt poll vote')
        }

        // Mapeia os hashes SHA-256 selecionados para os nomes legíveis das opções da enquete
        const rawPollContent = pollMsg?.raw?.message || pollMsg?.message || {}
        const pollCreation = rawPollContent.pollCreationMessage
            || rawPollContent.pollCreationMessageV2
            || rawPollContent.pollCreationMessageV3
            || rawPollContent.pollCreationMessageV4
            || rawPollContent.pollCreationMessageV5
            || null

        let selectedOptionNames = []
        if (pollCreation?.options && Array.isArray(decrypted.selectedOptions)) {
            const hashToName = new Map()
            for (const opt of pollCreation.options) {
                if (opt?.optionName) {
                    const hashHex = crypto.createHash('sha256').update(Buffer.from(opt.optionName)).digest('hex')
                    hashToName.set(hashHex, opt.optionName)
                }
            }
            selectedOptionNames = decrypted.selectedOptions
                .map(buf => hashToName.get(Buffer.from(buf).toString('hex')))
                .filter(Boolean)
        }

        return {
            selectedOptions: decrypted.selectedOptions || [],
            selectedOptionNames,
            pollName: pollCreation?.name || null,
            pollCreationMessageKey: creationMsgKey || null,
            raw: decrypted
        }
    }

    /**
     * Agrega votos de mensagens de enquete
     * @param {Object} pollParams
     */
    getAggregateVotesInPollMessage(pollParams) {
        const { getAggregateVotesInPollMessage } = require("../Utils/messages")
        const meId = pollParams?.meId || this.sock?.user?.id
        return getAggregateVotesInPollMessage(pollParams, meId)
    }

    /**
     * Descriptografa resposta a convite de evento (RSVP)
     * @param {Object} encEventResponse - Nó encEventResponseMessage ou payload com encPayload e encIv
     * @param {Object} [options={}] - Parâmetros opcionais (eventEncKey, creationMsgKey, etc.)
     */
    async decryptEventResponse(encEventResponse, options = {}) {
        const { decryptEventResponse } = require("../Utils/process-message")
        const { jidNormalizedUser } = require("../WABinary")

        const encNode = encEventResponse?.encEventResponseMessage || encEventResponse
        if (!encNode?.encPayload || !encNode?.encIv) {
            throw new Error('Invalid encrypted event response payload')
        }

        const creationMsgKey = options.creationMsgKey || encNode.eventCreationMessageKey
        let eventEncKey = options.eventEncKey
        let eventMsg = null

        // Se a chave do evento não foi fornecida, tenta buscar da mensagem original no store
        if (creationMsgKey && this.store?.getMessage) {
            const candidateJids = [
                options.chatId ? JidNormalizer.toJid(options.chatId) : null,
                options.responderKey?.remoteJidAlt ? JidNormalizer.toJid(options.responderKey.remoteJidAlt) : null,
                options.responderKey?.remoteJid,
                options.sender ? JidNormalizer.toJid(options.sender) : null,
                JidNormalizer.toJid(creationMsgKey.remoteJid),
                creationMsgKey.remoteJid
            ].filter(Boolean)

            if (creationMsgKey.remoteJid?.endsWith('@lid') && this.users?.getPnForLid) {
                const pn = await this.users.getPnForLid(creationMsgKey.remoteJid).catch(() => null)
                if (pn) candidateJids.push(pn)
            }

            for (const cJid of candidateJids) {
                eventMsg = await this.store.getMessage(cJid, creationMsgKey.id)
                if (eventMsg) break
            }

            if (!eventEncKey) {
                eventEncKey = eventMsg?.raw?.message?.messageContextInfo?.messageSecret
                    || eventMsg?.message?.messageContextInfo?.messageSecret
                    || eventMsg?.raw?.messageContextInfo?.messageSecret
                    || eventMsg?.messageContextInfo?.messageSecret
            }
        }

        if (!eventEncKey) {
            throw new Error('Missing event encryption key (messageSecret). Event creation message not found in store.')
        }

        const { getKeyAuthor } = require("../Utils/generics")
        const meLid = jidNormalizedUser(this.sock?.user?.lid || this.sock?.user?.id || '')
        const mePn = jidNormalizedUser(this.sock?.user?.id || '')
        const creatorKey = eventMsg?.raw?.key || eventMsg?.key || creationMsgKey
        const primaryCreator = options.eventCreatorJid || getKeyAuthor(creatorKey, meLid)
        const primaryResponder = options.responderKey
            ? getKeyAuthor(options.responderKey, meLid)
            : (options.responderJid || options.sender || meLid)
        const eventMsgId = creationMsgKey?.id || options.eventMsgId

        const creatorCandidates = Array.from(new Set([
            primaryCreator,
            meLid,
            mePn
        ].filter(Boolean)))

        const responderCandidates = Array.from(new Set([
            primaryResponder,
            options.responderKey?.remoteJid,
            options.responderKey?.remoteJidAlt,
            options.responderKey?.participant,
            options.responderKey?.participantAlt,
            options.sender ? JidNormalizer.toJid(options.sender) : null
        ].filter(Boolean)))

        let decrypted = null
        let lastErr = null
        for (const cJid of creatorCandidates) {
            for (const rJid of responderCandidates) {
                try {
                    decrypted = decryptEventResponse(encNode, {
                        eventEncKey,
                        eventCreatorJid: cJid,
                        eventMsgId,
                        responderJid: rJid
                    })
                    break
                } catch (err) {
                    lastErr = err
                }
            }
            if (decrypted) break
        }

        if (!decrypted) {
            throw lastErr || new Error('Failed to decrypt event response')
        }

        const statusMap = { 0: 'UNKNOWN', 1: 'GOING', 2: 'NOT_GOING', 3: 'MAYBE' }
        const labelMap = { 0: 'Desconhecido', 1: 'Confirmado (Vou)', 2: 'Recusado (Não vou)', 3: 'Talvez' }
        const statusCode = decrypted.response || 0
        const status = statusMap[statusCode] || 'UNKNOWN'

        return {
            eventMessageId: eventMsgId,
            eventCreationMessageKey: creationMsgKey,
            status,
            statusCode,
            statusLabel: labelMap[statusCode] || 'Desconhecido',
            isAttending: statusCode === 1,
            extraGuests: decrypted.extraGuestCount || 0,
            timestampMs: Number(decrypted.timestampMs || Date.now()),
            timestamp: new Date(Number(decrypted.timestampMs || Date.now())),
            raw: decrypted
        }
    }

    /**
     * Agrega todas as respostas de um evento (RSVP)
     * @param {Object} eventParams
     */
    getAggregateResponsesInEventMessage(eventParams) {
        const { getAggregateResponsesInEventMessage } = require("../Utils/messages")
        const meLid = eventParams?.meLid || this.sock?.user?.lid || this.sock?.user?.id
        return getAggregateResponsesInEventMessage(eventParams, meLid)
    }

    /**
     * Recupera histórico remoto de mensagens a partir de uma mensagem âncora
     * @param {Object} oldMsg - Mensagem âncora contendo `key` e `messageTimestamp`
     * @param {number} [limit=50]
     */
    async getMessages(oldMsg, limit = 50) {
        if (!this.sock?.fetchMessageHistory) {
            throw new Error('Socket is not connected or fetchMessageHistory is unavailable.')
        }
        if (!oldMsg || !oldMsg.key || !oldMsg.messageTimestamp) {
            return { error: 'INITIAL_MESSAGE_NOT_FOUND' }
        }
        return this.sock.fetchMessageHistory(limit, oldMsg.key, oldMsg.messageTimestamp)
    }

    /**
     * Normaliza um JID de usuário removendo sufixos de dispositivo
     * @param {string} id
     * @returns {string}
     */
    jidNormalizedUser(id) {
        return JidNormalizer.toJid(id)
    }

    /**
     * Efetua download binário do conteúdo de mídia de uma mensagem bruta
     * @param {Object} content
     * @param {string} type
     * @param {Object} [options]
     */
    async downloadContentFromMessage(content, type, options) {
        const { downloadContentFromMessage } = require("../Utils/messages-media")
        return downloadContentFromMessage(content, type, options)
    }

    /**
     * Retorna o tipo de conteúdo de uma mensagem bruta
     * @param {Object} message
     * @returns {string|undefined}
     */
    getContentType(message) {
        const { getContentType } = require("../Utils/messages")
        return getContentType(message)
    }

    /**
     * Closes the connection gracefully without deleting credentials
     */
    async disconnect() {
        this._isDestroyed = true
        this._clearReconnectTimer()
        this._clearPresenceInterval()
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
        this._clearPresenceInterval()
        this._setStatus(ConnectionStatus.LOGGED_OUT)
        if (this.sock) {
            await this.sock.logout('WaClient Intentional Logout')
        }
    }

    /**
     * Realiza uma chamada de voz WhatsApp (atalho para client.voip.call)
     * @param {string} phoneNumber
     * @param {Object} [options={}]
     */
    async call(phoneNumber, options = {}) {
        return this.voip.call(phoneNumber, options)
    }

    /**
     * Realiza uma chamada de vídeo WhatsApp (atalho para client.voip.callVideo)
     * @param {string} phoneNumber
     * @param {Object} [options={}]
     */
    async callVideo(phoneNumber, options = {}) {
        return this.voip.callVideo(phoneNumber, options)
    }

    /**
     * Retorna a chamada VoIP atualmente ativa ou null
     */
    get activeCall() {
        return this.voip.activeCall
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
