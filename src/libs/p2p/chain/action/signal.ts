import { ChainMessage, MsgType } from '../message'
import { BaseAction } from '../baseaction'
import { webrtcPeerPool } from '../../transport/webrtcpeerpool'

/**
在chain目录下的采用自定义protocol "/chain"的方式自己实现的功能
*/
export class SignalAction extends BaseAction {
	constructor(msgType: MsgType) {
		super(msgType)
		webrtcPeerPool.registSignalAction(this)
	}

	async signal(connectPeerId: string, data: any, targetPeerId: string): Promise<any> {
		let chainMessage: ChainMessage = signalAction.prepareSend(connectPeerId, data, targetPeerId)
		// TODO: 视频通话的signal加密送过去解密完数据有问题，具体原因还没找到
		//chainMessage.NeedEncrypt = true

		let response: ChainMessage = await signalAction.send(chainMessage)
		if (response) {
			return response.Payload
		}

		return null
	}

	receive(chainMessage: ChainMessage): ChainMessage {
		chainMessage = super.receive(chainMessage)
		if (chainMessage && signalAction.receivers) {
			signalAction.receivers.forEach((receiver, key) => {
				receiver(chainMessage.SrcPeerId, chainMessage.SrcConnectPeerId, chainMessage.SrcConnectSessionId, chainMessage.Payload)
			})

			return null
		}
	}
}
export let signalAction = new SignalAction(MsgType.SIGNAL)