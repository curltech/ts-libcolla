import { openpgp } from '../crypto/openpgp'

/**
 * 音视频流的端到端加密处理
 */
class WebrtcEncrypt {
  // 如果使用加密偏移字节设置，不要加密负载的前面几个字节，
  // 使得可以在中间识别视频关键帧，否则需要使用opus mode
  // VP8 https://tools.ietf.org/html/rfc6386#section-9.1
  // 关键帧是10个bytes，变化帧是3个bytes
  // opus (where encodedFrame.type is not set)是 TOC byte
  //   https://tools.ietf.org/html/rfc6716#section-3.1
  //
  // 它使观看和收听（加密的）视频和音频变得更加有趣
  // 因为解码器不会立即引发致命错误。
  private frameTypeToCryptoOffset: any = {
    key: 10, // 关键帧的偏移量
    delta: 3, // 变化帧的偏移量
    undefined: 1 // 未知帧的偏移量
  }
  private useCryptoOffset = true
  private currentKeyIdentifier = 0
  constructor() { }
  /**
   * 获取当前的加密密钥，表示加密密钥没有和帧数据一起传送
   * 在视频连接创建的时候，主动方创建一个随机加密密钥，
   * 并使用对方的公钥加密后发送给对方，双方将保存密钥直到本次连接断掉
   * 假如有一方不支持加密，则不传送密钥，双方不加密传输
   */
  getCryptoKey() {
    return ''
  }
  /**
   * 下面的方法用于视频流的端到端加密
   *
   * let win = new BrowserWindow({
        height: 600,
        width: 800,
        webPreferences: { experimentalFeatures: true}
      });
    可以显示地设置
    let pc = new RTCPeerConnection({
      encodedInsertableStreams: true,
      });
   */
  supportInsertableStream() {
    const supportsInsertableStreamsLegacy =
      !!RTCRtpSender.prototype.createEncodedVideoStreams
    const supportsInsertableStreams =
      !!RTCRtpSender.prototype.createEncodedStreams

    if (!(supportsInsertableStreams || supportsInsertableStreamsLegacy)) {
      return false
    }

    return true
  }

  polyFillEncodedFrameMetadata(encodedFrame, controller) {
    if (!encodedFrame.getMetadata) {
      encodedFrame.getMetadata = function () {
        return {
          // TODO: provide a more complete polyfill based on additionalData for video.
          synchronizationSource: this.synchronizationSource,
          contributingSources: this.contributingSources
        }
      }
    }
    controller.enqueue(encodedFrame)
  }

  videoAnalyzer(encodedFrame, controller) {
    const view = new DataView(encodedFrame.data)
    // We assume that the video is VP8.
    // TODO: Check the codec to see that it is.
    // The lowest value bit in the first byte is the keyframe indicator.
    // https://tools.ietf.org/html/rfc6386#section-9.1
    const keyframeBit = view.getUint8(0) & 0x01
    // console.log(view.getUint8(0).toString(16));
    if (keyframeBit === 0) {
      keyFrameCount++
      keyFrameLastSize = encodedFrame.data.byteLength
    } else {
      interFrameCount++
      interFrameLastSize = encodedFrame.data.byteLength
    }
    if (encodedFrame.type === prevFrameType &&
      encodedFrame.timestamp === prevFrameTimestamp &&
      encodedFrame.synchronizationSource === prevFrameSynchronizationSource) {
      duplicateCount++
    }
    prevFrameType = encodedFrame.type
    prevFrameTimestamp = encodedFrame.timestamp
    prevFrameSynchronizationSource = encodedFrame.synchronizationSource
    controller.enqueue(encodedFrame)
  }
  /**
   * 对视频帧数据的处理技巧：
   * 1. 将帧数据包装成Uint8Array，const data = new Uint8Array(encodedFrame.data)
   * 2. Uint8Array的subarray函数可以获取指定的数据，set方法方便设置数据
   * 3. 帧数据本身是ArrayBuffer byte array类型，frame.data = new ArrayBuffer(length)
   * 4. DataView可以包装ArrayBuffer，new DataView(frame.data)，其set方法比较方便
   * @param {*} encodedFrame 
   */
  /**
   * 显示帧数据的头
   * @param {*} encodedFrame 
   * @param {*} direction 
   * @param {*} max 
   */
  dump(encodedFrame, direction, max = 16) {
    const data = new Uint8Array(encodedFrame.data)
    let bytes = ''
    for (let j = 0; j < data.length && j < max; j++) {
      bytes += (data[j] < 16 ? '0' : '') + data[j].toString(16) + ' '
    }
    console.log(performance.now().toFixed(2), direction, bytes.trim(),
      'len=' + encodedFrame.data.byteLength,
      'type=' + (encodedFrame.type || 'audio'),
      'ts=' + encodedFrame.timestamp,
      'ssrc=' + encodedFrame.synchronizationSource
    )
  }
  parseVP8(buffer) {
    if (buffer.byteLength < 3)
      return null

    const view = new Uint8Array(buffer)

    //Read comon 3 bytes
    //   0 1 2 3 4 5 6 7
    //  +-+-+-+-+-+-+-+-+
    //  |Size0|H| VER |P|
    //  +-+-+-+-+-+-+-+-+
    //  |     Size1     |
    //  +-+-+-+-+-+-+-+-+
    //  |     Size2     |
    //  +-+-+-+-+-+-+-+-+
    const firstPartitionSize = view[0] >> 5
    const showFrame = view[0] >> 4 & 0x01
    const version = view[0] >> 1 & 0x07
    const isKeyFrame = (view[0] & 0x01) == 0

    if (isKeyFrame) {
      if (buffer.byteLength < 10)
        return null
      //Get size in le
      const hor = view[7] << 8 | view[6]
      const ver = view[9] << 8 | view[8]
      //Get dimensions and scale
      const width = hor & 0x3fff
      const horizontalScale = hor >> 14
      const height = ver & 0x3fff
      const verticalScale = ver >> 14
      //Key frame
      return view.subarray(0, 10)
    }

    //No key frame
    return view.subarray(0, 3)
  }

  /**
     * aes加密帧数据
     * @param {*} encodedFrame 
     * @param {*} controller 
     */
  async encrypt(encodedFrame, controller, cryptoKey) {
    let scount = 0
    if (scount++ < 30) { // 抛弃前30个包，dump the first 30 packets.
      this.dump(encodedFrame, 'send')
    }
    // 对数据进行加密
    if (cryptoKey) {
      try {
        const original = new Uint8Array(encodedFrame.data)
        const encryptedArray = new ArrayBuffer(encodedFrame.data.byteLength)
        const encryptedData = new Uint8Array(encryptedArray)
        //根据帧数据的类型，计算加密的偏移量，偏移量数据直接复制
        const cryptoOffset = this.useCryptoOffset ? this.frameTypeToCryptoOffset[encodedFrame.type] : 0;
        encryptedData.set(original.subarray(0, cryptoOffset))
        // 非偏移量的数据，实际数据，进行加密后复制
        let encrypted = await openpgp.aesEncrypt(original.subarray(cryptoOffset), cryptoKey)
        encryptedData.set(encrypted, cryptoOffset)
        // 尾部附加签名
        // 把新数据写回帧中
        encodedFrame.data = encryptedArray
      } catch (e) {
        console.error(e)
      }
    }
    controller.enqueue(encodedFrame)
  }
  /**
   * aes解密帧数据
   * @param {*} encodedFrame 
   * @param {*} controller 
   */
  async decrypt(encodedFrame, controller, cryptoKey) {
    let rcount = 0
    if (rcount++ < 30) { // dump the first 30 packets
      this.dump(encodedFrame, 'recv')
    }

    if (cryptoKey) {
      try {
        // 检查签名
        // const sign = encodedFrame.data.byteLength > 4 ? view.getUint32(encodedFrame.data.byteLength - 4) : false
        const cryptoOffset = this.useCryptoOffset ? this.frameTypeToCryptoOffset[encodedFrame.type] : 0
        const original = new Uint8Array(encodedFrame.data)
        const decryptArray = new ArrayBuffer(encodedFrame.data.byteLength)
        const decryptedData = new Uint8Array(decryptArray)
        decryptedData.set(original.subarray(0, cryptoOffset))
        let decrypted = await openpgp.aesEncrypt(original.subarray(cryptoOffset), cryptoKey)
        decryptedData.set(decrypted, cryptoOffset)

        encodedFrame.data = decryptedData
      } catch (e) {
        console.error(e)
      }
    }
    controller.enqueue(encodedFrame)
  }
}
export let webrtcEncrypt = new WebrtcEncrypt()