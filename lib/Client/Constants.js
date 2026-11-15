"use strict"

Object.defineProperty(exports, "__esModule", { value: true })

/**
 * High-level semantic event names for WaClient
 */
const Events = Object.freeze({
    // Connection Lifecycle
    STATUS_CHANGE: 'status.change',
    QR_CODE: 'qr',
    PAIRING_CODE: 'pairing.code',
    CONNECTED: 'connected',
    DISCONNECTED: 'disconnected',
    LOGGED_OUT: 'logged.out',

    // Messages
    MESSAGE_RECEIVED: 'message.received',
    MESSAGE_SENT: 'message.sent',
    MESSAGE_UPDATE: 'message.update',
    MESSAGE_DELETE: 'message.delete',

    // Presence & Contacts
    PRESENCE_UPDATE: 'presence.update',
    CONTACTS_UPSERT: 'contacts.upsert',

    // VoIP & Calls
    CALL_INCOMING: 'call.incoming',
    CALL_STATUS: 'call.status',

    // Group & Community Events
    GROUP_PARTICIPANTS_UPDATE: 'group.participants.update',

    // Generic Error
    ERROR: 'error'
})

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

exports.Events = Events
exports.ConnectionStatus = ConnectionStatus
