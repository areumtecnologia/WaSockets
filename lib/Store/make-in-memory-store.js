"use strict"

Object.defineProperty(exports, "__esModule", { value: true })

const { proto } = require("../../WAProto")
const { DEFAULT_CONNECTION_CONFIG } = require("../Defaults/connection")
const { LabelAssociationType } = require("../Types/LabelAssociation")
const {
  md5, 
  toNumber, 
  updateMessageWithReceipt, 
  updateMessageWithReaction
} = require("../Utils")
const {
  jidDecode, 
  jidNormalizedUser,
  isPnUser,
  isLidUser
} = require("../WABinary")
const { makeOrderedDictionary } = require("./make-ordered-dictionary")
const { ObjectRepository } = require("./object-repository")

const waChatKey = (pin) => ({
    key: (c) => (pin ? (c.pinned ? '1' : '0') : '') + (c.archived ? '0' : '1') + (c.conversationTimestamp ? c.conversationTimestamp.toString(16).padStart(8, '0') : '') + c.id,
    compare: (k1, k2) => k2.localeCompare(k1)
})

const waMessageID = (m) => m.key.id || ''

const waLabelAssociationKey = {
    key: (la) => (la.type === LabelAssociationType.Chat ? la.chatId + la.labelId : la.chatId + la.messageId + la.labelId),
    compare: (k1, k2) => k2.localeCompare(k1)
}

const makeMessagesDictionary = () => makeOrderedDictionary(waMessageID)

const makeInMemoryStore = (config) => {
    const socket = config.socket
    const chatKey = config.chatKey || waChatKey(true)
    const labelAssociationKey = config.labelAssociationKey || waLabelAssociationKey
    const logger = config.logger || DEFAULT_CONNECTION_CONFIG.logger.child({ stream: 'in-mem-store' })
    const maxMessagesPerChat = config.maxMessagesPerChat || 500
    const KeyedDB = require('@adiwajshing/keyed-db').default
    const chats = new KeyedDB(chatKey, c => c.id)
    const messages = {}
    const contacts = {}
    const groupMetadata = {}
    const presences = {}
    const state = { connection: 'close' }
    const labels = new ObjectRepository()
    const labelAssociations = new KeyedDB(labelAssociationKey, labelAssociationKey.key)
    const lidToId = new Map()
    const pnToId = new Map()

    const updateIndices = (contact) => {
        if (!contact || !contact.id) return
        const id = contact.id
        const normId = jidNormalizedUser(id)
        const decodedId = jidDecode(id)
        const userId = decodedId?.user

        if (isLidUser(id)) {
            lidToId.set(id, id)
            lidToId.set(normId, id)
            if (userId) lidToId.set(userId, id)
        } else if (isPnUser(id)) {
            pnToId.set(id, id)
            pnToId.set(normId, id)
            if (userId) pnToId.set(userId, id)
        }

        if (contact.lid) {
            const normLid = jidNormalizedUser(contact.lid)
            const decodedLid = jidDecode(contact.lid)
            lidToId.set(contact.lid, id)
            lidToId.set(normLid, id)
            if (decodedLid?.user) lidToId.set(decodedLid.user, id)
        }

        if (contact.phoneNumber) {
            const normPn = jidNormalizedUser(contact.phoneNumber)
            const decodedPn = jidDecode(contact.phoneNumber)
            pnToId.set(contact.phoneNumber, id)
            pnToId.set(normPn, id)
            if (decodedPn?.user) pnToId.set(decodedPn.user, id)
        }

        // Bridge with socket signalRepository.lidMapping if available
        const lid = contact.lid || (isLidUser(id) ? id : undefined)
        const pn = contact.phoneNumber || (isPnUser(id) ? id : undefined)
        if (lid && pn && isLidUser(lid) && isPnUser(pn)) {
            if (socket?.signalRepository?.lidMapping?.storeLIDPNMappings) {
                socket.signalRepository.lidMapping.storeLIDPNMappings([{ lid, pn }]).catch(err => {
                    logger.debug({ err, lid, pn }, 'Error storing LID-PN mapping from contact')
                })
            }
        }
    }

    const learnMapping = (jidA, jidB) => {
        if (!jidA || !jidB) return
        const isLidA = isLidUser(jidA)
        const isPnA = isPnUser(jidA)
        const isLidB = isLidUser(jidB)
        const isPnB = isPnUser(jidB)

        const lid = isLidA ? jidA : (isLidB ? jidB : undefined)
        const pn = isPnA ? jidA : (isPnB ? jidB : undefined)

        if (lid && pn) {
            const normLid = jidNormalizedUser(lid)
            const normPn = jidNormalizedUser(pn)
            const userLid = jidDecode(lid)?.user
            const userPn = jidDecode(pn)?.user

            lidToId.set(lid, normPn)
            lidToId.set(normLid, normPn)
            if (userLid) lidToId.set(userLid, normPn)

            pnToId.set(pn, normPn)
            pnToId.set(normPn, normPn)
            if (userPn) pnToId.set(userPn, normPn)

            if (contacts[normPn]) {
                contacts[normPn].lid = contacts[normPn].lid || normLid
            }
            if (contacts[normLid]) {
                contacts[normLid].phoneNumber = contacts[normLid].phoneNumber || normPn
            }

            if (socket?.signalRepository?.lidMapping?.storeLIDPNMappings) {
                socket.signalRepository.lidMapping.storeLIDPNMappings([{ lid: normLid, pn: normPn }]).catch(() => {})
            }
        }
    }

    const getContact = (jid) => {
        if (!jid) return undefined
        if (contacts[jid]) return contacts[jid]

        const norm = jidNormalizedUser(jid)
        if (contacts[norm]) return contacts[norm]

        const decoded = jidDecode(jid)
        const user = decoded?.user || (typeof jid === 'string' ? jid.split('@')[0].split(':')[0] : undefined)

        const idFromLid = lidToId.get(jid) || lidToId.get(norm) || (user ? lidToId.get(user) : undefined)
        if (idFromLid && contacts[idFromLid]) return contacts[idFromLid]

        const idFromPn = pnToId.get(jid) || pnToId.get(norm) || (user ? pnToId.get(user) : undefined)
        if (idFromPn && contacts[idFromPn]) return contacts[idFromPn]

        for (const id in contacts) {
            const c = contacts[id]
            if (c.lid === jid || c.lid === norm || (c.lid && jidDecode(c.lid)?.user === user)) {
                return c
            }
            if (c.phoneNumber === jid || c.phoneNumber === norm || (c.phoneNumber && jidDecode(c.phoneNumber)?.user === user)) {
                return c
            }
            if (c.id === jid || c.id === norm || (c.id && jidDecode(c.id)?.user === user)) {
                return c
            }
        }
        return undefined
    }

    const getChat = (jid) => {
        if (!jid) return undefined
        let chat = chats.get(jid)
        if (chat) return chat

        const norm = jidNormalizedUser(jid)
        chat = chats.get(norm)
        if (chat) return chat

        const contact = getContact(jid)
        if (contact) {
            const altJids = [contact.id, contact.phoneNumber, contact.lid].filter(Boolean)
            for (const alt of altJids) {
                chat = chats.get(alt) || chats.get(jidNormalizedUser(alt))
                if (chat) return chat
            }
        }
        return undefined
    }

    const assertMessageList = (jid) => {
        if (!messages[jid]) {
            messages[jid] = makeMessagesDictionary()
        }
        return messages[jid]
    }
    const contactsUpsert = (newContacts) => {
        const oldContacts = new Set(Object.keys(contacts))
        for (const contact of newContacts) {
            oldContacts.delete(contact.id)
            contacts[contact.id] = Object.assign(contacts[contact.id] || {}, contact)
            updateIndices(contacts[contact.id])
        }
        return oldContacts
    }
    const labelsUpsert = (newLabels) => {
        for (const label of newLabels) {
            labels.upsertById(label.id, label)
        }
    }
    /**
     * binds to a BaileysEventEmitter.
     * It listens to all events and constructs a state that you can query accurate data from.
     * Eg. can use the store to fetch chats, contacts, messages etc.
     * @param ev typically the event emitter from the socket connection
     */
    const bind = (ev) => {
        ev.on('connection.update', update => {
            Object.assign(state, update)
        })
        ev.on('messaging-history.set', ({ chats: newChats, contacts: newContacts, messages: newMessages, isLatest, syncType }) => {
            if (syncType === proto.HistorySync.HistorySyncType.ON_DEMAND) {
                return // FOR NOW,
                //TODO: HANDLE
            }
            if (isLatest) {
                chats.clear()
                for (const id in messages) {
                    delete messages[id]
                }
            }
            const chatsAdded = chats.insertIfAbsent(...newChats).length
            logger.debug({ chatsAdded }, 'synced chats')
            const oldContacts = contactsUpsert(newContacts)
            if (isLatest) {
                for (const jid of oldContacts) {
                    delete contacts[jid]
                }
            }
            logger.debug({ deletedContacts: isLatest ? oldContacts.size : 0, newContacts }, 'synced contacts')
            for (const msg of newMessages) {
                const jid = msg.key.remoteJid
                const list = assertMessageList(jid)
                list.upsert(msg, 'prepend')
            }
            logger.debug({ messages: newMessages.length }, 'synced messages')
        })
        ev.on('contacts.upsert', contacts => {
            contactsUpsert(contacts)
        })
        ev.on('contacts.update', async (updates) => {
            for (const update of updates) {
                let contact
                if (contacts[update.id]) {
                    contact = contacts[update.id]
                }
                else {
                    contact = getContact(update.id)
                }
                if (!contact) {
                    const contactHashes = await Promise.all(Object.keys(contacts).map(async (contactId) => {
                        const decoded = jidDecode(contactId)
                        const user = decoded?.user || ''
                        return [contactId, (await md5(Buffer.from(user + 'WA_ADD_NOTIF', 'utf8'))).toString('base64').slice(0, 3)]
                    }))
                    contact = contacts[contactHashes.find(([, b]) => b === update.id?.[0]) || ''] // find contact by attrs.hash, when user is not saved as a contact
                }
                if (contact) {
                    if (update.imgUrl === 'changed') {
                        contact.imgUrl = socket ? await socket.profilePictureUrl(contact.id) : undefined
                    }
                    else if (update.imgUrl === 'removed') {
                        delete contact.imgUrl
                    }
                    Object.assign(contacts[contact.id], update)
                    updateIndices(contacts[contact.id])
                }
                else {
                    logger.debug({ update }, 'got update for non-existant contact')
                }
            }
        })
        ev.on('chats.upsert', newChats => {
            chats.upsert(...newChats)
        })
        ev.on('chats.update', updates => {
            for (let update of updates) {
                let result = chats.update(update.id, chat => {
                    if (update.unreadCount > 0) {
                        update = { ...update }
                        update.unreadCount = (chat.unreadCount || 0) + update.unreadCount
                    }
                    Object.assign(chat, update)
                })
                if (!result) {
                    const altContact = getContact(update.id)
                    if (altContact) {
                        const candidates = [altContact.id, altContact.phoneNumber, altContact.lid].filter(id => id && id !== update.id)
                        for (const altId of candidates) {
                            result = chats.update(altId, chat => {
                                if (update.unreadCount > 0) {
                                    update = { ...update }
                                    update.unreadCount = (chat.unreadCount || 0) + update.unreadCount
                                }
                                Object.assign(chat, update)
                            })
                            if (result) break
                        }
                    }
                }
                if (!result) {
                    logger.debug({ update }, 'got update for non-existant chat')
                }
            }
        })
        ev.on('labels.edit', (label) => {
            if (label.deleted) {
                return labels.deleteById(label.id)
            }
            // WhatsApp can store only up to 20 labels
            if (labels.count() < 20) {
                return labels.upsertById(label.id, label)
            }
            logger.error('Labels count exceed')
        })
        ev.on('labels.association', ({ type, association }) => {
            switch (type) {
                case 'add':
                    labelAssociations.upsert(association)
                    break
                case 'remove':
                    labelAssociations.delete(association)
                    break
                default:
                    console.error(`unknown operation type [${type}]`)
            }
        })
        ev.on('presence.update', ({ id, presences: update }) => {
            presences[id] = presences[id] || {}
            Object.assign(presences[id], update)
        })
        ev.on('chats.delete', deletions => {
            for (const item of deletions) {
                if (chats.get(item)) {
                    chats.deleteById(item)
                }
            }
        })
        ev.on('messages.upsert', ({ messages: newMessages, type }) => {
            switch (type) {
                case 'append':
                case 'notify':
                    for (const msg of newMessages) {
                        const jid = jidNormalizedUser(msg.key.remoteJid)
                        const list = assertMessageList(jid)
                        list.upsert(msg, 'append')

                        if (maxMessagesPerChat && list.array.length > maxMessagesPerChat) {
                            const excess = list.array.length - maxMessagesPerChat
                            const toRemove = list.array.slice(0, excess)
                            for (const oldMsg of toRemove) {
                                list.remove(oldMsg)
                            }
                        }

                        // Learn LID mapping from participantAlt / remoteJidAlt
                        const alt = msg.key.participantAlt || msg.key.remoteJidAlt
                        const primary = msg.key.participant || msg.key.remoteJid
                        if (alt && primary) {
                            learnMapping(primary, alt)
                        }

                        if (type === 'notify' && !chats.get(jid)) {
                            const existingChat = getChat(jid)
                            if (!existingChat) {
                                ev.emit('chats.upsert', [
                                    {
                                        id: jid,
                                        conversationTimestamp: toNumber(msg.messageTimestamp),
                                        unreadCount: 1
                                    }
                                ])
                            }
                        }
                    }
                    break
            }
        })
        ev.on('messages.update', updates => {
            for (const { update, key } of updates) {
                const list = assertMessageList(jidNormalizedUser(key.remoteJid))
                if (update?.status) {
                    const listStatus = list.get(key.id)?.status
                    if (listStatus && update?.status <= listStatus) {
                        logger.debug({ update, storedStatus: listStatus }, 'status stored newer then update')
                        delete update.status
                        logger.debug({ update }, 'new update object')
                    }
                }
                const result = list.updateAssign(key.id, update)
                if (!result) {
                    logger.debug({ update }, 'got update for non-existent message')
                }
            }
        })
        ev.on('messages.delete', item => {
            if ('all' in item) {
                const list = messages[item.jid]
                list?.clear()
            }
            else {
                const jid = item.keys[0].remoteJid
                const list = messages[jid]
                if (list) {
                    const idSet = new Set(item.keys.map(k => k.id))
                    list.filter(m => !idSet.has(m.key.id))
                }
            }
        })
        ev.on('groups.update', updates => {
            for (const update of updates) {
                const id = update.id
                if (groupMetadata[id]) {
                    Object.assign(groupMetadata[id], update)
                }
                else {
                    logger.debug({ update }, 'got update for non-existant group metadata')
                }
            }
        })
        ev.on('group-participants.update', ({ id, participants, action }) => {
            const metadata = groupMetadata[id]
            if (metadata) {
                switch (action) {
                    case 'add':
                        metadata.participants.push(...participants.map(id => ({ id, isAdmin: false, isSuperAdmin: false })))
                        break
                    case 'demote':
                    case 'promote':
                        for (const participant of metadata.participants) {
                            if (participants.includes(participant.id)) {
                                participant.isAdmin = action === 'promote'
                            }
                        }
                        break
                    case 'remove':
                        metadata.participants = metadata.participants.filter(p => !participants.includes(p.id))
                        break
                }
            }
        })
        ev.on('message-receipt.update', updates => {
            for (const { key, receipt } of updates) {
                const obj = messages[key.remoteJid]
                const msg = obj?.get(key.id)
                if (msg) {
                    updateMessageWithReceipt(msg, receipt)
                }
            }
        })
        ev.on('messages.reaction', (reactions) => {
            for (const { key, reaction } of reactions) {
                const obj = messages[key.remoteJid]
                const msg = obj?.get(key.id)
                if (msg) {
                    updateMessageWithReaction(msg, reaction)
                }
            }
        })
    }
    const toJSON = () => ({
        chats,
        contacts,
        messages,
        labels,
        labelAssociations
    })
    const fromJSON = (json) => {
        chats.upsert(...json.chats)
        labelAssociations.upsert(...json.labelAssociations || [])
        contactsUpsert(Object.values(json.contacts))
        labelsUpsert(Object.values(json.labels || {}))
        for (const jid in json.messages) {
            const list = assertMessageList(jid)
            for (const msg of json.messages[jid]) {
                list.upsert(proto.WebMessageInfo.fromObject(msg), 'append')
            }
        }
    }
    return {
        chats,
        contacts,
        messages,
        groupMetadata,
        state,
        presences,
        labels,
        labelAssociations,
        bind,
        getContact,
        getChat,
        /** loads messages from the store, if not found -- uses the legacy connection */
        loadMessages: async (jid, count, cursor) => {
            let list = assertMessageList(jid)
            if (list.array.length === 0) {
                const contact = getContact(jid)
                if (contact) {
                    const altJids = [contact.id, contact.phoneNumber, contact.lid].filter(Boolean)
                    for (const alt of altJids) {
                        if (alt !== jid && messages[alt]?.array.length > 0) {
                            list = messages[alt]
                            break
                        }
                    }
                }
            }
            const mode = !cursor || 'before' in cursor ? 'before' : 'after'
            const cursorKey = !!cursor ? ('before' in cursor ? cursor.before : cursor.after) : undefined
            const cursorValue = cursorKey ? list.get(cursorKey.id) : undefined
            let messagesResult
            if (list && mode === 'before' && (!cursorKey || cursorValue)) {
                if (cursorValue) {
                    const msgIdx = list.array.findIndex(m => m.key.id === cursorKey?.id)
                    messagesResult = list.array.slice(0, msgIdx)
                }
                else {
                    messagesResult = list.array
                }
                const diff = count - messagesResult.length
                if (diff < 0) {
                    messagesResult = messagesResult.slice(-count) // get the last X messages
                }
            }
            else {
                messagesResult = []
            }
            return messagesResult
        },
        /**
         * Get all available labels for profile
         *
         * Keep in mind that the list is formed from predefined tags and tags
         * that were "caught" during their editing.
         */
        getLabels: () => {
            return labels
        },
        /**
         * Get labels for chat
         *
         * @returns Label IDs
         **/
        getChatLabels: (chatId) => {
            return labelAssociations.filter((la) => la.chatId === chatId).all()
        },
        /**
         * Get labels for message
         *
         * @returns Label IDs
         **/
        getMessageLabels: (messageId) => {
            const associations = labelAssociations
                .filter((la) => la.messageId === messageId)
                .all()
            return associations.map(({ labelId }) => labelId)
        },
        loadMessage: async (jid, id) => {
            let msg = messages[jid]?.get(id)
            if (!msg) {
                const contact = getContact(jid)
                if (contact) {
                    const altJids = [contact.id, contact.phoneNumber, contact.lid].filter(Boolean)
                    for (const alt of altJids) {
                        if (alt !== jid && messages[alt]?.get(id)) {
                            return messages[alt].get(id)
                        }
                    }
                }
            }
            return msg
        }, 
        mostRecentMessage: async (jid) => {
            let message = messages[jid]?.array.slice(-1)[0]
            if (!message) {
                const contact = getContact(jid)
                if (contact) {
                    const altJids = [contact.id, contact.phoneNumber, contact.lid].filter(Boolean)
                    for (const alt of altJids) {
                        if (alt !== jid && messages[alt]?.array.length) {
                            return messages[alt].array.slice(-1)[0]
                        }
                    }
                }
            }
            return message
        },
        fetchImageUrl: async (jid, suki) => {
            const contact = getContact(jid) || contacts[jid]
            const targetJid = contact?.id || jid
            if (!contact) {
                return suki?.profilePictureUrl(targetJid)
            }
            if (typeof contact.imgUrl === 'undefined') {
                contact.imgUrl = await suki?.profilePictureUrl(targetJid)
            }
            return contact.imgUrl
        },
        fetchGroupMetadata: async (jid, suki) => {
            if (!groupMetadata[jid]) {
                const metadata = await suki?.groupMetadata(jid)
                if (metadata) {
                    groupMetadata[jid] = metadata
                }
            }
            return groupMetadata[jid]
        },
        // fetchBroadcastListInfo: async(jid: string, sock: WASocket | undefined) => {
        // 	if(!groupMetadata[jid]) {
        // 		const metadata = await sock?.getBroadcastListInfo(jid)
        // 		if(metadata) {
        // 			groupMetadata[jid] = metadata
        // 		}
        // 	}
        // 	return groupMetadata[jid]
        // },
        fetchMessageReceipts: async ({ remoteJid, id }) => {
            const list = messages[remoteJid]
            const msg = list?.get(id)
            return msg?.userReceipt
        },
        toJSON,
        fromJSON,
        writeToFile: (path) => {
            // require fs here so that in case "fs" is not available -- the app does not crash
            const { writeFileSync } = require('fs')
            writeFileSync(path, JSON.stringify(toJSON()))
        },
        readFromFile: (path) => {
            // require fs here so that in case "fs" is not available -- the app does not crash
            const { readFileSync, existsSync } = require('fs')
            if (existsSync(path)) {
                logger.debug({ path }, 'reading from file')
                const jsonStr = readFileSync(path, { encoding: 'utf-8' })
                const json = JSON.parse(jsonStr)
                fromJSON(json)
            }
        },
        pruneMessages: (jid, keepLastN = 100) => {
            if (jid) {
                const list = messages[jid] || messages[jidNormalizedUser(jid)]
                if (list && list.array.length > keepLastN) {
                    const excess = list.array.length - keepLastN
                    const toRemove = list.array.slice(0, excess)
                    for (const oldMsg of toRemove) {
                        list.remove(oldMsg)
                    }
                    return excess
                }
                return 0
            }
            let totalPruned = 0
            for (const id in messages) {
                const list = messages[id]
                if (list && list.array.length > keepLastN) {
                    const excess = list.array.length - keepLastN
                    const toRemove = list.array.slice(0, excess)
                    for (const oldMsg of toRemove) {
                        list.remove(oldMsg)
                    }
                    totalPruned += excess
                }
            }
            return totalPruned
        },
        clear: (chatId) => {
            if (chatId) {
                const norm = jidNormalizedUser(chatId)
                delete messages[chatId]
                delete messages[norm]
            } else {
                for (const id in messages) {
                    delete messages[id]
                }
            }
        },
        getMessageCount: (jid) => {
            if (jid) {
                const list = messages[jid] || messages[jidNormalizedUser(jid)]
                return list ? list.array.length : 0
            }
            let total = 0
            for (const id in messages) {
                total += messages[id]?.array?.length || 0
            }
            return total
        }
    }
}

module.exports = {
  waChatKey, 
  waMessageID, 
  waLabelAssociationKey, 
  makeInMemoryStore
}