import { webrtcEncrypt } from './webrtc-encrypt'

/**
 * 多线程模式的音视频流加密处理
 * 接收主线程的消息
 * @param {*} event 
 */
self.onmessage = function (event) {
  const { operation, cryptoKey } = event.data
  if (operation === 'encrypt') {
    const { readableStream, writableStream } = event.data
    const transformStream = new TransformStream({
      transform: async (chunk, controller) => {
        webrtcEncrypt.encrypt(chunk, controller, cryptoKey)
      }
    })
    readableStream
      .pipeThrough(transformStream)
      .pipeTo(writableStream)
  } else if (operation === 'decrypt') {
    const { readableStream, writableStream } = event.data
    const transformStream = new TransformStream({
      transform: async (chunk, controller) => {
        webrtcEncrypt.decrypt(chunk, controller, cryptoKey)
      }
    })
    readableStream
      .pipeThrough(transformStream)
      .pipeTo(writableStream)
  }
}
