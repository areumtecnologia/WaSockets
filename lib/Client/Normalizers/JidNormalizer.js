"use strict"

Object.defineProperty(exports, "__esModule", { value: true })

class JidNormalizer {
    /**
     * Sanitizes and normalizes any phone number or JID string into a canonical JID
     * @param {string} input - Phone number (e.g., "+55 (11) 99999-9999") or existing JID
     * @returns {string} Normalized JID (e.g., "5511999999999@s.whatsapp.net")
     */
    static toJid(input) {
        if (!input || typeof input !== 'string') return ''
        const cleaned = input.trim()

        if (cleaned.includes('@')) {
            return cleaned
        }

        const digits = cleaned.replace(/\D/g, '')
        if (!digits) return ''

        return `${digits}@s.whatsapp.net`
    }

    /**
     * Extracts pure numeric phone number from a JID
     * @param {string} jid - WhatsApp JID
     * @returns {string} Extracted phone number or empty string
     */
    static toPhoneNumber(jid) {
        if (!jid || typeof jid !== 'string') return ''
        const base = jid.split('@')[0]
        const withoutDevice = base.split(':')[0]
        return withoutDevice.replace(/\D/g, '')
    }

    /**
     * Checks if JID represents a WhatsApp Group
     * @param {string} jid
     * @returns {boolean}
     */
    static isGroup(jid) {
        return typeof jid === 'string' && jid.endsWith('@g.us')
    }

    /**
     * Checks if JID represents a WhatsApp Channel / Newsletter
     * @param {string} jid
     * @returns {boolean}
     */
    static isNewsletter(jid) {
        return typeof jid === 'string' && jid.endsWith('@newsletter')
    }

    /**
     * Checks if JID is an internal LID (Linked Identity)
     * @param {string} jid
     * @returns {boolean}
     */
    static isLid(jid) {
        return typeof jid === 'string' && jid.endsWith('@lid')
    }

    /**
     * Checks if JID is a regular user chat (Phone Number based)
     * @param {string} jid
     * @returns {boolean}
     */
    static isUser(jid) {
        return typeof jid === 'string' && jid.endsWith('@s.whatsapp.net')
    }

    /**
     * Checks if JID represents WhatsApp Status Broadcast
     * @param {string} jid
     * @returns {boolean}
     */
    static isStatusBroadcast(jid) {
        return typeof jid === 'string' && jid === 'status@broadcast'
    }

    /**
     * Checks if JID represents any Broadcast list
     * @param {string} jid
     * @returns {boolean}
     */
    static isBroadcast(jid) {
        return typeof jid === 'string' && jid.endsWith('@broadcast')
    }
}

exports.JidNormalizer = JidNormalizer
exports.default = JidNormalizer
