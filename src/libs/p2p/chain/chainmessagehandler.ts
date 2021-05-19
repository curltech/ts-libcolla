import { ChainMessage, MsgDirect, messageSerializer, MsgType } from './message'
import { p2pPeer } from '../p2ppeer'
import { config } from '../conf/conf'
import { SecurityPayload, SecurityParams } from '../crypto/payload'
import { pubsubPool } from './pubsub'
import { websocketPool } from '../transport/websocket'
import { WebrtcPeer, webrtcPeerPool } from '../transport/webrtc-peer'
import { httpClientPool } from '../transport/httpclient'
import { libp2pClientPool } from '../transport/libp2p'
import { ionSfuClientPool } from '../transport/ionsfuclient'
import { myself } from '../dht/myselfpeer'
import { ObjectUtil } from '../../util/util'

const packetSize = 4*1024*1024
const webRtcPacketSize = 128*1024

/**
 * 原始消息的分派处理
 */
export class ChainMessageHandler {
	private caches: Map<string, ChainMessage[]> = new Map<string, ChainMessage[]>()

	constructor() {
		libp2pClientPool.registProtocolHandler(config.p2pParams.chainProtocolId, this.receiveRaw)
		webrtcPeerPool.registProtocolHandler(config.p2pParams.chainProtocolId, this.receiveRaw)
		ionSfuClientPool.registProtocolHandler(config.p2pParams.chainProtocolId, this.receiveRaw)
	}

	/**
		将接收的原始数据还原成ChainMessage，然后根据消息类型进行分支处理
		并将处理的结果转换成原始数据，发回去
	*/
	async receiveRaw(data: Uint8Array, remotePeerId: string, remoteAddr: string): Promise<Uint8Array> {
		let response: ChainMessage
		let chainMessage = new ChainMessage()
		let value: any = messageSerializer.unmarshal(data)
		messageSerializer.map(value, chainMessage)
		// 源节点的id和地址
		if (!chainMessage.SrcPeerId) {
			chainMessage.SrcPeerId = remotePeerId
		}
		if (!chainMessage.SrcAddress) {
			chainMessage.SrcAddress = remoteAddr
		}
		// 本次连接的源节点id和地址
		chainMessage.LocalConnectPeerId = remotePeerId
		chainMessage.LocalConnectAddress = remoteAddr
		response = await chainMessageHandler.receive(chainMessage)
		/**
		 * 把响应报文转成原始数据
		 */
		if (response) {
			try {
				await chainMessageHandler.encrypt(response)
			} catch (err: any) {
				response = chainMessageHandler.error(chainMessage.MessageType, err)
			}
			chainMessageHandler.setResponse(chainMessage, response)
			let responseData: Uint8Array = messageSerializer.marshal(response)

			return responseData
		}
		return null
	}

	/**
	 * 将返回的原始报文数据转换成chainmessge
	 * @param data 
	 * @param remotePeerId 
	 * @param remoteAddr 
	 */
	async responseRaw(data: Uint8Array, remotePeerId: string, remoteAddr: string): Promise<ChainMessage> {
		let response: ChainMessage
		let chainMessage = new ChainMessage()
		let value: any = messageSerializer.unmarshal(data)
		messageSerializer.map(value, chainMessage)
		chainMessage.LocalConnectPeerId = remotePeerId
		chainMessage.LocalConnectAddress = remoteAddr
		response = await chainMessageHandler.receive(chainMessage)

		return response
	}

	/**
	发送ChainMessage消息的唯一方法
	1.找出发送的目标地址和方式
	2.根据情况处理校验，加密，压缩等
	3.建立合适的通道并发送，比如libp2p的Pipe并Write消息流
	4.等待即时的返回，校验，解密，解压缩等
	*/
	async send(msg: ChainMessage): Promise<ChainMessage> {
		/**
		 * 消息的发送目标由三个字段决定，topic表示发送到主题
		 * targetPeerId表示发送到p2p节点
		 * targetAddress表示采用外部发送方式，比如http，wss
		 */
		let targetPeerId: string = msg.TargetPeerId
		let topic: string = msg.Topic
		let connectPeerId: string = msg.ConnectPeerId
		let connectAddress: string = msg.ConnectAddress
		await chainMessageHandler.encrypt(msg)
		let data: Uint8Array = messageSerializer.marshal(msg)
		/**
		 * 发送数据后返回的响应数据
		 */
		let success = false
		let result: any = null
		try {
			if (targetPeerId) {
				let webrtcPeers: WebrtcPeer[] = webrtcPeerPool.getConnected(targetPeerId)
				if (msg.MessageType === MsgType[MsgType.P2PCHAT] || (webrtcPeers && webrtcPeers.length > 0)) {
					success = true
					result = await webrtcPeerPool.send(targetPeerId, data)
				}
			}
			if (success === false && connectPeerId) {
				let webrtcPeers: WebrtcPeer[] = webrtcPeerPool.getConnected(connectPeerId)
				if (webrtcPeers && webrtcPeers.length > 0) {
					success = true
					result = await webrtcPeerPool.send(connectPeerId, data)
				} else {
					success = true
					result = await libp2pClientPool.send(connectPeerId, p2pPeer.chainProtocolId, data)
				}
			}
			if (success === false && connectAddress) {
				if (connectAddress.startsWith('ws')) {
					let websocket = websocketPool.get(connectAddress)
					if (websocket) {
						success = true
						result = websocket.send(data)
					}
				}
				if (success === false && connectAddress.startsWith('http')) {
					let httpClient = httpClientPool.get(connectAddress)
					if (httpClient) {
						success = true
						result = httpClient.send('/receive', data)
					}
				}
			}
			if (topic) {
				result = await pubsubPool.send(topic, data)
			}
		} catch (err: any) {
			console.error('send message:' + err)
		}
		/**
		 * 把响应数据转换成chainmessage
		 */
		if (result && result.data) {
			let response = await chainMessageHandler.responseRaw(result.data, result.remotePeerId, result.remoteAddr)
			return response
		}

		return null
	}

	/**
	接收报文处理的入口，包括接收请求报文和返回报文，并分配不同的处理方法
	*/
	async receive(chainMessage: ChainMessage): Promise<ChainMessage> {
		await chainMessageHandler.decrypt(chainMessage)
		let typ: string = chainMessage.MessageType
		let direct: string = chainMessage.MessageDirect
		let {
			sendHandler, receiveHandler, responseHandler
		} = chainMessageDispatch.getChainMessageHandler(typ)
		let response: ChainMessage
		//分发到对应注册好的处理器，主要是Receive和Response方法
		if (direct === MsgDirect[MsgDirect.Request]) {
			try {
				response = await receiveHandler(chainMessage)
			} catch (err: any) {
				console.error('receiveHandler chainMessage:' + err)
				response = chainMessageHandler.error(typ, err)

				return response
			}
		} else if (direct == MsgDirect[MsgDirect.Response]) {
			response = await responseHandler(chainMessage)
		}

		return response
	}

	/**
	 * 发送消息前负载的加密处理
	 * @param chainMessage 
	 */
	async encrypt(chainMessage: ChainMessage): Promise<ChainMessage> {
		let payload = chainMessage.Payload
		if (!payload) {
			return
		}
		let securityParams: SecurityParams = new SecurityParams()
		securityParams.NeedCompress = chainMessage.NeedCompress
		securityParams.NeedEncrypt = chainMessage.NeedEncrypt
		let targetPeerId = chainMessage.TargetPeerId
		let connectPeerId = chainMessage.ConnectPeerId
		if (!targetPeerId) {
			targetPeerId = connectPeerId
		}
		if (connectPeerId.indexOf(targetPeerId) === -1) {
			securityParams.TargetPeerId = targetPeerId
		}
		let result: SecurityParams = await SecurityPayload.encrypt(payload, securityParams)
		if (result) {
			chainMessage.TransportPayload = result.TransportPayload
			chainMessage.Payload = null
			chainMessage.PayloadSignature = result.PayloadSignature
			chainMessage.PreviousPublicKeyPayloadSignature = result.PreviousPublicKeyPayloadSignature
			chainMessage.NeedCompress = result.NeedCompress
			chainMessage.NeedEncrypt = result.NeedEncrypt
			chainMessage.PayloadKey = result.PayloadKey
		}

		return chainMessage
	}

	/**
	 * 消息接收前的解密处理
	 * @param chainMessage 
	 */
	async decrypt(chainMessage: ChainMessage): Promise<ChainMessage> {
		if (!chainMessage.TransportPayload) {
			return
		}
		let securityParams: SecurityParams = new SecurityParams()
		securityParams.NeedCompress = chainMessage.NeedCompress
		securityParams.NeedEncrypt = chainMessage.NeedEncrypt
		securityParams.PayloadSignature = chainMessage.PayloadSignature
		securityParams.PreviousPublicKeyPayloadSignature = chainMessage.PreviousPublicKeyPayloadSignature
		securityParams.PayloadKey = chainMessage.PayloadKey
		let targetPeerId = chainMessage.TargetPeerId
		if (!targetPeerId) {
			targetPeerId = chainMessage.ConnectPeerId
		}
		securityParams.TargetPeerId = targetPeerId
		securityParams.SrcPeerId = chainMessage.SrcPeerId
		let payload: any = await SecurityPayload.decrypt(chainMessage.TransportPayload, securityParams)
		if (payload) {
			chainMessage.Payload = payload
			chainMessage.TransportPayload = null
		}
	}

	error(msgType: string, err: Error): ChainMessage {
		let errMessage = new ChainMessage()
		errMessage.Payload = MsgType[MsgType.ERROR]
		errMessage.MessageType = msgType
		errMessage.Tip = err.message
		errMessage.MessageDirect = MsgDirect[MsgDirect.Response]

		return errMessage
	}

	response(msgType: string, payload: any): ChainMessage {
		let responseMessage = new ChainMessage()
		responseMessage.Payload = payload
		responseMessage.MessageType = msgType
		responseMessage.MessageDirect = MsgDirect[MsgDirect.Response]

		return responseMessage
	}

	ok(msgType: string): ChainMessage {
		let okMessage = new ChainMessage()
		okMessage.Payload = MsgType[MsgType.OK]
		okMessage.MessageType = msgType
		okMessage.Tip = "OK"
		okMessage.MessageDirect = MsgDirect[MsgDirect.Response]

		return okMessage
	}

	wait(msgType: string): ChainMessage {
		let waitMessage = new ChainMessage()
		waitMessage.Payload = MsgType[MsgType.WAIT]
		waitMessage.MessageType = msgType
		waitMessage.Tip = "WAIT"
		waitMessage.MessageDirect = MsgDirect[MsgDirect.Response]

		return waitMessage
	}

	setResponse(request: ChainMessage, response: ChainMessage) {
		response.LocalConnectAddress = ""
		response.LocalConnectPeerId = ""
		response.ConnectAddress = request.LocalConnectAddress
		response.ConnectPeerId = request.LocalConnectPeerId
		response.Topic = request.Topic
	}

	validate(chainMessage: ChainMessage) {
		if (!chainMessage.ConnectPeerId) {
			throw new Error("NullConnectPeerId")
		}
		if (!chainMessage.SrcPeerId) {
			throw new Error("NullSrcPeerId")
		}
	}

	/**
	 * 如果消息太大，而且被要求分片的话
	 * @param chainMessage 
	 */
	slice(chainMessage: ChainMessage): ChainMessage[] {
		let _packSize = (chainMessage.MessageType !== MsgType[MsgType.P2PCHAT]) ? packetSize : webRtcPacketSize
		if (chainMessage.NeedSlice !== true
			|| chainMessage.Payload.length <= _packSize) {
			return [chainMessage]
		}
		/**
		 * 如果源已经有值，说明不是最开始的节点，不用分片
		 */
		if (chainMessage.SrcPeerId) {
			return [chainMessage]
		}
		let _payload = chainMessage.Payload
		let sliceSize: number = chainMessage.Payload.length / _packSize
		sliceSize = Math.ceil(sliceSize)
		chainMessage.SliceSize = sliceSize
		let slices: ChainMessage[] = []
		for (let i = 0; i < sliceSize; ++i) {
			let slice = new ChainMessage()
			ObjectUtil.copy(chainMessage, slice)
			slice.SliceNumber = i
			let slicePayload = null
			if (i === sliceSize - 1) {
				slicePayload = _payload.substr(i * _packSize, _payload.length)
			} else {
				slicePayload = _payload.substring(i * _packSize, (i + 1) * _packSize)
			}
			slice.Payload = slicePayload
			slices.push(slice)
		}
		return slices
	}

	/**
	 * 如果分片进行合并
	 * @param chainMessage 
	 */
	merge(chainMessage: ChainMessage): ChainMessage {
		if (chainMessage.NeedSlice !== true
			|| !chainMessage.SliceSize || chainMessage.SliceSize < 2) {
			return chainMessage
		}
		/**
		 * 如果不是最终目标，不用合并
		 */
		let targetPeerId = chainMessage.TargetPeerId
		if (!targetPeerId) {
			targetPeerId = chainMessage.ConnectPeerId
		}
		if (targetPeerId !== myself.myselfPeer.peerId) {
			return chainMessage
		}
		let uuid = chainMessage.UUID
		let sliceSize = chainMessage.SliceSize
		if (!this.caches.has(uuid)) {
			let slices: ChainMessage[] = []
			this.caches.set(uuid, slices)
		}
		let slices: ChainMessage[] = this.caches.get(uuid)
		slices[chainMessage.SliceNumber] = chainMessage
		if (slices.length === sliceSize) {
			let payload = null
			for (let slice of slices) {
            	let _payload = slice.Payload
                payload = payload ? payload + _payload : _payload
			}
            console.log("merge")
			console.log(chainMessage)
            console.log(payload)
			chainMessage.Payload = payload
			this.caches.delete(uuid)

			return chainMessage
		}
		return null
	}
}
export let chainMessageHandler = new ChainMessageHandler()

/**
 * 根据ChainMessage的类型进行分派
 */
class ChainMessageDispatch {
	/**
		为每个消息类型注册接收和发送的处理函数，从ChainMessage中解析出消息类型，自动分发到合适的处理函数
	*/
	private chainMessageHandlers: any = {}

	constructor() {

	}

	getChainMessageHandler(msgType: string): any {
		return this.chainMessageHandlers[msgType]
	}

	registChainMessageHandler(msgType: string,
		sendHandler: any,
		receiveHandler: any,
		responseHandler: any) {
		let chainMessageHandler: any = {
			sendHandler: sendHandler,
			receiveHandler: receiveHandler,
			responseHandler: responseHandler
		}

		this.chainMessageHandlers[msgType] = chainMessageHandler
	}
}
export let chainMessageDispatch = new ChainMessageDispatch()
