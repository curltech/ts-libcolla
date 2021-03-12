import { ChainMessage, MsgType } from '../message'
import { BaseAction } from '../baseaction'
import { ionSfuClientPool } from '../../transport/ionsfuclient'

/**
在chain目录下的采用自定义protocol "/chain"的方式自己实现的功能
*/
export class IonSignalAction extends BaseAction {
	constructor(msgType: MsgType) {
		super(msgType)
		ionSfuClientPool.registSignalAction(this)
	}

	async signal(connectPeerId: string, data: any, targetPeerId: string): Promise<any> {
		let chainMessage: ChainMessage = ionSignalAction.prepareSend(connectPeerId, data, targetPeerId)
		chainMessage.NeedEncrypt = true

		let response: ChainMessage = await ionSignalAction.send(chainMessage)
		if (response) {
			console.info('IonSignal response:' + JSON.stringify(response))
			return response.Payload
		}

		return null
	}

	receive(chainMessage: ChainMessage): ChainMessage {
		chainMessage = super.receive(chainMessage)
		if (chainMessage && ionSignalAction.receivers) {
			ionSignalAction.receivers.forEach((receiver, key) => {
				receiver(chainMessage.SrcPeerId, chainMessage.SrcConnectPeerId, chainMessage.SrcConnectSessionId, chainMessage.Payload)
			})

			return null
		}
	}
}
export let ionSignalAction = new IonSignalAction(MsgType.IONSIGNAL)