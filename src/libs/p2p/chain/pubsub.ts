import { p2pPeer } from '../p2ppeer'
import { chainMessageHandler } from './chainmessagehandler'

/**
 * 发布订阅主题的池
 */
export class PubsubPool {
	private pool = new Map()
	constructor() {

	}

	/**
	 * 订阅主题，收到的消息由subHandle函数处理
	 */
	async subscribe(topicname: string): Promise<any> {
		let topic: any = this.pool.get(topicname)
		if (!topic) {
			p2pPeer.pubsub.on(topicname, this.subHandle)
			let sub = await p2pPeer.pubsub.subscribe(topicname)
			this.pool.set(topicname, sub)
		}

		return topic
	}

	/**
	 * 接触订阅主题
	 * @private
	 */
	unsubscribe(topicname: string) {
		p2pPeer.pubsub.removeListener(topicname, this.subHandle)
		p2pPeer.pubsub.unsubscribe(topicname)
		this.pool.delete(topicname)
	}

	/**
	 * 收到订阅的消息进行处理
	 * { from: string, data: Uint8Array, seqno: Uint8Array, topicIDs: Array<string>, signature: Uint8Array, key: Uint8Array }
	 * @param message 
	 */
	subHandle(message: any) {
		try {
			chainMessageHandler.receiveRaw(message.data, null, null)
		} catch (err) {
			console.error(err)
		}
	}

	/**
	 * 向主题发送消息
	 * @param {string} message The chat message to send
	 */
	async send(topicname: string, data: Uint8Array) {
		await p2pPeer.pubsub.publish(topicname, data)
	}

	/**
	 * 获取主题的所以订阅者
	 * @param topicname 
	 */
	getSubscribers(topicname: string): Array<string> {
		const peerIds = p2pPeer.pubsub.getSubscribers(topicname)

		return peerIds
	}

	/**
	 * 获取所有的订阅的主题
	 */
	getTopics(): Array<string> {
		const topics = p2pPeer.pubsub.getTopics()

		return topics
	}
}

export let pubsubPool = new PubsubPool()