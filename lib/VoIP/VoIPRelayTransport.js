"use strict";

Object.defineProperty(exports, "__esModule", { value: true });

const dgram = require("dgram");
const { EventEmitter } = require("events");

/**
 * Meta VoIP Relay UDP Transport Client
 * Manages UDP socket communication, relay authentication tokens,
 * NAT keep-alives, and packet dispatching.
 */
class VoIPRelayTransport extends EventEmitter {
    constructor({ ip, port, token, logger = console }) {
        super();
        this.ip = ip;
        this.port = port;
        this.token = Buffer.isBuffer(token) ? token : (token ? Buffer.from(token) : Buffer.alloc(0));
        this.logger = logger;
        this.socket = null;
        this.keepAliveTimer = null;
        this.isConnected = false;
        this.bytesSent = 0;
        this.bytesReceived = 0;
        this.packetsSent = 0;
        this.packetsReceived = 0;
    }

    /**
     * Connects to the Meta Relay Server via UDP
     */
    async connect() {
        return new Promise((resolve, reject) => {
            try {
                this.socket = dgram.createSocket("udp4");

                this.socket.on("error", (err) => {
                    this.logger.error?.({ err, relay: `${this.ip}:${this.port}` }, "VoIP Relay socket error");
                    this.emit("error", err);
                });

                this.socket.on("message", (msg, rinfo) => {
                    this.bytesReceived += msg.length;
                    this.packetsReceived++;
                    this.handleIncomingPacket(msg, rinfo);
                });

                this.socket.on("close", () => {
                    this.isConnected = false;
                    this.stopKeepAlive();
                    this.emit("close");
                });

                // Bind to random available local UDP port
                this.socket.bind(0, () => {
                    this.isConnected = true;
                    // Send initial relay allocation / binding handshake
                    this.sendRelayBinding();
                    this.startKeepAlive();
                    resolve();
                });
            } catch (err) {
                reject(err);
            }
        });
    }

    /**
     * Sends the Meta VoIP Relay Binding Packet
     * Format: [0x01 (Bind Command)] [Token Length (2 bytes)] [Token Bytes]
     */
    sendRelayBinding() {
        if (!this.isConnected || !this.socket) return;

        const packet = Buffer.alloc(3 + this.token.length);
        packet.writeUInt8(0x01, 0); // Binding request
        packet.writeUInt16BE(this.token.length, 1);
        if (this.token.length > 0) {
            this.token.copy(packet, 3);
        }

        this.sendRaw(packet);
    }

    /**
     * Sends an RTP / SRTP packet through the relay connection
     * @param {Buffer} rtpPacket The encrypted SRTP packet
     */
    sendRtp(rtpPacket) {
        if (!this.isConnected || !this.socket) return;
        // In Meta relay transport, standard RTP packets can be prefixed with data tag (0x02) or sent directly
        this.sendRaw(rtpPacket);
    }

    /**
     * Sends a raw UDP packet to the relay endpoint
     */
    sendRaw(buffer) {
        if (!this.isConnected || !this.socket) return;

        this.socket.send(buffer, 0, buffer.length, this.port, this.ip, (err) => {
            if (err) {
                this.logger.warn?.({ err }, "Error sending VoIP relay packet");
            } else {
                this.bytesSent += buffer.length;
                this.packetsSent++;
            }
        });
    }

    /**
     * Parses incoming UDP packet
     */
    handleIncomingPacket(msg, rinfo) {
        if (msg.length < 2) return;

        const header = msg[0];

        // 0x01 = Relay Ack / Pong
        if (header === 0x01) {
            this.emit("relay.bound", { rinfo });
            return;
        }

        // 0x80+ = Standard RTP/SRTP packet (Version 2 RFC 3550)
        if ((header & 0xc0) === 0x80) {
            this.emit("rtp", msg);
            return;
        }

        // Emit general packet
        this.emit("packet", msg);
    }

    /**
     * Sends periodic keep-alives to preserve NAT binding and session affinity
     */
    startKeepAlive(intervalMs = 2000) {
        this.stopKeepAlive();
        this.keepAliveTimer = setInterval(() => {
            if (this.isConnected) {
                // Relay ping: 0x03 [Ping]
                const ping = Buffer.from([0x03, 0x00]);
                this.sendRaw(ping);
            }
        }, intervalMs);
    }

    stopKeepAlive() {
        if (this.keepAliveTimer) {
            clearInterval(this.keepAliveTimer);
            this.keepAliveTimer = null;
        }
    }

    /**
     * Gracefully closes the relay socket
     */
    close() {
        this.stopKeepAlive();
        this.isConnected = false;
        if (this.socket) {
            try {
                this.socket.close();
            } catch (_) {}
            this.socket = null;
        }
    }
}

module.exports = {
    VoIPRelayTransport,
};
