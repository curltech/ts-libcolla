const IPFS = require('ipfs')
const IpfsHttpClient = require("ipfs-http-client")
const Room = require('ipfs-pubsub-room')
const ipns = require("ipns")
const all = require('it-all')
const VideoStream = require('videostream')
const toStream = require('it-to-stream')
const uint8ArrayConcat = require('uint8arrays/concat')
const uint8ArrayFromString = require('uint8arrays/from-string')
const uint8ArrayToString = require('uint8arrays/to-string')

/**
 * ipfs的节点
 */
class IpfsNode {
	private node: any
	constructor() {
	}

	/**
	 * 创建Ipfs节点
	 */
	async init() {
		this.node = await IPFS.create({
			//libp2p: libp2p,
			repo: String(Math.random() + Date.now()),
			init: { alogorithm: 'ed25519' },
			relay: {
				enabled: true, // enable relay dialer/listener (STOP)
				hop: {
					enabled: true // make this node a relay (HOP)
				}
			},
			config: {
				Addresses: {
					Swarm: [
						// This is a public webrtc-star server
						'/dns4/wrtc-star1.par.dwebops.pub/tcp/443/wss/p2p-webrtc-star',
						'/dns4/wrtc-star2.sjc.dwebops.pub/tcp/443/wss/p2p-webrtc-star',
						'/ip4/127.0.0.1/tcp/13579/wss/p2p-webrtc-star'
					],
					"API": "/ip4/127.0.0.1/tcp/5002",
					"Gateway": "/ip4/127.0.0.1/tcp/9090"
				},
				// If you want to connect to the public bootstrap nodes, remove the next line
				Bootstrap: []
			},
			pass: "01234567890123456789",
			EXPERIMENTAL: { ipnsPubsub: true }
		})
		console.info('this.node.version:' + this.node.version)
		let addr = await this.addr
		console.info('this.node.addrs:' + addr)
	}

	async addr(): Promise<string> {
		let info = await this.node.id()

		let addresses = info.addresses.map((address) => {
			return address
		}).join('')

		return addresses
	}

	async add(path: string, content: string): Promise<any> {
		let fileAdded = await this.node.add({
			path: path,
			content: content
		})
		console.log('Added file:', fileAdded.path, fileAdded.cid)

		return fileAdded
	}

	async get(cid: any): Promise<string> {
		const chunks = await all(this.node.cat(cid))
		let content: string = uint8ArrayConcat(chunks).toString()
		console.log('Added file contents:', content)

		return content
	}

	/**
	 * files是对象数组，对象是{path:path,content:"hello"}
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
		const data = await this.node.add(stream)

		console.info('Added ' + data.path + ' hash: ' + data.hash)

		// The last data event will contain the directory hash
		if (data.path === path) {
			return data.cid
		}

		return data
	}

	/**
	 * websocket连接
	 * @param multiaddr 
	 */
	async connect(multiaddr: any) {
		return await this.node.swarm.connect(multiaddr)
	}

	async peers() {
		const peers = await this.node.swarm.peers()

		return peers
	}

	async messageHandler(message: any) {
		const myself = this.node.id().id.toString()
		const hash = message.data.toString()
		const messageSender = message.from

		if (myself !== messageSender) {
			let content = await this.get(hash)
			console.info(content)
		}
	}

	async subscribe(topic: string) {
		await this.node.pubsub.subscribe(topic, this.messageHandler)
	}

	async subscribePeers(topic: string) {
		const peers = await this.node.pubsub.peers(topic)

		return peers
	}

	async publish(topic: string, content: string) {
		let data = uint8ArrayFromString(content)
		await this.node.pubsub.publish(topic, data)
	}

	async unsubscribe(topic: string) {
		await this.node.pubsub.unsubscribe(topic)
	}

	createVideoStream(cid:string){
		// Set up the video stream an attach it to our <video> element
		let stream
    const videoStream = new VideoStream({
      createReadStream: function createReadStream (opts) {
        const start = opts.start

        // The videostream library does not always pass an end byte but when
        // it does, it wants bytes between start & end inclusive.
        // catReadableStream returns the bytes exclusive so increment the end
        // byte if it's been requested
        const end = opts.end ? start + opts.end + 1 : undefined

        console.info(`Stream: Asked for data starting at byte ${start} and ending at byte ${end}`)

        // If we've streamed before, clean up the existing stream
        if (stream && stream.destroy) {
          stream.destroy()
        }

        // This stream will contain the requested bytes
        stream = toStream.readable(this.node.cat(cid.trim(), {
          offset: start,
          length: end && end - start
        }))

        // Log error messages
        stream.on('error', (error) => console.error(error))

        if (start === 0) {
          // Show the user some messages while we wait for the data stream to start
          console.error(stream)
        }

        return stream
      }
		}, this.createVideoElement(''))
		
		return videoStream
	}

	createVideoElement (name:string){
		const videoElement = document.getElementById(name)
		videoElement.addEventListener('loadedmetadata', () => {
			videoElement.play()
				.catch(console.error)
		})
	
		const events = [
			'playing',
			'waiting',
			'seeking',
			'seeked',
			'ended',
			'loadedmetadata',
			'loadeddata',
			'canplay',
			'canplaythrough',
			'durationchange',
			'play',
			'pause',
			'suspend',
			'emptied',
			'stalled',
			'error',
			'abort'
		]
		events.forEach(event => {
			videoElement.addEventListener(event, () => {
				console.error(`Video: ${event}`)
			})
		})
	
		videoElement.addEventListener('error', () => {
			console.error(videoElement.error)
		})
	
		return videoElement
	}

	createRoom(name) {
    const room = new Room(this.node, name)
		let peersSet=new Set()
    room.on('peer joined', (peer) => {
      console.log('peer ' + peer + ' joined')
      peersSet.add(peer)
    })

    room.on('peer left', (peer) => {
      console.log('peer ' + peer + ' left')
      peersSet.delete(peer)
    })

    // send and receive messages
    room.on('message', (message) => {
      console.log('got message from ' + message.from + ': ' + uint8ArrayToString(message.data))
    })

    return room
  }
}
export let ipfsNode = new IpfsNode()