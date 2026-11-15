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
     * Envia localização fixa ou ao vivo
     * @param {string} jid
     * @param {{ latitude: number, longitude: number, name?: string, address?: string, live?: boolean }} coords
     * @param {Object} [options={}]
     */
    async sendLocation(jid, coords, options = {}) {
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
     * Apaga uma mensagem para todos no chat
     * @param {string} jid
     * @param {Object} messageKey - { remoteJid, id, fromMe }
     */
    async delete(jid, messageKey) {
        return this.client.sendMessage(jid, { delete: messageKey })
    }

    /**
     * Edita uma mensagem de texto já enviada pelo próprio bot
     * @param {string} jid
     * @param {Object} messageKey
     * @param {string} newText
     */
    async edit(jid, messageKey, newText) {
        return this.client.sendMessage(jid, {
            edit: messageKey,
            text: newText
        })
    }

    /**
     * Fixa uma mensagem no topo da conversa
     * @param {string} jid
     * @param {Object} messageKey
     * @param {number} [durationSeconds=86400]
     */
    async pin(jid, messageKey, durationSeconds = 86400) {
        if (!this.client.sock?.pinInChatMessage) {
            throw new Error('Método pinInChatMessage indisponível no socket.')
        }
        const targetJid = JidNormalizer.toJid(jid)
        return this.client.sock.pinInChatMessage(targetJid, messageKey, 1, durationSeconds)
    }

    /**
     * Desafixa mensagem do topo da conversa
     * @param {string} jid
     * @param {Object} messageKey
     */
    async unpin(jid, messageKey) {
        if (!this.client.sock?.pinInChatMessage) {
            throw new Error('Método pinInChatMessage indisponível no socket.')
        }
        const targetJid = JidNormalizer.toJid(jid)
        return this.client.sock.pinInChatMessage(targetJid, messageKey, 2)
    }

    /**
     * Reage com emoji a uma mensagem
     * @param {string} jid
     * @param {Object} messageKey
     * @param {string} emoji
     */
    async react(jid, messageKey, emoji) {
        return this.client.sendMessage(jid, {
            react: {
                text: emoji || '',
                key: messageKey
            }
        })
    }
}

exports.MessageManager = MessageManager
exports.default = MessageManager
