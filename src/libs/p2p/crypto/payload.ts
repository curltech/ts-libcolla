import { openpgp } from './openpgp'
import { messageSerializer } from '../chain/message'
import { myself } from '../dht/myselfpeer'
import { peerClientService } from '../dht/peerclient'

const CompressLimit: number = 2048

export class SecurityParams {
	constructor() { }

	public TransportPayload: string
	public PayloadSignature: string
	public PreviousPublicKeyPayloadSignature: string
	public NeedCompress: boolean
	public NeedEncrypt: boolean
	public PayloadKey: string
	public TargetPeerId: string
	public SrcPeerId: string
	public PayloadHash: string
}

/**
 * 对任意结构的负载进行压缩，签名，加密处理
 */
export class SecurityPayload {
	constructor() { }

	/**
	 * 加密参数必须有是否压缩，是否加密，目标peerId
	 * 返回参数包括结果负载，是否压缩，是否加密，加密键值，签名
	 * @param payload 
	 * @param securityParams 
	 */
	static async encrypt(payload: any, securityParams: SecurityParams): Promise<SecurityParams> {
		let result: SecurityParams = new SecurityParams()
		let transportPayload: string = messageSerializer.textMarshal(payload)
		// 原始字符串转换成utf-8数组
		let data: Uint8Array = openpgp.stringToUtf8Uint8Array(transportPayload)

		// 消息的数据部分转换成字符串，签名，加密，压缩，base64
		let privateKey = myself.privateKey
		if (!privateKey) {
			throw new Error("NullPrivateKey")
		}
		result.NeedEncrypt = securityParams.NeedEncrypt
		result.NeedCompress = securityParams.NeedCompress
		// 1.设置签名（本地保存前加密不签名）
		let targetPeerId = securityParams.TargetPeerId
		if (securityParams.NeedEncrypt === true && targetPeerId && targetPeerId.indexOf(myself.myselfPeer.peerId) === -1) {
			let payloadSignature = await openpgp.sign(data, privateKey)
			result.PayloadSignature = payloadSignature
			if (myself.expiredKeys.length > 0) {
				let previousPublicKeyPayloadSignature = await openpgp.sign(data, myself.expiredKeys[0].expiredPrivateKey)
				result.PreviousPublicKeyPayloadSignature = previousPublicKeyPayloadSignature
			}
		}

		// 本地保存NeedCompress为true即压缩，ChainMessage压缩还需判断transportPayload.length
		if (securityParams.NeedCompress === true && (!targetPeerId || (targetPeerId && transportPayload.length > CompressLimit))) {
			//2. 压缩数据
			data = openpgp.compress(data)
		} else {
			result.NeedCompress = false
		}
		if (securityParams.NeedEncrypt === true) {
			//3. 数据加密，base64
			let targetPublicKey: any = null
			if (targetPeerId && targetPeerId.indexOf(myself.myselfPeer.peerId) === -1) {
				targetPublicKey = await peerClientService.getPublic(securityParams.TargetPeerId)
			} else { // 本地保存前加密
				targetPublicKey = myself.publicKey
			}
			if (!targetPublicKey) {
				console.warn("TargetPublicKey is null, will not be encrypted!")
				result.NeedEncrypt = false
			}

			// 目标公钥不为空时加密数据
			if (targetPublicKey) {
				let secretKey = null
				if (!securityParams.PayloadKey) {
					secretKey = await openpgp.getRandomAsciiString()
				} else {
					secretKey = await openpgp.eccDecrypt(securityParams.PayloadKey, null, privateKey)
				}
				data = await openpgp.aesEncrypt(data, secretKey)
				// 对对称密钥进行公钥加密
				let encryptedKey = await openpgp.eccEncrypt(secretKey, targetPublicKey, null)
				result.PayloadKey = encryptedKey
			} else {
				result.PayloadKey = null
			}
		}
		// 无论是否经过压缩和加密，进行based64处理
		result.TransportPayload = openpgp.encodeBase64(data)
		// 设置数据的hash，base64
		let payloadHash = await openpgp.hash(data);
		let payloadHashBase64 = openpgp.encodeBase64(payloadHash);
		result.PayloadHash = payloadHashBase64

		return result
	}

	/**
	 * 加密参数必须有是否压缩，是否加密，源peerId，目标peerId，加密键值，签名
	 * 返回负载
	 * @param payload 
	 * @param securityParams 
	 */
	static async decrypt(transportPayload: string, securityParams: SecurityParams): Promise<any> {
		let targetPeerId = securityParams.TargetPeerId
		// 本地保存前加密targetPeerId可为空
		if (!targetPeerId || targetPeerId.indexOf(myself.myselfPeer.peerId) > -1) {
			// 消息的数据部分，base64
			let data: Uint8Array = await openpgp.decodeBase64(transportPayload)
			let needEncrypt = securityParams.NeedEncrypt
			if (needEncrypt === true) {
				// 1.对对称密钥进行私钥解密
				let payloadKey = securityParams.PayloadKey
				// 消息的数据部分，数据加密过，解密
				if (payloadKey) {
					let privateKey = myself.privateKey
					if (!privateKey) {
						throw new Error("NullPrivateKey")
					}
					let payloadKeyData = null
					try {
						payloadKeyData = await openpgp.eccDecrypt(payloadKey, null, privateKey)
					} catch (e) {
						console.log(e)
					}
					let i = 0
					while (!payloadKeyData && i < myself.expiredKeys.length) {
						try {
							payloadKeyData = await openpgp.eccDecrypt(payloadKey, null, myself.expiredKeys[i].expiredPrivateKey)
						} catch (e) {
							console.log(e)
						} finally {
							i++
						}
					}
					if (!payloadKeyData) {
						throw new Error("EccDecryptFailed")
					}
					// 数据解密
					data = await openpgp.aesDecrypt(data, payloadKeyData)
				}
			}

			let needCompress = securityParams.NeedCompress
			if (needCompress === true) {
				// 2. 解压缩
				data = openpgp.uncompress(data)
			}
			//3. 消息的数据部分，验证签名
			if (needEncrypt === true) {
				let payloadSignature = securityParams.PayloadSignature
				if (payloadSignature) {
					let srcPublicKey: any = null
					let srcPeerId = securityParams.SrcPeerId
					if (srcPeerId && srcPeerId.indexOf(myself.myselfPeer.peerId) === -1) {
						srcPublicKey = await peerClientService.getPublic(securityParams.SrcPeerId)
					} else {
						throw new Error("NullSrcPeerId")
						// 本地保存前加密如果签名，验签需尝试所有expiredPublicKey
						//srcPublicKey = myself.publicKey
					}
					if (!srcPublicKey) {
						throw new Error("NullSrcPublicKey")
					}
					let pass = await openpgp.verify(data, payloadSignature, srcPublicKey)
					if (!pass) {
						let previousPublicKeyPayloadSignature = securityParams.PreviousPublicKeyPayloadSignature
						if (previousPublicKeyPayloadSignature) {
							pass = await openpgp.verify(data, previousPublicKeyPayloadSignature, srcPublicKey)
						}
						if (!pass) {
							let peerClients = await peerClientService.getPeerClient(null, securityParams.SrcPeerId, null)
							if (peerClients && peerClients.length > 0) {
								srcPublicKey = await peerClientService.getPublic(securityParams.SrcPeerId)
								if (!srcPublicKey) {
									throw new Error("NullSrcPublicKey")
								}
								pass = await openpgp.verify(data, payloadSignature, srcPublicKey)
								if (!pass) {
									console.error("PayloadVerifyFailure")
									//throw new Error("PayloadVerifyFailure")
								}
							} else {
								console.error("PeerClientNotExists")
							}
						}
					}
				}
			}
			let str: string = openpgp.utf8Uint8ArrayToString(data)
			let payload: any = messageSerializer.textUnmarshal(str)

			return payload
		}

		return null
	}
}