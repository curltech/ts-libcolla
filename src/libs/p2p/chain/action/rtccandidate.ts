import { ChainMessage, MsgType } from '../message'
import { BaseAction } from '../baseaction'
import { chainMessageHandler } from '../chainmessagehandler'
import { webrtcPool } from '../../transport/webrtc'
import { config } from '../../conf/conf'

/**
在chain目录下的采用自定义protocol "/chain"的方式自己实现的功能
*/
class RtcCandidateAction extends BaseAction {
	constructor(msgType: MsgType) {
		super(msgType)
	}
	
	async candidate(connectPeerId: string, data: any, targetPeerId: string): Promise<any> {
		let chainMessage: ChainMessage = this.prepareSend(connectPeerId, data, targetPeerId)

		let response: ChainMessage = await this.send(chainMessage)
		if (response) {
			return response.Payload
		}

		return null
	}

	receive(chainMessage: ChainMessage): ChainMessage {
		let webrtc = webrtcPool.get(chainMessage.LocalConnectPeerId)
		if (webrtc) {
			webrtc.receiveCandidate(chainMessage.LocalConnectPeerId)
		}
		let response: ChainMessage = chainMessageHandler.ok(chainMessage.MessageType)

		return response
	}
}
export let rtcCandidateAction = new RtcCandidateAction(MsgType.RTCCANDIDATE)