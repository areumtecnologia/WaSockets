"use strict"

Object.defineProperty(exports, "__esModule", { value: true })

class MessageNormalizer {
    /**
     * Unwraps container wrappers (ephemeral, viewOnce, documentWithCaption, etc.)
     * @param {Object} rawMessageContent - raw message node from proto
     * @returns {Object} Unwrapped message object
     */
    static unwrapMessage(rawMessageContent) {
        if (!rawMessageContent) return null

        let msg = rawMessageContent
        while (
            msg.ephemeralMessage ||
            msg.viewOnceMessage ||
            msg.viewOnceMessageV2 ||
            msg.viewOnceMessageV2Extension ||
            msg.documentWithCaptionMessage
        ) {
            msg =
                msg.ephemeralMessage?.message ||
                msg.viewOnceMessage?.message ||
                msg.viewOnceMessageV2?.message ||
                msg.viewOnceMessageV2Extension?.message ||
                msg.documentWithCaptionMessage?.message ||
                msg
        }

        return msg
    }

    /**
     * Identifies the primary content type of the message
     * @param {Object} messageContent - Unwrapped message content
     * @returns {string} Normalized type (e.g., 'text', 'image', 'video', 'audio', etc.)
     */
    static extractType(messageContent) {
        const msg = this.unwrapMessage(messageContent)
        if (!msg) return 'unknown'

        if (msg.conversation || msg.extendedTextMessage) return 'text'
        if (msg.imageMessage) return 'image'
        if (msg.videoMessage) return msg.videoMessage.gifPlayback ? 'gif' : 'video'
        if (msg.audioMessage) return msg.audioMessage.ptt ? 'voice' : 'audio'
        if (msg.documentMessage) return 'document'
        if (msg.stickerMessage) return 'sticker'
        if (msg.contactMessage || msg.contactsArrayMessage) return 'contact'
        if (msg.locationMessage || msg.liveLocationMessage) return 'location'
        if (msg.pollCreationMessage || msg.pollCreationMessageV2 || msg.pollCreationMessageV3) return 'poll'
        if (msg.reactionMessage) return 'reaction'
        if (msg.interactiveMessage || msg.interactiveResponseMessage) return 'interactive'
        if (msg.buttonsResponseMessage || msg.templateButtonReplyMessage) return 'button_reply'
        if (msg.listResponseMessage) return 'list_reply'
        if (msg.protocolMessage) return 'protocol'

        const keys = Object.keys(msg).filter(k => k !== 'messageContextInfo' && k !== 'senderKeyDistributionMessage')
        return keys[0] ? keys[0].replace('Message', '').toLowerCase() : 'unknown'
    }

    /**
     * Extracts readable text content across diverse message structures
     * @param {Object} messageContent - Unwrapped message content
     * @returns {string} Text body
     */
    static extractBody(messageContent) {
        const msg = this.unwrapMessage(messageContent)
        if (!msg) return ''

        if (msg.conversation) return msg.conversation
        if (msg.extendedTextMessage?.text) return msg.extendedTextMessage.text
        if (msg.imageMessage?.caption) return msg.imageMessage.caption
        if (msg.videoMessage?.caption) return msg.videoMessage.caption
        if (msg.documentMessage?.caption) return msg.documentMessage.caption
        if (msg.buttonsResponseMessage?.selectedDisplayText) return msg.buttonsResponseMessage.selectedDisplayText
        if (msg.listResponseMessage?.title) return msg.listResponseMessage.title
        if (msg.templateButtonReplyMessage?.selectedId) return msg.templateButtonReplyMessage.selectedId
        if (msg.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson) {
            return msg.interactiveResponseMessage.nativeFlowResponseMessage.paramsJson
        }
        if (msg.pollCreationMessage?.name) return msg.pollCreationMessage.name
        if (msg.pollCreationMessageV2?.name) return msg.pollCreationMessageV2.name
        if (msg.pollCreationMessageV3?.name) return msg.pollCreationMessageV3.name
        if (msg.reactionMessage?.text) return msg.reactionMessage.text

        return ''
    }

    /**
     * Extracts media node if present
     * @param {Object} messageContent - Unwrapped message content
     * @returns {Object|null}
     */
    static extractMediaNode(messageContent) {
        const msg = this.unwrapMessage(messageContent)
        if (!msg) return null

        return (
            msg.imageMessage ||
            msg.videoMessage ||
            msg.audioMessage ||
            msg.documentMessage ||
            msg.stickerMessage ||
            null
        )
    }

    /**
     * Extracts quoted message context info
     * @param {Object} messageContent - Unwrapped message content
     * @returns {Object|null}
     */
    static extractContextInfo(messageContent) {
        const msg = this.unwrapMessage(messageContent)
        if (!msg) return null

        return (
            msg.extendedTextMessage?.contextInfo ||
            msg.imageMessage?.contextInfo ||
            msg.videoMessage?.contextInfo ||
            msg.audioMessage?.contextInfo ||
            msg.documentMessage?.contextInfo ||
            msg.stickerMessage?.contextInfo ||
            msg.buttonsResponseMessage?.contextInfo ||
            msg.listResponseMessage?.contextInfo ||
            msg.interactiveResponseMessage?.contextInfo ||
            null
        )
    }
}

exports.MessageNormalizer = MessageNormalizer
exports.default = MessageNormalizer
