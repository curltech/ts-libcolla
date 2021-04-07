import { TypeUtil } from '../../util/util'
import { config } from '../conf/conf'
import { SignalAction } from '../chain/action/signal'

const SimplePeer = require('simple-peer4curltech')

export class WebrtcPeer {
	private _webrtcPeer: SimplePeer
	private _targetPeerId: string
	private _connectPeerId: string
	private _connectSessionId: string
	private _iceServer: []
	private _localStreams: any[] = []
	private _remoteStreams: any[] = []
	private _options: any
	private _router: any
	private _start: number
	private _end: number

	get webrtcPeer() {
		return this._webrtcPeer
	}
	get targetPeerId() {
		return this._targetPeerId
	}
	get connectSessionId() {
		return this._connectSessionId
	}
	get connectPeerId() {
		return this._connectPeerId
	}
	set connectSessionId(connectSessionId: string) {
		this._connectSessionId = connectSessionId
	}
	set connectPeerId(connectPeerId: string) {
		this._connectPeerId = connectPeerId
	}

	/**
	 * 初始化一个SimplePeer的配置参数
	{
		initiator: false,//是否是发起节点
		channelConfig: {},
		channelName: '<random string>',
		config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:global.stun.twilio.com:3478?transport=udp' }] },
		offerOptions: {},
		answerOptions: {},
		sdpTransform: function (sdp) { return sdp },
		stream: false,
		streams: [],
		trickle: true,
		allowHalfTrickle: false,
		wrtc: {}, // RTCPeerConnection/RTCSessionDescription/RTCIceCandidate
		objectMode: false
	}
	 */

	constructor(targetPeerId: string, iceServer: [],
		initiator: boolean, options: any, router: any) {
		this.init(targetPeerId, iceServer, initiator, options, router)
	}

	init(targetPeerId: string, iceServer: [],
		initiator: boolean, options: any, router: any) {
		this._targetPeerId = targetPeerId
		if (!iceServer) {
			iceServer = config.appParams.iceServer[0]
		}
		this._iceServer = iceServer
		if (!options) {
			options = {}
		}
		if (!options.config) {
			options.config = {
				"iceServers": iceServer
			}
		}
		if (!options.config["iceServers"]) {
			options.config["iceServers"] = iceServer
		}
		if (initiator) {
			options.initiator = initiator
		}
		if (options.stream) {
			this._localStreams.push(options.stream)
		}
		this._options = options
		// 自定义属性，表示本节点createOffer时加入的sfu的编号，作为出版者还是订阅者，还是都是
		this._router = router
		this._start = Date.now()
		this._webrtcPeer = new SimplePeer(options)
		/**
		 * 下面的三个事件对于发起方和被发起方是一样的
		 */
		/**
		 * 可以发起信号
		 */
		this._webrtcPeer.on('signal', async data => {
			console.info(new Date() + ':can signal to peer:' + this._targetPeerId + ';connectPeer:' + this._connectPeerId + ' session:' + this._connectSessionId)
			if (this._router) {
				data.router = this._router
			}
			await webrtcPeerPool.emitEvent('signal', { data: data, source: this })
		})

		/**
		 * 连接建立
		 */
		this._webrtcPeer.on('connect', async () => {
			console.info(new Date() + ':connected to peer:' + this._targetPeerId + ';connectPeer:' + this._connectPeerId + ' session:' + this._connectSessionId + ', can send message ')
			this._end = Date.now()
			console.info('connect time:' + (this._end - this._start))
			// this.send('hello,hu')
			await webrtcPeerPool.emitEvent('connect', { source: this })
		})

		this._webrtcPeer.on('close', async () => {
			console.info(new Date() + ':connected peer close: ' + this._targetPeerId + ';connectPeer:' + this._connectPeerId + ' session:' + this._connectSessionId + ', is closed')
			await webrtcPeerPool.remove(this._targetPeerId, this._connectPeerId, this._connectSessionId)
			await webrtcPeerPool.emitEvent('close', { source: this })
		})

		/**
		 * 收到数据
		 */
		this._webrtcPeer.on('data', async data => {
			console.info(new Date() + ':got a message from peer: ' + data)
			await webrtcPeerPool.emitEvent('data', { data: data, source: this })
		})

		this._webrtcPeer.on('stream', async stream => {
			this._remoteStreams.push(stream)
			if (stream) {
				stream.onremovetrack = (event) => {
					console.info(`Video track: ${event.track.label} removed`)
				}
			}
			await webrtcPeerPool.emitEvent('stream', { stream: stream, source: this })
		})

		this._webrtcPeer.on('track', async (track, stream) => {
			console.info(new Date() + ':track')
			await webrtcPeerPool.emitEvent('track', { track: track, stream: stream, source: this })
		})

		this._webrtcPeer.on('error', async (err) => {
			console.error(new Date() + ':error:' + JSON.stringify(err))
			// 重试的次数需要限制，超过则从池中删除
			//this.init(this._targetPeerId, this._iceServer, null, this._options)
			await webrtcPeerPool.emitEvent('error', { error: err, source: this })
		})
	}

	on(name:string, fn:any){
		this._webrtcPeer.on(name,fn)
	}

	once(name:string, fn:any){
		this._webrtcPeer.once(name,fn)
	}

	removeListener(name:string, fn:any){
		this._webrtcPeer.removeListener(name,fn)
	}

	attachStream(element: any, stream: any) {
		if ('srcObject' in element) {
			element.srcObject = stream
		} else {
			element.src = window.URL.createObjectURL(stream)
		}
		element.play()
	}

	addStream(stream: any) {
		console.log('add stream to webrtc')
		this._webrtcPeer.addStream(stream)
		this._localStreams.push(stream)
	}
	/**
	 * 空参数全部删除
	 */
	removeStream(stream: any){
		this.removeLocalStream(stream)
		this.removeRemoteStream(stream)
	}
	/**
	 * 空参数全部删除
	 */
	removeLocalStream(stream: any){
		let i: number = 0
		for (let _stream of this._localStreams) {
			if (!stream || _stream === stream){
				this._localStreams.splice(i, 1)
				this._webrtcPeer.removeStream(_stream)
				break
			}
			++i
		}
	}
	/**
	 * 空参数全部删除
	 */
	removeRemoteStream(stream: any){
		let i: number = 0
		for (let _stream of this._remoteStreams) {
			if (!stream || _stream === stream){
				this._remoteStreams.splice(i, 1)
				break
			}
			++i
		}
	}
	signal(data: any) {
		this._webrtcPeer.signal(data)
	}

	get support(): boolean {
		if (this._webrtcPeer.WEBRTC_SUPPORT) {
			return true
		} else {
			return false
		}
	}

	get connected(): boolean {
		return this._webrtcPeer.connected
	}

	send(data: string | Uint8Array) {
		if (this._webrtcPeer.connected) {
			this._webrtcPeer.send(data)
		} else {
			console.error('peerId:' + this._targetPeerId + ';connectPeer:' + this._connectPeerId + ' session:' + this._connectSessionId + ' webrtc connection state is not connected')
		}
	}

	async destroy(err: any) {
		await this._webrtcPeer.destroy(err)
		webrtcPeerPool.remove(this._targetPeerId, this._connectPeerId, this._connectSessionId)
	}
}

/**
 * webrtc的连接池，键值是对方的peerId
 */
export class WebrtcPeerPool {
	private webrtcPeers = new Map<string, WebrtcPeer[]>()
	private _events: Map<string, any> = new Map<string, any>()
	private _signalAction: SignalAction = null
	private protocolHandlers = new Map()
	constructor() {
		this.registEvent('signal', this.sendSignal)
		this.registEvent('data', this.receiveData)
	}

	registSignalAction(signalAction: SignalAction) {
		webrtcPeerPool._signalAction = signalAction
		webrtcPeerPool._signalAction.registReceiver('webrtcPeerPool', webrtcPeerPool.receive)
	}

	registProtocolHandler(protocol: string, receiveHandler: any) {
		this.protocolHandlers.set(protocol, {
			receiveHandler: receiveHandler
		})
	}

	getProtocolHandler(protocol: string): any {
		return this.protocolHandlers.get(protocol)
	}

	/**
	 * 获取peerId的webrtc连接，可能是多个
	 * 如果不存在，创建一个新的连接，发起连接尝试
	 * 否则，根据connected状态判断连接是否已经建立
	 * @param peerId 
	 */
	async get(peerId: string): Promise<WebrtcPeer[]> {
		if (webrtcPeerPool.webrtcPeers.has(peerId)) {
			return webrtcPeerPool.webrtcPeers.get(peerId)
		}

		return null
	}

	getOne(peerId: string, connectPeerId: string, connectSessionId: string): WebrtcPeer {
		let webrtcPeers: WebrtcPeer[] = webrtcPeerPool.webrtcPeers.get(peerId)
		if (webrtcPeers && webrtcPeers.length > 0) {
			for (let webrtcPeer of webrtcPeers) {
				if (webrtcPeer.connectPeerId === connectPeerId
					&& webrtcPeer.connectSessionId === connectSessionId) {
					return webrtcPeer
				}
			}
		}

		return null
	}

	async create(peerId: string, options:any, router: any): Promise<WebrtcPeer> {
		let webrtcPeers: WebrtcPeer[] = null
		if (webrtcPeerPool.webrtcPeers.has(peerId)) {
			webrtcPeers = webrtcPeerPool.webrtcPeers[peerId]
		}
		let webrtcPeer = new WebrtcPeer(peerId, null, true, options, router)
		if (!webrtcPeers) {
			webrtcPeers = []
		}
		webrtcPeers.push(webrtcPeer)
		webrtcPeerPool.webrtcPeers.set(peerId, webrtcPeers)

		return webrtcPeer
	}

	async remove(peerId: string, connectPeerId: string, connectSessionId: string): Promise<boolean> {
		if (webrtcPeerPool.webrtcPeers.has(peerId)) {
			let webrtcPeers: WebrtcPeer[] = webrtcPeerPool.webrtcPeers.get(peerId)
			if (webrtcPeers && webrtcPeers.length > 0) {
				let i: number = 0
				for (let webrtcPeer of webrtcPeers) {
					if ((!webrtcPeer.connectPeerId  || webrtcPeer.connectPeerId === connectPeerId)
						&& (!webrtcPeer.connectSessionId || webrtcPeer.connectSessionId === connectSessionId)) {
						webrtcPeers.splice(i, 1)
						break
					}
					++i
				}
				if (webrtcPeers && webrtcPeers.length === 0) {
					webrtcPeerPool.webrtcPeers.delete(peerId)
				}
			}

			return true
		} else {
			return false
		}
	}

	/**
	 * 获取连接已经建立的连接，可能是多个
	 * @param peerId 
	 */
	getConnected(peerId: string): WebrtcPeer[] {
		let peers: WebrtcPeer[] = []
		if (webrtcPeerPool.webrtcPeers.has(peerId)) {
			let webrtcPeers: WebrtcPeer[] = webrtcPeerPool.webrtcPeers.get(peerId)
			if (webrtcPeers && webrtcPeers.length > 0) {
				for (let webrtcPeer of webrtcPeers) {
					if (webrtcPeer.connected === true) {
						peers.push(webrtcPeer)
					}
				}
			}
		}
		if (peers.length > 0) {
			return peers
		}

		return null
	}

	getAll(): WebrtcPeer[] {
		let webrtcPeers: WebrtcPeer[] = []
		let ps = webrtcPeerPool.webrtcPeers.values()
		webrtcPeerPool.webrtcPeers.forEach((peers , key) =>{
			for (let peer of peers) {
				webrtcPeers.push(peer)
			}
		})
		return webrtcPeers
	}
	clear(){
		let webrtcPeers = this.getAll()
		for(let peer of webrtcPeers){
			peer.destroy({})
		}
	}
	/**
	 * 接收到signal的处理
	 * @param peerId 
	 * @param connectSessionId 
	 * @param data 
	 */
	async receive(peerId: string, connectPeerId: string, connectSessionId: string, data: any) {
		let type = data.type
		if (type) {
			console.info('receive signal type: ' + type + ' from webrtcPeer: ' + peerId)
		}
		if(type === 'offer'){
			await webrtcPeerPool.remove(peerId, connectPeerId, connectSessionId)
		}
		let router = data.router
		let webrtcPeer: WebrtcPeer = null
		// peerId的连接不存在，被动方创建WebrtcPeer，被动创建WebrtcPeer
		if (!webrtcPeerPool.webrtcPeers.has(peerId)) {
			console.info('webrtcPeer:' + peerId + ' not exist, will create receiver')
			webrtcPeer = new WebrtcPeer(peerId, null, false, null, null)
			webrtcPeer.connectPeerId = connectPeerId
			webrtcPeer.connectSessionId = connectSessionId
			let webrtcPeers: WebrtcPeer[] = []
			webrtcPeers.push(webrtcPeer)
			webrtcPeerPool.webrtcPeers.set(peerId, webrtcPeers)
		} else {// peerId的连接存在
			let webrtcPeers: WebrtcPeer[] = webrtcPeerPool.webrtcPeers.get(peerId)
			if (webrtcPeers && webrtcPeers.length > 0) {
				let found: boolean = false
				for (webrtcPeer of webrtcPeers) {
					// 如果连接没有完成
					if (!webrtcPeer.connectPeerId) {
						webrtcPeer.connectPeerId = connectPeerId
						webrtcPeer.connectSessionId = connectSessionId
						found = true
						break
					} else if (webrtcPeer.connectPeerId === connectPeerId
						&& webrtcPeer.connectSessionId === connectSessionId) {
						found = true
						break
					}
				}
				// 没有匹配的连接被发现，说明有多个客户端实例回应，这时创建新的主动连接请求，尝试建立新的连接
				// if (found === false) {
				// 	console.info('match webrtcPeer:' + peerId + ' not exist, will create sender')
				// 	webrtcPeer = new WebrtcPeer(peerId, null, true, null, router)
				// 	webrtcPeer.connectPeerId = connectPeerId
				// 	webrtcPeer.connectSessionId = connectSessionId
				// 	webrtcPeers.push(webrtcPeer)
				// 	webrtcPeer = null
				// }
			}
			console.info('webrtcPeer:' + peerId + ' exist, connected:')
			//console.info('webrtcPeer:' + peerId + ' exist, connected:' + webrtcPeer.connected)
		}
		if (webrtcPeer) {
			console.info('webrtcPeer signal data:' + JSON.stringify(data))
			webrtcPeer.signal(data)
		}
	}

	/**
	 * 向peer发送信息，如果是多个，遍历发送
	 * @param peerId 
	 * @param data 
	 */
	async send(peerId: string, data: string | Uint8Array) {
		let webrtcPeers: WebrtcPeer[] = await this.get(peerId)
		if (webrtcPeers && webrtcPeers.length > 0) {
			let ps = []
			for (let webrtcPeer of webrtcPeers) {
				let p = webrtcPeer.send(data)
				ps.push(p)
			}
			await Promise.all(ps)
		}
	}

	async receiveData(event: any) {
		let {
			receiveHandler
		} = webrtcPeerPool.getProtocolHandler(config.p2pParams.chainProtocolId)
		if (receiveHandler) {
			let remotePeerId = event.source.targetPeerId
			/**
			 * 调用注册的接收处理器处理接收的原始数据
			 */
			let data: Uint8Array = await receiveHandler(event.data, remotePeerId, null)
			/**
			 * 如果有返回的响应数据，则发送回去，不可以调用同步的发送方法send
			 */
			if (data) {
				webrtcPeerPool.send(remotePeerId, data)
			}
		}
	}

	registEvent(name: string, func: any): boolean {
		if (func && TypeUtil.isFunction(func)) {
			this._events.set(name, func)
			return true
		}
		return false
	}

	unregistEvent(name: string) {
		this._events.delete(name)
	}

	async emitEvent(name: string, evt: any): Promise<any> {
		if (this._events.has(name)) {
			let func: any = this._events.get(name)
			if (func && TypeUtil.isFunction(func)) {
				return await func(evt)
			} else {
				console.error('event:' + name + ' is not func')
			}
		}
	}

	async sendSignal(evt: any): Promise<any> {
		try {
			let targetPeerId = evt.source.targetPeerId
			console.info('webrtcPeer:' + targetPeerId + ' send signal:' + JSON.stringify(evt.data))
			let result = await webrtcPeerPool._signalAction.signal(null, evt.data, targetPeerId)
			if (result === 'ERROR') {
				console.error('signal err:' + result)
			}
			return result
		} catch (err) {
			console.error('signal err:' + err)
		}
		return null
	}
}
export let webrtcPeerPool = new WebrtcPeerPool()