import { EventEmitter } from 'events'
import { Readable } from 'stream'
import { AuthenticationState, proto, AnyMessageContent, MiscMessageGenerationOptions, GroupMetadata } from '../Types'

export declare const Events: {
    readonly STATUS_CHANGE: 'status.change'
    readonly QR_CODE: 'qr'
    readonly PAIRING_CODE: 'pairing.code'
    readonly CONNECTED: 'connected'
    readonly DISCONNECTED: 'disconnected'
    readonly LOGGED_OUT: 'logged.out'
    readonly MESSAGE_RECEIVED: 'message.received'
    readonly MESSAGE_SENT: 'message.sent'
    readonly MESSAGE_UPDATE: 'message.update'
    readonly MESSAGE_DELETE: 'message.delete'
    readonly PRESENCE_UPDATE: 'presence.update'
    readonly CONTACTS_UPSERT: 'contacts.upsert'
    readonly CALL_INCOMING: 'call.incoming'
    readonly CALL_STATUS: 'call.status'
    readonly GROUP_PARTICIPANTS_UPDATE: 'group.participants.update'
    readonly ERROR: 'error'
}

export type EventNames = typeof Events[keyof typeof Events]

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
    logger?: any
}

export declare class MediaObject {
    mediaNode: any
    rawType: string
    mediaType: string
    mimetype: string
    fileLength: number
    fileName: string
    seconds: number
    isVoice: boolean
    isAnimated: boolean
    extension: string

    constructor(mediaNode: any, canonicalType: string)

    toStream(options?: any): Promise<Readable>
    toBuffer(options?: any): Promise<Buffer>
    save(destinationPath: string, options?: any): Promise<string>
    toBase64(options?: any): Promise<string>
    toDataUri(options?: any): Promise<string>
    toSharp(options?: any): Promise<any>
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

export interface QuotedMessageContext {
    id: string
    sender: string
    senderNumber: string
    type: string
    body: string
    raw: proto.IMessage
}

export declare class MessageContext {
    client: WaClient
    raw: proto.IWebMessageInfo
    id: string
    chatId: string
    isFromMe: boolean
    isGroup: boolean
    isChannel: boolean
    isBroadcast: boolean
    sender: string
    senderNumber: string
    senderName: string
    type: string
    body: string
    mediaNode: any | null
    hasMedia: boolean
    media: MediaObject | null
    timestamp: number
    contextInfo: proto.IContextInfo | null
    mentionedJids: string[]
    quoted: QuotedMessageContext | null

    constructor(client: WaClient, rawMessage: proto.IWebMessageInfo)

    reply(content: string | AnyMessageContent, options?: MiscMessageGenerationOptions): Promise<proto.WebMessageInfo | undefined>
    react(emoji: string): Promise<proto.WebMessageInfo | undefined>
    removeReaction(): Promise<proto.WebMessageInfo | undefined>
    delete(): Promise<proto.WebMessageInfo | undefined>
    markRead(): Promise<void>
    forward(targetJid: string, options?: MiscMessageGenerationOptions): Promise<proto.WebMessageInfo | undefined>
    pin(durationInSeconds?: number): Promise<any>
    unpin(): Promise<any>
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
    constructor(displayText: string, url: string, merchantUrl?: string)
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

export declare class ListRow {
    title: string
    description: string
    rowId: string
    constructor(title: string, description?: string, rowId?: string)
    build(): { title: string; description: string; rowId: string }
}

export declare class ListSection {
    title: string
    rows: (ListRow | any)[]
    constructor(title: string, rows?: ListRow[])
    addRow(titleOrRow: string | ListRow, description?: string, rowId?: string): this
    build(): { title: string; rows: any[] }
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
    setSubtitle(subtitle: string): this
    setText(text: string): this
    setFooter(footer: string): this
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
    sendText(jid: string, text: string, options?: any): Promise<proto.WebMessageInfo | undefined>
    sendMedia(jid: string, type: 'image' | 'video' | 'audio' | 'document' | 'sticker', content: any, options?: any): Promise<proto.WebMessageInfo | undefined>
    sendAlbum(jid: string, items: any[], options?: any): Promise<proto.WebMessageInfo | undefined>
    sendVoice(jid: string, audioSource: any, options?: any): Promise<proto.WebMessageInfo | undefined>
    sendContact(jid: string, name: string, phoneNumber: string, options?: any): Promise<proto.WebMessageInfo | undefined>
    sendLocation(jid: string, coords: { latitude: number; longitude: number; name?: string; address?: string; live?: boolean }, options?: any): Promise<proto.WebMessageInfo | undefined>
    forward(targetJid: string, message: any, options?: any): Promise<proto.WebMessageInfo | undefined>
    delete(jid: string, messageKey: proto.IMessageKey): Promise<proto.WebMessageInfo | undefined>
    edit(jid: string, messageKey: proto.IMessageKey, newText: string): Promise<proto.WebMessageInfo | undefined>
    pin(jid: string, messageKey: proto.IMessageKey, durationSeconds?: number): Promise<any>
    unpin(jid: string, messageKey: proto.IMessageKey): Promise<any>
    react(jid: string, messageKey: proto.IMessageKey, emoji: string): Promise<proto.WebMessageInfo | undefined>
}

export declare class GroupManager {
    constructor(client: WaClient)
    create(subject: string, participants: string[]): Promise<GroupMetadata>
    getMetadata(groupJid: string): Promise<GroupMetadata>
    addMembers(groupJid: string, participants: string[]): Promise<any>
    removeMembers(groupJid: string, participants: string[]): Promise<any>
    promote(groupJid: string, participants: string[]): Promise<any>
    demote(groupJid: string, participants: string[]): Promise<any>
    getInviteCode(groupJid: string): Promise<string>
    revokeInviteCode(groupJid: string): Promise<string>
    joinWithCode(inviteCode: string): Promise<string>
    setSubject(groupJid: string, subject: string): Promise<void>
    setDescription(groupJid: string, description: string): Promise<void>
    setAnnounceOnly(groupJid: string, announceOnly?: boolean): Promise<void>
    setLocked(groupJid: string, locked?: boolean): Promise<void>
    mentionAll(groupJid: string, textOrContent: string | any, options?: any): Promise<proto.WebMessageInfo | undefined>
}

export declare class ChannelManager {
    constructor(client: WaClient)
    create(name: string, description?: string): Promise<any>
    getMetadata(channelJidOrInvite: string): Promise<any>
    subscribe(channelJid: string): Promise<any>
    unsubscribe(channelJid: string): Promise<any>
    mute(channelJid: string): Promise<any>
    unmute(channelJid: string): Promise<any>
    listSubscribed(): Promise<any[]>
    fetchMessages(channelJid: string, count?: number, sinceTimestamp?: number): Promise<proto.WebMessageInfo[]>
    fetchReactions(channelJid: string, messageServerId: string): Promise<any>
    setName(channelJid: string, name: string): Promise<any>
    setDescription(channelJid: string, description: string): Promise<any>
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
    isOnWhatsApp(phoneOrJid: string): Promise<{ exists: boolean; jid: string } | null>
    resolveJid(jidOrPhone: string, fetchIfMissing?: boolean): Promise<string>
    getPnForLid(lidJid: string, fetchIfMissing?: boolean): Promise<string | null>
    getLidForPn(pnJid: string, fetchIfMissing?: boolean): Promise<string | null>
    getBusinessProfile(jid: string): Promise<any>
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
}

export declare class BusinessManager {
    constructor(client: WaClient)
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
    updateProduct(productId: string, update: any): Promise<any>
    deleteProduct(productIds: string | string[]): Promise<{ deleted: number }>
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
    update(id: string, name: string, color?: number, predefinedId?: number): Promise<any>
    delete(id: string): Promise<any>
    addChat(jid: string, labelId: string): Promise<any>
    removeChat(jid: string, labelId: string): Promise<any>
    addMessage(jid: string, messageId: string, labelId: string): Promise<any>
    removeMessage(jid: string, messageId: string, labelId: string): Promise<any>
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
    static extractMediaNode(messageContent: any): any | null
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
    presence: PresenceManager
    profile: ProfileManager
    privacy: PrivacyManager
    users: UserManager
    chat: ChatManager
    voip: VoipManager
    business: BusinessManager
    communities: CommunityManager
    labels: LabelManager

    constructor(options?: WaClientOptions)

    connect(): Promise<this>
    disconnect(): Promise<void>
    logout(): Promise<void>

    sendMessage(jid: string, content: AnyMessageContent, options?: MiscMessageGenerationOptions): Promise<proto.WebMessageInfo | undefined>
    sendInteractive(jid: string, interactiveOrBuilder: InteractiveMessage | any, options?: MiscMessageGenerationOptions): Promise<proto.WebMessageInfo | undefined>
    sendPoll(jid: string, pollOrBuilder: PollBuilder | any, options?: MiscMessageGenerationOptions): Promise<proto.WebMessageInfo | undefined>
    sendEvent(jid: string, eventOrBuilder: EventBuilder | any, options?: MiscMessageGenerationOptions): Promise<proto.WebMessageInfo | undefined>

    startTyping(jid: string): { stop: () => Promise<void> }
    startRecording(jid: string): { stop: () => Promise<void> }
    isOnWhatsApp(jidOrNumber: string): Promise<{ exists: boolean; jid: string } | null>

    get user(): { id: string; name?: string } | null
    get isConnected(): boolean
    get rawSocket(): any

    on(event: 'status.change', listener: (status: { current: ConnectionStatusType; previous: ConnectionStatusType }) => void): this
    on(event: 'qr', listener: (data: { qr: string }) => void): this
    on(event: 'pairing.code', listener: (data: { code: string }) => void): this
    on(event: 'connected', listener: (data: { user: any }) => void): this
    on(event: 'disconnected', listener: (data: { error?: any; willReconnect: boolean; attempt?: number; delayMs?: number }) => void): this
    on(event: 'logged.out', listener: (data: { error?: any }) => void): this
    on(event: 'call.incoming', listener: (call: CallContext) => void): this
    on(event: 'call.status', listener: (calls: any[]) => void): this
    on(event: 'message.received', listener: (ctx: MessageContext, raw: proto.IWebMessageInfo) => void): this
    on(event: 'message.sent', listener: (ctx: MessageContext, raw: proto.IWebMessageInfo) => void): this
    on(event: 'message.update', listener: (updates: any[]) => void): this
    on(event: 'message.delete', listener: (item: any) => void): this
    on(event: 'presence.update', listener: (presence: any) => void): this
    on(event: 'contacts.upsert', listener: (contacts: any[]) => void): this
    on(event: 'group.participants.update', listener: (update: any) => void): this
    on(event: 'error', listener: (error: any) => void): this
    on(event: string | symbol, listener: (...args: any[]) => void): this
}

export default WaClient
