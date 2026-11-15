"use strict"

Object.defineProperty(exports, "__esModule", { value: true })

const { JidNormalizer } = require("../Normalizers/JidNormalizer")
const { MessageNormalizer } = require("../Normalizers/MessageNormalizer")
const { MediaObject } = require("./MediaObject")

class MessageContext {
    /**
     * @param {import('../WaClient').WaClient} client
     * @param {Object} rawMessage - proto.IWebMessageInfo
     */
    constructor(client, rawMessage) {
        this.client = client
        this.raw = rawMessage

        const key = rawMessage.key || {}
        this.id = key.id || ''
        this.chatId = key.remoteJid || ''
        this.isFromMe = Boolean(key.fromMe)
        this.isGroup = JidNormalizer.isGroup(this.chatId)
        this.isChannel = JidNormalizer.isNewsletter(this.chatId)
        this.isBroadcast = JidNormalizer.isBroadcast(this.chatId)

        // Sender determination (group participant vs 1:1 chat remoteJid)
        this.sender = this.isGroup
            ? (key.participant || rawMessage.participant || this.chatId)
            : this.chatId
        this.senderNumber = JidNormalizer.toPhoneNumber(this.sender)
        this.senderName = rawMessage.pushName || this.senderNumber || 'Desconhecido'

        // Content Extraction
        const messageContent = rawMessage.message || null
        this.type = MessageNormalizer.extractType(messageContent)
        this.body = MessageNormalizer.extractBody(messageContent)
        this.mediaNode = MessageNormalizer.extractMediaNode(messageContent)
        this.hasMedia = Boolean(this.mediaNode)
        this.media = this.hasMedia ? new MediaObject(this.mediaNode, this.type) : null
        this.timestamp = Number(rawMessage.messageTimestamp || Math.floor(Date.now() / 1000))

        // Context info & mentions
        this.contextInfo = MessageNormalizer.extractContextInfo(messageContent)
        this.mentionedJids = this.contextInfo?.mentionedJid || []

        // Quoted message parsing
        this.quoted = null
        if (this.contextInfo?.quotedMessage) {
            const quotedMsg = this.contextInfo.quotedMessage
            this.quoted = {
                id: this.contextInfo.stanzaId,
                sender: this.contextInfo.participant,
                senderNumber: JidNormalizer.toPhoneNumber(this.contextInfo.participant),
                type: MessageNormalizer.extractType(quotedMsg),
                body: MessageNormalizer.extractBody(quotedMsg),
                raw: quotedMsg
            }
        }
    }

    /**
     * Responde citando esta mensagem automaticamente
     * @param {string|Object} content - Texto ou objeto de mensagem do WaSockets
     * @param {Object} [options={}] - Opções adicionais de envio
     */
    async reply(content, options = {}) {
        const payload = typeof content === 'string' ? { text: content } : content
        return this.client.sendMessage(this.chatId, payload, {
            quoted: this.raw,
            ...options
        })
    }

    /**
     * Reage à mensagem com um emoji
     * @param {string} emoji - Emoji único (ex: '👍', '❤️', '🔥')
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
        if (!this.client.sock?.readMessages) return
        return this.client.sock.readMessages([this.raw.key])
    }

    /**
     * Encaminha esta mensagem para outro destinatário
     * @param {string} targetJid - Destinatário
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
     * @param {number} [durationInSeconds=86400] - 86400 (24h), 604800 (7d), 2592000 (30d)
     */
    async pin(durationInSeconds = 86400) {
        if (!this.client.sock?.pinInChatMessage) {
            throw new Error('Método pinInChatMessage indisponível no socket.')
        }
        return this.client.sock.pinInChatMessage(this.chatId, this.raw.key, 1, durationInSeconds)
    }

    /**
     * Desafixa a mensagem do topo da conversa
     */
    async unpin() {
        if (!this.client.sock?.pinInChatMessage) {
            throw new Error('Método pinInChatMessage indisponível no socket.')
        }
        return this.client.sock.pinInChatMessage(this.chatId, this.raw.key, 2)
    }
}

exports.MessageContext = MessageContext
exports.default = MessageContext
