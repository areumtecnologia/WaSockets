import { EventEmitter } from 'events'
import { Readable } from 'stream'
import { AuthenticationState, proto, AnyMessageContent, MiscMessageGenerationOptions, GroupMetadata } from '../Types'

export declare const Events: {
    readonly INIT: 'init'
    readonly CONNECTING: 'connecting'
    readonly STATUS_CHANGE: 'status.change'
    readonly QR_CODE: 'qr'
    readonly PAIRING_CODE: 'pairing.code'
    readonly PAIRING_SUCCESS: 'pairing.success'
    readonly CONNECTED: 'connected'
    readonly DISCONNECTED: 'disconnected'
    readonly LOGGED_OUT: 'logged.out'
    readonly MESSAGE_RECEIVED: 'message.received'
    readonly MESSAGE_SENT: 'message.sent'
    readonly MESSAGE_UPDATE: 'message.update'
    readonly MESSAGE_DELETE: 'message.delete'
    readonly MESSAGE_REACTION: 'message.reaction'
    readonly BROADCAST_MESSAGE: 'message.broadcast'
    readonly NOTIFICATION: 'notification'
    readonly HISTORY_SYNC: 'history.sync'
    readonly MESSAGES_HISTORY_SYNC_DONE: 'history.sync'
    readonly PRESENCE_UPDATE: 'presence.update'
    readonly CONTACTS_UPSERT: 'contacts.upsert'
    readonly CONTACTS_UPDATE: 'contacts.update'
    readonly BLOCKLIST_UPDATE: 'blocklist.update'
    readonly CALL_INCOMING: 'call.incoming'
    readonly CALL: 'call.incoming'
    readonly CALL_STATUS: 'call.status'
    readonly GROUP_PARTICIPANTS_UPDATE: 'group.participants.update'
    readonly GROUP_UPDATE: 'group.update'
    readonly GROUPS_UPDATE: 'group.update'
    readonly GROUP_UPSERT: 'group.upsert'
    readonly GROUPS_UPSERT: 'group.upsert'
    readonly GROUP_MEMBER_TAG_UPDATE: 'group.member_tag.update'
    readonly CHAT_UPDATE: 'chat.update'
    readonly CHAT_DELETE: 'chat.delete'
    readonly ERROR: 'error'
}

export type EventNames = typeof Events[keyof typeof Events]

export declare const CanonicalToLegacyMap: Record<string, readonly string[]>
export declare const LegacyToCanonicalMap: Record<string, string>

export declare const ConnectionStatus: {
    readonly IDLE: 'idle'
    readonly INITIALIZING: 'initializing'
    readonly CONNECTING: 'connecting'
    readonly QR_READY: 'qr_ready'
    readonly PAIRING_READY: 'pairing_ready'
    readonly CONNECTED: 'connected'
    readonly RECONNECTING: 'reconnecting'
    readonly LOGGED_OUT: 'logged_out'
    readonly DISCONNECTED: 'disconnected'
}

export type ConnectionStatusType = typeof ConnectionStatus[keyof typeof ConnectionStatus]

export declare const PresenceStatus: {
    readonly AVAILABLE: 'available'
    readonly UNAVAILABLE: 'unavailable'
    readonly COMPOSING: 'composing'
    readonly RECORDING: 'recording'
    readonly PAUSED: 'paused'
}

export declare const SessionStatus: {
    readonly CONNECTING: 'connecting'
    readonly PAIRING_CODE: 'pairing_code'
    readonly PAIRING_SUCCESS: 'pairing_success'
    readonly PAIRING_FAILED: 'pairing_failed'
    readonly LOGGED_OUT: 'logged_out'
    readonly CONNECTED: 'connected'
    readonly DISCONNECTED: 'disconnected'
}

export declare const DisconnectReasons: {
    readonly MANUAL_DISCONNECT: 'manual_disconnect'
    readonly LOGGED_OUT: 'logged_out'
    readonly PAIRING_FAILED: 'pairing_failed'
    readonly CONNECTION_ERROR: 'connection_error'
    readonly RESTART_REQUIRED: 'restart_required'
    readonly UNAVAILABLE_SERVICE: 'unavailable_service'
    readonly UNKNOWN: 'unknown'
    readonly QR_READ_ATTEMPTS_ENDED: 'qr_read_attempts_ended'
    readonly BAD_SESSION: 'bad_session'
    readonly CONNECTION_LOST: 'connection_lost'
    readonly CONNECTION_CLOSED: 'connection_closed'
    readonly CONNECTION_REPLACED: 'connection_replaced'
    readonly MULTIDEVICE_MISMATCH: 'multidevice_mismatch'
    readonly TIMED_OUT: 'timed_out'
    readonly UNAUTHORIZED: 'unauthorized'
}

export declare class ConnectionStatusChange {
    current: ConnectionStatusType
    previous: ConnectionStatusType
    constructor(current: ConnectionStatusType, previous: ConnectionStatusType)
    toString(): string
    toJSON(): { current: ConnectionStatusType; previous: ConnectionStatusType }
}

export declare class QrCodeEvent {
    qr: string
    attempts: number
    base64: string | null
    constructor(qr: string, attempts?: number)
    toDataURL(): Promise<string | null>
    toString(): string
    toJSON(): { qr: string; attempts: number; base64: string | null }
}

export declare class PairingCodeEvent {
    code: string
    constructor(code: string)
    toString(): string
    toJSON(): { code: string }
}

export declare class ConnectedEvent {
    user: any
    readonly name: string
    readonly id: string
    constructor(user: any)
    toString(): string
    toJSON(): { user: any }
}

export declare class DisconnectedEvent {
    error: any | null
    willReconnect: boolean
    attempt: number
    delayMs: number
    reason: string
    constructor(options?: any)
    toString(): string
    toJSON(): any
}

export declare class LoggedOutEvent {
    error: any | null
    constructor(error?: any)
    toString(): string
    toJSON(): any
}

export declare class MessageDeleteEvent {
    keys: any[]
    readonly ids: string[]
    constructor(keys: any | any[])
    toString(): string
    toJSON(): { keys: any[] }
}

export declare class GroupParticipantsUpdateEvent {
    id: string
    participants: string[]
    action: string
    constructor(update?: any)
    toString(): string
    toJSON(): { id: string; participants: string[]; action: string }
}

export declare class PresenceUpdateEvent {
    id: string
    presences: Record<string, any>
    constructor(presence?: any)
    toString(): string
    toJSON(): { id: string; presences: Record<string, any> }
}

export declare class MessageReactionEvent {
    reactions: any[]
    readonly first: any | null
    readonly emoji: string
    readonly targetKey: any | null
    constructor(reactions?: any[])
    toString(): string
    toJSON(): { reactions: any[] }
}

export declare class GroupUpdateEvent {
    updates: any[]
    readonly first: any | null
    readonly id: string
    constructor(updates?: any[])
    toString(): string
    toJSON(): { updates: any[] }
}

export declare class ChatUpdateEvent {
    chats: any[]
    constructor(chats?: any[])
    toString(): string
    toJSON(): { chats: any[] }
}

export declare class ChatDeleteEvent {
    chatIds: string[]
    constructor(chatIds?: string[])
    toString(): string
    toJSON(): { chatIds: string[] }
}

export interface WaClientOptions {
    sessionName?: string
    dataPath?: string
    auth?: { state: AuthenticationState; saveCreds: () => Promise<void> }
    phoneNumber?: string
    printQRInTerminal?: boolean
    restartOnClose?: boolean
    maxReconnectAttempts?: number
    syncFullHistory?: boolean
    markOnlineOnConnect?: boolean
    socketOptions?: Record<string, any>
    environment?: [string, string, string] | string[]
    waVersion?: [number, number, number] | number[]
    loggerLevel?: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal' | 'silent' | string
    keepAlivePresence?: boolean
    keepAlivePresenceIntervalMs?: number
    logger?: any
    store?: BaseStorageAdapter | any
    historySyncLastMessageOnly?: boolean
    historySyncFilterStatus?: 'all' | 'read' | 'unread' | string
    historyOptions?: { lastMessageOnly?: boolean; filterStatus?: 'all' | 'read' | 'unread' | string }
}

export declare abstract class BaseStorageAdapter {
    abstract saveMessage(chatId: string, message: any): Promise<void>
    setMessage(chatId: string, message: any): Promise<void>
    abstract getMessage(chatId: string, messageId: string): Promise<any>
    abstract getMessages(chatId: string, options?: { limit?: number }): Promise<any[]>
    abstract deleteMessage(chatId: string, messageId: string): Promise<void>
    abstract clear(chatId?: string): Promise<void>
}

export declare class MemoryStorageAdapter extends BaseStorageAdapter {
    cache: any
    constructor(options?: { maxMessages?: number; ttl?: number })
    saveMessage(chatId: string, message: any): Promise<void>
    getMessage(chatId: string, messageId: string): Promise<any>
    getMessages(chatId: string, options?: { limit?: number }): Promise<any[]>
    deleteMessage(chatId: string, messageId: string): Promise<void>
    clear(chatId?: string): Promise<void>
}

export declare class FileStorageAdapter extends BaseStorageAdapter {
    basePath: string
    constructor(options?: { basePath?: string })
    saveMessage(chatId: string, message: any): Promise<void>
    getMessage(chatId: string, messageId: string): Promise<any>
    getMessages(chatId: string, options?: { limit?: number }): Promise<any[]>
    deleteMessage(chatId: string, messageId: string): Promise<void>
    clear(chatId?: string): Promise<void>
}

export declare class HistoryEngine {
    static process(client: WaClient, syncData: any): Promise<void>
}

export interface AttachmentHelpers {
    mimetype: string
    extension: string
    buffer: Buffer
    toBase64(): string
    toDataUri(): string
    toArrayBuffer(): ArrayBuffer
    toBlob(): any
    toStream(): Readable
    toSharp(): Promise<any>
    detectType(): Promise<{ ext: string; mime: string } | undefined>
    save(destPath?: string): Promise<string>
}

export declare class MediaObject {
    mediaNode: any
    rawType: string
    mediaType: string
    mimetype: string
    fileLength: number
    fileName: string
    caption: string
    seconds: number
    duration: number | null
    isVoice: boolean
    isPtt: boolean
    isGif: boolean
    isViewOnce: boolean
    isAnimated: boolean
    extension: string

    constructor(mediaNode: any, canonicalType: string)

    toStream(options?: any): Promise<Readable>
    toBuffer(options?: any): Promise<Buffer>
    save(destinationPath?: string, options?: any): Promise<string>
    toBase64(options?: any): Promise<string>
    toDataUri(options?: any): Promise<string>
    toSharp(options?: any): Promise<any>
    getAttachments(options?: any): Promise<AttachmentHelpers>
}

export declare class CallContext {
    client: WaClient
    raw: any
    id: string
    from: string
    fromNumber: string
    isVideo: boolean
    status: string
    startTime: number
    instance: any | null

    constructor(client: WaClient, callData: any, activeCallInstance?: any)

    accept(options?: { isVideo?: boolean; durationMs?: number; audioSource?: any }): Promise<any>
    reject(reason?: number | string): Promise<void>
    hangup(): Promise<void>
    playAudio(audioPathOrBuffer: string | Buffer): Promise<any>
}

export interface InteractiveReplyData {
    id: string
    text: string
    params?: any
    flowName?: string
    description?: string
    type: 'button' | 'list' | 'native_flow' | 'template_button' | 'question_reply' | string
}

export interface ContactData {
    name: string
    number: string
    org?: string
    vcard: string
}

export interface LocationData {
    latitude: number
    longitude: number
    name: string
    address: string
    url: string
    accuracyInMeters?: number
    speedInMps?: number
    isLive: boolean
}

export interface ReactionData {
    emoji: string
    reactedMessageId: string
    targetKey: any
    isRemoval: boolean
    senderTimestamp: Date
}

export interface PollData {
    id: string
    name: string
    selectableOptionsCount: number
    allowsMultipleAnswers: boolean
    options: Array<{ name: string; hash: string | null }>
}

export interface MediaDetailsData {
    mimetype: string
    fileName: string
    caption: string
    duration: number | null
    isPtt: boolean
    isGif: boolean
    isViewOnce: boolean
}

export interface QuotedMessageContext {
    id: string
    sender: string
    senderNumber: string
    type: string
    body: string
    raw: proto.IMessage | any
}

export interface ChatContextData {
    id: string
    lid: string | null
    name: string
    type: 'personal' | 'business' | 'group' | 'newsletter' | string
    isGroup: boolean
    isNewsletter: boolean
    isBusiness: boolean
    metadata: any | null
    slogan: string | null
    description: string | null
    picture: string | null
    fetchFullProfile(): Promise<any>
    toJSON(): Record<string, any>
}

export declare class MessageContext {
    client: WaClient
    raw: proto.IWebMessageInfo
    id: string
    chatId: string
    fromMe: boolean
    isFromMe: boolean
    isGroup: boolean
    isChannel: boolean
    isBroadcast: boolean

    readonly chat: ChatContextData

    from: string
    to: string
    fromPushName: string
    fromNumber: string
    sender: string
    senderNumber: string
    senderName: string

    timestamp: Date
    isEdited: boolean
    editTimestamp: Date | null

    type: string
    body: string
    interactiveReply: InteractiveReplyData | null
    contacts: ContactData[]
    location: LocationData | null
    reaction: ReactionData | null
    poll: PollData | null
    pollUpdate: any | null

    mediaNode: any | null
    hasMedia: boolean
    media: MediaObject | null
    mediaDetails: MediaDetailsData | null

    contextInfo: proto.IContextInfo | null
    mentions: string[]
    mentionedJids: string[]
    isForwarded: boolean
    forwardingScore: number
    isMentioningMe: boolean

    isReply: boolean
    quoted: MessageContext | QuotedMessageContext | null
    quotedMessage: MessageContext | QuotedMessageContext | null

    constructor(client: WaClient, rawMessage: proto.IWebMessageInfo, depth?: number)

    getAttachments(options?: any): Promise<AttachmentHelpers | null>
    reply(content: string | AnyMessageContent, options?: MiscMessageGenerationOptions): Promise<proto.WebMessageInfo | undefined>
    react(emoji: string): Promise<proto.WebMessageInfo | undefined>
    removeReaction(): Promise<proto.WebMessageInfo | undefined>
    delete(): Promise<proto.WebMessageInfo | undefined>
    markRead(): Promise<void>
    forward(targetJid: string, options?: MiscMessageGenerationOptions): Promise<proto.WebMessageInfo | undefined>
    pin(durationInSeconds?: number): Promise<any>
    unpin(): Promise<any>
    getEventResponse(): Promise<any>
    getPollVote(): Promise<any>
}

export declare class QuickReplyButton {
    displayText: string
    id: string
    constructor(displayText: string, id?: string)
    build(): { name: string; buttonParamsJson: string }
}

export declare class UrlButton {
    displayText: string
    url: string
    merchantUrl?: string
    webviewInteraction: boolean
    constructor(displayText: string, url: string, merchantUrl?: string, webviewInteraction?: boolean)
    build(): { name: string; buttonParamsJson: string }
}

export declare class CopyCodeButton {
    displayText: string
    copyCode: string
    id?: string
    constructor(displayText: string, copyCode: string, id?: string)
    build(): { name: string; buttonParamsJson: string }
}

export declare class CallButton {
    displayText: string
    phoneNumber: string
    constructor(displayText: string, phoneNumber: string)
    build(): { name: string; buttonParamsJson: string }
}

export declare class PixButton {
    displayText: string
    pixKey: string
    keyType: string
    merchantName: string
    constructor(displayText: string, pixKey: string, keyType?: 'CPF' | 'EMAIL' | 'PHONE' | 'EVP' | string, merchantName?: string)
    build(): { name: string; buttonParamsJson: string }
}

export declare class LocationButton {
    displayText: string
    constructor(displayText?: string)
    build(): { name: string; buttonParamsJson: string }
}

export declare class CheckoutButton {
    data: any
    constructor(data?: any)
    build(): { name: string; buttonParamsJson: string }
}

export declare class WebviewButton {
    displayText: string
    url: string
    inAppWebview: boolean
    constructor(displayText: string, url: string, inAppWebview?: boolean)
    build(): { name: string; buttonParamsJson: string }
}

export declare class VoiceCallButton {
    displayText: string
    constructor(displayText?: string)
    build(): { name: string; buttonParamsJson: string }
}

export declare class FlowButton {
    data: any
    constructor(data?: {
        flowId?: string
        flowCta?: string
        flowToken?: string
        flowAction?: string
        flowActionPayload?: any
        flowMessageVersion?: string
        mode?: string
        [key: string]: any
    })
    build(): { name: string; buttonParamsJson: string }
}

export declare class CardBuilder {
    setImage(image: string | Buffer | { url: string }): this
    setVideo(video: string | Buffer | { url: string }): this
    setTitle(title: string): this
    setBody(body: string): this
    setFooter(footer: string): this
    addButton(button: any): this
    addButtons(buttons: any[]): this
    build(): any
}

export declare class CarouselBuilder {
    setTitle(title: string): this
    setSubtitle(subtitle: string): this
    setText(text: string): this
    setFooter(footer: string): this
    addCard(card: CardBuilder | any): this
    addCards(cards: (CardBuilder | any)[]): this
    build(): { text: string; title?: string; subtitle?: string; footer?: string; cards: any[] }
}

export declare class ListRow {
    title: string
    description: string
    rowId: string
    header: string
    constructor(title: string, description?: string, rowId?: string, header?: string)
    withHeader(header: string): this
    build(): { id: string; title: string; description: string; rowId: string; header?: string }
}

export declare class ListSection {
    title: string
    highlightLabel: string
    rows: (ListRow | any)[]
    constructor(title: string, rows?: ListRow[])
    withHighlightLabel(label: string): this
    addRow(titleOrRow: string | ListRow, description?: string, rowId?: string, header?: string): this
    build(): { title: string; highlight_label?: string; rows: any[] }
}

export declare class ListButton {
    buttonText: string
    sections: (ListSection | any)[]
    constructor(buttonText: string, sections?: ListSection[])
    addSection(titleOrSection: string | ListSection, rows?: ListRow[]): this
    build(): { buttonText: string; sections: any[] }
}

export declare class InteractiveMessage {
    setTitle(title: string): this
    withTitle(title: string): this
    setSubtitle(subtitle: string): this
    withSubtitle(subtitle: string): this
    setText(text: string): this
    withText(text: string): this
    setFooter(footer: string): this
    withFooter(footer: string): this
    setHeaderImage(image: string | Buffer | { url: string }): this
    setHeaderVideo(video: string | Buffer | { url: string }): this
    addButton(button: any): this
    addButtons(buttons: any[]): this
    build(): any
}

export declare class PollBuilder {
    setName(name: string): this
    addOption(option: string): this
    addOptions(options: string[]): this
    setSelectableCount(count: number): this
    build(): { poll: { name: string; values: string[]; selectableCount: number } }
}

export declare class EventBuilder {
    setName(name: string): this
    setDescription(description: string): this
    setStartDate(date: Date | number): this
    setEndDate(date: Date | number): this
    setLocation(name: string, degreesLatitude?: number, degreesLongitude?: number): this
    setCall(callType?: 'voice' | 'video' | 1 | 2): this
    build(): { event: any }
}

export declare class MessageManager {
    constructor(client: WaClient)
    sendMessage(jid: string, content: AnyMessageContent, options?: any): Promise<proto.WebMessageInfo | undefined>
    sendPoll(jid: string, pollNameOrBuilder: string | PollBuilder | any, pollValuesOrOptions?: string[] | any, options?: any): Promise<proto.WebMessageInfo | undefined>
    sendText(jid: string, text: string, options?: any): Promise<proto.WebMessageInfo | undefined>
    sendTextMessage(jid: string, text: string, options?: any): Promise<proto.WebMessageInfo | undefined>
    sendMedia(jid: string, type: 'image' | 'video' | 'audio' | 'document' | 'sticker', content: any, options?: any): Promise<proto.WebMessageInfo | undefined>
    sendImage(jid: string, content: any, caption?: string, options?: any): Promise<proto.WebMessageInfo | undefined>
    sendVideo(jid: string, content: any, caption?: string, options?: any): Promise<proto.WebMessageInfo | undefined>
    sendAudio(jid: string, content: any, ptt?: boolean, options?: any): Promise<proto.WebMessageInfo | undefined>
    sendDocument(jid: string, content: any, fileName?: string, mimetype?: string, options?: any): Promise<proto.WebMessageInfo | undefined>
    sendLink(jid: string, text: string, options?: any): Promise<proto.WebMessageInfo | undefined>
    sendContacts(jid: string, contacts: any[], options?: any): Promise<proto.WebMessageInfo | undefined>
    sendAlbum(jid: string, items: any[], options?: any): Promise<proto.WebMessageInfo | undefined>
    sendVoice(jid: string, audioSource: any, options?: any): Promise<proto.WebMessageInfo | undefined>
    sendContact(jid: string, name: string, phoneNumber: string, options?: any): Promise<proto.WebMessageInfo | undefined>
    sendLocation(jid: string, coordsOrLat: number | { latitude: number; longitude: number; name?: string; address?: string; live?: boolean }, lngOrOptions?: number | any, name?: string, address?: string): Promise<proto.WebMessageInfo | undefined>
    reply(jid: string, textOrContent: string | AnyMessageContent, quoted: any, options?: any): Promise<proto.WebMessageInfo | undefined>
    editMessage(jid: string, messageKey: proto.IMessageKey, newText: string): Promise<proto.WebMessageInfo | undefined>
    edit(jid: string, messageKey: proto.IMessageKey, newText: string): Promise<proto.WebMessageInfo | undefined>
    forward(targetJid: string, message: any, options?: any): Promise<proto.WebMessageInfo | undefined>
    forwardMessage(targetJid: string, message: any, options?: any): Promise<proto.WebMessageInfo | undefined>
    delete(jid: string, messageKey: proto.IMessageKey): Promise<proto.WebMessageInfo | undefined>
    react(jid: string, messageKey: proto.IMessageKey, emoji: string): Promise<proto.WebMessageInfo | undefined>
    read(keys: any | any[]): Promise<void>
    composing(jid: string): { stop: () => Promise<void> }
    getAttachments(messageOrContext: any, options?: any): Promise<AttachmentHelpers | null>
    pin(jid: string, messageKey: proto.IMessageKey, durationSeconds?: number): Promise<any>
    unpin(jid: string, messageKey: proto.IMessageKey): Promise<any>
    getMessages(oldMsg: any, limit?: number): Promise<any>
}

export declare class GroupManager {
    constructor(client: WaClient)
    create(subject: string, participants: string[]): Promise<GroupMetadata>
    getMetadata(groupJid: string): Promise<GroupMetadata>
    leave(groupJid: string): Promise<any>
    addMembers(groupJid: string, participants: string[]): Promise<any>
    addParticipants(groupJid: string, participants: string[]): Promise<any>
    removeMembers(groupJid: string, participants: string[]): Promise<any>
    removeParticipants(groupJid: string, participants: string[]): Promise<any>
    promote(groupJid: string, participants: string[]): Promise<any>
    promoteParticipants(groupJid: string, participants: string[]): Promise<any>
    demote(groupJid: string, participants: string[]): Promise<any>
    demoteParticipants(groupJid: string, participants: string[]): Promise<any>
    updateParticipants(groupJid: string, participants: string[], action: 'add' | 'remove' | 'promote' | 'demote'): Promise<any>
    getInviteCode(groupJid: string): Promise<string>
    revokeInviteCode(groupJid: string): Promise<string>
    joinWithCode(inviteCode: string): Promise<string>
    setSubject(groupJid: string, subject: string): Promise<void>
    updateName(groupJid: string, subject: string): Promise<void>
    setDescription(groupJid: string, description: string): Promise<void>
    updateDescription(groupJid: string, description: string): Promise<void>
    setAnnounceOnly(groupJid: string, announceOnly?: boolean): Promise<void>
    setLocked(groupJid: string, locked?: boolean): Promise<void>
    mentionAll(groupJid: string, textOrContent: string | any, options?: any): Promise<proto.WebMessageInfo | undefined>
    getAllGroups(): Promise<Record<string, GroupMetadata>>
    getProfilePicture(groupJid: string, highRes?: boolean): Promise<string | null>
    updateMemberLabel(groupJid: string, memberJid: string, label: string): Promise<any>
}

export declare class ChannelManager {
    constructor(client: WaClient)
    create(name: string, description?: string, picture?: string | Buffer | any): Promise<any>
    delete(channelJid: string): Promise<any>
    getMetadata(channelJidOrInvite: string): Promise<any>
    subscribe(channelJid: string): Promise<any>
    follow(channelJid: string): Promise<any>
    unsubscribe(channelJid: string): Promise<any>
    unfollow(channelJid: string): Promise<any>
    mute(channelJid: string, duration?: number): Promise<any>
    unmute(channelJid: string): Promise<any>
    listSubscribed(): Promise<any[]>
    getAllNewsletters(): Promise<any[]>
    fetchMessages(channelJid: string, count?: number, sinceTimestamp?: number): Promise<proto.WebMessageInfo[]>
    fetchReactions(channelJid: string, messageServerId: string): Promise<any>
    setName(channelJid: string, name: string): Promise<any>
    updateName(channelJid: string, name: string): Promise<any>
    setDescription(channelJid: string, description: string): Promise<any>
    updateDescription(channelJid: string, description: string): Promise<any>
    updatePicture(channelJid: string, picture: string | Buffer | any): Promise<any>
    setPicture(channelJid: string, picture: string | Buffer | any): Promise<any>
    update(channelJid: string, data?: { name?: string; description?: string; picture?: string | Buffer | any }): Promise<any[]>
    updateReactionMode(channelJid: string, mode?: 'ALL' | 'BASIC' | 'NONE'): Promise<any>
    setReactionMode(channelJid: string, mode?: 'ALL' | 'BASIC' | 'NONE'): Promise<any>
}

export declare class PresenceManager {
    constructor(client: WaClient)
    startTyping(jid: string): { stop: () => Promise<void> }
    startRecording(jid: string): { stop: () => Promise<void> }
    setOnline(): Promise<void>
    setOffline(): Promise<void>
    subscribe(jid: string): Promise<void>
}

export declare class ProfileManager {
    constructor(client: WaClient)
    updateName(name: string): Promise<void>
    updateAbout(aboutText: string): Promise<void>
    getAbout(jid?: string): Promise<any>
    updatePicture(jidOrSelf: string, imageSource: any): Promise<void>
    removePicture(jidOrSelf?: string): Promise<void>
    getPictureUrl(jid: string, highRes?: boolean): Promise<string | null>
}

export declare class PrivacyManager {
    constructor(client: WaClient)
    block(jid: string): Promise<void>
    unblock(jid: string): Promise<void>
    getBlocklist(): Promise<string[]>
    setLastSeen(privacy: 'all' | 'contacts' | 'contact_blacklist' | 'none'): Promise<void>
    setOnline(privacy: 'all' | 'match_last_seen'): Promise<void>
    setProfilePicture(privacy: 'all' | 'contacts' | 'contact_blacklist' | 'none'): Promise<void>
    setAbout(privacy: 'all' | 'contacts' | 'contact_blacklist' | 'none'): Promise<void>
    setReadReceipts(enabled: boolean): Promise<void>
}

export declare class UserManager {
    constructor(client: WaClient)
    getMetadata(jid: string): Promise<any>
    isOnWhatsApp(phoneOrJid: string): Promise<{ exists: boolean; jid: string } | null>
    resolveJid(jidOrPhone: string, fetchIfMissing?: boolean): Promise<string>
    getPnForLid(lidJid: string, fetchIfMissing?: boolean): Promise<string | null>
    getLidForPn(pnJid: string, fetchIfMissing?: boolean): Promise<string | null>
    getBusinessProfile(jid: string): Promise<any>
    getStatus(jid: string): Promise<any>
    getProfilePicture(jid: string, highRes?: boolean): Promise<string | null>
    getMyStatus(): Promise<any>
    updateProfileName(name: string): Promise<void>
    updateProfileStatus(status: string): Promise<void>
    block(jid: string): Promise<void>
    unblock(jid: string): Promise<void>
    getBlocklist(): Promise<string[]>
    sendPresence(jid: string, presence?: 'available' | 'unavailable' | 'composing' | 'recording' | 'paused'): Promise<void>
    updateLastSeenPrivacy(value: 'all' | 'contacts' | 'contact_blacklist' | 'none'): Promise<void>
    updateOnlinePrivacy(value: 'all' | 'match_last_seen'): Promise<void>
    updateReadReceiptsPrivacy(value: 'all' | 'none' | boolean): Promise<void>
}

export declare class ChatManager {
    constructor(client: WaClient)
    pin(jid: string): Promise<void>
    unpin(jid: string): Promise<void>
    mute(jid: string, durationMs?: number): Promise<void>
    unmute(jid: string): Promise<void>
    archive(jid: string): Promise<void>
    unarchive(jid: string): Promise<void>
    setFavorite(jid: string, isFavorite?: boolean): Promise<void>
    setChatNote(jid: string, note: string): Promise<void>
}

export declare class VoipManager {
    constructor(client: WaClient)
    call(phoneNumber: string, options?: any): Promise<CallContext>
    callVideo(phoneNumber: string, options?: any): Promise<CallContext>
    get activeCall(): CallContext | null
    clearActiveCall(): void
    acceptCall(callId: string, from: string, options?: any): Promise<any>
    rejectCall(callId: string, from: string, reason?: number | string): Promise<void>
    reject(callOrId: { id: string; from: string } | string, fromOrReason?: string | number, reason?: number | string): Promise<void>
}

export declare class BusinessManager {
    constructor(client: WaClient)
    updateBusinessProfile(profile: any): Promise<any>
    updateBussinesProfile(profile: any): Promise<any>
    updateCoverPhoto(pathOrBuffer: string | Buffer): Promise<any>
    removeCoverPhoto(coverPhotoId: string): Promise<any>
    createProduct(product: {
        name: string
        description?: string
        price: number
        currency?: string
        images?: (string | Buffer)[]
        retailerId?: string
        url?: string
        isHidden?: boolean
    }): Promise<any>
    productCreate(product: any): Promise<any>
    updateProduct(productId: string, update: any): Promise<any>
    productUpdate(productId: string, update: any): Promise<any>
    deleteProduct(productIds: string | string[]): Promise<{ deleted: number }>
    productDelete(productIds: string | string[]): Promise<{ deleted: number }>
    getProduct(productId: string, merchantJid?: string): Promise<any>
    getCatalog(options?: { jid?: string; limit?: number; cursor?: string }): Promise<any>
    getCollections(merchantJid?: string, limit?: number): Promise<any>
    getOrderDetails(orderId: string, orderToken: string): Promise<any>
}

export declare class CommunityManager {
    constructor(client: WaClient)
    create(subject: string, description?: string): Promise<any>
    getMetadata(communityJid: string): Promise<any>
    createSubgroup(communityJid: string, subject: string, participants?: string[]): Promise<any>
    linkSubgroup(communityJid: string, groupJid: string): Promise<any>
    unlinkSubgroup(communityJid: string, groupJid: string): Promise<any>
    getSubgroups(communityJid: string): Promise<any>
    leave(communityJid: string): Promise<any>
    setName(communityJid: string, subject: string): Promise<any>
}

export declare class LabelManager {
    constructor(client: WaClient)
    create(name: string, color?: number, predefinedId?: number): Promise<any>
    createLabel(name: string, color?: number, predefinedId?: number): Promise<any>
    update(id: string, name: string, color?: number, predefinedId?: number): Promise<any>
    updateLabel(id: string, name: string, color?: number, predefinedId?: number): Promise<any>
    delete(id: string): Promise<any>
    deleteLabel(id: string): Promise<any>
    addChat(jid: string, labelId: string): Promise<any>
    addChatLabel(jid: string, labelId: string): Promise<any>
    removeChat(jid: string, labelId: string): Promise<any>
    removeChatLabel(jid: string, labelId: string): Promise<any>
    addMessage(jid: string, messageId: string, labelId: string): Promise<any>
    addMessageLabel(jid: string, messageId: string, labelId: string): Promise<any>
    removeMessage(jid: string, messageId: string, labelId: string): Promise<any>
    removeMessageLabel(jid: string, messageId: string, labelId: string): Promise<any>
}

export declare class StoriesManager {
    constructor(client: WaClient)
    send(jids: string[], content: any, options?: { sendMentions?: boolean; backgroundColor?: string; font?: number; [key: string]: any }): Promise<any>
    delete(msgKey: any): Promise<any>
}

export interface NormalizedContact {
    id: string
    lid: string | null
    name: string
    type: 'personal' | 'business' | 'group' | 'newsletter' | string
    isGroup: boolean
    isNewsletter: boolean
    isBusiness: boolean
    slogan: string | null
    picture: string | null
    metadata: any | null
}

export declare class ContactManager {
    client: WaClient
    cache: any
    constructor(client: WaClient, options?: { maxContacts?: number; ttl?: number })
    get(jid: string): NormalizedContact | null
    set(jid: string, contact: Partial<NormalizedContact> | any): void
    getAll(): NormalizedContact[]
    has(jid: string): boolean
    delete(jid: string): void
    clear(): void
    normalize(rawMessage: any, options?: { enrich?: boolean }): Promise<NormalizedContact | null>
    enrich(jid: string): Promise<NormalizedContact | null>
}

export declare class JidNormalizer {
    static toJid(input: string): string
    static toPhoneNumber(jid: string): string
    static isGroup(jid: string): boolean
    static isNewsletter(jid: string): boolean
    static isLid(jid: string): boolean
    static isUser(jid: string): boolean
    static isStatusBroadcast(jid: string): boolean
    static isBroadcast(jid: string): boolean
}

export declare class MessageNormalizer {
    static unwrapMessage(rawMessageContent: any): any
    static extractType(messageContent: any): string
    static extractBody(messageContent: any): string
    static extractInteractiveReply(messageContent: any): InteractiveReplyData | null
    static extractContacts(messageContent: any): ContactData[]
    static extractLocation(messageContent: any): LocationData | null
    static extractReaction(messageContent: any): ReactionData | null
    static extractPollCreation(messageContent: any, rawMessage?: any): PollData | null
    static extractMediaNode(messageContent: any): any | null
    static extractMediaDetails(messageContent: any): MediaDetailsData | null
    static extractContextInfo(messageContent: any): proto.IContextInfo | null
}

export declare class WaClient extends EventEmitter {
    options: WaClientOptions
    status: ConnectionStatusType
    sock: any
    authState: AuthenticationState | null
    saveCreds: (() => Promise<void>) | null
    reconnectAttempts: number

    // Specialized Domain Managers
    messages: MessageManager
    groups: GroupManager
    channels: ChannelManager
    newsletters: ChannelManager
    presence: PresenceManager
    profile: ProfileManager
    privacy: PrivacyManager
    users: UserManager
    chat: ChatManager
    voip: VoipManager
    calls: VoipManager
    business: BusinessManager
    communities: CommunityManager
    labels: LabelManager
    contacts: ContactManager
    stories: StoriesManager
    store: BaseStorageAdapter | any
    historySyncLastMessageOnly: boolean
    historySyncFilterStatus: 'all' | 'read' | 'unread' | string

    constructor(options?: WaClientOptions)

    connect(): Promise<this>
    disconnect(): Promise<void>
    logout(): Promise<void>
    setHistorySyncOptions(options?: { lastMessageOnly?: boolean; filterStatus?: 'all' | 'read' | 'unread' | string }): void

    sendMessage(jid: string, content: AnyMessageContent, options?: MiscMessageGenerationOptions): Promise<proto.WebMessageInfo | undefined>
    sendInteractive(jid: string, interactiveOrBuilder: InteractiveMessage | any, options?: MiscMessageGenerationOptions): Promise<proto.WebMessageInfo | undefined>
    sendPoll(jid: string, pollOrBuilder: PollBuilder | any, options?: MiscMessageGenerationOptions): Promise<proto.WebMessageInfo | undefined>
    sendEvent(jid: string, eventOrBuilder: EventBuilder | any, options?: MiscMessageGenerationOptions): Promise<proto.WebMessageInfo | undefined>

    startTyping(jid: string): { stop: () => Promise<void> }
    startRecording(jid: string): { stop: () => Promise<void> }
    composing(jid: string): { stop: () => Promise<void> }
    itsMe(jid?: string): Promise<any>
    fetchStatus(...jids: string[]): Promise<any[]>
    decryptPollVote(vote: any, voteParams: any): Promise<any>
    getAggregateVotesInPollMessage(pollParams: any): any
    isOnWhatsApp(jidOrNumber: string): Promise<{ exists: boolean; jid: string } | null>
    getMessages(oldMsg: any, limit?: number): Promise<any>
    jidNormalizedUser(id: string): string
    downloadContentFromMessage(content: any, type: string, options?: any): Promise<any>
    getContentType(message: any): string | undefined

    get user(): { id: string; name?: string } | null
    get isConnected(): boolean
    get rawSocket(): any

    on(event: 'status.change', listener: (status: ConnectionStatusChange) => void): this
    on(event: 'status_change', listener: (status: ConnectionStatusChange) => void): this
    on(event: 'qr', listener: (data: QrCodeEvent) => void): this
    on(event: 'pairing_code', listener: (data: QrCodeEvent) => void): this
    on(event: 'pairing.code', listener: (data: PairingCodeEvent) => void): this
    on(event: 'pairing.success', listener: (update: any) => void): this
    on(event: 'pairing_success', listener: (update: any) => void): this
    on(event: 'connected', listener: (data: ConnectedEvent) => void): this
    on(event: 'disconnected', listener: (data: DisconnectedEvent) => void): this
    on(event: 'logged.out', listener: (data: LoggedOutEvent) => void): this
    on(event: 'call.incoming', listener: (call: CallContext) => void): this
    on(event: 'call', listener: (call: CallContext) => void): this
    on(event: 'call.status', listener: (calls: any[]) => void): this
    on(event: 'message.received', listener: (ctx: MessageContext, raw: proto.IWebMessageInfo) => void): this
    on(event: 'message_received', listener: (ctx: MessageContext, raw: proto.IWebMessageInfo) => void): this
    on(event: 'message.sent', listener: (ctx: MessageContext, raw: proto.IWebMessageInfo) => void): this
    on(event: 'message_sent', listener: (ctx: MessageContext, raw: proto.IWebMessageInfo) => void): this
    on(event: 'message.update', listener: (updates: any[]) => void): this
    on(event: 'message_update', listener: (updates: any[]) => void): this
    on(event: 'message.delete', listener: (item: MessageDeleteEvent) => void): this
    on(event: 'message_delete', listener: (item: MessageDeleteEvent) => void): this
    on(event: 'message.reaction', listener: (item: MessageReactionEvent) => void): this
    on(event: 'message_reaction', listener: (item: MessageReactionEvent) => void): this
    on(event: 'message.broadcast', listener: (raw: proto.IWebMessageInfo) => void): this
    on(event: 'broadcast_message', listener: (raw: proto.IWebMessageInfo) => void): this
    on(event: 'notification', listener: (raw: proto.IWebMessageInfo) => void): this
    on(event: 'presence.update', listener: (presence: PresenceUpdateEvent) => void): this
    on(event: 'presence_update', listener: (presence: PresenceUpdateEvent) => void): this
    on(event: 'contacts.upsert', listener: (contacts: any[]) => void): this
    on(event: 'contacts.update', listener: (contacts: any[]) => void): this
    on(event: 'contacts_update', listener: (contacts: any[]) => void): this
    on(event: 'blocklist.update', listener: (update: any) => void): this
    on(event: 'blocklist_update', listener: (update: any) => void): this
    on(event: 'group.participants.update', listener: (update: GroupParticipantsUpdateEvent) => void): this
    on(event: 'group_participants_update', listener: (update: GroupParticipantsUpdateEvent) => void): this
    on(event: 'group.update', listener: (update: GroupUpdateEvent) => void): this
    on(event: 'GROUPS_UPDATE', listener: (update: GroupUpdateEvent) => void): this
    on(event: 'group.upsert', listener: (groups: any[]) => void): this
    on(event: 'GROUPS_UPSERT', listener: (groups: any[]) => void): this
    on(event: 'group.member_tag.update', listener: (update: any) => void): this
    on(event: 'group_member_tag_update', listener: (update: any) => void): this
    on(event: 'chat.update', listener: (update: ChatUpdateEvent) => void): this
    on(event: 'chat_update', listener: (update: ChatUpdateEvent) => void): this
    on(event: 'chat.delete', listener: (update: ChatDeleteEvent) => void): this
    on(event: 'chat_delete', listener: (update: ChatDeleteEvent) => void): this
    on(event: 'history.sync', listener: (history: any[], meta?: any) => void): this
    on(event: 'messages_history_sync_done', listener: (history: any[], meta?: any) => void): this
    on(event: 'error', listener: (error: any) => void): this
    on(event: string | symbol, listener: (...args: any[]) => void): this
}

export default WaClient
