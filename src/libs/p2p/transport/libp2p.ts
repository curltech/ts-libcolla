import { p2pPeer } from '../p2ppeer'
import { config } from '../conf/conf'
import { TypeUtil } from '../../util/util'
import { openpgp } from '../crypto/openpgp'

export class Libp2pPipe {
	public connection: any
	public stream: any
	public protocol: any
}

const itpipe: any = require('it-pipe')
const itpushable = require('it-pushable')
const { toBuffer } = require('it-buffer')
const { collect, take } = require('streaming-iterables')

export class Libp2pClient {
	private pushable = itpushable()
	private _asyncPipe: Libp2pPipe
	constructor(asyncPipe: Libp2pPipe) {
		this._asyncPipe = asyncPipe
	}

	async push(message: Buffer | String) {
		this.pushable.push(message)
	}

	/**
	 * 异步发送，无返回值
	 *
	 * @param {Buffer|String} message The message to send over `stream`
	 * @param {PullStream} stream A stream over the muxed Connection to our peer
	 */
	async write() {
		let _that = this
		try {
			itpipe(
				_that.pushable,
				_that._asyncPipe.stream.sink
			)
		} catch (err) {
			console.error(err)
		}
	}

	/**
	 * 异步管道接收消息
	 */
	async receive() {
		let _that = this
		try {
			await itpipe(
				_that._asyncPipe.stream.source,
				async function (source: any) {
					for await (const message of source) {
						let {
							receiveHandler
						} = libp2pClientPool.getProtocolHandler(_that._asyncPipe.protocol)
						if (receiveHandler) {
							let connection = _that._asyncPipe.connection
							let remotePeerId = connection.remotePeer.toB58String()
							let remoteAddr = connection.remoteAddr.toString()
							/**
							 * 调用注册的接收处理器处理接收的原始数据
							 */
							let buf=openpgp.concatUint8Array(message._bufs)
							let data: Uint8Array = await receiveHandler(buf, remotePeerId, remoteAddr)
							/**
							 * 如果有返回的响应数据，则发送回去，不可以调用同步的发送方法send
							 */
							if (data) {
								_that.push(Buffer.from(data))
							}
						}
					}
				}
			)
			// await _that.pipe([], _that._p2pPipe.stream)
		} catch (err) {
			console.error(err)
		}
	}

	/**
	 * 同步管道发送，等待返回的信息
	 *
	 * @param {Buffer|String} message The message to send over `stream`
	 * @param {PullStream} stream A stream over the muxed Connection to our peer
	 */
	async send(syncPipe: Libp2pPipe, message: Buffer | String): Promise<any> {
		if (syncPipe == null) {
			throw new Error("NoSyncPipe")
		}
		let _that = this
		try {
			const result: any = await itpipe(
				[message],
				syncPipe.stream,
				async function (source: any) {
					for await (const message of source) {
						if (!syncPipe) {
							console.error('_syncPipe is null')
						}
						let connection = syncPipe.connection
						let remotePeerId = connection.remotePeer.toB58String()
						let remoteAddr = connection.remoteAddr.toString()
						/**
						 * 发送返回的原始数据
						 */
						let buf = openpgp.concatUint8Array(message._bufs)
						let result = { data: buf, remotePeerId: remotePeerId, remoteAddr: remoteAddr }

						return result
					}
				}
			)
			//await itpipe([], _that._syncPipe.stream)
			await syncPipe.stream.close()

			return result
		} catch (err) {
			console.error(err)
		}
	}

	/**
	 * 关闭管道
	 */
	async close() {
		try {
			if (this._asyncPipe) {
				await this._asyncPipe.stream.close()
				this._asyncPipe = null
			}
		} catch (err) {
			console.error('stream close error:' + err)
		}
	}

	/**
	 * 重置管道
	 */
	async reset() {
		try {
			if (this._asyncPipe) {
				await this._asyncPipe.stream.reset()
				this._asyncPipe = null
			}
		} catch (err) {
			console.error('stream reset error:' + err)
		}
	}
}

/**
 * libp2p客户端池
 */
export class Libp2pClientPool {
	private libp2pClients = new Map<string, Libp2pClient>()
	private protocolHandlers = new Map()
	constructor() { }

	/**
	 * 与配置的定位器建立连接
	 */
	async init() {
		let connectPeerId = config.appParams.connectPeerId
		if (connectPeerId && TypeUtil.isArray(connectPeerId)) {
			for (let peerId of connectPeerId) {
				try {
					let libp2pClient = await this.create(peerId, config.p2pParams.chainProtocolId)
				} catch (err) {
					console.error(err)
				}
			}
		}
	}

	registProtocolHandler(protocol: string, receiveHandler: any) {
		this.protocolHandlers.set(protocol, {
			receiveHandler: receiveHandler
		})
	}

	getProtocolHandler(protocol: string): any {
		return this.protocolHandlers.get(protocol)
	}

	/**
	 * 接收原始的消息
	 */
	async handleRaw(options: any) {
		let { connection, stream, protocol } = options
		let key = connection.remotePeer.toB58String() + ':' + protocol.protocolId
		let libp2pClient = null
		if (!this.libp2pClients.has(key)) {
			let asyncPipe = new Libp2pPipe()
			asyncPipe.connection = connection
			asyncPipe.protocol = protocol
			asyncPipe.stream = stream
			libp2pClient = new Libp2pClient(asyncPipe)
			this.libp2pClients.set(key, libp2pClient)
		} else {
			libp2pClient = this.libp2pClients.get(key)
		}
		await libp2pClient.receive()
	}

	get(peerId: string, protocolId: string): Libp2pClient {
		let key = peerId + ':' + protocolId
		if (this.libp2pClients.has(key)) {
			return this.libp2pClients.get(key)
		}
		return null
	}

	async create(peerId: string, protocolId: string): Promise<Libp2pClient> {
		let key = peerId + ':' + protocolId
		/**
		 * 异步流，应该叫接收流，不会关闭，用于接收服务器端发来的数据
		 * 同步流，应该叫发送流，每次都会创建新的，可以做成支持同步或者异步发送，
		 * 因为服务器端在完成时会主动关闭，所以同步方式更好，异步没有必要了
		 */
		let asyncPipe = await this.createStream(peerId, protocolId)
		console.log('asyncPipe:' + peerId + '-' + protocolId)
		console.log(JSON.stringify(asyncPipe))
		if (asyncPipe) {
			let libp2pClient = new Libp2pClient(asyncPipe)
			libp2pClient.receive()
			this.libp2pClients.set(key, libp2pClient)

			return libp2pClient
		}
		return null
	}

	async createStream(peerId: string, protocolId: string): Promise<Libp2pPipe> {
		if (!protocolId) {
			protocolId = config.p2pParams.chainProtocolId
		}
		let pipe = await p2pPeer.createStream(peerId, protocolId)

		return pipe
	}

	/**
	 * 目前不能使用，stream不能复用，未来考虑异步发送消息，还是采用新流的方式
	 * @param connectPeerId 
	 * @param protocolId 
	 * @param data 
	 */
	async write(connectPeerId: string, protocolId: string, data: Uint8Array) {
		let libp2pClient: Libp2pClient = this.get(connectPeerId, protocolId)
		if (!libp2pClient) {
			libp2pClient = await this.create(connectPeerId, protocolId)
			await libp2pClient.push(Buffer.from(data))
		} else {
			await libp2pClient.push(Buffer.from(data))
		}
	}

	/**
	 * 同步发送消息，每次都采用新流，服务器端会主动关闭流
	 * @param connectPeerId 
	 * @param protocolId 
	 * @param data 
	 */
	async send(connectPeerId: string, protocolId: string, data: Uint8Array): Promise<any> {
		let libp2pClient: Libp2pClient = this.get(connectPeerId, protocolId)

		if (!libp2pClient) {
			libp2pClient = await this.create(connectPeerId, protocolId)
		}
		let syncPipe = await this.createStream(connectPeerId, protocolId)
		console.log('syncPipe:' + connectPeerId + '-' + protocolId)
		console.log(JSON.stringify(syncPipe))
		let result = await libp2pClient.send(syncPipe, Buffer.from(data))

		return result
	}

	async closeByKey(key: string) {
		if (this.libp2pClients.has(key)) {
			let libp2pClient = this.libp2pClients.get(key)
			await libp2pClient.close()
			this.libp2pClients.delete(key)
			console.log('closeByKey:' + key)
		}
	}

	async close(peerId: string, protocolId: string) {
		let key = peerId + ':' + protocolId
		await this.closeByKey(key)
	}

	async closeAll() {
		this.libp2pClients.forEach(async (value , key) => {
			await this.closeByKey(key)
		});
	}
}
export let libp2pClientPool = new Libp2pClientPool()