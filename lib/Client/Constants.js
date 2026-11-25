"use strict"

Object.defineProperty(exports, "__esModule", { value: true })

/**
 * High-level semantic event names for WaClient
 */
const Events = Object.freeze({
    // Connection Lifecycle
    INIT: 'init',
    CONNECTING: 'connecting',
    STATUS_CHANGE: 'status.change',
    QR_CODE: 'qr',
    PAIRING_CODE: 'pairing.code',
    PAIRING_SUCCESS: 'pairing.success',
    CONNECTED: 'connected',
    DISCONNECTED: 'disconnected',
    LOGGED_OUT: 'logged.out',

    // Messages
    MESSAGE_RECEIVED: 'message.received',
    MESSAGE_SENT: 'message.sent',
    MESSAGE_UPDATE: 'message.update',
    MESSAGE_DELETE: 'message.delete',
    MESSAGE_REACTION: 'message.reaction',
    BROADCAST_MESSAGE: 'message.broadcast',
    NOTIFICATION: 'notification',
    HISTORY_SYNC: 'history.sync',
    MESSAGES_HISTORY_SYNC_DONE: 'history.sync',

    // Presence & Contacts
    PRESENCE_UPDATE: 'presence.update',
    CONTACTS_UPSERT: 'contacts.upsert',
    CONTACTS_UPDATE: 'contacts.update',
    BLOCKLIST_UPDATE: 'blocklist.update',

    // VoIP & Calls
    CALL_INCOMING: 'call.incoming',
    CALL: 'call.incoming',
    CALL_STATUS: 'call.status',

    // Calendar Events & RSVP
    EVENT_RESPONSE: 'event.response',

    // Group & Community Events
    GROUP_PARTICIPANTS_UPDATE: 'group.participants.update',
    GROUP_UPDATE: 'group.update',
    GROUPS_UPDATE: 'group.update',
    GROUP_UPSERT: 'group.upsert',
    GROUPS_UPSERT: 'group.upsert',
    GROUP_MEMBER_TAG_UPDATE: 'group.member_tag.update',

    // Chats
    CHAT_UPDATE: 'chat.update',
    CHAT_DELETE: 'chat.delete',

    // Generic Error
    ERROR: 'error'
})

/**
 * Translation map for direct backward compatibility with @areumtecnologia/unitychat.
 * Key: Canonical event (modern WaClient) -> Value: Array of legacy aliases
 */
const CanonicalToLegacyMap = Object.freeze({
    'status.change': ['status_change'],
    'qr': ['pairing_code'], // UnityChat emitted QR on 'pairing_code'
    'pairing.success': ['pairing_success'],
    'message.received': ['message_received'],
    'message.sent': ['message_sent'],
    'message.update': ['message_update'],
    'message.delete': ['message_delete'],
    'message.reaction': ['message_reaction'],
    'event.response': ['event_response'],
    'message.broadcast': ['broadcast_message'],
    'presence.update': ['presence_update'],
    'contacts.upsert': ['contacts_upsert'],
    'contacts.update': ['contacts_update'],
    'group.participants.update': ['group_participants_update'],
    'group.update': ['GROUPS_UPDATE', 'group_update'],
    'group.upsert': ['GROUPS_UPSERT', 'group_upsert'],
    'group.member_tag.update': ['group_member_tag_update'],
    'blocklist.update': ['blocklist_update'],
    'call.incoming': ['call', 'incoming_call'],
    'chat.update': ['chat_update'],
    'chat.delete': ['chat_delete'],
    'history.sync': ['messages_history_sync_done']
})

// Fast reverse lookup map
const LegacyToCanonicalMap = Object.freeze(
    Object.entries(CanonicalToLegacyMap).reduce((acc, [canon, legals]) => {
        legals.forEach(leg => acc[leg] = canon)
        return acc
    }, {})
)

/**
 * Connection states for WaClient state machine
 */
const ConnectionStatus = Object.freeze({
    IDLE: 'idle',
    INITIALIZING: 'initializing',
    CONNECTING: 'connecting',
    QR_READY: 'qr_ready',
    PAIRING_READY: 'pairing_ready',
    CONNECTED: 'connected',
    RECONNECTING: 'reconnecting',
    LOGGED_OUT: 'logged_out',
    DISCONNECTED: 'disconnected'
})

/**
 * Presence states compatible with UnityChat
 */
const PresenceStatus = Object.freeze({
    AVAILABLE: 'available',
    UNAVAILABLE: 'unavailable',
    COMPOSING: 'composing',
    RECORDING: 'recording',
    PAUSED: 'paused'
})

/**
 * Session status enum compatible with UnityChat
 */
const SessionStatus = Object.freeze({
    CONNECTING: 'connecting',
    PAIRING_CODE: 'pairing_code',
    PAIRING_SUCCESS: 'pairing_success',
    PAIRING_FAILED: 'pairing_failed',
    LOGGED_OUT: 'logged_out',
    CONNECTED: 'connected',
    DISCONNECTED: 'disconnected'
})

/**
 * Disconnect reasons compatible with UnityChat
 */
const DisconnectReasons = Object.freeze({
    MANUAL_DISCONNECT: 'manual_disconnect',
    LOGGED_OUT: 'logged_out',
    PAIRING_FAILED: 'pairing_failed',
    CONNECTION_ERROR: 'connection_error',
    RESTART_REQUIRED: 'restart_required',
    UNAVAILABLE_SERVICE: 'unavailable_service',
    UNKNOWN: 'unknown',
    QR_READ_ATTEMPTS_ENDED: 'qr_read_attempts_ended',
    BAD_SESSION: 'bad_session',
    CONNECTION_LOST: 'connection_lost',
    CONNECTION_CLOSED: 'connection_closed',
    CONNECTION_REPLACED: 'connection_replaced',
    MULTIDEVICE_MISMATCH: 'multidevice_mismatch',
    TIMED_OUT: 'timed_out',
    UNAUTHORIZED: 'unauthorized'
})

exports.Events = Events
exports.ConnectionStatus = ConnectionStatus
exports.CanonicalToLegacyMap = CanonicalToLegacyMap
exports.LegacyToCanonicalMap = LegacyToCanonicalMap
exports.PresenceStatus = PresenceStatus
exports.SessionStatus = SessionStatus
exports.DisconnectReasons = DisconnectReasons
