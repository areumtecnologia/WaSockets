"use strict"

Object.defineProperty(exports, "__esModule", { value: true })

/**
 * Fluent builder for a single card inside a WhatsApp Carousel message
 */
class CardBuilder {
    constructor() {
        this._media = null
        this._title = ''
        this._body = ''
        this._footer = ''
        this._buttons = []
    }

    /**
     * Sets card header image
     * @param {string|Buffer|{ url: string }} image
     * @returns {this}
     */
    setImage(image) {
        this._media = {
            image: typeof image === 'string' ? { url: image } : image
        }
        return this
    }

    /**
     * Sets card header video
     * @param {string|Buffer|{ url: string }} video
     * @returns {this}
     */
    setVideo(video) {
        this._media = {
            video: typeof video === 'string' ? { url: video } : video
        }
        return this
    }

    /**
     * Sets card title
     * @param {string} title
     * @returns {this}
     */
    setTitle(title) {
        this._title = title || ''
        return this
    }

    /**
     * Sets card body text
     * @param {string} body
     * @returns {this}
     */
    setBody(body) {
        this._body = body || ''
        return this
    }

    /**
     * Sets card footer text
     * @param {string} footer
     * @returns {this}
     */
    setFooter(footer) {
        this._footer = footer || ''
        return this
    }

    /**
     * Adds an interactive button to the card
     * @param {Object} button
     * @returns {this}
     */
    addButton(button) {
        if (button) {
            this._buttons.push(button)
        }
        return this
    }

    /**
     * Adds multiple buttons to the card
     * @param {Array<Object>} buttons
     * @returns {this}
     */
    addButtons(buttons) {
        if (Array.isArray(buttons)) {
            for (const b of buttons) {
                this.addButton(b)
            }
        }
        return this
    }

    /**
     * Builds the card object expected by lib/Utils/messages.js
     * @returns {Object}
     */
    build() {
        const buttons = this._buttons.map(btn => (
            typeof btn.build === 'function' ? btn.build() : btn
        ))

        return {
            ...(this._media || {}),
            title: this._title || undefined,
            body: this._body || undefined,
            footer: this._footer || undefined,
            buttons
        }
    }
}

/**
 * Fluent builder for WhatsApp Carousel (cards) messages
 */
class CarouselBuilder {
    constructor() {
        this._title = ''
        this._subtitle = ''
        this._text = ''
        this._footer = ''
        this._cards = []
    }

    setTitle(title) {
        this._title = title || ''
        return this
    }

    setSubtitle(subtitle) {
        this._subtitle = subtitle || ''
        return this
    }

    setText(text) {
        this._text = text || ''
        return this
    }

    setFooter(footer) {
        this._footer = footer || ''
        return this
    }

    /**
     * Adds a CardBuilder or raw card object
     * @param {CardBuilder|Object} card
     * @returns {this}
     */
    addCard(card) {
        if (card) {
            this._cards.push(card)
        }
        return this
    }

    /**
     * Adds multiple cards
     * @param {Array<CardBuilder|Object>} cards
     * @returns {this}
     */
    addCards(cards) {
        if (Array.isArray(cards)) {
            for (const c of cards) {
                this.addCard(c)
            }
        }
        return this
    }

    /**
     * Compiles the carousel payload ready for client.sendInteractive() / sock.sendMessage()
     * @returns {Object}
     */
    build() {
        const cards = this._cards.map(c => (
            typeof c.build === 'function' ? c.build() : c
        ))

        return {
            text: this._text || '',
            title: this._title || undefined,
            subtitle: this._subtitle || undefined,
            footer: this._footer || undefined,
            cards
        }
    }
}

exports.CardBuilder = CardBuilder
exports.CarouselBuilder = CarouselBuilder
exports.default = CarouselBuilder
