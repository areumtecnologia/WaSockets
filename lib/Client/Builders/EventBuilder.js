"use strict"

Object.defineProperty(exports, "__esModule", { value: true })

/**
 * Fluent builder for WhatsApp Calendar / Group Event Messages
 */
class EventBuilder {
    constructor() {
        this._name = ''
        this._description = ''
        this._startTime = null
        this._endTime = null
        this._location = null
        this._call = null
    }

    /**
     * Sets event title
     * @param {string} name
     * @returns {this}
     */
    setName(name) {
        this._name = name || ''
        return this
    }

    /**
     * Sets event description
     * @param {string} description
     * @returns {this}
     */
    setDescription(description) {
        this._description = description || ''
        return this
    }

    /**
     * Sets start time as Date, timestamp in seconds or milliseconds
     * @param {Date|number} date
     * @returns {this}
     */
    setStartDate(date) {
        if (date instanceof Date) {
            this._startTime = Math.floor(date.getTime() / 1000)
        } else if (typeof date === 'number') {
            this._startTime = date > 10000000000 ? Math.floor(date / 1000) : Math.floor(date)
        }
        return this
    }

    /**
     * Sets end time as Date, timestamp in seconds or milliseconds
     * @param {Date|number} date
     * @returns {this}
     */
    setEndDate(date) {
        if (date instanceof Date) {
            this._endTime = Math.floor(date.getTime() / 1000)
        } else if (typeof date === 'number') {
            this._endTime = date > 10000000000 ? Math.floor(date / 1000) : Math.floor(date)
        }
        return this
    }

    /**
     * Sets event location
     * @param {string} name - Location name
     * @param {number} [degreesLatitude]
     * @param {number} [degreesLongitude]
     * @returns {this}
     */
    setLocation(name, degreesLatitude, degreesLongitude) {
        this._location = {
            name: name || '',
            degreesLatitude: degreesLatitude || 0,
            degreesLongitude: degreesLongitude || 0
        }
        return this
    }

    /**
     * Sets WhatsApp voice or video call for the event
     * @param {'voice'|'video'|1|2} callType
     * @returns {this}
     */
    setCall(callType = 'voice') {
        this._call = {
            callType: callType === 'video' || callType === 2 ? 2 : 1
        }
        return this
    }

    /**
     * Compiles event into a payload ready for sendMessage()
     * @returns {Object}
     */
    build() {
        if (!this._name) {
            throw new Error('EventBuilder requires an event title via setName().')
        }

        const nowSec = Math.floor(Date.now() / 1000)
        const startTime = this._startTime || (nowSec + 3600) // Default 1 hour from now

        const eventPayload = {
            name: this._name,
            description: this._description || undefined,
            startTime,
            endTime: this._endTime || undefined,
            location: this._location || undefined,
            call: this._call || undefined
        }

        return {
            event: eventPayload
        }
    }
}

exports.EventBuilder = EventBuilder
exports.default = EventBuilder
