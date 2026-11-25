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

        // 3. Identity and Routing (Extrai PN e LID de remoteJid / remoteJidAlt - idêntico ao UnityChat)
        const rawRemote = effectiveKey.remoteJid || rawMessage?.key?.remoteJid || ''
        const rawAlt = effectiveKey.remoteJidAlt || rawMessage?.key?.remoteJidAlt || ''
        const allKeys = [rawRemote, rawAlt].filter(Boolean)

        const chatLid = allKeys.find(j => j.includes('@lid'))?.replace(/:.*?@/, '@') || null
        let parsedChatId = allKeys.find(j => !j.includes('@lid'))?.replace(/:.*?@/, '@') || rawRemote.replace(/:.*?@/, '@')

        // Se parsedChatId ainda for @lid, tenta resolver com o cache reverso
        if (parsedChatId.endsWith('@lid') && chatLid && client?.contacts?.lidToPnMap?.has(chatLid)) {
            parsedChatId = client.contacts.lidToPnMap.get(chatLid)
        }

        this.id = effectiveKey.id || rawMessage?.key?.id || ''
        this.chatId = parsedChatId
        this.lid = chatLid
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
        this.pollUpdate = MessageNormalizer.extractPollUpdate(unwrapped, rawMessage)

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

    /**
     * Backward-compatible synchronous chat metadata getter (Zero network overhead)
     */
    get chat() {
        const cached = this.client?.contacts?.get?.(this.chatId)
        const rawAlt = this.raw?.key?.remoteJidAlt
        const chatLid = (rawAlt && rawAlt.endsWith('@lid') ? rawAlt : null) || cached?.lid || null

        let defaultName = cached?.name || this.fromPushName
        if (!defaultName) {
            if (this.isGroup) defaultName = 'Grupo'
            else if (this.isChannel) defaultName = 'Canal'
            else defaultName = this.fromNumber || this.chatId.split('@')[0]
        }

        return {
            id: this.chatId,
            lid: chatLid,
            name: defaultName,
            type: cached?.type || (this.isGroup ? 'group' : this.isChannel ? 'newsletter' : 'personal'),
            isGroup: this.isGroup,
            isNewsletter: this.isChannel,
            isBusiness: Boolean(cached?.isBusiness),
            metadata: cached?.metadata || null,
            slogan: cached?.slogan || null,
            description: cached?.description || null,
            picture: cached?.picture || null,

            fetchFullProfile: async () => {
                if (this.client?.contacts?.enrich) {
                    return this.client.contacts.enrich(this.chatId)
                }
                if (this.isGroup && this.client?.groups) {
                    return this.client.groups.getMetadata(this.chatId)
                }
                if (this.isChannel && this.client?.channels) {
                    return this.client.channels.getMetadata(this.chatId)
                }
                if (this.client?.users) {
                    return this.client.users.getBusinessProfile?.(this.chatId)
                }
                return null
            },

            toString() {
                return `[Chat ${this.type}: ${this.name} (${this.id})]`
            },

            toJSON() {
                return {
                    id: this.id,
                    lid: this.lid,
                    name: this.name,
                    type: this.type,
                    isGroup: this.isGroup,
                    isNewsletter: this.isNewsletter,
                    isBusiness: this.isBusiness
                }
            }
        }
    }

    /** Alias for this.fromMe */
    get isFromMe() {
        return this.fromMe
    }

    /** Alias for this.quoted */
    get quotedMessage() {
        return this.quoted
    }

    set quotedMessage(val) {
        this.quoted = val
    }

    /** Alias for this.from */
    get sender() {
        return this.from
    }
    set sender(val) {
        this.from = val
    }

    /** Alias for this.fromNumber */
    get senderNumber() {
        return this.fromNumber
    }
    set senderNumber(val) {
        this.fromNumber = val
    }

    /** Alias for this.fromPushName */
    get senderName() {
        return this.fromPushName
    }
    set senderName(val) {
        this.fromPushName = val
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
        return this.client.messages.pin(this.chatId, this.raw.key, durationInSeconds)
    }

    /**
     * Desafixa a mensagem do topo da conversa
     */
    async unpin() {
        return this.client.messages.unpin(this.chatId, this.raw.key)
    }

    /**
     * Obtém os detalhes estruturados da resposta do evento (RSVP), descriptografando se necessário
     * @returns {Promise<Object|null>}
     */
    async getEventResponse() {
        const rawMsg = this.raw?.message || {}
        if (rawMsg.eventResponseMessage) {
            const resp = rawMsg.eventResponseMessage
            const statusMap = { 0: 'UNKNOWN', 1: 'GOING', 2: 'NOT_GOING', 3: 'MAYBE' }
            const labelMap = { 0: 'Desconhecido', 1: 'Confirmado (Vou)', 2: 'Recusado (Não vou)', 3: 'Talvez' }
            const statusCode = resp.response || 0
            const status = statusMap[statusCode] || 'UNKNOWN'
            return {
                eventMessageId: resp.eventCreationMessageKey?.id,
                eventCreationMessageKey: resp.eventCreationMessageKey,
                status,
                statusCode,
                statusLabel: labelMap[statusCode] || 'Desconhecido',
                isAttending: statusCode === 1,
                extraGuests: resp.extraGuestCount || 0,
                timestampMs: Number(resp.timestampMs || Date.now()),
                timestamp: new Date(Number(resp.timestampMs || Date.now())),
                raw: resp
            }
        }

        if (rawMsg.encEventResponseMessage) {
            try {
                return await this.client.decryptEventResponse(rawMsg.encEventResponseMessage, {
                    chatId: this.chatId,
                    sender: this.from,
                    responderJid: this.raw?.key?.participant || this.raw?.key?.remoteJid || this.from,
                    responderKey: this.raw?.key
                })
            } catch (err) {
                this.client?.options?.logger?.warn?.({ err: err?.message }, 'Failed to decrypt event response in MessageContext')
                return null
            }
        }

        return null
    }

    /**
     * Obtém os detalhes decodificados do voto em enquete
     * @returns {Promise<Object|null>}
     */
    async getPollVote() {
        const rawMsg = this.raw?.message || {}
        const pollUpdate = this.pollUpdate || rawMsg.pollUpdateMessage
        if (!pollUpdate) return null

        try {
            return await this.client.decryptPollVote(pollUpdate, {
                chatId: this.chatId,
                sender: this.from,
                voterJid: this.raw?.key?.participant || this.raw?.key?.remoteJid || this.from,
                voterKey: this.raw?.key
            })
        } catch (err) {
            this.client?.options?.logger?.warn?.({ err: err?.message }, 'Failed to decrypt poll vote in MessageContext')
            return null
        }
    }

    /**
     * Downloads attachment with helpers (compatible with UnityChat)
     * @param {Object} [options={}]
     * @returns {Promise<Object|null>}
     */
    async getAttachments(options = {}) {
        if (!this.media) return null
        return this.media.getAttachments(options)
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
