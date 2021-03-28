import { openpgp } from '../crypto/openpgp'

export class ChainMessage {
	public UUID!: string
	/**
	 * 最终的消息接收目标，如果当前节点不是最终的目标，可以进行转发
	 * 如果目标是服务器节点，直接转发，
	 * 如果目标是客户机节点，先找到客户机目前连接的服务器节点，也许就是自己，然后转发
	 */
	public TargetPeerId!: string
	public TargetConnectPeerId!: string
	public TargetConnectSessionId!: string
	/**
	以下两个字段方便对消息处理时寻找目的节点
	*/
	public Topic!: string
	/**
	 * src字段在发送的时候不填，到接收端自动填充,ConnectSessionId在发送的时候不填，到接收端自动填充
	 * ,第一个连接节点
	*/
	public SrcConnectSessionId!: string
	public SrcConnectPeerId!: string
	public LocalConnectPeerId!: string
	public LocalConnectAddress!: string
	public SrcPeerId!: string
	public SrcAddress!: string
	public ConnectPeerId!: string
	public ConnectAddress!: string
	public ConnectSessionId!: string
	public MessageType!: string
	public Tip!: string
	public MessageDirect!: string
	/**
	 * 经过目标peer的公钥加密过的对称密钥，这个对称密钥是随机生成，每次不同，用于加密payload
	 */
	public PayloadKey!: string
	public NeedCompress!: boolean
	public NeedEncrypt!: boolean
	public NeedSlice!: boolean
	public SecurityContext!: SecurityContext
	/**
	 * 消息负载序列化后的寄送格式，再经过客户端自己的加密方式比如openpgp（更安全）加密，签名，压缩，base64处理后的字符串
	 */
	public TransportPayload!: string
	/**
	 * 不跨网络传输，是transportPayload检验过后还原的对象，传输时通过转换成transportPayload传输
	 */
	public Payload!: any
	/**
	 * 负载json的源peer的签名
	 */
	public PayloadSignature!: string
	public PreviousPublicKeyPayloadSignature!: string
	/**
	 * 根据此字段来把TransportPayload对应的字节还原成Payload的对象，最简单的就是字符串
	 * 也可以是一个复杂的结构，但是dht的数据结构（peerendpoint），通用网络块存储（datablock）一般不用这种方式操作
	二采用getvalue和putvalue的方式操作
	*/
	public PayloadType!: string
	public CreateTimestamp!: Date

	public SliceSize!: number
	public SliceNumber!: number
}

export class SecurityContext {
	public Protocol!: string
	public KeyFactoryAlgorithm!: string
	public KeyStoreType!: string
	public KeyPairAlgorithm!: string
	public KeyPairType!: string
	public KeyPairLength!: number
	public SecretKeyAlgorithm!: string
	public SecretKeySize!: number
	public HashKeySize!: number
	public AsymmetricalAlgorithm!: string
	public SymmetricalAlgorithm!: string
	public SignatureAlgorithm!: string
	public MessageDigestAlgorithm!: string
	public KeyGeneratorAlgorithm!: string
	public HmacAlgorithm!: string
	public Username!: string
	public Password!: string
}

export enum MsgType {
	// 未定义
	UNDEFINED,
	// 消息返回正确
	OK,
	// 消息返回正确，但等待所有数据到齐
	WAIT,
	// 消息返回错误
	ERROR,
	// 发送消息peer对接收者来说不可信任
	UNTRUST,
	// 消息超时无响应
	NO_RESPONSE,
	// 通用消息返回，表示可能异步返回
	RESPONSE,
	// 消息被拒绝
	REJECT,
	// 可做心跳测试
	PING,
	// 发送聊天报文
	P2PCHAT,
	CHAT,
	FINDPEER,
	GETVALUE,
	PUTVALUE,
	SIGNAL,
	IONSIGNAL,
	RTCCANDIDATE,
	RTCANSWER,
	RTCOFFER,
	// PeerClient连接
	CONNECT,
	// PeerClient查找
	FINDCLIENT,
	// DataBlock查找
	QUERYVALUE,
	// PeerTrans查找
	QUERYPEERTRANS,
	// DataBlock保存共识消息
	CONSENSUS,
	CONSENSUS_REPLY,
	CONSENSUS_PREPREPARED,
	CONSENSUS_PREPARED,
	CONSENSUS_COMMITED,
	CONSENSUS_RAFT,
	CONSENSUS_RAFT_REPLY,
	CONSENSUS_RAFT_PREPREPARED,
	CONSENSUS_RAFT_PREPARED,
	CONSENSUS_RAFT_COMMITED,
	CONSENSUS_PBFT,
	CONSENSUS_PBFT_REPLY,
	CONSENSUS_PBFT_PREPREPARED,
	CONSENSUS_PBFT_PREPARED,
	CONSENSUS_PBFT_COMMITED
}

export enum MsgDirect {
	Request,
	Response
}

class MessageSerializer {
	constructor() {
	}

	map(src: any, target: any) {
		for (let key in src) {
			let v = src[key]
			target[key] = v
		}
	}

	marshal(value: any): Uint8Array {
		let json: string = this.textMarshal(value) + '\n'

		return this.stringToUint8Array(json)
	}

	unmarshal(data: Uint8Array): any {
		let json: string = this.uint8ArrayToString(data)

		return this.textUnmarshal(json)
	}

	textMarshal(value: any): string {
		let json: string = JSON.stringify(value)
		return json
	}

	textUnmarshal(data: string): any {
		console.log(data)
		let value = JSON.parse(data)
		return value
	}

	uint8ArrayToString(fileData: Uint8Array): string {
		let dataString = "";
		for (let i = 0; i < fileData.length; i++) {
			dataString += String.fromCharCode(fileData[i]);
		}

		return dataString
	}

	stringToUint8Array(str: string): Uint8Array {
		let arr = [];
		for (let i = 0, j = str.length; i < j; ++i) {
			arr.push(str.charCodeAt(i));
		}

		var tmpUint8Array = new Uint8Array(arr);
		return tmpUint8Array
	}

	arrayBufferToString(buf: ArrayBuffer) {
		let unit8Array = new Uint8Array(buf)
		return openpgp.encodeBase64(unit8Array)
	}
	
	stringToArrayBuffer(str: string) {
		let unit8Array = openpgp.decodeBase64(str)
		let buf = unit8Array.buffer; 
		return buf;
	}
}
export let messageSerializer = new MessageSerializer()
