"use strict"

Object.defineProperty(exports, "__esModule", { value: true })

const { JidNormalizer } = require("../Normalizers/JidNormalizer")

/**
 * Gerencia o envio e exclusão de publicações de Stories (Status) no WhatsApp.
 */
class StoriesManager {
    /**
     * @param {import('../WaClient').WaClient} client
     */
    constructor(client) {
        this.client = client
    }

    _getSock() {
        if (!this.client.sock) {
            throw new Error('Socket is not connected.')
        }
        return this.client.sock
    }

    /**
     * Envia uma publicação de Stories (Status) para uma lista de destinatários.
     * @param {string[]} jids - Lista de JIDs ou números que receberão ou serão mencionados nos stories.
     * @param {Object} content - Conteúdo da mensagem (texto, imagem, vídeo, etc.).
     * @param {Object} [options={}] - Opções adicionais (`sendMentions`, `backgroundColor`, `font`).
     */
    async send(jids, content, options = {}) {
        const sock = this._getSock()
        if (!Array.isArray(jids)) {
            throw new Error('jids must be an array of JIDs')
        }

        const targetJids = jids.map(JidNormalizer.toJid)
        const {
            sendMentions = false,
            backgroundColor = '#288d7c85',
            font = 1,
            ...restOptions
        } = options

        if (sendMentions) {
            const contentFinal = {
                ...content,
                backgroundColor,
                font,
                ...restOptions
            }
            return sock.sendStatusMentions(contentFinal, targetJids)
        }

        return sock.sendMessage('status@broadcast', content, {
            ...restOptions,
            broadcast: true,
            backgroundColor,
            font,
            statusJidList: targetJids
        })
    }

    /**
     * Exclui uma publicação de Stories enviada anteriormente.
     * @param {Object} msgKey - Chave da mensagem (`proto.IMessageKey`), mensagem bruta ou `MessageContext`.
     */
    async delete(msgKey) {
        const sock = this._getSock()
        const key = msgKey?.raw?.key || msgKey?.key || msgKey
        return sock.sendMessage('status@broadcast', { delete: key })
    }
}

exports.StoriesManager = StoriesManager
exports.default = StoriesManager
