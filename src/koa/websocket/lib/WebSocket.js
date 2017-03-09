/*!
 * ws: a node.js websocket client
 * Copyright(c) 2011 Einar Otto Stangvik <einaros@gmail.com>
 * MIT Licensed
 */

'use strict';
const EventEmitter = require('events');
const crypto = require('crypto');
const https = require('https');
const http = require('http');
const url = require('url');
const Ultron = require('./Ultron');
const PerMessageDeflate = require('./PerMessageDeflate');
const EventTarget = require('./EventTarget');
const Extensions = require('./Extensions');
const Receiver = require('./Receiver');
const Sender = require('./Sender');
const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const closeTimeout = 30 * 1000; // Allow 30 seconds to terminate the connection cleanly.
const protocolVersion = 13;
/**
 * Class representing a WebSocket.
 *
 * @extends EventEmitter
 */
class WebSocket extends EventEmitter {
    /**
     * Create a new `WebSocket`.
     * @param {String} address The URL to which to connect
     * @param {(String|String[])} protocols The subprotocols
     * @param {Object} options Connection options
     */
    constructor(req, socket, head, options) {
        super();
        this.readyState = WebSocket.CONNECTING;
        this.bytesReceived = 0;
        this._finalize = this.finalize.bind(this);
        this._closeMessage = null;
        this._closeTimer = null;
        this._closeCode = null;
        this._receiver = null;
        this._sender = null;
        this._socket = null;
        this._ultron = null;
        this.protocolVersion = options.protocolVersion;
        this.extensions = options.extensions;
        this.maxPayload = options.maxPayload;
        this.protocol = options.protocol;
        this.upgradeReq = req;
        this._isServer = true;
        this.setSocket(socket, head);
    }

    get CONNECTING() {
        return WebSocket.CONNECTING;
    }

    get CLOSING() {
        return WebSocket.CLOSING;
    }

    get CLOSED() {
        return WebSocket.CLOSED;
    }

    get OPEN() {
        return WebSocket.OPEN;
    }

    /**
     * @type {Number}
     */
    get bufferedAmount() {
        var amount = 0;

        if (this._socket) amount = this._socket.bufferSize || 0;
        return amount;
    }

    /**
     * Set up the socket and the internal resources.
     *
     * @param {net.Socket} socket The network socket between the server and client
     * @param {Buffer} head The first packet of the upgraded stream
     * @private
     */
    setSocket(socket, head) {
        socket.setTimeout(0);
        socket.setNoDelay();
        this._receiver = new Receiver(this.extensions, this.maxPayload);
        this._sender = new Sender(socket, this.extensions);
        this._ultron = new Ultron(socket);
        this._socket = socket;
        // socket cleanup handlers
        this._ultron.on('close', this._finalize);
        this._ultron.on('error', this._finalize);
        this._ultron.on('end', this._finalize);
        // ensure that the head is added to the receiver
        if (head && head.length > 0) {
            socket.unshift(head);
            head = null;
        }
        // subsequent packets are pushed to the receiver
        this._ultron.on('data', (data) => {
            this.bytesReceived += data.length;
            this._receiver.add(data);
        });
        // receiver event handlers
        this._receiver.onmessage = (data, flags) => this.emit('message', data, flags);
        this._receiver.onping = (data, flags) => {
            this.pong(data, {mask: !this._isServer}, true);
            this.emit('ping', data, flags);
        };
        this._receiver.onpong = (data, flags) => this.emit('pong', data, flags);
        this._receiver.onclose = (code, reason) => {
            this._closeMessage = reason;
            this._closeCode = code;
            this.close(code, reason);
        };
        this._receiver.onerror = (error, code) => {
            // close the connection when the receiver reports a HyBi error code
            this.close(code, '');
            this.emit('error', error);
        };

        // sender event handlers
        this._sender.onerror = (error) => {
            this.close(1002, '');
            this.emit('error', error);
        };
        this.readyState = WebSocket.OPEN;
        this.emit('open');
    }

    /**
     * Clean up and release internal resources and emit the `close` event.
     *
     * @param {(Boolean|Error)} Indicates whether or not an error occurred
     * @private
     */
    finalize(error) {
        if (this.readyState === WebSocket.CLOSED) return;

        this.readyState = WebSocket.CLOSED;

        clearTimeout(this._closeTimer);
        this._closeTimer = null;

        //
        // If the connection was closed abnormally (with an error), or if the close
        // control frame was malformed or not received then the close code must be
        // 1006.
        //
        if (error) this._closeCode = 1006;
        this.emit('close', this._closeCode || 1006, this._closeMessage || '');

        if (this._socket) {
            this._ultron.destroy();
            this._socket.on('error', function onerror() {
                this.destroy();
            });

            if (!error) this._socket.end();
            else this._socket.destroy();

            this._socket = null;
            this._ultron = null;
        }

        if (this._sender) {
            this._sender = this._sender.onerror = null;
        }

        if (this._receiver) {
            this._receiver.cleanup();
            this._receiver = null;
        }

        if (this.extensions[PerMessageDeflate.extensionName]) {
            this.extensions[PerMessageDeflate.extensionName].cleanup();
        }

        this.extensions = null;

        this.removeAllListeners();
        this.on('error', function onerror() {
        }); // catch all errors after this
    }

    /**
     * Pause the socket stream.
     *
     * @public
     */
    pause() {
        if (this.readyState !== WebSocket.OPEN) throw new Error('not opened');

        this._socket.pause();
    }

    /**
     * Resume the socket stream
     *
     * @public
     */
    resume() {
        if (this.readyState !== WebSocket.OPEN) throw new Error('not opened');
        this._socket.resume();
    }

    /**
     * Start a closing handshake.
     *
     * @param {Number} code Status code explaining why the connection is closing
     * @param {String} data A string explaining why the connection is closing
     * @public
     */
    close(code, data) {
        if (this.readyState === WebSocket.CLOSED) return;

        if (this.readyState === WebSocket.CONNECTING) {
            this.readyState = WebSocket.CLOSED;
            return;
        }

        if (this.readyState === WebSocket.CLOSING) {
            if (this._closeCode && this._isServer) {
                this.terminate();
            }
            return;
        }

        this.readyState = WebSocket.CLOSING;
        this._sender.close(code, data, !this._isServer, (err) => {
            if (err) this.emit('error', err);

            if (this._closeCode && this._isServer) {
                this.terminate();
            } else {
                //
                // Ensure that the connection is cleaned up even when the closing
                // handshake fails.
                //
                clearTimeout(this._closeTimer);
                this._closeTimer = setTimeout(this._finalize, closeTimeout, true);
            }
        });
    }

    /**
     * Send a ping message.
     *
     * @param {*} data The message to send
     * @param {Object} options Options object
     * @param {Boolean} options.mask Indicates whether or not to mask `data`
     * @param {Boolean} dontFailWhenClosed Indicates whether or not to throw an if the connection isn't open
     * @public
     */
    ping(data, options, dontFailWhenClosed) {
        if (this.readyState !== WebSocket.OPEN) {
            if (dontFailWhenClosed) return;
            throw new Error('not opened');
        }

        options = options || {};
        if (options.mask === undefined) options.mask = !this._isServer;

        this._sender.ping(data, options);
    }

    /**
     * Send a pong message.
     *
     * @param {*} data The message to send
     * @param {Object} options Options object
     * @param {Boolean} options.mask Indicates whether or not to mask `data`
     * @param {Boolean} dontFailWhenClosed Indicates whether or not to throw an if the connection isn't open
     * @public
     */
    pong(data, options, dontFailWhenClosed) {
        if (this.readyState !== WebSocket.OPEN) {
            if (dontFailWhenClosed) return;
            throw new Error('not opened');
        }

        options = options || {};
        if (options.mask === undefined) options.mask = !this._isServer;

        this._sender.pong(data, options);
    }

    /**
     * Send a data message.
     *
     * @param {*} data The message to send
     * @param {Object} options Options object
     * @param {Boolean} options.compress Specifies whether or not to compress `data`
     * @param {Boolean} options.binary Specifies whether `data` is binary or text
     * @param {Boolean} options.fin Specifies whether the fragment is the last one
     * @param {Boolean} options.mask Specifies whether or not to mask `data`
     * @param {Function} cb Callback which is executed when data is written out
     * @public
     */
    send(data, options, cb) {
        if (typeof options === 'function') {
            cb = options;
            options = {};
        }

        if (this.readyState !== WebSocket.OPEN) {
            if (cb) cb(new Error('not opened'));
            else throw new Error('not opened');
            return;
        }

        if (!data) data = '';

        options = options || {};
        if (options.fin !== false) options.fin = true;

        if (options.binary === undefined) {
            options.binary = data instanceof Buffer || data instanceof ArrayBuffer ||
                ArrayBuffer.isView(data);
        }

        if (options.mask === undefined) options.mask = !this._isServer;
        if (options.compress === undefined) options.compress = true;
        if (!this.extensions[PerMessageDeflate.extensionName]) {
            options.compress = false;
        }

        this._sender.send(data, options, cb);
    }

    /**
     * Half-close the socket sending a FIN packet.
     *
     * @public
     */
    terminate() {
        if (this.readyState === WebSocket.CLOSED) return;

        if (this._socket) {
            this.readyState = WebSocket.CLOSING;
            this._socket.end();
            // Add a timeout to ensure that the connection is completely cleaned up
            // within 30 seconds, even if the other peer does not send a FIN packet.
            clearTimeout(this._closeTimer);
            this._closeTimer = setTimeout(this._finalize, closeTimeout, true);
        } else if (this.readyState === WebSocket.CONNECTING) {
            this.finalize(true);
        }
    }
}

WebSocket.CONNECTING = 0;
WebSocket.OPEN = 1;
WebSocket.CLOSING = 2;
WebSocket.CLOSED = 3;
// Add the `onopen`, `onerror`, `onclose`, and `onmessage` attributes.
// See https://html.spec.whatwg.org/multipage/comms.html#the-websocket-interface
//
['open', 'error', 'close', 'message'].forEach((method) => {
    Object.defineProperty(WebSocket.prototype, `on${method}`, {
        /**
         * Return the listener of the event.
         * @return {(Function|undefined)} The event listener or `undefined`
         * @public
         */
        get () {
            const listener = this.listeners(method)[0];
            return listener ? listener._listener ? listener._listener : listener : undefined;
        },
        /**
         * Add a listener for the event.
         * @param {Function} listener The listener to add
         * @public
         */
        set (listener) {
            this.removeAllListeners(method);
            this.addEventListener(method, listener);
        }
    });
});
WebSocket.prototype.addEventListener = EventTarget.addEventListener;
WebSocket.prototype.removeEventListener = EventTarget.removeEventListener;
module.exports = WebSocket;