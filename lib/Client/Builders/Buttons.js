"use strict"

Object.defineProperty(exports, "__esModule", { value: true })

/**
 * Quick Reply Button - user clicks and sends a predetermined text/id response
 */
class QuickReplyButton {
    constructor(displayText, id) {
        this.displayText = displayText || ''
        this.id = id || displayText || 'quick_reply'
    }

    build() {
        return {
            name: 'quick_reply',
            buttonParamsJson: JSON.stringify({
                display_text: this.displayText,
                id: this.id
            })
        }
    }
}

/**
 * URL Button - user clicks and opens a webpage
 */
class UrlButton {
    constructor(displayText, url, merchantUrl) {
        this.displayText = displayText || ''
        this.url = url || ''
        this.merchantUrl = merchantUrl || url || ''
    }

    build() {
        return {
            name: 'cta_url',
            buttonParamsJson: JSON.stringify({
                display_text: this.displayText,
                url: this.url,
                merchant_url: this.merchantUrl
            })
        }
    }
}

/**
 * Copy Code Button - user clicks to copy a coupon/token to clipboard
 */
class CopyCodeButton {
    constructor(displayText, copyCode, id) {
        this.displayText = displayText || ''
        this.copyCode = copyCode || ''
        this.id = id || 'copy_code'
    }

    build() {
        return {
            name: 'cta_copy',
            buttonParamsJson: JSON.stringify({
                display_text: this.displayText,
                id: this.id,
                copy_code: this.copyCode
            })
        }
    }
}

/**
 * Call Button - user clicks to initiate a standard voice call
 */
class CallButton {
    constructor(displayText, phoneNumber) {
        this.displayText = displayText || ''
        this.phoneNumber = phoneNumber || ''
    }

    build() {
        return {
            name: 'cta_call',
            buttonParamsJson: JSON.stringify({
                display_text: this.displayText,
                phone_number: this.phoneNumber
            })
        }
    }
}

/**
 * Native PIX Payment Button (WhatsApp Payment Info)
 */
class PixButton {
    /**
     * @param {string} displayText - Text displayed on button (e.g., 'Pagar com PIX')
     * @param {string} pixKey - Chave PIX (CPF/CNPJ, Email, Telefone ou EVP)
     * @param {string} [keyType='CPF'] - Tipo da chave: 'CPF', 'EMAIL', 'PHONE', 'EVP'
     * @param {string} [merchantName='Comerciante'] - Nome do beneficiário exibido
     */
    constructor(displayText, pixKey, keyType = 'CPF', merchantName = 'Comerciante') {
        this.displayText = displayText || 'Pagar via PIX'
        this.pixKey = pixKey || ''
        this.keyType = (keyType || 'CPF').toUpperCase()
        this.merchantName = merchantName || 'Comerciante'
    }

    build() {
        return {
            name: 'payment_info',
            buttonParamsJson: JSON.stringify({
                payment_settings: [{
                    type: 'pix_static_code',
                    pix_static_code: {
                        merchant_name: this.merchantName,
                        key: this.pixKey,
                        key_type: this.keyType
                    }
                }]
            })
        }
    }
}

exports.QuickReplyButton = QuickReplyButton
exports.UrlButton = UrlButton
exports.CopyCodeButton = CopyCodeButton
exports.CallButton = CallButton
exports.PixButton = PixButton
