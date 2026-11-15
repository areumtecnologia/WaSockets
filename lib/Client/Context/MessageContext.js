"use strict"

Object.defineProperty(exports, "__esModule", { value: true })

const { JidNormalizer } = require("../Normalizers/JidNormalizer")
const { MessageNormalizer } = require("../Normalizers/MessageNormalizer")
const { MediaObject } = require("./MediaObject")

class MessageContext {
    /**
     * @param {import('../WaClient').WaClient} client
     * @param {Object} rawMessage - proto.IWebMessageInfo
     * @param {number} [depth=0] - Recursion depth guard for quoted messages
     */
    constructor(client, rawMessage, depth = 0) {
        this.client = client
        this.raw = rawMessage || {}

        // 1. Detection of Edited Message (protocolMessage.editedMessage)
        const editedMsg = rawMessage?.message?.protocolMessage?.editedMessage
        this.isEdited = Boolean(editedMsg)

        const effectiveKey = (this.isEdited && rawMessage.message.protocolMessage.key)
            ? { ...rawMessage.key, ...rawMessage.message.protocolMessage.key }
            : (rawMessage?.key || {})

        const effectiveMessage = editedMsg || rawMessage?.message || null

        // 2. Single-pass message unwrapping (eliminates repeated while-loops)
        const unwrapped = MessageNormalizer.unwrapMessage(effectiveMessage)

        // 3. Identity and Routing
        this.id = effectiveKey.id || rawMessage?.key?.id || ''
        this.chatId = effectiveKey.remoteJid || rawMessage?.key?.remoteJid || ''
        this.fromMe = Boolean(effectiveKey.fromMe)

        this.isGroup = JidNormalizer.isGroup(this.chatId)
        this.isChannel = JidNormalizer.isNewsletter(this.chatId)
        this.isBroadcast = JidNormalizer.isBroadcast(this.chatId)

        // Bot JID resolution
        const sockUser = client?.sock?.user || {}
        const clientJid = sockUser.id ? JidNormalizer.toJid(sockUser.id) : ''
        const clientLid = sockUser.lid ? JidNormalizer.toJid(sockUser.lid) : ''

        // Origin and Destination (from / to)
        if (this.fromMe) {
            this.from = clientJid || this.chatId
            this.to = this.chatId
            this.fromPushName = sockUser.name || sockUser.notify || 'Você'
        } else {
            this.from = this.isGroup
                ? (effectiveKey.participant || rawMessage?.participant || this.chatId)
                : this.chatId
            this.to = clientJid || this.chatId
            this.fromPushName = rawMessage?.pushName || JidNormalizer.toPhoneNumber(this.from) || 'Desconhecido'
        }

        this.fromNumber = JidNormalizer.toPhoneNumber(this.from)

        // Timestamps
        const rawTs = Number(rawMessage?.messageTimestamp || Math.floor(Date.now() / 1000))
        this.timestamp = new Date(rawTs > 10000000000 ? rawTs : rawTs * 1000)
        this.editTimestamp = this.isEdited
            ? new Date(Number(rawMessage.message.protocolMessage.timestampMs || Date.now()))
            : null

        // 4. Content Decoupling & Typed Parsers (Single-pass unwrapped nodes)
        this.type = MessageNormalizer.extractType(unwrapped)
        this.body = MessageNormalizer.extractBody(unwrapped)
        this.interactiveReply = MessageNormalizer.extractInteractiveReply(unwrapped)
        this.contacts = MessageNormalizer.extractContacts(unwrapped)
        this.location = MessageNormalizer.extractLocation(unwrapped)
        this.reaction = MessageNormalizer.extractReaction(unwrapped)
        this.poll = MessageNormalizer.extractPollCreation(unwrapped, rawMessage)

        // 5. Media Normalization (Centralized directly into MediaObject)
        this.mediaNode = MessageNormalizer.extractMediaNode(unwrapped)
        this.media = this.mediaNode ? new MediaObject(this.mediaNode, this.type) : null

        // 6. Context Info, Mentions & Forwarding
        this.contextInfo = MessageNormalizer.extractContextInfo(unwrapped)
        this.mentions = this.contextInfo?.mentionedJid || []
        this.isForwarded = Boolean(this.contextInfo?.isForwarded)
        this.forwardingScore = Number(this.contextInfo?.forwardingScore || 0)

        // Checks if the bot was directly mentioned (by PN or LID)
        this.isMentioningMe = Boolean(
            (clientJid && this.mentions.includes(clientJid)) ||
            (clientLid && this.mentions.includes(clientLid))
        )

        // 7. Quoted Message Parsing (Recursion with depth limit 1)
        this.isReply = Boolean(this.contextInfo?.quotedMessage)
        this.quoted = null

        if (this.isReply && this.contextInfo?.quotedMessage && depth === 0) {
            const quotedParticipant = this.contextInfo.participant || this.chatId
            const quotedRaw = {
                key: {
                    remoteJid: this.chatId,
                    id: this.contextInfo.stanzaId,
                    fromMe: clientJid && JidNormalizer.toJid(quotedParticipant) === clientJid,
                    participant: quotedParticipant
                },
                message: this.contextInfo.quotedMessage,
                pushName: this.contextInfo.pushName
            }
            try {
                this.quoted = new MessageContext(this.client, quotedRaw, depth + 1)
            } catch {
                this.quoted = {
                    id: this.contextInfo.stanzaId,
                    sender: quotedParticipant,
                    senderNumber: JidNormalizer.toPhoneNumber(quotedParticipant),
                    type: MessageNormalizer.extractType(this.contextInfo.quotedMessage),
                    body: MessageNormalizer.extractBody(this.contextInfo.quotedMessage),
                    raw: this.contextInfo.quotedMessage
                }
            }
        }
    }

    // ==========================================
    // Zero-Cost Memory Aliases & Compatibility Getters
    // ==========================================

    /** Alias for this.fromMe */
    get isFromMe() {
        return this.fromMe
    }

    /** Alias for this.from */
    get sender() {
        return this.from
    }

    /** Alias for this.fromNumber */
    get senderNumber() {
        return this.fromNumber
    }

    /** Alias for this.fromPushName */
    get senderName() {
        return this.fromPushName
    }

    /** Alias for this.mentions */
    get mentionedJids() {
        return this.mentions
    }

    /** Boolean check whether message contains media */
    get hasMedia() {
        return Boolean(this.media)
    }

    /** Backward-compatible media details accessor backed by MediaObject */
    get mediaDetails() {
        if (!this.media) return null
        return {
            mimetype: this.media.mimetype,
            fileName: this.media.fileName,
            caption: this.media.caption,
            duration: this.media.duration,
            isPtt: this.media.isPtt,
            isGif: this.media.isGif,
            isViewOnce: this.media.isViewOnce
        }
    }

    // ==========================================
    // Context Action Methods
    // ==========================================

    /**
     * Responde citando esta mensagem automaticamente
     * @param {string|Object} content - Texto ou payload de mensagem
     * @param {Object} [options={}]
     */
    async reply(content, options = {}) {
        const payload = typeof content === 'string' ? { text: content } : content
        return this.client.sendMessage(this.chatId, payload, {
            quoted: this.raw,
            ...options
        })
    }

    /**
     * Reage à mensagem com um emoji (ou string vazia para remover)
     * @param {string} emoji
     */
    async react(emoji) {
        return this.client.sendMessage(this.chatId, {
            react: {
                text: emoji || '',
                key: this.raw.key
            }
        })
    }

    /**
     * Remove qualquer reação anteriormente atribuída a esta mensagem
     */
    async removeReaction() {
        return this.react('')
    }

    /**
     * Apaga esta mensagem para todos na conversa (revoke)
     */
    async delete() {
        return this.client.sendMessage(this.chatId, {
            delete: this.raw.key
        })
    }

    /**
     * Marca esta mensagem como lida (ticks azuis)
     */
    async markRead() {
        if (!this.client?.sock?.readMessages) return
        return this.client.sock.readMessages([this.raw.key])
    }

    /**
     * Encaminha esta mensagem para outro destinatário
     * @param {string} targetJid
     * @param {Object} [options={}]
     */
    async forward(targetJid, options = {}) {
        return this.client.sendMessage(
            targetJid,
            { forward: this.raw, ...options }
        )
    }

    /**
     * Fixa a mensagem no chat com duração configurável
     * @param {number} [durationInSeconds=86400]
     */
    async pin(durationInSeconds = 86400) {
        if (!this.client?.sock?.pinInChatMessage) {
            throw new Error('Método pinInChatMessage indisponível no socket.')
        }
        return this.client.sock.pinInChatMessage(this.chatId, this.raw.key, 1, durationInSeconds)
    }

    /**
     * Desafixa a mensagem do topo da conversa
     */
    async unpin() {
        if (!this.client?.sock?.pinInChatMessage) {
            throw new Error('Método pinInChatMessage indisponível no socket.')
        }
        return this.client.sock.pinInChatMessage(this.chatId, this.raw.key, 2)
    }

    toString() {
        const author = this.fromPushName || this.senderName || this.fromNumber || this.from
        const preview = this.body ? `"${this.body}"` : `<${this.type}>`
        return `[Message ${this.id}] ${author}: ${preview}`
    }

    toJSON() {
        return {
            id: this.id,
            chatId: this.chatId,
            from: this.from,
            to: this.to,
            fromMe: this.fromMe,
            fromPushName: this.fromPushName,
            fromNumber: this.fromNumber,
            type: this.type,
            body: this.body,
            isEdited: this.isEdited,
            timestamp: this.timestamp
        }
    }

    [Symbol.toPrimitive]() {
        return this.toString()
    }
}

exports.MessageContext = MessageContext
exports.default = MessageContext
