import { ChainMessage, MsgType } from '../message'
import { BaseAction } from '../baseaction'
import { chainMessageHandler } from '../chainmessagehandler'
import { webrtcPool } from '../../transport/webrtc_base'

/**
在chain目录下的采用自定义protocol "/chain"的方式自己实现的功能
*/
class RtcAnswerAction extends BaseAction {
	constructor(msgType: MsgType) {
		super(msgType)
	}

	async answer(connectPeerId: string, data: any, targetPeerId: string): Promise<any> {
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
			webrtc.receiveAnswer(chainMessage.LocalConnectPeerId, chainMessage.Payload, null)
		}
		let response: ChainMessage = chainMessageHandler.ok(chainMessage.MessageType)

		return response
	}
}
export let rtcAnswerAction = new RtcAnswerAction(MsgType.RTCANSWER)