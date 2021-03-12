import pako from 'pako'
import { TypeUtil } from '../../util/util'

class OpenPGP {
  private openpgp: any
  constructor() {
    this.openpgp = null
    try {
      let w: any = window
      if (w.openpgp) {
        this.openpgp = w.openpgp
      } else {
        this.openpgp = require('openpgp')
      }
    } catch {
      this.openpgp = require('openpgp')
    }
  }
  /**
   * 串接Uint8Array的数组为一个Uint8Array
   * @param {*} arr
   */
  concatUint8Array(arr: Uint8Array[]): Uint8Array {
    return this.openpgp.util.concatUint8Array(arr)
  }
  strToUint8Array(data: string): Uint8Array {
    return this.openpgp.util.strToUint8Array(data)
  }
  uint8ArrayToStr(data: Uint8Array): string {
    return this.openpgp.util.uint8ArrayToStr(data)
  }
  /**
   * 把输入的Uint8Array转换成base64的string
   *
   * 建议输入为Uint8Array
   * @param {*} data
   */
  encodeBase64(data: Uint8Array | string): string {
    if (TypeUtil.isString(data)) {
      data = this.openpgp.util.strToUint8Array(data)
    }
    return this.openpgp.uint8ArrayToB64(data, false)
  }
  /**
   * 把输入的base64格式的Uint8Array转换成普通的Uint8Array
   *
   * 返回值为Uint8Array
   * @param {*} code
   * @param {*} options
   */
  decodeBase64(code: string): Uint8Array {
    let data = this.openpgp.b64ToUint8Array(code)
    return data
  }

  utf8ToString(str: string): string {
    let utf8: Uint8Array = this.openpgp.util.strToUint8Array(str)

    return this.openpgp.util.decodeUtf8(utf8)
  }

  stringToUtf8(str: string): string {
    let utf8: Uint8Array = this.openpgp.util.encodeUtf8(str)

    return this.openpgp.util.uint8ArrayToStr(utf8)
  }

  utf8Uint8ArrayToString(data: Uint8Array): string {

    return this.openpgp.util.decodeUtf8(data)
  }

  stringToUtf8Uint8Array(str: string): Uint8Array {
    let utf8 = this.openpgp.util.encodeUtf8(str)

    return utf8
  }
  /**
   * gzip压缩，返回值为Uint8Array
   * 对入参做了TypeUtil.String.encodeURI转码处理
   * @param {*} data
   */
  compress(data: Uint8Array): Uint8Array {
    // 方法一：GZIP
    data = pako.gzip(data) // 应当对入参做了相当于TypeUtil.String.encodeURI的处理

    return data
  }
  /**
   * gzip解压缩，输入参数可以是string或者Uint8Array
   * 返回值为Uint8Array
   * 不做TypeUtil.String.decodeURI转码处理
   * @param {*} code
   */
  uncompress(code: Uint8Array | string): Uint8Array {
    let binData = code
    if (TypeUtil.isString(code)) {
      binData = this.openpgp.util.strToUint8Array(code)
    }
    let data = pako.inflate(binData)
    // code = TypeUtil.String.arrayBufferToString(data)
    // code = TypeUtil.String.decodeURI(code) // 解决中文问题

    return data
  }
  /**
   * 随机字节数组
   * @param {*} length
   */
  async getRandomBytes(length = 32): Promise<Uint8Array> {
    const randomBytes: Uint8Array = await this.openpgp.crypto.random.getRandomBytes(length)

    return randomBytes
  }
  /**
   * 随机base64位字符串
   * @param {} length
   */
  async getRandomAsciiString(length = 32): Promise<string> {
    const randomBytes = await this.openpgp.crypto.random.getRandomBytes(length)
    const hash = await this.hash(randomBytes)
    const randomAscii = this.openpgp.uint8ArrayToB64(hash, false)

    return randomAscii
  }
  /**
   * 编码，如果输入是Uint8Array，转为string
   * @param {*} data
   * @param {*} format
   */
  encode(data: Uint8Array | string | any, format?: string): string {
    if (data instanceof Uint8Array) {
      data = this.openpgp.util.uint8ArrayToStr(data)
    } else if (typeof (data) === 'object' && !TypeUtil.isString(data)) {
      let encodeData: any = {}
      for (let key in data) {
        if (data.hasOwnProperty(key)) {
          encodeData[key] = this.encode(data[key], format)
        }
      }
      data = encodeData
    }
    if (format === 'base64' && TypeUtil.isString(data)) {
      data = this.encodeBase64(data)
    }

    return data
  }
  /**
   * 解码，将string或者base64的string转为Uint8Array
   * @param {*} data
   * @param {*} format
   */
  decode(data: string | any, format: string): Uint8Array {
    if (TypeUtil.isString(data)) {
      if (format === 'base64') {
        data = this.decodeBase64(data)
      }
      if (TypeUtil.isString(data)) {
        data = this.openpgp.util.strToUint8Array(data)
      }
    } else if (typeof (data) === 'object' && !(data instanceof Uint8Array)) {
      let decodeData: any = {}
      for (let key in data) {
        if (data.hasOwnProperty(key)) {
          decodeData[key] = this.decode(data[key], format)
        }
      }
      data = decodeData
    }

    return data
  }
  /**
   * 对消息进行hash处理，输入消息可以为字符串或者uintarray，
   * 8代表sha256
   *
   * @param {*} msg
   * @param {*} algo
   * @param {*} options
   */
  async hash(msg: Uint8Array | string, algo: number = 8, options: any = { format: 'binary' }): Promise<Uint8Array> {
    if (TypeUtil.isString(msg)) {
      msg = this.openpgp.util.strToUint8Array(msg)
    }
    let digest = await this.openpgp.crypto.hash.digest(algo, msg)
    if (options.format === 'base64') {
      digest = this.encodeBase64(digest)
    }

    return digest
  }
  async hmac(msg: Uint8Array, key: string, hash: string = 'SHA3-256'): Promise<Uint8Array> {
    throw new Error('NotSupport')
  }
  async hmacVerify(msg: Uint8Array, key: string, mac: Uint8Array, hash: string = 'SHA3-256') {
    throw new Error('NotSupport')
  }
  /**
   * 产生密钥对，返回对象为密钥对象（公钥和私钥对象）
   *
   * @param {*} keyType
   * @param {*} options
   */
  async generateKey(options: any = {
    namedCurve: 'ed25519'
  }): Promise<any> {
    const keyPairArmored = await this.openpgp.generateKey({
      userIds: options.userIds,
      curve: options.namedCurve ? options.namedCurve : 'ed25519'
    })
    let publicKeyArmored = keyPairArmored.publicKeyArmored
    let privateKeyArmored = keyPairArmored.privateKeyArmored
    let keyPair: any = {}
    keyPair.publicKey = await this.openpgp.readKey({ armoredKey: publicKeyArmored })
    keyPair.privateKey = await this.openpgp.readKey({ armoredKey: privateKeyArmored })

    return keyPair
  }
  /**
   * 将armored的密钥字符串导入转换成密钥对象，如果是私钥，options.password必须有值用于解密私钥
   *
   * @param {*} keyArmored
   * @param {*} options
   */
  async import(keyArmored: string, options: any = { armor: false, format: 'base64' }): Promise<any> {
    let key = null
    if (options.armor !== true) {
      options.armor = false
    }
    if (!options.format) {
      options.format = 'base64'
    }
    if (options.armor === true) {
      key = await this.openpgp.readKey({ armoredKey: keyArmored })
    } else {
      if (!options.format || options.format === 'base64') {
        let k: Uint8Array | string = this.decodeBase64(keyArmored)
        key = await this.openpgp.readKey({ binaryKey: k })
      }
    }
    let isDecrypted = key.isDecrypted()
    if (isDecrypted === false && options.password) {
      await key.decrypt(options.password)
    }

    return key
  }
  /**
   * 将密钥对象转换成armored的字符串，可以保存
   *
   * @param {*} key
   * @param {*} password
   * @param {*} options
   */
  async export(key: any, password: string, options: any = { armor: false, format: 'base64' }): Promise<string> {
    let isDecrypted = key.isDecrypted()
    if (isDecrypted === true) {
      if (password) {
        console.info('key need encrypt!')
        await key.encrypt(password)
      } else {
        throw new Error('NoPassword')
      }
    }
    let output = null
    if (options.armor === true) {
      output = await this.openpgp.stream.readToEnd(key.armor())
    } else {
      output = key.toPacketlist().write()
      if (!options.format || options.format === 'base64') {
        output = this.encodeBase64(output)
      }
    }
    return output
  }

  async deriveSecret(publicKey: any, privateKey: any, options: any = {
    format: 'base64'
  }) {
    throw new Error('NotSupport')
  }
  /**
   * 签名，输入消息为uintarray(推荐)
   *
   * 返回值根据options.armor是否为true决定，缺省是二进制结果的base64字符串
   * @param {*} msg
   * @param {*} privateKey
   * @param {*} hash
   * @param {*} options
   */
  async sign(msg: Uint8Array | string, privateKey: any, hash: string = 'sha256', options: any = {
    armor: false,
    detached: true,
    format: 'base64'
  }): Promise<string> {
    let message = msg
    if (TypeUtil.isString(msg)) {
      // message = await openpgp.Message.fromText(message)
      message = this.openpgp.util.strToUint8Array(message)
    }
    message = await this.openpgp.Message.fromBinary(message)
    const signed = await this.openpgp.sign({
      message: message,
      privateKeys: [privateKey],
      armor: options.armor,
      detached: options.detached
    })
    if (options.armor === true) {
      if (options.detached) {
        return signed.signature
      } else {
        return signed.data
      }
    } else {
      if (options.detached === true) {
        let sign = signed
        if (options.format === 'base64') {
          sign = this.encodeBase64(signed)
        }
        return sign
      } else {
        return signed
      }
    }
  }
  /**
   * 验证签名，第一个参数是数据为uintarray(推荐)或者string（自动转成uintarray），
   *
   * 第二个参数为签名，缺省认为是base64格式（自动转成uintarray），也可以是uintarray
   *
   * @param {*} msg
   * @param {*} signature
   * @param {*} publicKey
   * @param {*} hash
   * @param {*} options
   */
  async verify(msg: Uint8Array | string, signature: Uint8Array | string, publicKey: any, hash: string = 'sha256', options: any = {
    armor: false,
    format: 'base64'
  }) {
    if (options.armor === true) {
      signature = await this.openpgp.readSignature({ armoredSignature: signature })
    } else {
      if (options.format === 'base64') {
        signature = this.decodeBase64(signature as string)
      }
      signature = await this.openpgp.readSignature({ binarySignature: signature })
    }
    let message = msg
    if (TypeUtil.isString(msg)) {
      // message = await openpgp.Message.fromText(message)
      message = this.openpgp.util.strToUint8Array(message)
    }
    message = await this.openpgp.Message.fromBinary(message)
    let verified = null
    if (msg) {
      verified = await this.openpgp.verify({
        date: new Date(Date.now() + 5000),
        message: message,           // parse armored message
        signature: signature,
        publicKeys: [publicKey] // for verification
      })
    } else {
      verified = await this.openpgp.verify({
        date: new Date(Date.now() + 5000),
        message: signature,           // parse armored message
        publicKeys: [publicKey] // for verification
      })
    }
    // await openpgp.stream.readToEnd(verified.data)
    const { valid } = verified.signatures[0]
    return valid
  }
  /**
   * 非对称加密，公钥加密，私钥签名（暂不支持）
   * 输入消息可以是Uint8Array或者string，
   *
   * 缺省返回base64格式字符串
   * @param {*} msg
   * @param {*} publicKey
   * @param {*} privateKey
   * @param {*} options
   */
  async eccEncrypt(msg: Uint8Array | string, publicKey: any, signPrivateKey: any, options: any = {
    armor: false,
    format: 'base64'
  }): Promise<string> {
    let data = msg
    if (TypeUtil.isString(msg)) {
      data = await this.openpgp.Message.fromText(data)
      //data = openpgp.util.strToUint8Array(msg)//encodeUtf8(msg)
    } else {
      // data = openpgp.util.uint8ArrayToStr(msg)
      // data = openpgp.util.encodeUtf8(msg)
      data = await this.openpgp.Message.fromBinary(data)
    }

    let compression
    if (options.compression === true) {
      compression = this.openpgp.enums.compression.zip
    }
    let publicKeys = null
    if (Array.isArray(publicKey)) {
      publicKeys = publicKey
    } else {
      publicKeys = [publicKey]
    }
    const message = await this.openpgp.encrypt({
      message: data,
      publicKeys: publicKeys,
      //privateKeys: [signPrivateKey],                                           // for signing (optional)
      armor: options.armor,
      compression: compression,
      sessionKey: options.sessionKey // You can separately call openpgp.generateSessionKey({ publicKeys }) instead and call openpgp.encrypt({ sessionKey }) with the result
    })
    let encrypted = message
    if (options.format === 'base64') {
      encrypted = this.encodeBase64(message)
    }

    return encrypted
  }
  /**
   * 非对称解密，输入密文可以是base64格式字符串，或者是Uint8Array
   *
   * 返回值缺省是Uint8Array，根据options.format可以返回string或者base64
   *
   * @param {*} encrypted
   * @param {*} verifyPublicKey
   * @param {*} privateKey
   * @param {*} options
   */
  async eccDecrypt(encrypted: Uint8Array | string, verifyPublicKey: any, privateKey: any, options: any = {
    armor: false,
    format: 'binary'
  }) {
    let msg = encrypted
    if (options.armor === true) {
      msg = await this.openpgp.readMessage({ armoredMessage: msg })
    } else {
      if (TypeUtil.isString(msg)) {
        msg = this.decodeBase64(msg as string)
        // msg = openpgp.util.strToUint8Array(msg)
      }
      msg = await this.openpgp.readMessage({ binaryMessage: msg })
    }
    let privateKeys = null
    if (Array.isArray(privateKey)) {
      privateKeys = privateKey
    } else {
      privateKeys = [privateKey]
    }
    let decrypted: any = await this.openpgp.decrypt({
      message: msg,              // parse armored message
      // publicKeys: [verifyPublicKey], // for verification (optional)
      privateKeys: privateKeys,                                           // for decryption
      sessionKeys: options.sessionKeys
    })
    decrypted = decrypted.data
    if (options.format === 'string') {
      decrypted = this.encode(decrypted)
    }
    if (options.format === 'base64') {
      decrypted = this.encodeBase64(decrypted)
    }

    return decrypted
  }
  /**
   * 对对称密钥进行非对称公钥加密，输入密钥为uintarray，返回消息对象
   * @param {*} msg
   * @param {*} publicKey
   * @param {*} options
   */
  async encryptKey(msg: Uint8Array, publicKey: any, options: any = {
    algorithm: 'aes256',
    aeadAlgorithm: 'experimental_gcm'
  }): Promise<Uint8Array> {
    const encrypted = await this.openpgp.encryptSessionKey({
      data: msg,
      algorithm: options.algorithm,
      aeadAlgorithm: options.aeadAlgorithm,
      publicKeys: [publicKey],
      passwords: options.passwords
    })

    return encrypted.message
  }
  /**
   * 对加密后的对称密钥对象私钥解密，还原对称密钥，返回uintarray
   * @param {*} encrypted
   * @param {*} privateKey
   * @param {*} passwords
   * @param {*} options
   */
  async decryptKey(encrypted: Uint8Array, privateKey: any, passwords: string[], options: any = {}): Promise<Uint8Array> {
    const decrypted = await this.openpgp.decryptSessionKeys({
      message: encrypted,
      privateKeys: [privateKey],
      passwords: passwords
    })
    return decrypted[0].data
  }
  /**
   * 对称算法aes加密，输入消息为Uint8Array（推荐），或者string（自动转Uint8Array）
   * key是string
   * 返回值取决于options.armor，是uintarray（缺省），或者armor string
   * @param {*} msg
   * @param {*} key
   * @param {*} options
   */
  async aesEncrypt(msg: Uint8Array | string, key: string, options: any = {}): Promise<Uint8Array> {
    let data = msg
    if (TypeUtil.isString(msg)) {
      data = this.openpgp.util.strToUint8Array(msg)
    }
    data = await this.openpgp.Message.fromBinary(data)
    options.armor = false
    const message = await this.openpgp.encrypt({
      message: data, // input as Message object
      passwords: [key],                                             // multiple passwords possible
      armor: options.armor
      // sessionKey: options.sessionKey
    })
    let encrypted = message

    return encrypted
  }
  /**
   * 对称密钥算法aes解密，输入为Uint8Array（推荐），或者string（自动转Uint8Array）
   * key是string
   * 返回值取决于options，是uintarray（缺省），或者armor string，或者string，base64
   * @param {*} encrypted
   * @param {*} key
   * @param {*} options
   */
  async aesDecrypt(encrypted: Uint8Array | string, key: string, options: any = {
    armor: false,
    aesFormat: 'binary',
    format: 'binary'
  }): Promise<Uint8Array> {
    let data = encrypted
    let format = options.aesFormat
    if (options.armor === true) {
      data = await this.openpgp.readMessage({ armoredMessage: encrypted })
    } else {
      if (TypeUtil.isString(encrypted)) {
        data = this.openpgp.util.strToUint8Array(data)
      }
      data = await this.openpgp.readMessage({ binaryMessage: data })
    }
    let decrypted = await this.openpgp.decrypt({
      message: data, // parse encrypted bytes
      passwords: [key],                    // decrypt with password
      format: format
      // sessionKeys: options.sessionKeys
    })
    decrypted = decrypted.data

    return decrypted
  }
  /**
   * 对消息进行AES加密，密钥是随机数，对密钥用ecc加密，用自己的私钥和对方的公钥，对方是一个数组
   *
   * 返回加密后的消息和加密后的密钥数组
   * @param {*} msg
   * @param {*} receivers
   * @param {*} options privateKey私钥
   */
  async encrypt(msg: Uint8Array | string, privateKey: any, receivers: {}[], options: any = {}): Promise<any> {
    let key: string = await this.getRandomAsciiString()
    let encryptedMsg = await this.aesEncrypt(msg, key, options)
    let encrypted: any = {}
    encrypted['msg'] = encryptedMsg
    encrypted['receivers'] = receivers
    let ps = []
    for (let key in receivers) {
      if (receivers.hasOwnProperty(key)) {
        let receiver: any = receivers[key]
        let publicKey = receiver.publicKey
        let name = receiver.name
        let p = this.eccEncrypt(key, publicKey, privateKey, options)
        ps.push(p)
      }
    }

    let encryptedKeys = await Promise.all(ps)
    for (let key in encryptedKeys) {
      if (encryptedKeys.hasOwnProperty(key)) {
        let receiver: any = receivers[key]
        let encryptedKey = encryptedKeys[key]
        receiver['encryptedKey'] = encryptedKey
      }
    }

    return encrypted
  }
  /**
   *
   * @param {*} msg
   * @param {*} privateKey
   * @param {*} receiver
   * @param {*} options
   */
  async decrypt(msg: Uint8Array | string, privateKey: any, sender: any, options: any = {}) {
    let publicKey = sender.publicKey
    let key: any = this.eccDecrypt(sender.encryptedKey, publicKey, privateKey, options)
    let decryptedMsg = this.aesDecrypt(msg, key, options)

    return decryptedMsg
  }
  clonePackets(options: any): any {
    return this.openpgp.packet.clone.clonePackets(options)
  }
  parseClonedPackets(options: any): any {
    return this.openpgp.packet.clone.parseClonedPackets(options)
  }
  initWorker(path: string): any {
    return this.openpgp.initWorker(path)
  }
  destroyWorker() {
    return this.openpgp.destroyWorker()
  }
}
export let openpgp = new OpenPGP()
