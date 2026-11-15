"use strict"

Object.defineProperty(exports, "__esModule", { value: true })

const { Events } = require("../Constants")
const { MessageContext } = require("../Context/MessageContext")
const { CallContext } = require("../Context/CallContext")

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
                // Ignore stub or protocol messages if completely empty
                if (!rawMsg.message && !rawMsg.messageStubType) continue

                // Handle protocol revoke messages explicitly
                const isRevoke = rawMsg.message?.protocolMessage?.type === 0
                if (isRevoke) {
                    client.emit(Events.MESSAGE_DELETE, {
                        keys: [rawMsg.message.protocolMessage.key || rawMsg.key]
                    })
                }

                const ctx = new MessageContext(client, rawMsg)

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

        // 2. Message updates (reactions, poll updates, edits, delivery/read receipts)
        sock.ev.on('messages.update', (updates) => {
            client.emit(Events.MESSAGE_UPDATE, updates)
        })

        // 3. Message deletion (revoke)
        sock.ev.on('messages.delete', (item) => {
            client.emit(Events.MESSAGE_DELETE, item)
        })

        // 4. Presence updates (typing, online, offline)
        sock.ev.on('presence.update', (presence) => {
            client.emit(Events.PRESENCE_UPDATE, presence)
        })

        // 5. Contacts upsert
        sock.ev.on('contacts.upsert', (contacts) => {
            client.emit(Events.CONTACTS_UPSERT, contacts)
        })

        // 6. Group participants updates (join, leave, promote, demote)
        sock.ev.on('group-participants.update', (update) => {
            client.emit(Events.GROUP_PARTICIPANTS_UPDATE, update)
        })

        // 7. VoIP incoming calls & status
        sock.ev.on('call.received', (incomingCall) => {
            const callCtx = new CallContext(client, incomingCall)
            client.emit(Events.CALL_INCOMING, callCtx)
        })

        sock.ev.on('call', (calls) => {
            client.emit(Events.CALL_STATUS, calls)
            if (Array.isArray(calls)) {
                for (const call of calls) {
                    if (call.status === 'offer') {
                        const callCtx = new CallContext(client, call)
                        client.emit(Events.CALL_INCOMING, callCtx)
                    }
                }
            }
        })
    }
}

exports.EventNormalizer = EventNormalizer
exports.default = EventNormalizer
