"use strict"

Object.defineProperty(exports, "__esModule", { value: true })

const { JidNormalizer } = require("../Normalizers/JidNormalizer")

class BusinessManager {
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
     * Atualiza o perfil comercial da conta
     * @param {Object} profile
     */
    async updateBusinessProfile(profile) {
        const sock = this._getSock()
        if (!sock.updateBussinesProfile) {
            throw new Error('updateBussinesProfile indisponível no socket.')
        }
        return sock.updateBussinesProfile(profile)
    }

    /**
     * Alias para updateBusinessProfile
     * @param {Object} profile
     */
    async updateBussinesProfile(profile) {
        return this.updateBusinessProfile(profile)
    }

    /**
     * Atualiza ou define a foto de capa comercial da conta
     * @param {string|Buffer} pathOrBuffer
     */
    async updateCoverPhoto(pathOrBuffer) {
        const sock = this._getSock()
        if (!sock.updateCoverPhoto) {
            throw new Error('updateCoverPhoto indisponível no socket.')
        }
        return sock.updateCoverPhoto(pathOrBuffer)
    }

    /**
     * Remove a foto de capa comercial ativa
     * @param {string} coverPhotoId
     */
    async removeCoverPhoto(coverPhotoId) {
        const sock = this._getSock()
        if (!sock.removeCoverPhoto) {
            throw new Error('removeCoverPhoto indisponível no socket.')
        }
        return sock.removeCoverPhoto(coverPhotoId)
    }

    /**
     * Cria um produto no catálogo comercial
     * @param {Object} product
     * @param {string} product.name
     * @param {string} [product.description]
     * @param {number} product.price
     * @param {string} [product.currency='BRL']
     * @param {Array<string|Buffer>} [product.images=[]]
     * @param {string} [product.retailerId]
     * @param {string} [product.url]
     * @param {boolean} [product.isHidden=false]
     */
    async createProduct(product) {
        const sock = this._getSock()
        if (!sock.productCreate) {
            throw new Error('productCreate indisponível no socket.')
        }

        const formattedImages = (product.images || []).map(img => (
            typeof img === 'string' ? { url: img } : img
        ))

        const payload = {
            name: product.name,
            description: product.description || '',
            price: Math.round((Number(product.price) || 0) * 1000), // Preço em milésimos
            currency: product.currency || 'BRL',
            images: formattedImages,
            retailerId: product.retailerId || undefined,
            url: product.url || undefined,
            isHidden: Boolean(product.isHidden)
        }

        return sock.productCreate(payload)
    }

    /**
     * Atualiza dados de um produto existente no catálogo
     * @param {string} productId
     * @param {Object} update
     */
    async updateProduct(productId, update = {}) {
        const sock = this._getSock()
        if (!sock.productUpdate) {
            throw new Error('productUpdate indisponível no socket.')
        }

        const payload = { ...update }
        if (typeof update.price !== 'undefined') {
            payload.price = Math.round((Number(update.price) || 0) * 1000)
        }
        if (Array.isArray(update.images)) {
            payload.images = update.images.map(img => (
                typeof img === 'string' ? { url: img } : img
            ))
        }

        return sock.productUpdate(productId, payload)
    }

    /**
     * Exclui um ou mais produtos do catálogo
     * @param {string|string[]} productIds
     * @returns {Promise<{ deleted: number }>}
     */
    async deleteProduct(productIds) {
        const sock = this._getSock()
        if (!sock.productDelete) {
            throw new Error('productDelete indisponível no socket.')
        }
        const ids = Array.isArray(productIds) ? productIds : [productIds]
        return sock.productDelete(ids)
    }

    /**
     * Obtém detalhes de um produto específico
     * @param {string} productId
     * @param {string} [merchantJid] - JID da empresa (ou self se omitido)
     */
    async getProduct(productId, merchantJid) {
        const sock = this._getSock()
        if (!sock.getProduct) {
            throw new Error('getProduct indisponível no socket.')
        }
        const targetJid = merchantJid ? JidNormalizer.toJid(merchantJid) : undefined
        return sock.getProduct(targetJid, productId)
    }

    /**
     * Lista produtos do catálogo
     * @param {Object} [options={}]
     * @param {string} [options.jid] - JID do comerciante
     * @param {number} [options.limit=20]
     * @param {string} [options.cursor]
     */
    async getCatalog(options = {}) {
        const sock = this._getSock()
        if (!sock.getCatalog) {
            throw new Error('getCatalog indisponível no socket.')
        }
        const jid = options.jid ? JidNormalizer.toJid(options.jid) : undefined
        return sock.getCatalog({ ...options, jid })
    }

    /**
     * Lista coleções de produtos
     * @param {string} [merchantJid]
     * @param {number} [limit=20]
     */
    async getCollections(merchantJid, limit = 20) {
        const sock = this._getSock()
        if (!sock.getCollections) {
            throw new Error('getCollections indisponível no socket.')
        }
        const targetJid = merchantJid ? JidNormalizer.toJid(merchantJid) : undefined
        return sock.getCollections(targetJid, limit)
    }

    /**
     * Obtém os detalhes de um pedido de checkout
     * @param {string} orderId
     * @param {string} orderToken - Token base64 do pedido
     */
    async getOrderDetails(orderId, orderToken) {
        const sock = this._getSock()
        if (!sock.getOrderDetails) {
            throw new Error('getOrderDetails indisponível no socket.')
        }
        return sock.getOrderDetails(orderId, orderToken)
    }

    /** Alias compatível com UnityChat */
    async productCreate(product) {
        return this.createProduct(product)
    }

    /** Alias compatível com UnityChat */
    async productUpdate(productId, product) {
        return this.updateProduct(productId, product)
    }

    /** Alias compatível com UnityChat */
    async productDelete(productIds) {
        return this.deleteProduct(productIds)
    }
}

exports.BusinessManager = BusinessManager
exports.default = BusinessManager
