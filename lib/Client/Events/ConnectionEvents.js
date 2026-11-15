"use strict"

Object.defineProperty(exports, "__esModule", { value: true })

/**
 * Event emitted when connection status transitions between states
 */
class ConnectionStatusChange {
    constructor(current, previous) {
        this.current = current
        this.previous = previous
    }

    toString() {
        return JSON.stringify({ current: this.current, previous: this.previous })
    }

    toJSON() {
        return { current: this.current, previous: this.previous }
    }

    [Symbol.toPrimitive]() {
        return this.toString()
    }
}

/**
 * Event emitted when a QR code is generated for authentication
 */
class QrCodeEvent {
    constructor(qr) {
        this.qr = qr || ''
    }

    toString() {
        return this.qr
    }

    toJSON() {
        return { qr: this.qr }
    }

    [Symbol.toPrimitive]() {
        return this.qr
    }
}

/**
 * Event emitted when a 8-digit pairing code is received
 */
class PairingCodeEvent {
    constructor(code) {
        this.code = code || ''
    }

    toString() {
        return this.code
    }

    toJSON() {
        return { code: this.code }
    }

    [Symbol.toPrimitive]() {
        return this.code
    }
}

/**
 * Event emitted when client successfully authenticates and opens connection
 */
class ConnectedEvent {
    constructor(user) {
        this.user = user || {}
    }

    get name() {
        return this.user?.name || this.user?.notify || 'WhatsApp User'
    }

    get id() {
        return this.user?.id || ''
    }

    toString() {
        return `[Connected: ${this.name} (${this.id})]`
    }

    toJSON() {
        return { user: this.user }
    }

    [Symbol.toPrimitive]() {
        return this.toString()
    }
}

/**
 * Event emitted when connection drops or closes
 */
class DisconnectedEvent {
    constructor(options = {}) {
        this.error = options.error || null
        this.willReconnect = Boolean(options.willReconnect)
        this.attempt = options.attempt || 0
        this.delayMs = options.delayMs || 0
        this.reason = options.reason || options.error?.message || 'Connection closed'
    }

    toString() {
        const reconnectInfo = this.willReconnect
            ? `Reconnecting attempt ${this.attempt} in ${this.delayMs}ms`
            : 'No reconnect'
        return `[Disconnected: ${this.reason} (${reconnectInfo})]`
    }

    toJSON() {
        return {
            error: this.error ? { message: this.error.message, stack: this.error.stack } : null,
            willReconnect: this.willReconnect,
            attempt: this.attempt,
            delayMs: this.delayMs,
            reason: this.reason
        }
    }

    [Symbol.toPrimitive]() {
        return this.toString()
    }
}

/**
 * Event emitted when device session is permanently logged out
 */
class LoggedOutEvent {
    constructor(error) {
        this.error = error || null
    }

    toString() {
        return '[LoggedOut: Session logged out on WhatsApp device]'
    }

    toJSON() {
        return { error: this.error ? { message: this.error.message } : null }
    }

    [Symbol.toPrimitive]() {
        return this.toString()
    }
}

/**
 * Event emitted when one or more messages are deleted/revoked
 */
class MessageDeleteEvent {
    constructor(keys) {
        this.keys = Array.isArray(keys) ? keys : [keys].filter(Boolean)
    }

    get ids() {
        return this.keys.map(k => k?.id || k).filter(Boolean)
    }

    toString() {
        return `[MessageDelete: ${this.ids.join(', ')}]`
    }

    toJSON() {
        return { keys: this.keys }
    }

    [Symbol.toPrimitive]() {
        return this.toString()
    }
}

/**
 * Event emitted when participants in a group are added, removed, promoted or demoted
 */
class GroupParticipantsUpdateEvent {
    constructor(update = {}) {
        this.id = update.id || ''
        this.participants = update.participants || []
        this.action = update.action || 'update'
    }

    toString() {
        return `[GroupParticipantsUpdate ${this.action}: ${this.participants.join(', ')} in ${this.id}]`
    }

    toJSON() {
        return { id: this.id, participants: this.participants, action: this.action }
    }

    [Symbol.toPrimitive]() {
        return this.toString()
    }
}

/**
 * Event emitted on contact or group presence status updates
 */
class PresenceUpdateEvent {
    constructor(presence = {}) {
        this.id = presence.id || ''
        this.presences = presence.presences || {}
    }

    toString() {
        const keys = Object.keys(this.presences)
        const summary = keys.length
            ? keys.map(k => `${k}:${this.presences[k]?.lastKnownPresence || 'active'}`).join(', ')
            : 'active'
        return `[PresenceUpdate ${this.id}: ${summary}]`
    }

    toJSON() {
        return { id: this.id, presences: this.presences }
    }

    [Symbol.toPrimitive]() {
        return this.toString()
    }
}

exports.ConnectionStatusChange = ConnectionStatusChange
exports.QrCodeEvent = QrCodeEvent
exports.PairingCodeEvent = PairingCodeEvent
exports.ConnectedEvent = ConnectedEvent
exports.DisconnectedEvent = DisconnectedEvent
exports.LoggedOutEvent = LoggedOutEvent
exports.MessageDeleteEvent = MessageDeleteEvent
exports.GroupParticipantsUpdateEvent = GroupParticipantsUpdateEvent
exports.PresenceUpdateEvent = PresenceUpdateEvent
