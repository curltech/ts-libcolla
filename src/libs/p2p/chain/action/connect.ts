import { ChainMessage, MsgType } from '../message'
import { BaseAction, PayloadType } from '../baseaction'

/**
在chain目录下的采用自定义protocol "/chain"的方式自己实现的功能
*/
class ConnectAction extends BaseAction {
	constructor(msgType: MsgType) {
		super(msgType)
	}

	async connect(connectPeerId: string, peerClient: any): Promise<any> {
		let chainMessage: ChainMessage = this.prepareSend(connectPeerId, peerClient, null)
		chainMessage.PayloadType = PayloadType.PeerClient

		let response: ChainMessage = await this.send(chainMessage)
		if (response) {
			return response.Payload
		}

		return null
	}

	receive(chainMessage: ChainMessage): ChainMessage {
		chainMessage = super.receive(chainMessage)
		if (chainMessage && connectAction.receivers) {
			connectAction.receivers.forEach(async (receiver, key) => {
				await receiver(chainMessage)
			})

			return null
		}
	}
}
export let connectAction = new ConnectAction(MsgType.CONNECT)