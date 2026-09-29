import { proto } from '../../WAProto'

export declare const DisconnectReason: {
    readonly connectionClosed: 428
    readonly connectionLost: 408
    readonly connectionReplaced: 440
    readonly timedOut: 408
    readonly loggedOut: 401
    readonly badSession: 500
    readonly restartRequired: 515
    readonly multideviceMismatch: 411
    readonly forbidden: 403
    readonly unavailableService: 503
}

export type DisconnectReasonCode = typeof DisconnectReason[keyof typeof DisconnectReason]

export interface AuthenticationCreds {
    noiseKey?: any
    pairingEphemeralKeyPair?: any
    signedIdentityKey?: any
    signedPreKey?: any
    registrationId?: number
    advSecretKey?: string
    processedHistoryMessages?: any[]
    nextPreKeyId?: number
    firstUnuploadedPreKeyId?: number
    accountSyncCounter?: number
    accountSettings?: any
    me?: Contact
    signalIdentities?: any[]
    myAppStateKeyId?: string
    registered?: boolean
    [key: string]: any
}

export interface SignalKeyStore {
    get(type: string, ids: string[]): Promise<Record<string, any>>
    set(data: Record<string, any>): Promise<void>
    clear?(): Promise<void>
}

export interface AuthenticationState {
    creds: AuthenticationCreds
    keys: SignalKeyStore
}

export interface Contact {
    id: string
    name?: string
    notify?: string
    verifiedName?: string
    imgUrl?: string | null
    status?: string
    [key: string]: any
}

export interface GroupParticipant {
    id: string
    admin?: 'admin' | 'superadmin' | null
    [key: string]: any
}

export interface GroupMetadata {
    id: string
    owner?: string
    subject: string
    subjectOwner?: string
    subjectTime?: number
    creation?: number
    desc?: string
    descOwner?: string
    descId?: string
    restrict?: boolean
    announce?: boolean
    size?: number
    participants: GroupParticipant[]
    ephemeralDuration?: number
    inviteCode?: string
    author?: string
    memberAddMode?: 'admin_add' | 'all_member_add'
    approvalMode?: boolean | 'on' | 'off'
    [key: string]: any
}

export interface WAMessageKey {
    remoteJid?: string | null
    fromMe?: boolean | null
    id?: string | null
    participant?: string | null
}

export interface WAMessageContent {
    conversation?: string | null
    extendedTextMessage?: any
    imageMessage?: any
    videoMessage?: any
    audioMessage?: any
    documentMessage?: any
    stickerMessage?: any
    contactMessage?: any
    contactsArrayMessage?: any
    locationMessage?: any
    liveLocationMessage?: any
    pollCreationMessage?: any
    pollCreationMessageV2?: any
    pollCreationMessageV3?: any
    pollUpdateMessage?: any
    reactionMessage?: any
    [key: string]: any
}

export interface WAMessage {
    key: WAMessageKey
    message?: WAMessageContent | null
    messageTimestamp?: number | any
    pushName?: string | null
    status?: number | string | null
    broadcast?: boolean | null
    [key: string]: any
}

export type AnyMessageContent =
    | { text: string; [key: string]: any }
    | { image: any; caption?: string; [key: string]: any }
    | { video: any; caption?: string; [key: string]: any }
    | { audio: any; mimetype?: string; ptt?: boolean; [key: string]: any }
    | { document: any; mimetype: string; fileName?: string; [key: string]: any }
    | { sticker: any; [key: string]: any }
    | { location: { degreesLatitude: number; degreesLongitude: number; [key: string]: any }; [key: string]: any }
    | { contacts: { displayName?: string; contacts: Array<{ vcard: string }> }; [key: string]: any }
    | { poll: { name: string; values: string[]; selectableCount?: number }; [key: string]: any }
    | { react: { text: string; key: WAMessageKey }; [key: string]: any }
    | { edit: WAMessageKey; text?: string; [key: string]: any }
    | { pin: WAMessageKey; type: number; time?: number; [key: string]: any }
    | Record<string, any>

export interface MiscMessageGenerationOptions {
    quoted?: WAMessage
    timestamp?: Date | number
    messageId?: string
    cachedGroupMetadata?: (jid: string) => Promise<GroupMetadata | undefined>
    font?: number
    textColor?: string
    backgroundColor?: string
    broadcast?: boolean
    statusJidList?: string[]
    [key: string]: any
}

export interface ConnectionState {
    connection: 'close' | 'open' | 'connecting'
    lastDisconnect?: {
        error?: Error | any
        date?: Date
    }
    isNewLogin?: boolean
    qr?: string
    receivedPendingNotifications?: boolean
    legacy?: any
    isOnline?: boolean
}

export interface WACallEvent {
    id: string
    from: string
    timestamp: number
    status: 'offer' | 'accept' | 'reject' | 'timeout' | 'terminate'
    isVideo?: boolean
    isGroup?: boolean
    [key: string]: any
}

export interface BaileysEventMap {
    'connection.update': Partial<ConnectionState>
    'creds.update': Partial<AuthenticationCreds>
    'messages.upsert': { messages: WAMessage[]; type: 'append' | 'notify'; [key: string]: any }
    'messages.update': Array<{ key: WAMessageKey; update: Partial<WAMessage> }>
    'message-receipt.update': Array<{ key: WAMessageKey; receipt: any }>
    'messages.reaction': Array<{ key: WAMessageKey; reaction: any }>
    'messages.delete': { keys: WAMessageKey[] } | { jid: string; all: true }
    'chats.upsert': any[]
    'chats.update': any[]
    'chats.delete': string[]
    'presence.update': { id: string; presences: Record<string, any> }
    'contacts.upsert': Contact[]
    'contacts.update': Partial<Contact>[]
    'group-participants.update': { id: string; author?: string; participants: string[]; action: 'add' | 'remove' | 'demote' | 'promote' }
    'call': WACallEvent[]
    [key: string]: any
}

export interface BaileysEventEmitter {
    on<T extends keyof BaileysEventMap>(event: T, listener: (arg: BaileysEventMap[T]) => void): this
    off<T extends keyof BaileysEventMap>(event: T, listener: (arg: BaileysEventMap[T]) => void): this
    removeAllListeners<T extends keyof BaileysEventMap>(event?: T): this
    emit<T extends keyof BaileysEventMap>(event: T, arg: BaileysEventMap[T]): boolean
    [key: string]: any
}
