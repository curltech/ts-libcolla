import { WebrtcPeer } from '../transport/webrtc-peer'

/**
 * 接收主线程的消息
 * @param {*} event
 */
self.onmessage = function (event) {
  console.log('webRtcConnect worker receive message:')
  console.log(event.data)
  let start = new Date().getTime()
  let rtcArr = event.data
  let rtcPeerArr = []
  if (rtcArr.length) {
    try {
      for (let i = 0; i < rtcArr.length; i++) {
        let _rtcObj = rtcArr[i]
        let _webrtc = new WebrtcPeer(_rtcObj.peerId, true, _rtcObj.option)
        rtcPeerArr.push(_webrtc)
      }
      self.postMessage(rtcPeerArr)
    } catch (e) {
      console.error(e)
    } finally {
    }
  }
}
