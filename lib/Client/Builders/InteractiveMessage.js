"use strict"

Object.defineProperty(exports, "__esModule", { value: true })

const { ListButton } = require("./Lists")

/**
 * Fluent builder for Interactive WhatsApp Messages (Buttons, Cards, Menus, PIX)
 */
class InteractiveMessage {
    constructor() {
        this._title = ''
        this._subtitle = ''
        this._text = ''
        this._footer = ''
        this._header = null
        this._buttons = []
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
     * Sets subtitle or secondary header
     * @param {string} subtitle
     * @returns {this}
     */
    setSubtitle(subtitle) {
        this._subtitle = subtitle || ''
        return this
    }

    /**
     * Sets the main text body (required)
     * @param {string} text
     * @returns {this}
     */
    setText(text) {
        this._text = text || ''
        return this
    }

    /**
     * Sets smaller footer text at the bottom
     * @param {string} footer
     * @returns {this}
     */
    setFooter(footer) {
        this._footer = footer || ''
        return this
    }

    /**
     * Sets an image header for the interactive card
     * @param {string|Buffer|{ url: string }} image
     * @returns {this}
     */
    setHeaderImage(image) {
        this._header = {
            image: typeof image === 'string' ? { url: image } : image
        }
        return this
    }

    /**
     * Sets a video header for the interactive card
     * @param {string|Buffer|{ url: string }} video
     * @returns {this}
     */
    setHeaderVideo(video) {
        this._header = {
            video: typeof video === 'string' ? { url: video } : video
        }
        return this
    }

    /**
     * Adds an interactive button (QuickReply, Url, CopyCode, Call, Pix or ListButton)
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
     * Adds multiple buttons at once
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
     * Compiles the interactive message into a payload ready for sock.sendMessage()
     * @returns {Object}
     */
    build() {
        if (!this._text && !this._title) {
            throw new Error('InteractiveMessage requires at least a text or title.')
        }

        // Check if there is a ListButton
        const listBtn = this._buttons.find(b => b instanceof ListButton || b.sections)

        if (listBtn) {
            const builtList = typeof listBtn.build === 'function' ? listBtn.build() : listBtn
            return {
                text: this._text,
                title: this._title || undefined,
                subtitle: this._subtitle || undefined,
                footer: this._footer || undefined,
                buttonText: builtList.buttonText,
                sections: builtList.sections,
                ...(this._header || {})
            }
        }

        // Standard interactive buttons
        return {
            text: this._text,
            title: this._title || undefined,
            subtitle: this._subtitle || undefined,
            footer: this._footer || undefined,
            ...(this._header || {}),
            interactiveButtons: this._buttons.map(btn => (
                typeof btn.build === 'function' ? btn.build() : btn
            ))
        }
    }
}

exports.InteractiveMessage = InteractiveMessage
exports.default = InteractiveMessage
