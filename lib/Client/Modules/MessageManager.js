"use strict"

Object.defineProperty(exports, "__esModule", { value: true })

const { JidNormalizer } = require("../Normalizers/JidNormalizer")

class MessageManager {
    /**
     * @param {import('../WaClient').WaClient} client
     */
    constructor(client) {
        this.client = client
    }

    /**
     * Envia payload customizado diretamente (compatível com UnityChat)
     * @param {string} jid
     * @param {Object} content
     * @param {Object} [options={}]
     */
    async sendMessage(jid, content, options = {}) {
        return this.client.sendMessage(jid, content, options)
    }

    /**
     * Envia uma enquete (suporta assinatura UnityChat e WaClient)
     * @param {string} jid
     * @param {string|Object} pollNameOrBuilder
     * @param {string[]|Object} [pollValuesOrOptions]
     * @param {Object} [options={}]
     */
    async sendPoll(jid, pollNameOrBuilder, pollValuesOrOptions, options = {}) {
        if (typeof pollNameOrBuilder === 'string') {
            const values = Array.isArray(pollValuesOrOptions) ? pollValuesOrOptions : []
            const selectableCount = options?.selectableCount === 0 ? 0 : (options?.selectableCount || 1)
            return this.client.sendMessage(jid, {
                poll: {
                    name: pollNameOrBuilder,
                    values,
                    selectableCount
                }
            }, options)
        }
        return this.client.sendPoll(jid, pollNameOrBuilder, pollValuesOrOptions || {})
    }

    /**
     * Envia mensagem de texto com suporte a menções
     * @param {string} jid
     * @param {string} text
     * @param {Object} [options={}]
     */
    async sendText(jid, text, options = {}) {
        const payload = {
            text: text || '',
            ...(options.mentions ? { mentions: options.mentions.map(JidNormalizer.toJid) } : {})
        }
        return this.client.sendMessage(jid, payload, options)
    }

    /**
     * Envia arquivo de mídia (imagem, vídeo, áudio, documento ou figurinha)
     * @param {string} jid
     * @param {'image'|'video'|'audio'|'document'|'sticker'} type
     * @param {string|Buffer|Object} content - Caminho, URL ou Buffer
     * @param {Object} [options={}]
     */
    async sendMedia(jid, type, content, options = {}) {
        const mediaPayload = typeof content === 'string' ? { url: content } : content
        const payload = {
            [type]: mediaPayload,
            ...(options.caption ? { caption: options.caption } : {}),
            ...(options.fileName ? { fileName: options.fileName } : {}),
            ...(options.mimetype ? { mimetype: options.mimetype } : {}),
            ...(options.viewOnce ? { viewOnce: true } : {})
        }
        return this.client.sendMessage(jid, payload, options)
    }

    /**
     * Envia um álbum de fotos ou vídeos agrupados nativamente
     * @param {string} jid
     * @param {Array<Object>} items
     * @param {Object} [options={}]
     */
    async sendAlbum(jid, items = [], options = {}) {
        const targetJid = JidNormalizer.toJid(jid)
        if (this.client.sock?.sendAlbumMessage) {
            return this.client.sock.sendAlbumMessage(targetJid, items, options)
        }
        return this.client.sendMessage(targetJid, { album: items }, options)
    }

    /**
     * Envia áudio simulando gravação de voz (PTT / Voice Note)
     * @param {string} jid
     * @param {string|Buffer|Object} audioSource
     * @param {Object} [options={}]
     */
    async sendVoice(jid, audioSource, options = {}) {
        const payload = {
            audio: typeof audioSource === 'string' ? { url: audioSource } : audioSource,
            mimetype: 'audio/mp4',
            ptt: true,
            ...(options.waveform ? { waveform: options.waveform } : {})
        }
        return this.client.sendMessage(jid, payload, options)
    }

    /**
     * Envia um contato com cartão vCard
     * @param {string} jid
     * @param {string} name
     * @param {string} phoneNumber
     * @param {Object} [options={}]
     */
    async sendContact(jid, name, phoneNumber, options = {}) {
        const cleanPhone = JidNormalizer.toPhoneNumber(phoneNumber)
        const vcard = 'BEGIN:VCARD\n'
            + 'VERSION:3.0\n'
            + `FN:${name}\n`
            + `ORG:${options.org || name};\n`
            + `TEL;type=CELL;type=VOICE;waid=${cleanPhone}:+${cleanPhone}\n`
            + 'END:VCARD'

        const payload = {
            contacts: {
                displayName: name,
                contacts: [{ vcard }]
            }
        }
        return this.client.sendMessage(jid, payload, options)
    }

    /**
     * Envia localização fixa ou ao vivo.
     * Suporta `sendLocation(jid, { latitude, longitude, name, address, live }, options)`
     * e a assinatura posicional da UnityChat `sendLocation(jid, latitude, longitude, name, address)`.
     */
    async sendLocation(jid, coordsOrLat, lngOrOptions = {}, name = '', address = '') {
        let coords
        let options
        if (typeof coordsOrLat === 'number') {
            coords = {
                latitude: coordsOrLat,
                longitude: lngOrOptions,
                name,
                address
            }
            options = {}
        } else {
            coords = coordsOrLat || {}
            options = lngOrOptions || {}
        }

        const payload = {
            location: {
                degreesLatitude: coords.latitude,
                degreesLongitude: coords.longitude,
                ...(coords.name ? { name: coords.name } : {}),
                ...(coords.address ? { address: coords.address } : {})
            },
            ...(coords.live ? { live: true } : {})
        }
        return this.client.sendMessage(jid, payload, options)
    }

    /**
     * Encaminha uma mensagem existente para outro destinatário
     * @param {string} targetJid
     * @param {Object} message - Objeto raw da mensagem
     * @param {Object} [options={}]
     */
    async forward(targetJid, message, options = {}) {
        return this.client.sendMessage(targetJid, { forward: message }, options)
    }

    /**
     * Alias compatível com UnityChat para forward
     */
    async forwardMessage(targetJid, message, options = {}) {
        return this.forward(targetJid, message, options)
    }

    /**
     * Apaga uma mensagem para todos no chat
     * @param {string} jid
     * @param {Object} messageKey - { remoteJid, id, fromMe }
     */
    async delete(jid, messageKey) {
        return this.client.sendMessage(jid, { delete: messageKey })
    }

    /**
     * Edita uma mensagem de texto já enviada pelo próprio bot.
     * Suporta polimorfismo: edit(jid, messageKey, newText) e edit(messageKey, newText)
     * @param {string|Object} jidOrKey
     * @param {Object|string} keyOrText
     * @param {string} [maybeText]
     */
    async edit(jidOrKey, keyOrText, maybeText) {
        let jid, key, text
        if (typeof jidOrKey === 'object' && jidOrKey !== null) {
            // edit(messageKey, newText)
            key = jidOrKey.key || jidOrKey
            jid = key.remoteJid
            text = keyOrText
        } else if (typeof keyOrText === 'object' && keyOrText !== null) {
            // edit(jid, messageKey, newText)
            jid = jidOrKey
            key = keyOrText.key || keyOrText
            text = maybeText
        } else {
            jid = jidOrKey
            text = keyOrText
            key = maybeText
        }

        const cleanText = typeof text === 'string' ? text : (text?.text || String(text || ''))
        return this.client.sendMessage(jid, {
            edit: key,
            text: cleanText
        })
    }

    /**
     * Fixa uma mensagem no topo da conversa
     * @param {string} jid
     * @param {Object} messageKey
     * @param {number} [durationSeconds=86400]
     */
    async pin(jid, messageKey, durationSeconds = 86400) {
        const targetJid = JidNormalizer.toJid(jid)
        if (typeof this.client.sock?.pinInChatMessage === 'function') {
            return this.client.sock.pinInChatMessage(targetJid, messageKey, 1, durationSeconds)
        }
        return this.client.sendMessage(targetJid, {
            pin: {
                key: messageKey,
                type: 1,
                time: durationSeconds
            }
        })
    }

    /**
     * Desafixa mensagem do topo da conversa
     * @param {string} jid
     * @param {Object} messageKey
     */
    async unpin(jid, messageKey) {
        const targetJid = JidNormalizer.toJid(jid)
        if (typeof this.client.sock?.pinInChatMessage === 'function') {
            return this.client.sock.pinInChatMessage(targetJid, messageKey, 2)
        }
        return this.client.sendMessage(targetJid, {
            pin: {
                key: messageKey,
                type: 2
            }
        })
    }

    /**
     * Reage com emoji a uma mensagem
     * Suporta tanto react(jid, messageKey, emoji) quanto react(messageKey, emoji)
     * @param {string|Object} jidOrKey
     * @param {Object|string} messageKeyOrEmoji
     * @param {string} [maybeEmoji]
     */
    async react(jidOrKey, messageKeyOrEmoji, maybeEmoji) {
        let jid, key, emoji
        if (typeof jidOrKey === 'object' && jidOrKey !== null && jidOrKey.remoteJid) {
            // Assinatura UnityChat: react(messageKey, emoji)
            jid = jidOrKey.remoteJid
            key = jidOrKey
            emoji = messageKeyOrEmoji
        } else {
            // Assinatura WaClient: react(jid, messageKey, emoji)
            jid = jidOrKey
            key = messageKeyOrEmoji
            emoji = maybeEmoji
        }

        return this.client.sendMessage(jid, {
            react: {
                text: emoji || '',
                key: key
            }
        })
    }

    /**
     * Envia mensagem de texto (alias compatível com UnityChat)
     */
    async sendTextMessage(jid, text, options = {}) {
        return this.sendText(jid, text, options)
    }

    /**
     * Envia imagem (compatível com UnityChat)
     */
    async sendImage(jid, media, caption = '', options = {}) {
        return this.sendMedia(jid, 'image', media, { caption, ...options })
    }

    /**
     * Envia vídeo (compatível com UnityChat)
     */
    async sendVideo(jid, media, caption = '', options = {}) {
        return this.sendMedia(jid, 'video', media, { caption, ...options })
    }

    /**
     * Envia áudio/PTT (compatível com UnityChat)
     */
    async sendAudio(jid, media, ptt = true, options = {}) {
        return this.sendVoice(jid, media, { ptt, ...options })
    }

    /**
     * Envia documento (compatível com UnityChat)
     */
    async sendDocument(jid, media, mimetypeOrFileNameOrOpts, fileName = '', caption = '', options = {}) {
        let finalMime = ''
        let finalFileName = ''
        let finalCaption = ''
        let finalOpts = {}

        if (typeof mimetypeOrFileNameOrOpts === 'object' && mimetypeOrFileNameOrOpts !== null) {
            finalOpts = mimetypeOrFileNameOrOpts
            finalMime = finalOpts.mimetype || finalOpts.mime || ''
            finalFileName = finalOpts.fileName || finalOpts.filename || finalOpts.name || ''
            finalCaption = finalOpts.caption || ''
        } else if (typeof mimetypeOrFileNameOrOpts === 'string') {
            if (mimetypeOrFileNameOrOpts.includes('/')) {
                finalMime = mimetypeOrFileNameOrOpts
                if (typeof fileName === 'string') finalFileName = fileName
                if (typeof caption === 'string') finalCaption = caption
                else if (typeof caption === 'object' && caption !== null) {
                    finalCaption = caption.caption || ''
                    finalOpts = caption
                }
            } else {
                finalFileName = mimetypeOrFileNameOrOpts
                if (typeof fileName === 'string' && fileName.includes('/')) {
                    finalMime = fileName
                } else if (typeof fileName === 'string') {
                    finalCaption = fileName
                }
                if (typeof caption === 'string') {
                    if (caption.includes('/') && !finalMime) finalMime = caption
                    else finalCaption = caption
                } else if (typeof caption === 'object' && caption !== null) {
                    finalCaption = caption.caption || ''
                    finalOpts = caption
                }
            }
        }

        if (typeof options === 'object' && options !== null) {
            finalOpts = { ...finalOpts, ...options }
            if (finalOpts.caption && !finalCaption) finalCaption = finalOpts.caption
            if (finalOpts.fileName && !finalFileName) finalFileName = finalOpts.fileName
            if (finalOpts.mimetype && !finalMime) finalMime = finalOpts.mimetype
        }

        if (!finalMime && finalFileName) {
            const ext = finalFileName.split('.').pop()?.toLowerCase()
            const mimeMap = {
                pdf: 'application/pdf',
                txt: 'text/plain',
                doc: 'application/msword',
                docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                xls: 'application/vnd.ms-excel',
                xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                zip: 'application/zip',
                csv: 'text/csv'
            }
            if (ext && mimeMap[ext]) finalMime = mimeMap[ext]
        }

        if (typeof finalCaption === 'object' && finalCaption !== null) {
            finalCaption = finalCaption.caption || ''
        }

        return this.sendMedia(jid, 'document', media, {
            mimetype: finalMime || 'application/octet-stream',
            fileName: finalFileName || 'document',
            caption: String(finalCaption || ''),
            ...finalOpts
        })
    }

    async sendLink(jid, url, options = {}) {
        return this.sendText(jid, url, options)
    }

    /**
     * Envia um ou mais contatos
     * @param {string} jid
     * @param {Array<Object>|string} contactsOrName
     * @param {string} [phoneNumber]
     */
    async sendContacts(jid, contactsOrName, phoneNumber) {
        if (Array.isArray(contactsOrName)) {
            const vcards = contactsOrName.map(c => ({
                displayName: c.fullName || c.name || '',
                vcard: `BEGIN:VCARD\nVERSION:3.0\nFN:${c.fullName || c.name || ''}\n${c.organization ? `ORG:${c.organization};\n` : ''}TEL;type=CELL;type=VOICE;waid=${c.waid || c.phoneNumber}:+${String(c.waid || c.phoneNumber).replace(/\D/g, '')}\nEND:VCARD`
            }))
            return this.client.sendMessage(jid, { contacts: { contacts: vcards } })
        }
        return this.sendContact(jid, contactsOrName, phoneNumber)
    }

    /**
     * Responde citando uma mensagem existente (compatível com UnityChat)
     */
    async reply(originalMessage, content, options = {}) {
        const jid = originalMessage.key?.remoteJid || originalMessage.chatId
        const payload = typeof content === 'string' ? { text: content } : content
        return this.client.sendMessage(jid, payload, { quoted: originalMessage.raw || originalMessage, ...options })
    }

    /**
     * Edita uma mensagem enviada anteriormente (compatível com UnityChat e WaSockets)
     * Suporta editMessage(messageKey, newText) e editMessage(jid, messageKey, newText)
     */
    async editMessage(jidOrKey, keyOrText, maybeText) {
        return this.edit(jidOrKey, keyOrText, maybeText)
    }

    /**
     * Apaga uma mensagem. Suporta delete(messageKey) e delete(jid, messageKey)
     */
    async delete(jidOrKey, maybeKey) {
        if (typeof jidOrKey === 'object' && jidOrKey !== null && jidOrKey.remoteJid) {
            return this.client.sendMessage(jidOrKey.remoteJid, { delete: jidOrKey })
        }
        return this.client.sendMessage(jidOrKey, { delete: maybeKey })
    }

    /**
     * Marca mensagens como lidas (compatível com UnityChat)
     */
    async read(messageKey) {
        if (!this.client.sock?.readMessages) return
        const keys = Array.isArray(messageKey) ? messageKey : [messageKey]
        return this.client.sock.readMessages(keys)
    }

    /**
     * Notifica estado "digitando"
     */
    composing(jid) {
        return this.client.startTyping(jid)
    }

    /**
     * Baixa anexos de uma mensagem bruta do Baileys (compatível com UnityChat)
     */
    async getAttachments(message) {
        const { MediaObject } = require("../Context/MediaObject")
        const { MessageNormalizer } = require("../Normalizers/MessageNormalizer")
        const unwrapped = MessageNormalizer.unwrapMessage(message?.message || message)
        const mediaNode = MessageNormalizer.extractMediaNode(unwrapped)
        if (!mediaNode) return null
        const type = MessageNormalizer.extractType(unwrapped)
        const mediaObj = new MediaObject(mediaNode, type)
        return mediaObj.getAttachments()
    }

    /**
     * Recupera histórico remoto de mensagens a partir de uma mensagem âncora
     * @param {Object} oldMsg
     * @param {number} [limit=50]
     */
    async getMessages(oldMsg, limit = 50) {
        return this.client.getMessages(oldMsg, limit)
    }
}

exports.MessageManager = MessageManager
exports.default = MessageManager
