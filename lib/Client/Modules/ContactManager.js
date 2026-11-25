"use strict"

Object.defineProperty(exports, "__esModule", { value: true })

const { LRUCache } = require("lru-cache")
const { JidNormalizer } = require("../Normalizers/JidNormalizer")

/**
 * High-performance contact management module backed by an LRU cache.
 * Provides transparent backward compatibility with @areumtecnologia/unitychat.
 */
class ContactManager {
    /**
     * @param {import('../WaClient').WaClient} client
     * @param {Object} [options={}]
     * @param {number} [options.maxContacts=5000] - Maximum contacts in cache
     * @param {number} [options.ttl=86400000] - Cache TTL in ms (default 24h)
     */
    constructor(client, options = {}) {
        this.client = client

        // Primary LRU cache indexed by canonical JID
        this.cache = new LRUCache({
            max: options.maxContacts || 5000,
            ttl: options.ttl || 1000 * 60 * 60 * 24
        })

        // Reverse map for instant O(1) LID -> PN JID lookup
        this.lidToPnMap = new Map()
    }

    /**
     * Resolves canonical key handling LID to PN resolution
     * @private
     * @param {string} key
     * @returns {string}
     */
    _normalizeKey(key) {
        if (!key) return ''
        const clean = JidNormalizer.toJid(key)
        if (clean.endsWith('@lid') && this.lidToPnMap.has(clean)) {
            return this.lidToPnMap.get(clean)
        }
        return clean
    }

    /**
     * Retrieves a contact from cache (compatible with UnityChat)
     * @param {string} jid
     * @returns {Object|null}
     */
    get(jid) {
        if (!jid) return null
        const key = this._normalizeKey(jid)
        return this.cache.get(key) || null
    }

    /**
     * Stores or updates a contact in cache (compatible with UnityChat)
     * @param {string} jid
     * @param {Object} contact
     */
    set(jid, contact) {
        if (!jid || !contact) return
        const key = JidNormalizer.toJid(jid)

        // Register reverse mapping if LID present
        if (contact.lid) {
            this.lidToPnMap.set(contact.lid, key)
        }
        if (key.endsWith('@lid') && contact.id && !contact.id.endsWith('@lid')) {
            this.lidToPnMap.set(key, contact.id)
        }

        const existing = this.cache.get(key) || {}
        const merged = {
            id: key,
            lid: contact.lid || existing.lid || null,
            name: contact.name || contact.notify || contact.verifiedName || existing.name || JidNormalizer.toPhoneNumber(key),
            type: contact.type || existing.type || (key.endsWith('@g.us') ? 'group' : key.endsWith('@newsletter') ? 'newsletter' : 'personal'),
            isGroup: key.endsWith('@g.us'),
            isNewsletter: key.endsWith('@newsletter'),
            isBusiness: Boolean(contact.isBusiness || existing.isBusiness || contact.verifiedName),
            slogan: contact.slogan || existing.slogan || null,
            picture: contact.picture || existing.picture || null,
            metadata: contact.metadata || existing.metadata || null
        }

        this.cache.set(key, merged)
    }

    /**
     * Returns all contacts currently held in cache (compatible with UnityChat)
     * @returns {Array<Object>}
     */
    getAll() {
        return Array.from(this.cache.values())
    }

    /**
     * Checks if contact is cached
     * @param {string} jid
     * @returns {boolean}
     */
    has(jid) {
        const key = this._normalizeKey(jid)
        return this.cache.has(key)
    }

    /**
     * Removes a contact from cache
     * @param {string} jid
     */
    delete(jid) {
        const key = this._normalizeKey(jid)
        this.cache.delete(key)
    }

    /**
     * Clears all contacts from cache
     */
    clear() {
        this.cache.clear()
        this.lidToPnMap.clear()
    }

    /**
     * Normalizes a contact from a raw message envelope without blocking network I/O
     * @param {Object} rawMessage - Message with key: { remoteJid, fromMe, remoteJidAlt }
     * @param {Object} [options={}]
     * @param {boolean} [options.enrich=false]
     * @returns {Promise<Object>}
     */
    async normalize(rawMessage, options = {}) {
        if (!rawMessage || !rawMessage.key) return null

        const key = rawMessage.key
        const fromMe = Boolean(key.fromMe)
        const myJid = this.client?.user?.id ? JidNormalizer.toJid(this.client.user.id) : ''
        const myName = this.client?.user?.name || 'Você'

        const rawAlt = key.remoteJidAlt
        const chatLid = rawAlt && rawAlt.endsWith('@lid') ? rawAlt : null
        const chatId = JidNormalizer.toJid(key.remoteJid)

        const isGroup = JidNormalizer.isGroup(chatId)
        const isNewsletter = JidNormalizer.isNewsletter(chatId)

        let contactName = fromMe ? myName : (rawMessage.pushName || '')
        if (!contactName) {
            contactName = isGroup ? 'Grupo' : isNewsletter ? 'Canal' : JidNormalizer.toPhoneNumber(chatId)
        }

        const cached = this.get(chatId)

        const contact = {
            id: chatId,
            lid: chatLid || cached?.lid || null,
            name: cached?.name && cached.name !== JidNormalizer.toPhoneNumber(chatId) ? cached.name : contactName,
            type: isGroup ? 'group' : isNewsletter ? 'newsletter' : (cached?.type || 'personal'),
            isGroup,
            isNewsletter,
            isBusiness: Boolean(cached?.isBusiness),
            slogan: cached?.slogan || null,
            picture: cached?.picture || null,
            metadata: cached?.metadata || null
        }

        this.set(chatId, contact)

        if (options.enrich) {
            await this.enrich(chatId)
        }

        return contact
    }

    /**
     * Enriches a contact in the background by fetching profile picture and bio/about
     * @param {string} jid
     * @returns {Promise<Object|null>}
     */
    async enrich(jid) {
        const contact = this.get(jid)
        if (!contact) return null

        try {
            if (!contact.picture && this.client.profile?.getPictureUrl) {
                contact.picture = await this.client.profile.getPictureUrl(jid).catch(() => null)
            }
            if (!contact.slogan && this.client.profile?.getAbout) {
                const about = await this.client.profile.getAbout(jid).catch(() => null)
                contact.slogan = about?.status || null
            }
            this.set(jid, contact)
        } catch {}

        return contact
    }
}

exports.ContactManager = ContactManager
exports.default = ContactManager
