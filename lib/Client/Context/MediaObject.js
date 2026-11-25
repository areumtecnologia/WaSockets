"use strict"

Object.defineProperty(exports, "__esModule", { value: true })

const { promises: fsPromises } = require("fs")
const { dirname } = require("path")
const { downloadContentFromMessage } = require("../../Utils/messages-media")

class MediaObject {
    /**
     * @param {Object} mediaNode - Raw protobuf media node (imageMessage, videoMessage, etc.)
     * @param {string} canonicalType - Canonical message type ('image', 'video', 'voice', 'audio', 'document', 'sticker')
     */
    constructor(mediaNode, canonicalType) {
        this.mediaNode = mediaNode || {}
        this.rawType = canonicalType || 'unknown'
        this.mediaType = this._resolveMediaType(canonicalType)

        this.mimetype = this.mediaNode.mimetype || this._defaultMimetype(this.mediaType)
        this.fileLength = Number(this.mediaNode.fileLength || 0)
        this.fileName = this.mediaNode.fileName || ''
        this.caption = this.mediaNode.caption || ''
        this.seconds = Number(this.mediaNode.seconds || 0)
        this.duration = this.seconds || null

        this.isVoice = Boolean(this.mediaNode.ptt)
        this.isPtt = this.isVoice
        this.isGif = Boolean(this.mediaNode.gifPlayback)
        this.isViewOnce = Boolean(this.mediaNode.viewOnce)
        this.isAnimated = Boolean(this.mediaNode.gifPlayback || this.mediaNode.isAnimated)
        this.extension = this._inferExtension()

        this._bufferCache = null
    }

    _resolveMediaType(type) {
        if (type === 'voice' || type === 'audio') return 'audio'
        if (type === 'gif' || type === 'video') return 'video'
        if (type === 'image') return 'image'
        if (type === 'sticker') return 'sticker'
        if (type === 'document') return 'document'
        return 'document'
    }

    _defaultMimetype(mediaType) {
        switch (mediaType) {
            case 'image': return 'image/jpeg'
            case 'video': return 'video/mp4'
            case 'audio': return 'audio/ogg; codecs=opus'
            case 'sticker': return 'image/webp'
            default: return 'application/octet-stream'
        }
    }

    _inferExtension() {
        if (this.fileName && this.fileName.includes('.')) {
            const ext = this.fileName.split('.').pop()
            if (ext) return ext.toLowerCase()
        }
        if (!this.mimetype) return 'bin'

        const base = this.mimetype.split(';')[0].trim().toLowerCase()
        const sub = base.split('/')[1] || 'bin'

        if (sub === 'jpeg') return 'jpg'
        if (sub.includes('ogg') || sub.includes('opus')) return 'ogg'
        if (sub === 'pdf') return 'pdf'
        if (sub === 'webp') return 'webp'
        if (sub === 'mp4') return 'mp4'
        if (sub === 'mpeg') return 'mp3'

        return sub.replace(/[^a-z0-9]/gi, '') || 'bin'
    }

    /**
     * Downloads media as a Node.js Readable stream
     * @param {Object} [options={}]
     * @returns {Promise<import('stream').Readable>}
     */
    async toStream(options = {}) {
        if (!this.mediaNode.mediaKey && !this.mediaNode.directPath && !this.mediaNode.url) {
            throw new Error('Media node does not contain valid decryption keys or download URL.')
        }

        return downloadContentFromMessage(this.mediaNode, this.mediaType, options)
    }

    /**
     * Downloads media and returns decrypted Buffer (caches in memory)
     * @param {Object} [options={}]
     * @returns {Promise<Buffer>}
     */
    async toBuffer(options = {}) {
        if (this._bufferCache) {
            return this._bufferCache
        }

        const stream = await this.toStream(options)
        const chunks = []

        for await (const chunk of stream) {
            chunks.push(chunk)
        }

        this._bufferCache = Buffer.concat(chunks)
        return this._bufferCache
    }

    /**
     * Saves the downloaded media directly to disk
     * @param {string} [destinationPath] - File path to save. Defaults to ./media/{timestamp}-{name}.{ext}
     * @param {Object} [options={}]
     * @returns {Promise<string>} Saved destination path
     */
    async save(destinationPath, options = {}) {
        const targetPath = destinationPath || `./media/${Date.now()}-${this.fileName || 'media'}.${this.extension}`
        const buffer = await this.toBuffer(options)
        const dir = dirname(targetPath)
        await fsPromises.mkdir(dir, { recursive: true })
        await fsPromises.writeFile(targetPath, buffer)
        return targetPath
    }

    /**
     * Returns legacy/UnityChat compatible attachment helpers and buffers
     * @param {Object} [options={}]
     * @returns {Promise<Object>}
     */
    async getAttachments(options = {}) {
        const buffer = await this.toBuffer(options)
        const toBase64 = () => buffer.toString('base64')
        const toDataUri = () => `data:${this.mimetype};base64,${toBase64()}`
        const toArrayBuffer = () => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
        const toBlob = () => {
            if (typeof Blob !== 'undefined') {
                return new Blob([toArrayBuffer()], { type: this.mimetype })
            }
            return buffer
        }
        const toStream = () => {
            const { Readable } = require('stream')
            return Readable.from(buffer)
        }
        const toSharp = () => this.toSharp(options)
        const detectType = async () => {
            try {
                const { fileTypeFromBuffer } = await import('file-type')
                const detected = await fileTypeFromBuffer(buffer)
                if (detected) return detected
            } catch {}
            return { ext: this.extension, mime: this.mimetype }
        }
        const save = async (destPath) => this.save(destPath, options)

        return {
            mimetype: this.mimetype,
            extension: this.extension,
            buffer,
            toBase64,
            toDataUri,
            toArrayBuffer,
            toBlob,
            toStream,
            toSharp,
            detectType,
            save
        }
    }

    /**
     * Returns Base64 encoded string of the media
     * @param {Object} [options={}]
     * @returns {Promise<string>}
     */
    async toBase64(options = {}) {
        const buffer = await this.toBuffer(options)
        return buffer.toString('base64')
    }

    /**
     * Returns a Data URI string (e.g. data:image/jpeg;base64,...)
     * @param {Object} [options={}]
     * @returns {Promise<string>}
     */
    async toDataUri(options = {}) {
        const base64 = await this.toBase64(options)
        return `data:${this.mimetype};base64,${base64}`
    }

    /**
     * Returns a Sharp instance for image processing (requires sharp installed)
     * @param {Object} [options={}]
     */
    async toSharp(options = {}) {
        let sharp
        try {
            sharp = require('sharp')
        } catch {
            throw new Error('The "sharp" package is required to use toSharp(). Run "npm install sharp" to add it.')
        }

        const buffer = await this.toBuffer(options)
        return sharp(buffer)
    }

    toString() {
        const sizeStr = this.fileLength ? `${this.fileLength} bytes` : 'unknown size'
        return `[MediaObject ${this.mediaType}: ${this.mimetype} (${sizeStr})]`
    }

    toJSON() {
        return {
            mediaType: this.mediaType,
            mimetype: this.mimetype,
            extension: this.extension,
            fileLength: this.fileLength,
            fileName: this.fileName,
            caption: this.caption,
            duration: this.duration,
            isPtt: this.isPtt,
            isGif: this.isGif,
            isViewOnce: this.isViewOnce
        }
    }

    [Symbol.toPrimitive]() {
        return this.toString()
    }
}

exports.MediaObject = MediaObject
exports.default = MediaObject
