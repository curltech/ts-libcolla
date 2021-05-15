import { TypeUtil } from '../../util/util'
const IpfsHttpClient = require('ipfs-http-client')
const all = require('it-all')
const uint8ArrayConcat = require('uint8arrays/concat')
const uint8ArrayFromString = require('uint8arrays/from-string')
const uint8ArrayToString = require('uint8arrays/to-string')

/**
 * 使用ipfs-http-client连接的节点
 */
export class IpfsClientNode {
	private client: any
	private url: string
	private peerId: string
	private version: any
	private topics = new Map<string, any>()
	constructor(options: any) {
		this.init(options)
	}

	/**
	 * 使用ipfs-http-client连接节点http://localhost:5001/api/v0
	 * @param addr 
	 */
	async init(options: any) {
		this.client = IpfsHttpClient(options)
		const { id, agentVersion } = await this.client.id()
		this.peerId = id
		this.version = agentVersion
	}

	async addr(): Promise<string> {
		let info = await this.client.id()

		let addresses = info.addresses.map((address) => {
			return address
		}).join('')

		return addresses
	}

	/**
	 * 加文件到节点
	 * @param path 
	 * @param content 
	 */
	async add(path: string, content: string): Promise<any> {
		if (!this.client) throw new Error('Connect to a node first')
		let fileAdded = null
		if (content){
			fileAdded = await this.client.add({
				path: path,
				content: content
			})
		} else {
			const {urlSource} = IpfsHttpClient
			fileAdded = await this.client.add(urlSource(path)) //('https://ipfs.io/images/ipfs-logo.svg'))
		}
		console.info('Added file:', fileAdded.path, fileAdded.cid)

		return fileAdded
	}

	/**
	 * 获取节点上的文件内容
	 * @param cid 
	 */
	async get(cid: any): Promise<string> {
		const chunks = await all(this.client.cat(cid))
		let content: string = uint8ArrayConcat(chunks).toString()
		console.info('Added file contents:', content)

		return content
	}

	/**
	 * 加一批文件到节点路径
	 * @param path 
	 * @param files 
	 */
	async addFiles(path: string, files: any): Promise<any> {
		// Create a stream to write files to
		let stream = new ReadableStream({
			start(controller) {
				for (let i = 0; i < files.length; i++) {
					// Add the files one by one
					controller.enqueue(files[i])
				}
				// When we have no more files to add, close the stream
				controller.close()
			}
		})
		// ipfs.addReadableStream
		const data = await this.client.add(stream)

		console.info('Added ' + data.path + ' hash: ' + data.hash)

		// The last data event will contain the directory hash
		if (data.path === path) {
			return data.cid
		}

		return data
	}

	/**
	 * 连接到另一个节点
	 * /ip4/127.0.0.1/tcp/5001
	 * @param multiaddr 
	 */
	async connect(multiaddr: any) {
		if (!this.client) throw new Error('Connect to a node first')
		return await this.client.swarm.connect(multiaddr)
	}

	/**
	 * 关闭节点
	 */
	async close() {
		if (!this.client) throw new Error('Connect to a node first')
		if (this.client && this.topics) {
			this.topics.forEach(async (topic , key) =>{
				console.info(`Unsubscribing from topic ${key}`)
				await this.client.pubsub.unsubscribe(key)
			})
		}
		this.topics = null
		this.peerId = null
		this.client = null
		ipfsClientNodePool.close(this.url)
	}

	/**
	 * 获取连接的所有peer，返回数组
	 */
	async peers() {
		if (!this.client) throw new Error('Connect to a node first')
		const peers = await this.client.swarm.peers()

		return peers
	}

	/**
	 * 订阅topic
	 * @param topic 
	 */
	async subscribe(topic: string, handler: any) {
		if (!topic) throw new Error('Missing topic name')
		if (!this.client) throw new Error('Connect to a node first')

		if (this.topics && this.topics.has(topic)) {
			this.topics.delete(topic)
			console.info(`Unsubscribing from topic ${topic}`)
			await this.client.pubsub.unsubscribe(topic)
		}

		console.info(`Subscribing to ${topic}...`)

		await this.client.pubsub.subscribe(topic, msg => {
			const from = msg.from
			const seqno = uint8ArrayToString(msg.seqno, 'base16')
			if (from === this.peerId) return console.info(`Ignoring message ${seqno} from self`)
			console.info(`Message ${seqno} from ${from}:`)
			try {
				handler(JSON.stringify(uint8ArrayToString(msg.data), null, 2))
			} catch (_) {
				handler(uint8ArrayToString(msg.data, 'base16'))
			}
		})

		this.topics.set(topic, handler)
	}

	/**
	 * 发送消息到节点订阅的topic
	 * @param msg 
	 */
	async publishAll(msg: string) {
		console.info(`Sending message to ${this.topics}...`)
		this.topics.forEach(async (topic , key) =>{
			await this.publish(key, msg)
		})
	}

	async publish(topic: string, msg: string) {
		if (!msg) throw new Error('Missing message')
		if (!this.topics.has(topic)) throw new Error('Subscribe to a topic first')
		if (!this.client) throw new Error('Connect to a node first')
		let data = uint8ArrayFromString(msg)
		await this.client.pubsub.publish(topic, data)
	}
}

/**
 * 使用ipfs-http-client连接的节点池
 */
export class IpfsClientNodePool {
	private ipfsClientNodes = new Map<string, IpfsClientNode>()
	constructor() {
	}

	create(options: any): IpfsClientNode {
		let url=options
		if (!TypeUtil.isString(options)) {
			url = options.url
		}
		if (this.ipfsClientNodes.has(url)) {
			this.ipfsClientNodes.delete(url)
		}
		let ipfsClientNode = new IpfsClientNode(options)
		if (ipfsClientNode) {
			this.ipfsClientNodes.set(url, ipfsClientNode)

			return ipfsClientNode
		}

		return null
	}

	get(url: string): IpfsClientNode {
		if (this.ipfsClientNodes.has(url)) {
			return this.ipfsClientNodes.get(url)
		} else {
			let ipfsClientNode = new IpfsClientNode(url)
			if (ipfsClientNode) {
				this.ipfsClientNodes.set(url, ipfsClientNode)

				return ipfsClientNode
			}
		}

		return null
	}

	close(url: string) {
		if (this.ipfsClientNodes.has(url)) {
			return this.ipfsClientNodes.delete(url)
		}
	}
}
export let ipfsClientNodePool = new IpfsClientNodePool()
