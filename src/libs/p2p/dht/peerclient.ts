import { BaseService, StatusEntity } from '../db/base'
import { ActiveStatus, EntityStatus } from '../db/base'
import { findClientAction } from '../chain/action/findclient'
import { putValueAction } from '../chain/action/putvalue'
import { connectAction } from '../chain/action/connect'
import { myself, myselfPeerService } from './myselfpeer'
import { openpgp } from '../crypto/openpgp'
import { config } from '../conf/conf'
import { PayloadType } from '../chain/baseaction'

export class PeerClient extends StatusEntity {
  public peerId!: string
  public clientId!: string
  public clientDevice!: string
  public clientType!: string
  // 用户头像（base64字符串）
  public avatar!: string
  public name!: string
  public mobile!: string
  public mobileVerified!: string
  public visibilitySetting!: string

  public peerPublicKey!: string
  public publicKey!: string
  /**
   * 客户连接到节点的位置
   */
  public connectPeerId!: string
  public connectSessionId!: string
  public activeStatus!: string
  public lastUpdateTime!: Date
  public lastAccessTime!: Date

	public expireDate!: number
  public signatureData!: string
  public signature!: string
  public previousPublicKeySignature!: string
}

export class PeerClientService extends BaseService {
  private peerClients = new Map<string, PeerClient[]>()
  private publicKeys = new Map<string, any>()

  async getPublic(peerId: string): Promise<any> {
    let peerClients = await this.getCachedPeerClient(peerId)
    if (peerClients && peerClients.length > 0) {
      return this.publicKeys.get(peerId)
    }

    return null
  }

  /**
   * 依次从内存，本地数据库和网络获取PeerClient信息
   * @param connectPeerId 
   * @param peerId 
   */
  async getCachedPeerClient(peerId: string): Promise<PeerClient[]> {
    if (this.peerClients.has(peerId)) {
      return this.peerClients.get(peerId)
    }
    let condi: any = { peerId: peerId, status: EntityStatus[EntityStatus.Effective] }
    condi.activeStatus = ActiveStatus[ActiveStatus.Up]
    let peerClients: PeerClient[] = await this.find(condi, null, null, null, null)
    if (peerClients && peerClients.length > 0) {
      this.peerClients.set(peerId, peerClients)
      if (peerClients[0].publicKey) {
        let publicKey = await openpgp.import(peerClients[0].publicKey)
        if (publicKey) {
          this.publicKeys.set(peerId, publicKey)
        }
      }

      return peerClients
    }
    peerClients = await this.getPeerClient(null, peerId, null)
    if (peerClients && peerClients.length > 0) {
      return peerClients
    }

    return null
  }

  /**
   * 从网络是获取PeerClient信息，第一个参数可以为空
   * @param connectPeerId 
   * @param peerId 
   */
  async getPeerClient(connectPeerId: string, peerId: string, mobileNumber: string): Promise<PeerClient[]> {
    let pcs: any[] = await findClientAction.findClient(connectPeerId, peerId, mobileNumber)
    console.log(pcs)
    if (pcs && pcs.length > 0) {
      console.log(pcs)
      let condi: any = { peerId: peerId }
      let peerClients: PeerClient[] = await this.find(condi, null, null, null, null)
      if (peerClients && peerClients.length > 0) {
        await this.delete(peerClients)
      }
      peerClients = []
      let best = null
      for (let pc of pcs) {
        let peerClient = new PeerClient()
        peerClient.peerId = pc.peerId
        peerClient.name = pc.name
        peerClient.mobile = pc.mobile
        peerClient.mobileVerified = pc.mobileVerified
        peerClient.visibilitySetting = pc.visibilitySetting
        peerClient.lastAccessTime = pc.lastAccessTime
        peerClient.lastUpdateTime = pc.lastUpdateTime
        peerClient.createDate = pc.createDate
        peerClient.updateDate = pc.updateDate
        peerClient.connectPeerId = pc.connectPeerId
        peerClient.clientId = pc.clientId
        peerClient.clientDevice = pc.clientDevice
        peerClient.clientType = pc.clientType
        peerClient.connectSessionId = pc.connectSessionId
        peerClient.avatar = pc.avatar
        peerClient.peerPublicKey = pc.peerPublicKey
        peerClient.publicKey = pc.publicKey
        peerClient.status = pc.status
        peerClient.statusReason = pc.statusReason
        peerClient.statusDate = pc.statusDate
        peerClient.activeStatus = pc.activeStatus
        peerClients.push(peerClient)
        await this.insert(peerClient)

        if (!best) {
          best = pc
        } else {
          let pcLastUpdateTime = new Date(pc.LastUpdateTime).getTime()
          let bestLastUpdateTime = new Date(best.LastUpdateTime).getTime()
          let pcLastAccessTime = new Date(pc.LastAccessTime).getTime()
          let bestLastAccessTime = new Date(best.LastAccessTime).getTime()
          if (pcLastUpdateTime > bestLastUpdateTime ||
            (pcLastUpdateTime === bestLastUpdateTime && pcLastAccessTime > bestLastAccessTime)) {
            best = pc
          }
        }
      }
      this.peerClients.set(peerId, peerClients)
      if (best && best.publicKey) {
        let publicKey = await openpgp.import(best.publicKey)
        if (publicKey) {
          this.publicKeys.set(peerId, publicKey)
        }
      }
      return peerClients
    }
    return null
  }

  async findPeerClient(connectPeerId: string, peerId: string, mobileNumber: string): Promise<PeerClient> {
    let peerClients = await this.getPeerClient(connectPeerId, peerId, mobileNumber)
    console.log(peerClients)
    let best = null
    if (peerClients && peerClients.length > 0) {
      for (let peerClient of peerClients) {
        if (!best) {
          best = peerClient
        } else {
          let pcLastUpdateTime = new Date(peerClient.lastUpdateTime).getTime()
          let bestLastUpdateTime = new Date(best.LastUpdateTime).getTime()
          let pcLastAccessTime = new Date(peerClient.lastAccessTime).getTime()
          let bestLastAccessTime = new Date(best.lastAccessTime).getTime()
          if (pcLastUpdateTime > bestLastUpdateTime ||
            (pcLastUpdateTime === bestLastUpdateTime && pcLastAccessTime > bestLastAccessTime)) {
            best = peerClient
          }
        }
      }
    }
    return best
  }

  async preparePeerClient(connectPeerId: string, activeStatus: string): Promise<PeerClient> {
    if (!connectPeerId) {
      connectPeerId = config.appParams.connectPeerId[0]
    }
    if (!activeStatus) {
      activeStatus = ActiveStatus[ActiveStatus.Up]
    }
    let peerClient = new PeerClient()
    peerClient.peerId = myself.myselfPeer.peerId
    peerClient.mobile = myself.myselfPeer.mobile
    peerClient.name = myself.myselfPeer.name
    peerClient.avatar = myself.myselfPeer.avatar
    peerClient.peerPublicKey = myself.myselfPeer.peerPublicKey
    peerClient.publicKey = myself.myselfPeer.publicKey
    peerClient.lastUpdateTime = myself.myselfPeer.lastUpdateTime
    peerClient.mobileVerified = myself.myselfPeer.mobileVerified
    peerClient.visibilitySetting = myself.myselfPeer.visibilitySetting
    peerClient.status = EntityStatus[EntityStatus.Effective]
    peerClient.connectPeerId = connectPeerId
    peerClient.activeStatus = activeStatus
    if (myself.peerProfile) {
      peerClient.clientId = myself.peerProfile.clientId
      peerClient.clientType = myself.peerProfile.clientType
      peerClient.clientDevice = myself.peerProfile.clientDevice
    }

    let password = myself.password
    peerClient.expireDate = new Date().getTime()
    peerClient.signatureData = peerClient.peerId
    let signature = await openpgp.sign(peerClient.expireDate + peerClient.signatureData, myself.privateKey)
    peerClient.signature = signature
    // 如有旧版本，设置expiredKeys，附上上个版本的签名
    let expiredKeys = []
    let condi: any = { peerId: peerClient.peerId, status: EntityStatus[EntityStatus.Discarded], endDate: { $gt: null } }
    let expiredPeerClients = await myselfPeerService.find(condi, [{ endDate: 'desc' }], null, null, null)
    if (expiredPeerClients && expiredPeerClients.length > 0) {
      for (let expiredPeerClient of expiredPeerClients) {
        let expiredPrivateKey_ = expiredPeerClient.privateKey
        let expiredPrivateKey = null
        try {
          expiredPrivateKey = await openpgp.import(expiredPrivateKey_, { password: password })
          if (expiredPrivateKey) {
            let isEncrypted = expiredPrivateKey.isEncrypted
            console.log('isEncrypted:' + isEncrypted)
            if (isEncrypted) {
              await expiredPrivateKey.decrypt(password)
            }
          }
        } catch (e) {
          console.error('wrong password:' + e)
          return null
        }
        let expiredPublicKey = await openpgp.import(expiredPeerClient.publicKey)
        expiredKeys.push({
          expiredPublicKey: expiredPublicKey,
          expiredPrivateKey: expiredPrivateKey
        })
      }
    }
    myself.expiredKeys = expiredKeys
    if (myself.expiredKeys.length > 0) {
      let previousPublicKeySignature = await openpgp.sign(peerClient.expireDate + peerClient.signatureData, myself.expiredKeys[0].expiredPrivateKey)
      peerClient.previousPublicKeySignature = previousPublicKeySignature
    }

    return peerClient
  }

  /**
   * 把本地客户端信息发布到网上，第一个参数可以为空
   * @param connectPeerId 
   * @param activeStatus 
   */
  async putPeerClient(connectPeerId: string, activeStatus: string): Promise<any> {
    //写自己的数据到peerendpoint中
    let peerClient = await this.preparePeerClient(connectPeerId, activeStatus)
    console.info('putPeerClient:' + peerClient.peerId + ';connectPeerId:' + connectPeerId + ';activeStatus:' + activeStatus)
    let result = await putValueAction.putValue(connectPeerId, PayloadType.PeerClient, peerClient)
    return result
  }

  /**
   * Connect
   */
  async connect(): Promise<any> {
    let connectPeerId = config.appParams.connectPeerId[0]
    let activeStatus = ActiveStatus[ActiveStatus.Up]
    let peerClient = await this.preparePeerClient(connectPeerId, activeStatus)
    console.info('connect:' + peerClient.peerId + ';connectPeerId:' + connectPeerId)
    let result = await connectAction.connect(connectPeerId, peerClient)
    return result
  }
}
export let peerClientService = new PeerClientService("blc_peerClient", ['mobile'], null)