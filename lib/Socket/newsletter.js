"use strict"

Object.defineProperty(exports, "__esModule", { value: true })

const { proto } = require("../../WAProto")
const {
    QueryIds,
    XWAPaths
} = require("../Types")
const { generateProfilePicture } = require("../Utils")
const { getBinaryNodeChild, getBinaryNodeChildren } = require("../WABinary")
const { makeGroupsSocket } = require("./groups")
const { executeWMexQuery: genericExecuteWMexQuery } = require("./mex")

const parseNewsletterCreateResponse = (response) => {
    const { id, thread_metadata: thread, viewer_metadata: viewer } = response
    return {
        id: id,
        owner: undefined,
        name: thread.name.text,
        creation_time: parseInt(thread.creation_time, 10),
        description: thread.description.text,
        invite: thread.invite,
        subscribers: parseInt(thread.subscribers_count, 10),
        verification: thread.verification,
        picture: {
            id: thread.picture.id,
            directPath: thread.picture.direct_path
        },
        mute_state: viewer.mute
    }
}

const parseNewsletterMetadata = (result) => {
    if (typeof result !== 'object' || result === null) {
        return null
    }

    if ('id' in result && typeof result.id === 'string') {
        return result
    }

    if ('result' in result && typeof result.result === 'object' && result.result !== null && 'id' in result.result) {
        return result.result
    }

    return null
}

const makeNewsletterSocket = (config) => {
    const suki = makeGroupsSocket(config)
    const {
        query,
        generateMessageTag
    } = suki

    const executeWMexQuery = (variables, queryId, dataPath) => {
        return genericExecuteWMexQuery(variables, queryId, dataPath, query, generateMessageTag)
    }

    const newsletterUpdate = async (jid, updates) => {
        const variables = {
            newsletter_id: jid,
            updates: {
                ...updates,
                settings: null
            }
        }

        return executeWMexQuery(variables, QueryIds.UPDATE_METADATA, XWAPaths.UPDATE)
    }

    return {
        ...suki,
        executeWMexQuery,
        newsletterCreate: async (name, description) => {
            const variables = {
                input: {
                    name,
                    description: description ?? null
                }
            }

            const rawResponse = await executeWMexQuery(variables, QueryIds.CREATE, XWAPaths.CREATE)

            return parseNewsletterCreateResponse(rawResponse)
        },
        newsletterUpdate,
        newsletterSubscribers: async (jid) => {
            return executeWMexQuery({ newsletter_id: jid }, QueryIds.SUBSCRIBERS, XWAPaths.SUBSCRIBERS)
        },
        newsletterSubscribed: async () => {
            return executeWMexQuery({}, QueryIds.SUBSCRIBED, XWAPaths.xwa2_newsletter_subscribed);
        },
        newsletterMetadata: async (type, key) => {
            const variables = {
                fetch_creation_time: true,
                fetch_full_image: true,
                fetch_viewer_metadata: true,
                input: {
                    key,
                    type: type.toUpperCase()
                }
            }

            const result = await executeWMexQuery(variables, QueryIds.METADATA, XWAPaths.METADATA)

            return parseNewsletterMetadata(result)
        },
        newsletterFollow: (jid) => {
            return executeWMexQuery({ newsletter_id: jid }, QueryIds.FOLLOW, XWAPaths.FOLLOW)
        },
        newsletterUnfollow: (jid) => {
            return executeWMexQuery({ newsletter_id: jid }, QueryIds.UNFOLLOW, XWAPaths.UNFOLLOW)
        },
        newsletterMute: (jid) => {
            return executeWMexQuery({ newsletter_id: jid }, QueryIds.MUTE, XWAPaths.MUTE_V2)
        },
        newsletterUnmute: (jid) => {
            return executeWMexQuery({ newsletter_id: jid }, QueryIds.UNMUTE, XWAPaths.UNMUTE_V2)
        },
        newsletterUpdateName: async (jid, name) => {
            return await newsletterUpdate(jid, { name })
        },
        newsletterUpdateDescription: async (jid, description) => {
            return await newsletterUpdate(jid, { description })
        },
        newsletterUpdatePicture: async (jid, content) => {
            const { img } = await generateProfilePicture(content)
            return await newsletterUpdate(jid, { picture: img.toString('base64') })
        },
        newsletterRemovePicture: async (jid) => {
            return await newsletterUpdate(jid, { picture: '' })
        },
        newsletterReactMessage: async (jid, serverId, reaction) => {
            const targetServerId = typeof serverId === 'object' ? (serverId.server_id || serverId.id) : serverId
            await query({
                tag: 'message',
                attrs: {
                    to: jid,
                    ...(reaction ? {} : { edit: '7' }),
                    type: 'reaction',
                    server_id: targetServerId?.toString(),
                    id: generateMessageTag()
                },
                content: [
                    {
                        tag: 'reaction',
                        attrs: reaction ? { code: reaction } : {}
                    }
                ]
            })
        },
        newsletterFetchReactions: async (jid, serverId) => {
            const targetServerId = typeof serverId === 'object' ? (serverId.server_id || serverId.id) : serverId
            const result = await query({
                tag: 'iq',
                attrs: {
                    id: generateMessageTag(),
                    type: 'get',
                    xmlns: 'newsletter',
                    to: jid
                },
                content: [
                    {
                        tag: 'reactions',
                        attrs: {
                            server_id: targetServerId?.toString()
                        }
                    }
                ]
            })

            const reactionsNode = getBinaryNodeChild(result, 'reactions')
            if (!reactionsNode) return []
            const reactionChildren = getBinaryNodeChildren(reactionsNode, 'reaction')
            return reactionChildren.map(r => ({
                code: r.attrs.code,
                count: parseInt(r.attrs.count || '0', 10)
            }))
        },
        newsletterFetchMessage: async (jid, serverId) => {
            const targetServerId = typeof serverId === 'object' ? (serverId.server_id || serverId.id) : serverId
            const result = await query({
                tag: 'iq',
                attrs: {
                    id: generateMessageTag(),
                    type: 'get',
                    xmlns: 'newsletter',
                    to: jid
                },
                content: [
                    {
                        tag: 'message',
                        attrs: {
                            server_id: targetServerId?.toString()
                        }
                    }
                ]
            })

            const messageNode = getBinaryNodeChild(result, 'message')
            if (!messageNode) return null

            const plaintextNode = getBinaryNodeChild(messageNode, 'plaintext')
            let messageProto
            if (plaintextNode?.content) {
                try {
                    const buffer = Buffer.isBuffer(plaintextNode.content)
                        ? plaintextNode.content
                        : Buffer.from(plaintextNode.content)
                    messageProto = proto.Message.decode(buffer)
                } catch (e) {
                    // ignore decode error
                }
            }

            const reactionsNode = getBinaryNodeChild(messageNode, 'reactions')
            const reactions = reactionsNode
                ? getBinaryNodeChildren(reactionsNode, 'reaction').map(r => ({
                    code: r.attrs.code,
                    count: parseInt(r.attrs.count || '0', 10)
                }))
                : []

            return {
                server_id: messageNode.attrs.server_id,
                messageTimestamp: +messageNode.attrs.t,
                views: messageNode.attrs.views ? +messageNode.attrs.views : undefined,
                message: messageProto,
                reactions
            }
        },
        newsletterFetchMessages: async (jid, count = 20, since, after) => {
            const messageUpdateAttrs = {
                count: count.toString()
            }

            if (typeof since === 'number') {
                messageUpdateAttrs.since = since.toString()
            }

            if (after) {
                messageUpdateAttrs.after = after.toString()
            }

            const result = await query({
                tag: 'iq',
                attrs: {
                    id: generateMessageTag(),
                    type: 'get',
                    xmlns: 'newsletter',
                    to: jid
                },
                content: [
                    {
                        tag: 'message_updates',
                        attrs: messageUpdateAttrs
                    }
                ]
            })

            const messageUpdatesNode = getBinaryNodeChild(result, 'message_updates')
            const messageNodes = getBinaryNodeChildren(messageUpdatesNode, 'message')

            const messages = messageNodes.map(node => {
                const plaintextNode = getBinaryNodeChild(node, 'plaintext')
                let messageProto
                if (plaintextNode?.content) {
                    try {
                        const buffer = Buffer.isBuffer(plaintextNode.content)
                            ? plaintextNode.content
                            : Buffer.from(plaintextNode.content)
                        messageProto = proto.Message.decode(buffer)
                    } catch (e) {
                        // ignore decode errors
                    }
                }

                const reactionsNode = getBinaryNodeChild(node, 'reactions')
                const reactions = reactionsNode
                    ? getBinaryNodeChildren(reactionsNode, 'reaction').map(r => ({
                        code: r.attrs.code,
                        count: parseInt(r.attrs.count || '0', 10)
                    }))
                    : []

                return {
                    server_id: node.attrs.server_id,
                    messageTimestamp: +node.attrs.t,
                    views: node.attrs.views ? +node.attrs.views : undefined,
                    message: messageProto,
                    reactions
                }
            })

            result.messages = messages
            return result
        },
        newsletterToggleMute: async (jid, mute = true) => {
            return mute
                ? executeWMexQuery({ newsletter_id: jid }, QueryIds.MUTE, XWAPaths.MUTE_V2)
                : executeWMexQuery({ newsletter_id: jid }, QueryIds.UNMUTE, XWAPaths.UNMUTE_V2)
        },
        subscribeNewsletterUpdates: async (jid) => {
            const result = await query({
                tag: 'iq',
                attrs: {
                    id: generateMessageTag(),
                    type: 'set',
                    xmlns: 'newsletter',
                    to: jid
                },
                content: [{ tag: 'live_updates', attrs: {}, content: [] }]
            })

            const liveUpdatesNode = getBinaryNodeChild(result, 'live_updates')
            const duration = liveUpdatesNode?.attrs?.duration

            return duration ? { duration: duration } : null
        },
        newsletterAdminCount: async (jid) => {
            const response = await executeWMexQuery({ newsletter_id: jid }, QueryIds.ADMIN_COUNT, XWAPaths.ADMIN_COUNT)
            return response.admin_count
        },
        newsletterChangeOwner: async (jid, newOwnerJid) => {
            await executeWMexQuery({ newsletter_id: jid, user_id: newOwnerJid }, QueryIds.CHANGE_OWNER, XWAPaths.CHANGE_OWNER)
        },
        newsletterDemote: async (jid, userJid) => {
            await executeWMexQuery({ newsletter_id: jid, user_id: userJid }, QueryIds.DEMOTE, XWAPaths.DEMOTE)
        },
        newsletterDelete: async (jid) => {
            await executeWMexQuery({ newsletter_id: jid }, QueryIds.DELETE, XWAPaths.DELETE_V2)
        }
    }
}

module.exports = {
    makeNewsletterSocket,
    parseNewsletterMetadata
}