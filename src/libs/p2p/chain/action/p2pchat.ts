import { ChainMessage, MsgType } from '../message'
import { BaseAction } from '../baseaction'

/**
在chain目录下的采用自定义protocol "/chain"的方式自己实现的功能
*/
export class P2pChatAction extends BaseAction {
	constructor(msgType: MsgType) {
		super(msgType)
	}

	async chat(connectPeerId: string, data: any, targetPeerId: string): Promise<any> {
		data = JSON.stringify(data)
		let chainMessage: ChainMessage = this.prepareSend(connectPeerId, data, targetPeerId)
		// 已经使用signal protocol加密，不用再加密
		//chainMessage.NeedEncrypt = true
        chainMessage.NeedSlice = true
		let response: ChainMessage = await this.send(chainMessage)
		if (response) {
			return response.Payload
		}

		return null
	}

	receive(chainMessage: ChainMessage): ChainMessage {
		chainMessage = super.receive(chainMessage)
		if (chainMessage && p2pChatAction.receivers) {
			let _payload = JSON.parse(chainMessage.Payload)
			p2pChatAction.receivers.forEach(async (receiver, key) => {
				await receiver(chainMessage.SrcPeerId, _payload)
			})

			return null
		}
	}
}
export let p2pChatAction = new P2pChatAction(MsgType.P2PCHAT)
