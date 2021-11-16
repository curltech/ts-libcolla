import { CollaUtil } from '../../util/util'
import { logService } from '../db/log'
import { webrtcPeerPool } from './webrtcpeerpool'

const SimplePeer = require('simple-peer-curltech')

export class WebrtcPeer {
	private _webrtcPeer: SimplePeer
	private _targetPeerId: string
	private _clientId: string
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
	get clientId() {
		return this._clientId
	}
	set clientId(clientId: string) {
		this._clientId = clientId
	}
	get localStreams() {
		return this._localStreams
	}
	set localStreams(localStreams: any[]) {
		this._localStreams = localStreams
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

	constructor(targetPeerId: string, 
		initiator: boolean, options: any, router: any) {
		this.init(targetPeerId, initiator, options, router)
	}

	init(targetPeerId: string, 
		initiator: boolean, options: any, router: any) {
		this._targetPeerId = targetPeerId
		if (!options) {
			options = {}
		}
		console.log(options)
		let  iceServer:any
		// if (!options.config || !options.config.iceServers) {
		// 	iceServer = config.appParams.iceServer[0]
		// 	options.config["iceServers"] = iceServer
		// }else{
			iceServer = options.config.iceServers
		//}
		this._iceServer = iceServer
		if (initiator) {
			options.initiator = initiator
		}
		if (options.stream) {
			this._localStreams.push(options.stream)
		}
		
		
		if(targetPeerId ==="12D3KooWLVFzm9iUdqL2DBLH7ND459CuZmnQEoHf1Ebm4zbJgg6t"){//模拟多客户端发送方
			console.log("targetPeerId 12D3KooWLVFzm9iUdqL2DBLH7ND459CuZmnQEoHf1Ebm4zbJgg6t")
			window.clientId = window.clientId?(window.clientId+1 ): 1
			console.log(window.clientId )
			this.clientId = window.clientId 
			options.extension = { iceServer : iceServer ,clientId : window.clientId, force : true }
		}else if(targetPeerId ==="12D3KooWQ1tzMkwc4ciUdW6NCgsHqa6CuvNXXpwKLLyt2gyaKkGm"){
			options.extension = { iceServer : iceServer ,clientId : window.clientId, force : true }
		}else{
			options.extension = { iceServer : iceServer ,clientId : webrtcPeerPool.clientId , force : true }
		}
		
		this._options = options
		// 自定义属性，表示本节点createOffer时加入的sfu的编号，作为出版者还是订阅者，还是都是
		this._router = router
		this._start = Date.now()
		debugger
		this._webrtcPeer = new SimplePeer(options)

		/**
		 * 下面的三个事件对于发起方和被发起方是一样的
		 */
		/**
		 * 可以发起信号
		 */
		this._webrtcPeer.on('signal', async data => {
			//console.info(new Date() + ':can signal to peer:' + this._targetPeerId + ';connectPeer:' + this._connectPeerId + ' session:' + this._connectSessionId)
			if (this._router) {
				data.router = this._router
			}
			if(this._webrtcPeer.extension.force){
				data.extension = CollaUtil.deepClone(data.extension)
               delete this._webrtcPeer.extension.force
			}
			let _that = this
			this._webrtcPeer._pc.getStats((err, items) => {
				if(items && items.length > 0){
					items.forEach(item => {
							if (
								(item.type === 'googCandidatePair' && item.googActiveConnection === 'true') ||
								((item.type === 'candidatepair' || item.type === 'candidate-pair') && item.selected)
							  ) {
								_that._webrtcPeer._maybeReady()
							  }
						  })
				}
			})
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
			await webrtcPeerPool.removeWebrtcPeer(this._targetPeerId, this)
			
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
			console.log(new Date() + ':error:' + JSON.stringify(err))
			await logService.log(err, 'webrtcPeerError', 'error')
			// 重试的次数需要限制，超过则从池中删除
			//this.init(this._targetPeerId, this._iceServer, null, this._options)
			//await webrtcPeerPool.emitEvent('error', { error: err, source: this })
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
			console.log('send failed , peerId:' + this._targetPeerId + ';connectPeer:' + this._connectPeerId + ' session:' + this._connectSessionId + ' webrtc connection state is not connected')
		}
	}

	async destroy(err: any) {
		await this._webrtcPeer.destroy(err)
	}
}