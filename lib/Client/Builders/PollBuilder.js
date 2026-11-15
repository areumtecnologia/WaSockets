"use strict"

Object.defineProperty(exports, "__esModule", { value: true })

/**
 * Fluent builder for WhatsApp Polls
 */
class PollBuilder {
    constructor() {
        this._name = ''
        this._options = []
        this._selectableCount = 1
    }

    /**
     * Sets poll question / title
     * @param {string} name
     * @returns {this}
     */
    setName(name) {
        this._name = name || ''
        return this
    }

    /**
     * Adds an option to the poll
     * @param {string} option
     * @returns {this}
     */
    addOption(option) {
        if (option && typeof option === 'string') {
            this._options.push(option.trim())
        }
        return this
    }

    /**
     * Adds multiple options to the poll
     * @param {Array<string>} options
     * @returns {this}
     */
    addOptions(options) {
        if (Array.isArray(options)) {
            for (const opt of options) {
                this.addOption(opt)
            }
        }
        return this
    }

    /**
     * Sets how many options can be selected (1 for single choice, > 1 for multiple choices)
     * @param {number} count
     * @returns {this}
     */
    setSelectableCount(count) {
        this._selectableCount = Math.max(1, Number(count) || 1)
        return this
    }

    /**
     * Compiles poll into a payload for sendMessage()
     * @returns {Object}
     */
    build() {
        if (!this._name) {
            throw new Error('PollBuilder requires a question name via setName().')
        }
        if (this._options.length < 2) {
            throw new Error('PollBuilder requires at least 2 options.')
        }

        return {
            poll: {
                name: this._name,
                values: this._options,
                selectableCount: this._selectableCount
            }
        }
    }
}

exports.PollBuilder = PollBuilder
exports.default = PollBuilder
