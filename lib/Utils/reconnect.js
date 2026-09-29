"use strict"

Object.defineProperty(exports, "__esModule", { value: true })

const { DisconnectReason } = require("../Types")

/**
 * Categorizes an error or status code into reconnectable vs fatal
 */
const shouldReconnect = (error) => {
    const statusCode = error?.output?.statusCode || error?.statusCode || error?.status || error
    
    // Non-recoverable fatal errors (user logged out or account unlinked)
    if (
        statusCode === DisconnectReason.loggedOut ||
        statusCode === DisconnectReason.multideviceMismatch ||
        statusCode === DisconnectReason.forbidden
    ) {
        return false
    }
    
    return true
}

/**
 * Calculate exponential backoff delay with full jitter
 * @param {number} attempt Attempt count (0-indexed or 1-indexed)
 * @param {object} options Configuration options
 */
const getReconnectDelay = (attempt = 0, options = {}) => {
    const {
        baseDelayMs = 1000,
        maxDelayMs = 45000,
        factor = 1.8,
        jitter = true,
        statusCode
    } = options

    // Special case for WhatsApp restartRequired (515) - fast restart
    if (statusCode === DisconnectReason.restartRequired) {
        return Math.floor(Math.random() * 500) + 250 // 250-750ms
    }

    const calculatedDelay = Math.min(maxDelayMs, baseDelayMs * Math.pow(factor, Math.max(0, attempt)))
    
    if (jitter) {
        // Decorrelated jitter: uniformly distributed between 50% and 100% of calculated backoff
        const minJitter = calculatedDelay * 0.5
        const randomSpread = Math.random() * (calculatedDelay - minJitter)
        return Math.floor(minJitter + randomSpread)
    }

    return Math.floor(calculatedDelay)
}

/**
 * Creates an Adaptive Reconnection Manager instance
 */
const makeReconnectManager = (config = {}) => {
    const {
        logger,
        maxAttempts = 15,
        baseDelayMs = 1000,
        maxDelayMs = 45000,
        onReconnect
    } = config

    let attempts = 0
    let reconnectTimeout = null
    let isReconnecting = false

    const reset = () => {
        attempts = 0
        isReconnecting = false
        if (reconnectTimeout) {
            clearTimeout(reconnectTimeout)
            reconnectTimeout = null
        }
    }

    const handleDisconnect = async (error) => {
        const canReconnect = shouldReconnect(error)
        const statusCode = error?.output?.statusCode || error?.statusCode || error?.status

        if (!canReconnect) {
            logger?.info({ statusCode }, 'reconnection skipped: fatal disconnect reason')
            reset()
            return false
        }

        if (attempts >= maxAttempts) {
            logger?.warn({ attempts, maxAttempts }, 'maximum reconnection attempts reached')
            reset()
            return false
        }

        attempts++
        const delay = getReconnectDelay(attempts, { baseDelayMs, maxDelayMs, statusCode })
        logger?.info({ attempt: attempts, delay, statusCode }, 'scheduling adaptive reconnection')

        isReconnecting = true
        if (reconnectTimeout) {
            clearTimeout(reconnectTimeout)
        }

        return new Promise((resolve) => {
            reconnectTimeout = setTimeout(async () => {
                reconnectTimeout = null
                try {
                    if (typeof onReconnect === 'function') {
                        await onReconnect(attempts)
                    }
                    resolve(true)
                } catch (err) {
                    logger?.error({ err }, 'error during reconnection callback')
                    resolve(false)
                }
            }, delay)
        })
    }

    return {
        get attempts() { return attempts },
        get isReconnecting() { return isReconnecting },
        shouldReconnect,
        getReconnectDelay,
        handleDisconnect,
        reset
    }
}

module.exports = {
    shouldReconnect,
    getReconnectDelay,
    makeReconnectManager
}
