/// <reference types="node" />

import { proto } from '../WAProto'
import { AuthenticationState, BaileysEventEmitter, ConnectionState, Contact, GroupMetadata, WACallEvent, WAMessage, WAMessageKey, WAMessageContent, AnyMessageContent, MiscMessageGenerationOptions } from './Types'
import { PluginManager } from './Plugins'

export * from './Types'
export * from './Utils'
export * from './Defaults'
export * from './Store'
export * from './WABinary'
export * from './Plugins'
export { proto }

export interface GroupPermissionsPolicies {
    announce?: boolean
    restrict?: boolean
    memberAddMode?: 'admin_add' | 'all_member_add'
    approvalMode?: boolean | 'on' | 'off'
    ephemeral?: number | false
}

export interface GroupSubGroupsResult {
    communityJid: string
    isCommunity: boolean
    defaultSubGroup: any | null
    subGroups: any[]
    linkedGroups: any[]
}

export interface SendAlbumMediaItem {
    image?: any
    video?: any
    caption?: string
    [key: string]: any
}

export interface UserFacingSocketConfig {
    version?: [number, number, number]
    browser?: [string, string, string]
    waWebSocketUrl?: string
    connectTimeoutMs?: number
    keepAliveIntervalMs?: number
    logger?: any
    printQRInTerminal?: boolean
    emitOwnEvents?: boolean
    defaultQueryTimeoutMs?: number
    customUploadHosts?: string[]
    retryRequestDelayMs?: number
    maxMsgRetryCount?: number
    fireInitQueries?: boolean
    auth?: AuthenticationState
    markOnlineOnConnect?: boolean
    syncFullHistory?: boolean
    patchMessageBeforeSending?: (msg: proto.IMessage) => proto.IMessage | Promise<proto.IMessage>
    shouldSyncHistoryMessage?: (msg: proto.IHistorySyncNotification) => boolean
    shouldIgnoreJid?: (jid: string) => boolean
    linkPreviewImageThumbnailWidth?: number
    transactionOpts?: { maxCommitRetries: number; delayBetweenTriesMs: number }
    generateHighQualityLinkPreview?: boolean
    enableAutoSessionRecreation?: boolean
    enableRecentMessageCache?: boolean
    enableMessageQueue?: boolean
    messageQueueTtlMs?: number
    maxReconnectAttempts?: number
    enableGroupCache?: boolean
    cachedGroupMetadata?: (jid: string) => Promise<GroupMetadata | undefined>
    plugins?: any[]
    [key: string]: any
}

export interface WASocket {
    type: 'md'
    ws: any
    ev: BaileysEventEmitter
    authState: AuthenticationState
    user: Contact | undefined
    plugins: PluginManager

    // Plugin & Middleware system
    use(plugin: any, options?: any): WASocket
    registerMiddleware(hook: 'beforeSendMessage' | 'afterSendMessage' | 'beforeRecvMessage' | 'afterRecvMessage' | 'connectionUpdate', fn: Function): () => void
    hasPlugin(name: string): boolean
    listPlugins(): Array<{ name: string; registeredAt: number; version: string; description: string }>

    // Connection & Auth
    waitForConnectionUpdate(check: (u: Partial<ConnectionState>) => boolean | undefined, timeoutMs?: number): Promise<void>
    end(error: Error | undefined): void
    logout(msg?: string): Promise<void>
    requestPairingCode(phoneNumber: string): Promise<string>
    repairSession(jid: string): Promise<void>
    onWhatsApp(...phoneNumber: string[]): Promise<{ jid: string; exists: boolean }[] | undefined>

    // Presence & Status
    sendPresenceUpdate(type: 'available' | 'unavailable' | 'composing' | 'recording' | 'paused', toJid?: string): Promise<void>
    presenceSubscribe(toJid: string): Promise<void>

    // Profile & User
    profilePictureUrl(jid: string, type?: 'image' | 'preview', timeoutMs?: number): Promise<string | undefined>
    updateProfilePicture(jid: string, content: any): Promise<void>
    removeProfilePicture(jid: string): Promise<void>
    fetchStatus(jid: string): Promise<{ status: string | undefined; setAt: Date } | undefined>
    updateProfileStatus(status: string): Promise<void>
    updateProfileName(name: string): Promise<void>

    // Cross-JID / LID Architecture
    toPn(jid: string, fetchIfMissing?: boolean): Promise<string | null>
    toLid(jid: string, fetchIfMissing?: boolean): Promise<string | null>
    resolveJid(jid: string, fetchIfMissing?: boolean): Promise<{ pn: string | null; lid: string | null; jid: string | null }>
    storeLidPnMapping(pn: string, lid: string): Promise<boolean>

    // Messaging
    sendMessage(jid: string, content: AnyMessageContent, options?: MiscMessageGenerationOptions & { mentionAll?: boolean; adminsOnly?: boolean; excludeMe?: boolean }): Promise<WAMessage | undefined>
    sendAlbumMessage(jid: string, medias: SendAlbumMediaItem[], options?: MiscMessageGenerationOptions): Promise<WAMessage[]>
    groupSendMentionAll(jid: string, content: string | AnyMessageContent, options?: { adminsOnly?: boolean; excludeMe?: boolean }): Promise<WAMessage | undefined>
    relayMessage(jid: string, message: proto.IMessage, options: any): Promise<string>
    readMessages(keys: WAMessageKey[]): Promise<void>
    star(jid: string, messages: { id: string; fromMe?: boolean }[], star: boolean): Promise<void>
    sendStatusMentions(content: any, jids?: string[]): Promise<WAMessage>
    reactToStatus(key: WAMessageKey, reaction?: string): Promise<string>
    sendEventResponse(jid: string, eventCreationMessageKey: WAMessageKey, response: string | number, extraGuestCount?: number): Promise<WAMessage | undefined>
    cancelEvent(jid: string, eventKey: WAMessageKey): Promise<WAMessage | undefined>

    // Calls (Web Calling)
    offerCall(toJid: string, isVideo?: boolean): Promise<any>
    acceptCall(callId: string, callFrom: string): Promise<void>
    rejectCall(callId: string, callFrom: string): Promise<void>
    terminateCall(callId: string, callFrom: string): Promise<void>

    // Chats & Contacts
    chatModify(mod: any, jid: string): Promise<void>
    updateFavorite(jid: string, favorite: boolean): Promise<void>
    updateChatNote(jid: string, note: string): Promise<void>
    removeChatNote(jid: string): Promise<void>
    addOrEditContact(contact: any): Promise<void>
    removeContact(jid: string): Promise<void>

    // Groups
    groupMetadata(jid: string): Promise<GroupMetadata>
    groupCreate(subject: string, participants: string[]): Promise<GroupMetadata>
    groupLeave(id: string): Promise<void>
    groupUpdateSubject(jid: string, subject: string): Promise<void>
    groupUpdateDescription(jid: string, description: string): Promise<void>
    groupInviteCode(jid: string): Promise<string | undefined>
    groupRevokeInvite(jid: string): Promise<string | undefined>
    groupAcceptInvite(code: string): Promise<string | undefined>
    groupGetInviteInfo(code: string): Promise<GroupMetadata>
    groupParticipantsUpdate(jid: string, participants: string[], action: 'add' | 'remove' | 'demote' | 'promote'): Promise<any[]>
    groupSettingUpdate(jid: string, setting: 'announcement' | 'not_announcement' | 'locked' | 'unlocked'): Promise<void>
    groupMemberAddMode(jid: string, mode: 'admin_add' | 'all_member_add'): Promise<void>
    groupJoinApprovalMode(jid: string, mode: 'on' | 'off' | boolean): Promise<void>
    groupMembershipApprovalMode(jid: string, mode: 'on' | 'off' | boolean): Promise<void>
    groupRequestParticipantsList(jid: string): Promise<any[]>
    groupRequestParticipantsUpdate(jid: string, participants: string[], action: 'approve' | 'reject'): Promise<any[]>
    groupApprovePendingParticipants(jid: string, participants: string | string[]): Promise<any[]>
    groupRejectPendingParticipants(jid: string, participants: string | string[]): Promise<any[]>
    groupUpdatePermissions(jid: string, policies: GroupPermissionsPolicies): Promise<Record<string, any>>
    groupGetAdminJids(jid: string): Promise<string[]>
    groupGetParticipants(jid: string): Promise<any[]>
    groupToggleEphemeral(jid: string, ephemeralExpiration: number): Promise<void>

    // Communities v2
    communityCreate(subject: string, body?: string): Promise<GroupMetadata | null>
    communityCreateGroup(subject: string, participants: string[], parentCommunityJid: string): Promise<GroupMetadata | null>
    communityLinkGroup(groupJid: string, parentCommunityJid: string): Promise<void>
    communityUnlinkGroup(groupJid: string, parentCommunityJid: string): Promise<void>
    communityFetchLinkedGroups(jid: string): Promise<any>
    communityFetchSubGroups(jid: string): Promise<GroupSubGroupsResult>
    communityMembershipApprovalMode(jid: string, mode: 'on' | 'off' | boolean): Promise<void>
    communityApprovePendingParticipants(jid: string, participants: string | string[]): Promise<any[]>
    communityRejectPendingParticipants(jid: string, participants: string | string[]): Promise<any[]>
    communityUpdatePermissions(jid: string, policies: GroupPermissionsPolicies): Promise<Record<string, any>>

    // Newsletters v2
    newsletterCreate(name: string, description?: string, picture?: Buffer): Promise<any>
    newsletterMetadata(type: 'invite' | 'jid', key: string): Promise<any>
    newsletterFetchMessages(jid: string, count: number, since?: number): Promise<any[]>
    newsletterFetchMessage(jid: string, messageServerId: string | number): Promise<any>
    newsletterFetchReactions(jid: string, messageServerId: string | number): Promise<any[]>
    newsletterToggleMute(jid: string, mute: boolean): Promise<void>
    newsletterFollow(jid: string): Promise<void>
    newsletterUnfollow(jid: string): Promise<void>
    newsletterSubscribers(jid: string): Promise<any>
    newsletterSubscribed(): Promise<any[]>
    newsletterUpdate(jid: string, updates: any): Promise<any>
    newsletterUpdateName(jid: string, name: string): Promise<any>
    newsletterUpdateDescription(jid: string, description: string): Promise<any>
    newsletterUpdatePicture(jid: string, content: any): Promise<any>
    newsletterRemovePicture(jid: string): Promise<any>
    newsletterReactMessage(jid: string, serverId: string | number, reaction?: string): Promise<void>
    newsletterAdminCount(jid: string): Promise<number>
    newsletterChangeOwner(jid: string, newOwnerJid: string): Promise<void>
    newsletterDelete(jid: string): Promise<void>

    // Labels & Quick Replies
    createLabel(name: string, color?: number): Promise<any>
    updateLabel(labelId: string, name: string, color?: number): Promise<any>
    deleteLabel(labelId: string): Promise<any>
    addChatLabel(jid: string, labelId: string): Promise<void>
    removeChatLabel(jid: string, labelId: string): Promise<void>
    addMessageLabel(jid: string, messageId: string, labelId: string): Promise<void>
    removeMessageLabel(jid: string, messageId: string, labelId: string): Promise<void>
    addOrEditQuickReply(quickReply: any): Promise<void>
    removeQuickReply(id: string): Promise<void>

    // Privacy
    fetchBlocklist(): Promise<string[]>
    updateBlockStatus(jid: string, action: 'block' | 'unblock'): Promise<void>
    fetchPrivacySettings(force?: boolean): Promise<any>
    updateLastSeenPrivacy(value: 'all' | 'contacts' | 'contact_blacklist' | 'none'): Promise<void>
    updateOnlinePrivacy(value: 'all' | 'match_last_seen'): Promise<void>
    updateReadReceiptsPrivacy(value: 'all' | 'none'): Promise<void>
    updateProfilePicturePrivacy(value: 'all' | 'contacts' | 'contact_blacklist' | 'none'): Promise<void>
    updateStatusPrivacy(value: 'all' | 'contacts' | 'contact_blacklist' | 'none'): Promise<void>
    updateGroupsAddPrivacy(value: 'all' | 'contacts' | 'contact_blacklist'): Promise<void>
    updateCallPrivacy(value: 'all' | 'known'): Promise<void>

    // Business
    getCatalog(opts: { jid?: string; limit?: number; cursor?: string }): Promise<any>
    getCollections(jid?: string, limit?: number): Promise<any>
    getOrderDetails(orderId: string, tokenBase64: string): Promise<any>
    getProduct(jid: string, productId: string): Promise<any>
    productCreate(create: any): Promise<any>
    productUpdate(productId: string, update: any): Promise<any>
    productDelete(productIds: string[]): Promise<{ deleted: number }>
    updateBussinesProfile(args: any): Promise<void>
    updateCoverPhoto(file: any): Promise<string>
    removeCoverPhoto(id: string): Promise<void>

    [key: string]: any
}

export interface InMemoryStoreConfig {
    logger?: any
    chatKey?: any
    labelAssociationKey?: any
    maxMessagesPerChat?: number
    [key: string]: any
}

export interface InMemoryStore {
    chats: any
    messages: Record<string, any>
    contacts: Record<string, Contact>
    groupMetadata: Record<string, GroupMetadata>
    presences: Record<string, any>
    state: Partial<ConnectionState>
    labels: any
    labelAssociations: any
    bind(ev: BaileysEventEmitter): void
    loadMessage(jid: string, id: string): Promise<WAMessage | undefined>
    loadMessages(jid: string, count: number, cursor?: any): Promise<WAMessage[]>
    mostRecentMessage(jid: string): Promise<WAMessage | undefined>
    getContact(jid: string): Contact | undefined
    getChat(jid: string): any | undefined
    pruneMessages(jid?: string, keepLastN?: number): number
    clear(chatId?: string): void
    getMessageCount(jid?: string): number
    writeToFile(path: string): void
    readFromFile(path: string): void
    toJSON(): any
    fromJSON(json: any): void
}

export declare function makeInMemoryStore(config?: InMemoryStoreConfig): InMemoryStore
export declare function createGroupMetadataCache(ttlMs?: number, maxSize?: number): {
    (jid: string): Promise<GroupMetadata | undefined>
    set(jid: string, metadata: GroupMetadata): void
    delete(jid: string): boolean
    clear(): void
}

export declare function makeWASocket(config?: UserFacingSocketConfig): WASocket
export default makeWASocket
