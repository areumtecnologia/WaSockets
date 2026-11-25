"use strict"

Object.defineProperty(exports, "__esModule", { value: true })

class MessageNormalizer {
    /**
     * Recursively unwraps all container wrappers (ephemeral, viewOnce, associatedChild, etc.)
     * @param {Object} rawMessageContent - raw message node from proto
     * @returns {Object} Unwrapped message object
     */
    static unwrapMessage(rawMessageContent) {
        if (!rawMessageContent) return null

        let msg = rawMessageContent
        let unwrapped = true

        // Loop to peel away multiple layers of wrappers if nested
        while (unwrapped && msg) {
            unwrapped = false

            if (msg.ephemeralMessage?.message) {
                msg = msg.ephemeralMessage.message
                unwrapped = true
                continue
            }
            if (msg.viewOnceMessage?.message) {
                msg = msg.viewOnceMessage.message
                unwrapped = true
                continue
            }
            if (msg.viewOnceMessageV2?.message) {
                msg = msg.viewOnceMessageV2.message
                unwrapped = true
                continue
            }
            if (msg.viewOnceMessageV2Extension?.message) {
                msg = msg.viewOnceMessageV2Extension.message
                unwrapped = true
                continue
            }
            if (msg.documentWithCaptionMessage?.message) {
                msg = msg.documentWithCaptionMessage.message
                unwrapped = true
                continue
            }
            if (msg.associatedChildMessage?.message) {
                msg = msg.associatedChildMessage.message
                unwrapped = true
                continue
            }
        }

        return msg
    }

    /**
     * Identifies the primary friendly content type of the message (28 distinct types)
     * @param {Object} messageContent - Raw or unwrapped message content
     * @returns {string} Normalized friendly type
     */
    static extractType(messageContent) {
        const msg = this.unwrapMessage(messageContent)
        if (!msg) return 'unknown'

        // 1. Text & Media Basics
        if (msg.conversation || msg.extendedTextMessage) return 'text'
        if (msg.imageMessage) return 'image'
        if (msg.albumMessage) return 'album'
        if (msg.videoMessage) return msg.videoMessage.gifPlayback ? 'gif' : 'video'
        if (msg.audioMessage) return msg.audioMessage.ptt ? 'voice' : 'audio'
        if (msg.documentMessage) return 'document'
        if (msg.stickerMessage) return 'sticker'
        if (msg.locationMessage) return 'location'
        if (msg.liveLocationMessage) return 'live_location'
        if (msg.contactMessage || msg.contactsArrayMessage) return 'contact'

        // 2. Polls & Events
        if (msg.pollCreationMessage || msg.pollCreationMessageV2 || msg.pollCreationMessageV3) return 'poll_creation'
        if (msg.pollUpdateMessage) return 'poll_update'
        if (msg.eventMessage) return 'event'
        if (msg.eventResponseMessage || msg.encEventResponseMessage) return 'event_response'

        // 3. Reactions & Pins
        if (msg.reactionMessage) return 'reaction'
        if (msg.pinInChatMessage) return 'pin_in_chat'
        if (msg.unpinInChatMessage) return 'unpin_in_chat'

        // 4. Replies from Buttons, Lists & Questions
        if (msg.buttonsResponseMessage) return 'button_reply'
        if (msg.listResponseMessage) return 'list_reply'
        if (msg.templateButtonReplyMessage) return 'template_button_reply'
        if (msg.questionReplyMessage) return 'question_reply'

        // 5. Specific Interactive Flow Buttons
        const firstBtnName = msg.interactiveMessage?.interactiveButtons?.[0]?.name
        if (firstBtnName) {
            switch (firstBtnName) {
                case 'review_and_pay': return 'review_and_pay'
                case 'review_order': return 'review_order'
                case 'quick_reply': return 'quick_reply'
                case 'cta_url': return 'cta_url'
                case 'cta_copy': return 'cta_copy'
                case 'cta_call': return 'cta_call'
                case 'voice_call': return 'voice_call'
                case 'payment_info': return 'payment_info'
            }
        }

        // 6. Native Flow Responses
        if (msg.interactiveResponseMessage?.nativeFlowResponseMessage) {
            const flowName = msg.interactiveResponseMessage.nativeFlowResponseMessage.name
            if (flowName === 'menu_options') return 'native_flow_menu_options_response'
            return 'native_flow_response'
        }

        // 7. Interactive Containers
        if (msg.interactiveMessage?.interactiveButtons) return 'interactive_buttons'
        if (msg.interactiveMessage?.interactiveList) return 'interactive_list'
        if (msg.interactiveResponseMessage) return 'interactive_response'
        if (msg.interactiveMessage) return 'interactive_message'

        // 8. Protocol
        if (msg.protocolMessage) return 'protocol'

        // Fallback to first non-metadata proto key
        const keys = Object.keys(msg).filter(k => k !== 'messageContextInfo' && k !== 'senderKeyDistributionMessage')
        return keys[0] ? keys[0].replace('Message', '').toLowerCase() : 'unknown'
    }

    /**
     * Extracts readable text content across diverse message structures
     * @param {Object} messageContent - Raw or unwrapped message content
     * @returns {string} Text body
     */
    static extractBody(messageContent) {
        const msg = this.unwrapMessage(messageContent)
        if (!msg) return ''

        // Direct Text
        if (msg.conversation) return msg.conversation
        if (msg.extendedTextMessage?.text) return msg.extendedTextMessage.text

        // Media Captions
        if (msg.imageMessage?.caption) return msg.imageMessage.caption
        if (msg.videoMessage?.caption) return msg.videoMessage.caption
        if (msg.documentMessage?.caption) return msg.documentMessage.caption

        // Button / List selections
        if (msg.buttonsResponseMessage?.selectedDisplayText) return msg.buttonsResponseMessage.selectedDisplayText
        if (msg.buttonsResponseMessage?.selectedButtonId) return msg.buttonsResponseMessage.selectedButtonId
        if (msg.listResponseMessage?.title) return msg.listResponseMessage.title
        if (msg.templateButtonReplyMessage?.selectedDisplayText) return msg.templateButtonReplyMessage.selectedDisplayText
        if (msg.templateButtonReplyMessage?.selectedId) return msg.templateButtonReplyMessage.selectedId

        // Interactive / Native Flows
        if (msg.interactiveResponseMessage?.body?.text) return msg.interactiveResponseMessage.body.text
        if (msg.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson) {
            return msg.interactiveResponseMessage.nativeFlowResponseMessage.paramsJson
        }
        if (msg.interactiveMessage?.body?.text) return msg.interactiveMessage.body.text

        // Polls, Reactions, Questions & Locations
        if (msg.pollCreationMessage?.name) return msg.pollCreationMessage.name
        if (msg.pollCreationMessageV2?.name) return msg.pollCreationMessageV2.name
        if (msg.pollCreationMessageV3?.name) return msg.pollCreationMessageV3.name
        if (msg.reactionMessage?.text) return msg.reactionMessage.text
        if (msg.questionReplyMessage?.message?.extendedTextMessage?.text) return msg.questionReplyMessage.message.extendedTextMessage.text
        if (msg.questionReplyMessage?.answer) return msg.questionReplyMessage.answer
        if (msg.locationMessage?.name || msg.locationMessage?.address) {
            return [msg.locationMessage.name, msg.locationMessage.address].filter(Boolean).join(' - ')
        }

        // Event RSVP Responses
        if (msg.eventResponseMessage) {
            const resp = msg.eventResponseMessage.response
            const respNames = { 1: 'Confirmou presença (Vou)', 2: 'Recusou convite (Não vou)', 3: 'Talvez vá (Talvez)' }
            return respNames[resp] || `Resposta de Evento: ${resp}`
        }
        if (msg.encEventResponseMessage) {
            return 'Resposta de Evento Enviada'
        }

        return ''
    }

    /**
     * Extracts and safely parses interactive button/list responses
     * @param {Object} messageContent - Unwrapped message content
     * @returns {Object|null} { id, text, params, flowName, type }
     */
    static extractInteractiveReply(messageContent) {
        const msg = this.unwrapMessage(messageContent)
        if (!msg) return null

        // 1. Classic Button Response
        if (msg.buttonsResponseMessage) {
            return {
                id: msg.buttonsResponseMessage.selectedButtonId || '',
                text: msg.buttonsResponseMessage.selectedDisplayText || '',
                type: 'button'
            }
        }

        // 2. List Dropdown Selection
        if (msg.listResponseMessage) {
            const row = msg.listResponseMessage.singleSelectReply
            return {
                id: row?.selectedRowId || '',
                text: msg.listResponseMessage.title || '',
                description: row?.description || '',
                type: 'list'
            }
        }

        // 3. Native Flow Interactive Response
        if (msg.interactiveResponseMessage?.nativeFlowResponseMessage) {
            const flow = msg.interactiveResponseMessage.nativeFlowResponseMessage
            let params = {}
            if (flow.paramsJson) {
                try {
                    params = JSON.parse(flow.paramsJson)
                } catch {
                    params = { raw: flow.paramsJson }
                }
            }

            const id = params?.id || params?.selected_id || params?.row_id || flow.name || ''
            return {
                id,
                text: flow.paramsJson || '',
                params,
                flowName: flow.name || '',
                type: 'native_flow'
            }
        }

        // 4. Template Button Reply
        if (msg.templateButtonReplyMessage) {
            return {
                id: msg.templateButtonReplyMessage.selectedId || '',
                text: msg.templateButtonReplyMessage.selectedDisplayText || '',
                type: 'template_button'
            }
        }

        // 5. Question Reply (Channels)
        if (msg.questionReplyMessage) {
            return {
                id: msg.questionReplyMessage.selectedButtonId || '',
                text: msg.questionReplyMessage.selectedDisplayText || msg.questionReplyMessage.answer || '',
                type: 'question_reply'
            }
        }

        return null
    }

    /**
     * Extracts and parses contacts from vCards
     * @param {Object} messageContent - Unwrapped message content
     * @returns {Array<{ name: string, number: string, org?: string, vcard: string }>}
     */
    static extractContacts(messageContent) {
        const msg = this.unwrapMessage(messageContent)
        if (!msg) return []

        const parseVcard = (vcard = '') => {
            const nameMatch = vcard.match(/FN:(.+)/i)
            // Tenta waid= primeiro, se não encontrar pega TEL
            const waidMatch = vcard.match(/waid=(\d+)/i)
            const telMatch = vcard.match(/TEL[^:]*:([+\d\s().-]+)/i)
            const orgMatch = vcard.match(/ORG:([^;\n\r]+)/i)

            let number = ''
            if (waidMatch) {
                number = waidMatch[1].replace(/\D/g, '')
            } else if (telMatch) {
                number = telMatch[1].replace(/\D/g, '')
            }

            return {
                name: (nameMatch ? nameMatch[1] : '').replace(/\\/g, '').trim(),
                number,
                org: orgMatch ? orgMatch[1].trim() : undefined,
                vcard
            }
        }

        if (msg.contactMessage) {
            return [parseVcard(msg.contactMessage.vcard)]
        }

        if (msg.contactsArrayMessage?.contacts) {
            return msg.contactsArrayMessage.contacts.map(c => parseVcard(c.vcard))
        }

        return []
    }

    /**
     * Extracts coordinates and metadata from location messages
     * @param {Object} messageContent - Unwrapped message content
     * @returns {Object|null}
     */
    static extractLocation(messageContent) {
        const msg = this.unwrapMessage(messageContent)
        if (!msg) return null

        const loc = msg.locationMessage || msg.liveLocationMessage
        if (!loc) return null

        return {
            latitude: Number(loc.degreesLatitude || 0),
            longitude: Number(loc.degreesLongitude || 0),
            name: loc.name || '',
            address: loc.address || '',
            url: loc.url || '',
            accuracyInMeters: loc.accuracyInMeters ? Number(loc.accuracyInMeters) : undefined,
            speedInMps: loc.speedInMps ? Number(loc.speedInMps) : undefined,
            isLive: Boolean(msg.liveLocationMessage)
        }
    }

    /**
     * Extracts reaction details
     * @param {Object} messageContent - Unwrapped message content
     * @returns {Object|null}
     */
    static extractReaction(messageContent) {
        const msg = this.unwrapMessage(messageContent)
        if (!msg?.reactionMessage) return null

        const reaction = msg.reactionMessage
        return {
            emoji: reaction.text || '',
            reactedMessageId: reaction.key?.id || '',
            targetKey: reaction.key || null,
            isRemoval: !reaction.text,
            senderTimestamp: reaction.senderTimestampMs ? new Date(Number(reaction.senderTimestampMs)) : new Date()
        }
    }

    /**
     * Extracts poll creation structure
     * @param {Object} messageContent - Unwrapped message content
     * @param {Object} [rawMessage]
     * @returns {Object|null}
     */
    static extractPollCreation(messageContent, rawMessage) {
        const msg = this.unwrapMessage(messageContent)
        const poll = msg?.pollCreationMessage || msg?.pollCreationMessageV2 || msg?.pollCreationMessageV3
        if (!poll) return null

        return {
            id: rawMessage?.key?.id || '',
            name: poll.name || '',
            selectableOptionsCount: Number(poll.selectableOptionsCount || 1),
            allowsMultipleAnswers: Number(poll.selectableOptionsCount || 1) > 1,
            options: (poll.options || []).map(opt => ({
                name: opt.optionName || '',
                hash: opt.optionHash ? Buffer.from(opt.optionHash).toString('hex') : null
            }))
        }
    }

    /**
     * Extracts poll update / vote details
     * @param {Object} messageContent - Unwrapped message content
     * @param {Object} [rawMessage]
     * @returns {Object|null}
     */
    static extractPollUpdate(messageContent, rawMessage) {
        const msg = this.unwrapMessage(messageContent)
        const update = msg?.pollUpdateMessage
        if (!update) return null

        return {
            pollCreationMessageKey: update.pollCreationMessageKey || null,
            pollCreationMessageId: update.pollCreationMessageKey?.id || '',
            vote: update.vote || null,
            senderTimestamp: update.senderTimestampMs ? new Date(Number(update.senderTimestampMs)) : new Date(),
            voterTimestamp: update.senderTimestampMs ? new Date(Number(update.senderTimestampMs)) : new Date(),
            raw: update
        }
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
     * Extracts structured media details
     * @param {Object} messageContent - Unwrapped message content
     * @returns {Object|null}
     */
    static extractMediaDetails(messageContent) {
        const node = this.extractMediaNode(messageContent)
        if (!node) return null

        return {
            mimetype: node.mimetype || '',
            fileName: node.fileName || '',
            caption: node.caption || '',
            duration: node.seconds ? Number(node.seconds) : null,
            isPtt: Boolean(node.ptt),
            isGif: Boolean(node.gifPlayback),
            isViewOnce: Boolean(node.viewOnce)
        }
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
            msg.templateButtonReplyMessage?.contextInfo ||
            msg.messageContextInfo ||
            null
        )
    }
}

exports.MessageNormalizer = MessageNormalizer
exports.default = MessageNormalizer
