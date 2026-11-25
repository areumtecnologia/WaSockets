"use strict"

Object.defineProperty(exports, "__esModule", { value: true })

const { JidNormalizer } = require("../Normalizers/JidNormalizer")
const { MessageContext } = require("../Context/MessageContext")
const { Events } = require("../Constants")

/**
 * Cooperative non-blocking engine for processing Baileys messaging-history.set events.
 */
class HistoryEngine {
    /**
     * Processes full history synchronization asynchronously
     * @param {import('../WaClient').WaClient} client
     * @param {Object} syncData - Raw Baileys messaging-history.set payload
     */
    static async process(client, syncData) {
        const {
            chats = [],
            contacts = [],
            messages = [],
            isLatest,
            syncType,
            peerDataRequestSessionId,
            progress
        } = syncData

        // 1. Ingest contacts into ContactManager cache
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

        // 2. Prepare structured chats tree
        const chatsTree = new Map()

        for (const chat of chats) {
            if (!chat || !chat.id) continue
            const chatId = JidNormalizer.toJid(chat.id)
            const contact = client.contacts?.get(chatId)

            const chatNode = {
                ...chat,
                id: chatId,
                name: contact?.name || chat.name || JidNormalizer.toPhoneNumber(chatId),
                messages: []
            }
            chatsTree.set(chatId, chatNode)
        }

        // 3. Group and index valid raw messages by chatId
        const chatMessagesMap = new Map()
        for (const rawMsg of messages) {
            if (!rawMsg || !rawMsg.message || rawMsg.message.protocolMessage) continue
            const rawChatId = rawMsg.key?.remoteJid
            if (!rawChatId) continue

            const chatId = JidNormalizer.toJid(rawChatId)
            if (!chatMessagesMap.has(chatId)) {
                chatMessagesMap.set(chatId, [])
            }
            chatMessagesMap.get(chatId).push(rawMsg)
        }

        // 4. Process messages in non-blocking batches
        const filterStatus = client.historySyncFilterStatus || 'all'
        const lastMessageOnly = Boolean(client.historySyncLastMessageOnly)

        for (const [chatId, msgList] of chatMessagesMap.entries()) {
            let chatNode = chatsTree.get(chatId)
            if (!chatNode) {
                const contact = client.contacts?.get(chatId)
                chatNode = {
                    id: chatId,
                    name: contact?.name || JidNormalizer.toPhoneNumber(chatId),
                    messages: []
                }
                chatsTree.set(chatId, chatNode)
            }

            // Sort chronologically
            msgList.sort((a, b) => Number(a.messageTimestamp || 0) - Number(b.messageTimestamp || 0))

            // Apply read/unread evaluation
            const unreadCount = Number(chatNode.unreadCount || 0)
            const receivedCount = msgList.filter(m => !m.key?.fromMe).length
            let receivedSeen = 0

            const evaluated = msgList.map(rawMsg => {
                const isFromMe = Boolean(rawMsg.key?.fromMe)
                let isRead = true

                if (!isFromMe) {
                    receivedSeen++
                    if (unreadCount > 0 && receivedSeen > (receivedCount - unreadCount)) {
                        isRead = false
                    }
                } else {
                    isRead = rawMsg.status >= 4 || unreadCount === 0
                }

                return { rawMsg, isRead }
            })

            // Apply filterStatus ('read' | 'unread' | 'all')
            let filtered = evaluated
            if (filterStatus === 'read') {
                filtered = evaluated.filter(item => item.isRead === true)
            } else if (filterStatus === 'unread') {
                filtered = evaluated.filter(item => item.isRead === false)
            }

            // Apply lastMessageOnly filter
            if (lastMessageOnly && filtered.length > 0) {
                let target = null
                for (let i = filtered.length - 1; i >= 0; i--) {
                    if (!filtered[i].rawMsg.key?.fromMe) {
                        target = filtered[i]
                        break
                    }
                }
                if (!target) {
                    target = filtered[filtered.length - 1]
                }
                filtered = target ? [target] : []
            }

            // Normalize and store in chunks
            const chunkSize = 50
            for (let i = 0; i < filtered.length; i += chunkSize) {
                const batch = filtered.slice(i, i + chunkSize)

                for (const item of batch) {
                    try {
                        const ctx = new MessageContext(client, item.rawMsg)
                        ctx.isRead = item.isRead
                        ctx.isUnread = !item.isRead

                        if (client.store) {
                            await client.store.saveMessage(chatId, ctx)
                        }

                        chatNode.messages.push(ctx)
                    } catch {}
                }

                // Cooperative yield to keep Event Loop responsive
                if (filtered.length > chunkSize) {
                    await new Promise(resolve => setImmediate(resolve))
                }
            }
        }

        const nestedHistory = Array.from(chatsTree.values())
        nestedHistory.isLatest = isLatest
        nestedHistory.syncType = syncType
        nestedHistory.peerDataRequestSessionId = peerDataRequestSessionId
        nestedHistory.progress = progress

        const syncMeta = { isLatest, syncType, peerDataRequestSessionId, progress }

        client.emit(Events.HISTORY_SYNC, nestedHistory, syncMeta)
    }
}

exports.HistoryEngine = HistoryEngine
exports.default = HistoryEngine
