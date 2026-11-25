"use strict"

Object.defineProperty(exports, "__esModule", { value: true })

const { Events } = require("../Constants")
const { MessageContext } = require("../Context/MessageContext")
const { CallContext } = require("../Context/CallContext")
const {
    MessageDeleteEvent,
    GroupParticipantsUpdateEvent,
    PresenceUpdateEvent,
    MessageReactionEvent,
    GroupUpdateEvent,
    ChatUpdateEvent,
    ChatDeleteEvent
} = require("../Events/ConnectionEvents")
const { HistoryEngine } = require("../Modules/HistoryEngine")

class EventNormalizer {
    /**
     * Binds low-level socket events and maps them to semantic WaClient events
     * @param {import('../WaClient').WaClient} client
     */
    static bindSocketEvents(client) {
        const sock = client.sock
        if (!sock || !sock.ev) return

        // 1. Message reception and outgoing events
        sock.ev.on('messages.upsert', async ({ messages, type }) => {
            if (!Array.isArray(messages)) return

            for (const rawMsg of messages) {
                // Ignore completely empty messages without stub
                if (!rawMsg.message && !rawMsg.messageStubType) continue

                // 1.1 Handle protocol revoke messages explicitly (delete for everyone)
                const isRevoke = rawMsg.message?.protocolMessage?.type === 0
                if (isRevoke) {
                    client.emit(Events.MESSAGE_DELETE, new MessageDeleteEvent([rawMsg.message.protocolMessage.key || rawMsg.key]))
                    continue
                }

                // 1.2 Handle protocol notifications and stub updates
                if (!rawMsg.message || rawMsg.message.protocolMessage) {
                    client.emit(Events.NOTIFICATION, rawMsg)
                    continue
                }

                // 1.3 Handle status and broadcast messages
                if (rawMsg.broadcast || rawMsg.key?.remoteJid === 'status@broadcast') {
                    client.emit(Events.BROADCAST_MESSAGE, rawMsg)
                    continue
                }

                // Passively update sender contact in cache
                if (client.contacts && rawMsg.key?.remoteJid && rawMsg.pushName) {
                    client.contacts.set(rawMsg.key.remoteJid, {
                        id: rawMsg.key.remoteJid,
                        lid: rawMsg.key.remoteJidAlt || null,
                        name: rawMsg.pushName
                    })
                }

                const ctx = new MessageContext(client, rawMsg)

                // Persist message in store
                if (client.store?.saveMessage) {
                    client.store.saveMessage(ctx.chatId, ctx).catch(() => {})
                }

                if (ctx.isFromMe) {
                    client.emit(Events.MESSAGE_SENT, ctx, rawMsg)
                } else {
                    client.emit(Events.MESSAGE_RECEIVED, ctx, rawMsg)
                }

                // If message is an edit, also notify on MESSAGE_UPDATE
                if (ctx.isEdited) {
                    client.emit(Events.MESSAGE_UPDATE, [{
                        key: ctx.raw.key,
                        update: { message: ctx.raw.message },
                        ctx
                    }])
                }
            }
        })

        // 2. Message reactions (dedicated event)
        sock.ev.on('messages.reaction', (reactions) => {
            client.emit(Events.MESSAGE_REACTION, new MessageReactionEvent(reactions))
        })

        // 3. Message updates (reactions, poll updates, edits, delivery/read receipts, event responses)
        sock.ev.on('messages.update', async (updates) => {
            if (Array.isArray(updates)) {
                for (const item of updates) {
                    if (item?.update?.eventResponses && Array.isArray(item.update.eventResponses)) {
                        for (const r of item.update.eventResponses) {
                            const resp = r.response || {}
                            const statusCode = typeof resp.response === 'number' ? resp.response : 1
                            const statusMap = { 0: 'UNKNOWN', 1: 'GOING', 2: 'NOT_GOING', 3: 'MAYBE' }
                            const labelMap = { 0: 'Desconhecido', 1: 'Confirmado (Vou)', 2: 'Recusado (Não vou)', 3: 'Talvez' }
                            const status = statusMap[statusCode] || 'UNKNOWN'

                            const senderJid = r.eventResponseMessageKey?.participant || r.eventResponseMessageKey?.remoteJid || ''
                            const senderNumber = senderJid ? senderJid.replace(/@.*$/, '') : ''
                            const contact = client.contacts?.get ? await client.contacts.get(senderJid) : null

                            const rsvpEvent = {
                                eventMessageId: item.key?.id,
                                eventCreationMessageKey: item.key,
                                chatId: item.key?.remoteJid?.replace(/:.*?@/, '@') || '',
                                sender: senderJid,
                                senderNumber,
                                senderName: contact?.name || contact?.pushName || senderNumber,
                                status,
                                statusCode,
                                statusLabel: labelMap[statusCode] || 'Desconhecido',
                                isAttending: statusCode === 1,
                                extraGuests: resp.extraGuestCount || 0,
                                timestampMs: Number(r.senderTimestampMs || resp.timestampMs || Date.now()),
                                timestamp: new Date(Number(r.senderTimestampMs || resp.timestampMs || Date.now())),
                                raw: r
                            }

                            client.emit(Events.EVENT_RESPONSE, rsvpEvent)
                        }
                    }
                }
            }
            client.emit(Events.MESSAGE_UPDATE, updates)
        })

        // 4. Message deletion (revoke)
        sock.ev.on('messages.delete', (item) => {
            client.emit(Events.MESSAGE_DELETE, new MessageDeleteEvent(item?.keys || item))
        })

        // 5. Presence updates (typing, online, offline)
        sock.ev.on('presence.update', (presence) => {
            client.emit(Events.PRESENCE_UPDATE, new PresenceUpdateEvent(presence))
        })

        // 6. Contacts (upsert & updates)
        sock.ev.on('contacts.upsert', (contacts) => {
            if (client.contacts && Array.isArray(contacts)) {
                for (const c of contacts) {
                    if (c && c.id) {
                        client.contacts.set(c.id, {
                            id: c.id,
                            lid: c.lid || null,
                            name: c.notify || c.name || c.verifiedName,
                            isBusiness: Boolean(c.verifiedName)
                        })
                    }
                }
            }
            client.emit(Events.CONTACTS_UPSERT, contacts)
        })
        sock.ev.on('contacts.update', (contacts) => {
            if (client.contacts && Array.isArray(contacts)) {
                for (const c of contacts) {
                    if (c && c.id) {
                        client.contacts.set(c.id, c)
                    }
                }
            }
            client.emit(Events.CONTACTS_UPDATE, contacts)
        })

        // 7. Group events (participants, updates, upsert, member tags)
        sock.ev.on('group-participants.update', (update) => {
            client.emit(Events.GROUP_PARTICIPANTS_UPDATE, new GroupParticipantsUpdateEvent(update))
        })
        sock.ev.on('groups.update', (updates) => {
            client.emit(Events.GROUP_UPDATE, new GroupUpdateEvent(updates))
        })
        sock.ev.on('groups.upsert', (groups) => {
            client.emit(Events.GROUP_UPSERT, groups)
        })
        sock.ev.on('group.member-tag.update', (update) => {
            client.emit(Events.GROUP_MEMBER_TAG_UPDATE, update)
        })

        // 8. Blocklist updates
        sock.ev.on('blocklist.update', (update) => {
            client.emit(Events.BLOCKLIST_UPDATE, update)
        })

        // 9. Chats (update & delete)
        sock.ev.on('chats.update', (updates) => {
            client.emit(Events.CHAT_UPDATE, new ChatUpdateEvent(updates))
        })
        sock.ev.on('chats.delete', (chatIds) => {
            client.emit(Events.CHAT_DELETE, new ChatDeleteEvent(chatIds))
        })

        // 10. VoIP incoming calls & status
        const handledCallOffers = new Set()
        const registerCallOffer = (id) => {
            if (!id) return false
            if (handledCallOffers.has(id)) return true
            handledCallOffers.add(id)
            setTimeout(() => handledCallOffers.delete(id), 60000)
            return false
        }

        sock.ev.on('call.received', (incomingCall) => {
            if (registerCallOffer(incomingCall?.id)) return
            const callCtx = new CallContext(client, incomingCall)
            client.emit(Events.CALL_INCOMING, callCtx)
        })

        sock.ev.on('call', (calls) => {
            client.emit(Events.CALL_STATUS, calls)
            if (Array.isArray(calls)) {
                for (const call of calls) {
                    if (call.status === 'offer') {
                        if (registerCallOffer(call.id)) continue
                        const callCtx = new CallContext(client, call)
                        client.emit(Events.CALL_INCOMING, callCtx)
                    }
                }
            }
        })

        // 11. Full messaging history synchronization
        sock.ev.on('messaging-history.set', (syncData) => {
            HistoryEngine.process(client, syncData).catch((err) => {
                client.emit(Events.ERROR, err)
            })
        })
    }
}

exports.EventNormalizer = EventNormalizer
exports.default = EventNormalizer
