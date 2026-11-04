"use strict";

Object.defineProperty(exports, "__esModule", { value: true });

const crypto = require("crypto");

/**
 * WhatsApp VoIP SRTP Key Derivation & Packet Protection
 * Conforms to WhatsApp VoIP specifications (wacrg / AstraCalls / RFC 3711)
 */

const SRTP_LABEL = {
    CALLER_AUDIO_KEY: "WhatsApp VoIP Master Key Caller Audio",
    CALLER_AUDIO_SALT: "WhatsApp VoIP Master Salt Caller Audio",
    CALLEE_AUDIO_KEY: "WhatsApp VoIP Master Key Callee Audio",
    CALLEE_AUDIO_SALT: "WhatsApp VoIP Master Salt Callee Audio",
    CALLER_VIDEO_KEY: "WhatsApp VoIP Master Key Caller Video",
    CALLER_VIDEO_SALT: "WhatsApp VoIP Master Salt Caller Video",
    CALLEE_VIDEO_KEY: "WhatsApp VoIP Master Key Callee Video",
    CALLEE_VIDEO_SALT: "WhatsApp VoIP Master Salt Callee Video",
};

/**
 * Standard HKDF extraction & expansion using SHA-256
 */
function hkdfDerive(ikm, salt, info, length) {
    const actualSalt = salt && salt.length > 0 ? salt : Buffer.alloc(32, 0);
    const prk = crypto.createHmac("sha256", actualSalt).update(ikm).digest();

    let prev = Buffer.alloc(0);
    const buffers = [];
    let currentLen = 0;
    let counter = 1;

    while (currentLen < length) {
        const hmac = crypto.createHmac("sha256", prk);
        hmac.update(prev);
        if (info) {
            hmac.update(Buffer.isBuffer(info) ? info : Buffer.from(info, "utf8"));
        }
        hmac.update(Buffer.from([counter]));
        prev = hmac.digest();
        buffers.push(prev);
        currentLen += prev.length;
        counter++;
    }

    return Buffer.concat(buffers).subarray(0, length);
}

/**
 * Derives all SRTP Master Keys and Salts from the 32-byte callKey
 * @param {Buffer|Uint8Array} callKey 32-byte master call key negotiated via Signal
 * @param {Buffer|Uint8Array} [salt] Optional salt (defaults to 32 zero bytes)
 */
function deriveVoIPKeys(callKey, salt = null) {
    const keyBuf = Buffer.isBuffer(callKey) ? callKey : Buffer.from(callKey);
    const saltBuf = salt ? (Buffer.isBuffer(salt) ? salt : Buffer.from(salt)) : Buffer.alloc(32, 0);

    return {
        // Caller (TX if caller, RX if callee)
        callerAudio: {
            masterKey: hkdfDerive(keyBuf, saltBuf, SRTP_LABEL.CALLER_AUDIO_KEY, 16),
            masterSalt: hkdfDerive(keyBuf, saltBuf, SRTP_LABEL.CALLER_AUDIO_SALT, 14),
        },
        // Callee (RX if caller, TX if callee)
        calleeAudio: {
            masterKey: hkdfDerive(keyBuf, saltBuf, SRTP_LABEL.CALLEE_AUDIO_KEY, 16),
            masterSalt: hkdfDerive(keyBuf, saltBuf, SRTP_LABEL.CALLEE_AUDIO_SALT, 14),
        },
        // Video Caller
        callerVideo: {
            masterKey: hkdfDerive(keyBuf, saltBuf, SRTP_LABEL.CALLER_VIDEO_KEY, 16),
            masterSalt: hkdfDerive(keyBuf, saltBuf, SRTP_LABEL.CALLER_VIDEO_SALT, 14),
        },
        // Video Callee
        calleeVideo: {
            masterKey: hkdfDerive(keyBuf, saltBuf, SRTP_LABEL.CALLEE_VIDEO_KEY, 16),
            masterSalt: hkdfDerive(keyBuf, saltBuf, SRTP_LABEL.CALLEE_VIDEO_SALT, 14),
        },
    };
}

/**
 * Generates an SRTP Initialization Vector (IV) from SSRC, Sequence Number, and Master Salt
 * Conforms to RFC 3711 Section 4.1.1
 */
function computeSRTPIV(masterSalt, ssrc, seqNo, roc = 0) {
    const iv = Buffer.alloc(16, 0);
    
    // 48-bit index: (roc << 16) | seqNo
    const indexBuf = Buffer.alloc(8, 0);
    indexBuf.writeUInt32BE(roc, 0);
    indexBuf.writeUInt16BE(seqNo, 4);

    // IV = (ssrc << 64) ^ (index << 16) ^ (masterSalt << 16)
    masterSalt.copy(iv, 0, 0, 14);

    // XOR SSRC at bytes 4-7
    iv[4] ^= (ssrc >>> 24) & 0xff;
    iv[5] ^= (ssrc >>> 16) & 0xff;
    iv[6] ^= (ssrc >>> 8) & 0xff;
    iv[7] ^= ssrc & 0xff;

    // XOR index at bytes 6-13
    for (let i = 0; i < 6; i++) {
        iv[8 + i] ^= indexBuf[2 + i];
    }

    return iv;
}

/**
 * Encrypts an RTP payload using AES-128-CTR (SRTP Default)
 */
function encryptRTPPayload(payload, key, iv) {
    const cipher = crypto.createCipheriv("aes-128-ctr", key, iv);
    return Buffer.concat([cipher.update(payload), cipher.final()]);
}

/**
 * Decrypts an SRTP payload using AES-128-CTR
 */
function decryptRTPPayload(encryptedPayload, key, iv) {
    const decipher = crypto.createDecipheriv("aes-128-ctr", key, iv);
    return Buffer.concat([decipher.update(encryptedPayload), decipher.final()]);
}

/**
 * Computes HMAC-SHA1-80 authentication tag (10 bytes) for SRTP packet
 */
function computeAuthTag(authKey, packetData, roc = 0) {
    const rocBuf = Buffer.alloc(4);
    rocBuf.writeUInt32BE(roc, 0);

    const hmac = crypto.createHmac("sha1", authKey);
    hmac.update(packetData);
    hmac.update(rocBuf);
    return hmac.digest().subarray(0, 10);
}

module.exports = {
    SRTP_LABEL,
    hkdfDerive,
    deriveVoIPKeys,
    computeSRTPIV,
    encryptRTPPayload,
    decryptRTPPayload,
    computeAuthTag,
};
