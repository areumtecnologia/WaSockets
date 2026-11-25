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
    constructor(displayText, url, merchantUrl, webviewInteraction = false) {
        this.displayText = displayText || ''
        this.url = url || ''
        this.merchantUrl = merchantUrl || url || ''
        this.webviewInteraction = Boolean(webviewInteraction)
    }

    build() {
        const params = {
            display_text: this.displayText,
            url: this.url,
            merchant_url: this.merchantUrl
        }
        if (this.webviewInteraction) {
            params.webview_interaction = true
        }
        return {
            name: 'cta_url',
            buttonParamsJson: JSON.stringify(params)
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
     * @param {string} displayText - Text displayed on button (ou merchantName na assinatura de 3 argumentos da UnityChat)
     * @param {string} pixKey - Chave PIX (CPF/CNPJ, Email, Telefone ou EVP)
     * @param {string} [keyType='CPF'] - Tipo da chave: 'CPF', 'EMAIL', 'PHONE', 'EVP'
     * @param {string} [merchantName] - Nome do beneficiário exibido (se omitido, usa o 1º argumento para compatibilidade UnityChat)
     */
    constructor(displayText, pixKey, keyType = 'CPF', merchantName) {
        this.displayText = displayText || 'Pagar via PIX'
        this.pixKey = pixKey || ''
        this.keyType = (keyType || 'CPF').toUpperCase()
        this.merchantName = merchantName !== undefined ? (merchantName || 'Comerciante') : (displayText || 'Comerciante')
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

/**
 * Location Button - user clicks to share their location
 */
class LocationButton {
    /**
     * @param {string} [displayText='Share Location'] - Text displayed on button
     */
    constructor(displayText = 'Share Location') {
        this.displayText = displayText || 'Share Location'
    }

    build() {
        return {
            name: 'send_location',
            buttonParamsJson: JSON.stringify({
                display_text: this.displayText
            })
        }
    }
}

/**
 * Checkout / Review & Pay Button
 */
class CheckoutButton {
    /**
     * @param {Object} data - Order and payment details
     */
    constructor(data = {}) {
        this.data = data || {}
    }

    build() {
        return {
            name: 'review_and_pay',
            buttonParamsJson: JSON.stringify({
                currency: this.data.currency || 'BRL',
                payment_type: this.data.paymentType || 'physical-goods',
                total_amount: this.data.totalAmount,
                reference_id: this.data.referenceId,
                payment_method: this.data.paymentMethod || 'confirm',
                payment_status: this.data.paymentStatus || 'captured',
                payment_timestamp: this.data.paymentTimestamp || Math.floor(Date.now() / 1000),
                order: {
                    status: this.data.orderStatus || 'completed',
                    order_type: this.data.orderType || 'PAYMENT_REQUEST',
                    subtotal: this.data.subtotal || this.data.totalAmount,
                    items: this.data.items || []
                },
                additional_note: this.data.additionalNote || ''
            })
        }
    }
}

/**
 * Webview Button - opens a URL in WhatsApp in-app webview
 */
class WebviewButton {
    /**
     * @param {string} displayText - Text displayed on button
     * @param {string} url - URL to open
     * @param {boolean} [inAppWebview=true] - Whether to open inside in-app webview
     */
    constructor(displayText, url, inAppWebview = true) {
        this.displayText = displayText || ''
        this.url = url || ''
        this.inAppWebview = Boolean(inAppWebview)
    }

    build() {
        return {
            name: 'open_webview',
            buttonParamsJson: JSON.stringify({
                title: this.displayText,
                link: {
                    in_app_webview: this.inAppWebview,
                    url: this.url
                }
            })
        }
    }
}

/**
 * WhatsApp Voice Call Button (`voice_call`)
 */
class VoiceCallButton {
    /**
     * @param {string} [displayText='Ligar no WhatsApp'] - Text displayed on button
     */
    constructor(displayText = 'Ligar no WhatsApp') {
        this.displayText = displayText || 'Ligar no WhatsApp'
    }

    build() {
        return {
            name: 'voice_call',
            buttonParamsJson: JSON.stringify({
                display_text: this.displayText
            })
        }
    }
}

/**
 * WhatsApp Flow Button (`flow`)
 */
class FlowButton {
    /**
     * @param {Object} data - Flow parameters (`flowId`, `flowCta`, `flowToken`, `flowAction`, `flowActionPayload`, `flowMessageVersion`, `mode`)
     */
    constructor(data = {}) {
        this.data = data || {}
    }

    build() {
        const params = {
            flow_message_version: this.data.flowMessageVersion || this.data.flow_message_version || '3',
            flow_token: this.data.flowToken || this.data.flow_token || 'unused',
            flow_id: this.data.flowId || this.data.flow_id || '',
            flow_cta: this.data.flowCta || this.data.flow_cta || 'Abrir',
            flow_action: this.data.flowAction || this.data.flow_action || 'navigate',
            ...(this.data.flowActionPayload || this.data.flow_action_payload
                ? { flow_action_payload: this.data.flowActionPayload || this.data.flow_action_payload }
                : {}),
            ...(this.data.mode ? { mode: this.data.mode } : {})
        }
        return {
            name: 'flow',
            buttonParamsJson: JSON.stringify(params)
        }
    }
}

exports.QuickReplyButton = QuickReplyButton
exports.UrlButton = UrlButton
exports.CopyCodeButton = CopyCodeButton
exports.CallButton = CallButton
exports.PixButton = PixButton
exports.LocationButton = LocationButton
exports.CheckoutButton = CheckoutButton
exports.WebviewButton = WebviewButton
exports.VoiceCallButton = VoiceCallButton
exports.FlowButton = FlowButton
