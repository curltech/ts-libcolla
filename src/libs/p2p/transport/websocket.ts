import ReconnectingWebSocket from 'reconnectingwebsocket'
import { TypeUtil, BlobUtil } from '../../util/util'
import { chainMessageHandler } from '../chain/chainmessagehandler'
import { config } from '../conf/conf'

export class Websocket {
    private prefix: string = 'wss://'
    private address: string
    private websocket: any
    private _status: boolean = false
    private heartbeatTimer: any
    constructor(address: string) {
        if (address) {
            let pos = address.indexOf(this.prefix)
            if (pos === 0) {
                address = address.substr(6)
            }
            while (address.charAt(address.length - 1) === '/') {
                address = address.substr(0, address.length - 1)
            }
        }
        this.address = address
    }

    regist(name: string, func: any) {
        if (func && TypeUtil.isFunction(func)) {
            if (name === 'onopen') {
                this.onOpen = func
            } else if (name === 'onerror') {
                this.onError = func
            } else if (name === 'onclose') {
                this.onClose = func
            } else if (name === 'onmessage') {
                this.onMessage = func
            }
        }
    }

    init() {
        if ('WebSocket' in window) {
            this.websocket = new ReconnectingWebSocket(this.prefix + this.address, null,
                { debug: false, reconnectInterval: 3000, maxReconnectAttempts: 5, timeoutInterval: 5000 });
        } else if ('MozWebSocket' in window) {
            this.websocket = new MozWebSocket(this.prefix + this.address)
        } else {
            this.websocket = new SockJS(this.address)
        }
        let _that = this
        this.websocket.onopen = function (evt) {
            console.log("WebSocket Connected!" + _that.address)
            _that._status = true
            _that.heartbeatTimer = setInterval(function () {
                _that.websocket.send(JSON.stringify({
                    contentType: "Heartbeat"
                }));
            }, 55 * 1000)
            _that.onOpen(evt)
        }
        this.websocket.onerror = function (evt) {
            console.error("WebSocket Error!" + _that.address);
            _that.websocket.socketStatus = false
            _that.onError(evt)
        }
        this.websocket.onmessage = async function (evt) {
            let remoteAddr = _that.address
            if (evt.data) {
                if (evt.data instanceof Blob) {
                    let str = await BlobUtil.blobToBase64(evt.data, { type: 'text' })
                    _that.onMessage(str, null, remoteAddr)
                } else if (evt.data instanceof Uint8Array) {
                    _that.onMessage(evt.data, null, remoteAddr)
                }
            }
        }
        this.websocket.onclose = function (evt) {
            console.log("WebSocket Closed!")
            _that._status = false
            if (_that.heartbeatTimer) {
                clearInterval(_that.heartbeatTimer)
                delete _that.heartbeatTimer
            }
            _that.onClose(evt)
        }
    }

    onOpen(evt) {
        console.info('websocket open:' + evt)
    }

    onError(evt) {
        console.error('websocket error:' + evt)
    }

    onClose(evt) {
        console.info('websocket close:' + evt)
    }

    close() {
        this.websocket.close()
    }

    onMessage(msg: string | Uint8Array, peerId: string, addr: string) {
        console.info('websocket receive message from peerId:' + peerId + ';addr:' + addr)
        console.info('websocket receive message:' + msg)
        if (msg instanceof Uint8Array) {
            chainMessageHandler.receiveRaw(msg, peerId, addr)
        }
    }

    reconnect() {
        if (this._status) {
            this.websocket.close()
            this._status = false
            this.websocket = null
        }
        if (!this._status) {
            if (!this.websocket || (this.websocket.reconnectAttempts > this.websocket.maxReconnectInterval)) {
                this.init()
            }
        }
    }
    send(message: string | Uint8Array) {
        this.websocket.send(message)
    }

    get status(): boolean {
        return this._status
    }
}

export class WebsocketPool {
    private websockets = new Map<string, Websocket>()
    constructor() {
        let connectAddress = config.appParams.connectAddress
        if (connectAddress && TypeUtil.isArray(connectAddress)) {
            for (let addr of connectAddress) {
                if (addr.startsWith('ws')) {
                    let websocket = new Websocket(addr)
                    this.websockets.set(addr, websocket)
                }
            }
        }
    }

    get(address: string): Websocket {
        if (this.websockets.has(address)) {
            return this.websockets.get(address)
        } else {
            let websocket = new Websocket(address)
            websocket.reconnect()
            this.websockets.set(address, websocket)

            return websocket
        }
    }

    close(address: string) {
        if (this.websockets.has(address)) {
            let websocket = this.websockets.get(address)
            websocket.close()
            this.websockets.delete(address)
        }
    }
}
export let websocketPool = new WebsocketPool()