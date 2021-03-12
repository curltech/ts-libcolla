import { chainMessageDispatch, chainMessageHandler } from './chainmessagehandler'
import { config } from '../conf/conf'
import { UUID, ObjectUtil } from '../../util/util'
import { ChainMessage, MsgType, MsgDirect } from './message'

const packetSize = 20000

export class PayloadType {
	static PeerClient = 'peerClient'
	static PeerEndpoint = 'peerEndpoint'
	static ChainApp = 'chainApp'
	static DataBlock = 'dataBlock'
	static ConsensusLog = "consensusLog"

	static PeerClients = 'peerClients'
	static PeerEndpoints = 'peerEndpoints'
	static ChainApps = 'chainApps'
	static DataBlocks = 'dataBlocks'

	static String = 'string'
	static Map = 'map'
}

export class NamespacePrefix {
	static PeerEndpoint = 'peerEndpoint'
	static PeerClient = 'peerClient'
	static PeerClient_Mobile = 'peerClientMobile'
	static ChainApp = 'chainApp'
	static DataBlock = 'dataBlock'
	static DataBlock_Owner = 'dataBlockOwner'
	static PeerTransaction_Src = 'peerTransactionSrc'
	static PeerTransaction_Target = 'peerTransactionTarget'
	static TransactionKey = 'transactionKey'

	static getPeerEndpointKey(peerId: string): string {
		let key: string = '/' + NamespacePrefix.PeerEndpoint + '/' + peerId

		return key
	}

	static getPeerClientKey(peerId: string): string {
		let key: string = '/' + NamespacePrefix.PeerClient + '/' + peerId

		return key
	}

	static getPeerClientMobileKey(mobile: string): string {
		//mobileHash:= std.EncodeBase64(std.Hash(mobile, "sha3_256"))
		let key: string = '/' + NamespacePrefix.PeerClient_Mobile + '/' + mobile

		return key
	}

	static getChainAppKey(peerId: string): string {
		let key: string = '/' + NamespacePrefix.ChainApp + '/' + peerId

		return key
	}

	static getDataBlockKey(blockId: string): string {
		let key: string = '/' + NamespacePrefix.DataBlock + '/' + blockId

		return key
	}
}

export abstract class BaseAction {
	protected msgType: MsgType
	protected receivers: Map<string, any>

	constructor(msgType: MsgType) {
		this.msgType = msgType
		chainMessageDispatch.registChainMessageHandler(MsgType[msgType], this.send, this.receive, this.response)
	}

	registReceiver(name: string, receiver: any): boolean {
		if (!this.receivers) {
			this.receivers = new Map<string, any>()
		}
		if (this.receivers.has(name)) {
			return false
		}
		this.receivers.set(name, receiver)

		return true
	}

	prepareSend(connectPeerId: string, data: any, targetPeerId: string): ChainMessage {
		let chainMessage: ChainMessage = new ChainMessage()
		if (!connectPeerId) {
			connectPeerId = config.appParams.connectPeerId[0]
		}
		chainMessage.ConnectPeerId = connectPeerId
		chainMessage.Payload = data
		chainMessage.TargetPeerId = targetPeerId
		chainMessage.PayloadType = PayloadType.Map
		chainMessage.MessageType = MsgType[this.msgType]
		chainMessage.MessageDirect = MsgDirect[MsgDirect.Request]
		chainMessage.NeedCompress = true
		chainMessage.NeedEncrypt = false
		chainMessage.UUID = UUID.string(null, null)

		return chainMessage
	}

	/**
	主动发送消息，在发送之前对消息进行必要的分片处理
	*/
	async send(chainMessage: ChainMessage): Promise<ChainMessage> {
		let slices: ChainMessage[] = chainMessageHandler.slice(chainMessage)
		if (slices.length > 0) {
			if (slices.length === 1) {
				let response = await chainMessageHandler.send(slices[0])
				return response
			} else {
				let ps = []
				for (let slice of slices) {
					let p = chainMessageHandler.send(slice)
					ps.push(p)
				}
				let responses: any[] = await Promise.all(ps)
				if (responses && responses.length > 1) {
					let response = new ChainMessage()
					ObjectUtil.copy(responses[0], response)
					let payloads = []
					for (let res of responses) {
						payloads.push(res.Payload)
					}
					response.Payload = payloads

					return response
				}
			}
		}

		return null
	}

	/**
	接收消息进行处理，在接收之前对消息进行必要的分片合并处理
	返回为空则没有返回消息，否则，有返回消息
	*/
	receive(chainMessage: ChainMessage): ChainMessage {
		/*let msg = chainMessageHandler.merge(chainMessage)
		let response: ChainMessage = null
		if (msg == null) {
			response = chainMessageHandler.wait(chainMessage.MessageType)
		} else {
			response = chainMessageHandler.ok(chainMessage.MessageType)
		}

		return response*/
		return chainMessageHandler.merge(chainMessage)
	}

	/**
	处理返回消息
	*/
	async response(chainMessage: ChainMessage): Promise<ChainMessage> {

		return chainMessage
	}
}