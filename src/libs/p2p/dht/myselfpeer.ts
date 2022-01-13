import { PeerEntity, BaseService } from '../db/base'
import { PeerProfile, peerProfileService } from './peerprofile'
import { p2pPeer } from '../p2ppeer'
import { EntityStatus } from '../db/base'
import { MobileNumberUtil } from '../../util/util'
import { CollaUtil } from '../../util/util'
import { config } from '../conf/conf'
import * as cookie from 'tiny-cookie'
import { openpgp } from '../crypto/openpgp'
import { signalProtocol } from '../crypto/signalprotocol'

const libp2pcrypto = require('libp2p-crypto')

/**
 * 单例本节点对象，包含公私钥，本节点配置，密码和过往的节点信息
 * 可以随时获取本节点的信息
 */
export class Myself {
  public peerPublicKey: any
  public publicKey: any
  public peerPrivateKey: any
  public privateKey: any
  public signalPublicKey:any
  public signalPrivateKey: any
  public myselfPeer: MyselfPeer
  public peerProfile: PeerProfile
  public myselfPeerClient: any // combine myselfPeer & peerProfile
  public password: string
  public expiredKeys: any[]

  constructor() { }
}
export let myself = new Myself()

/**
 * 本节点实体
 */
export class MyselfPeer extends PeerEntity {
  public peerPrivateKey!: string
  public privateKey!: string
  public signalPublicKey!: string
  public signalPrivateKey!: string
  public loginStatus!: string
  public password!: string
  /**
   * 以下的字段是和证书相关，不是必须的
   */
  public certType!: string
  public certFormat!: string
  // peer的保护密码，不保存到数据库，hash后成为password
  public oldPassword!: string
  // peer的证书的原密码，申请新证书的时候必须提供，不保存数据库
  public oldCertPassword!: string
  // peer的新证书的密码，申请新证书的时候必须提供，不保存数据库
  public newCertPassword!: string
  public certContent!: string
  /**
   * 主发现地址，表示可信的，可以推荐你的peer地址
   */
  public discoveryAddress!: string
  public lastFindNodeTime!: Date
  // 用户头像（base64字符串）
  public avatar!: string
  public mobileVerified!: string
  // 可见性YYYYY (peerId、mobileNumber、groupChat、qrCode、contactCard）
  public visibilitySetting!: string
}
export class MyselfPeerService extends BaseService {
  /**
   * 注册新的p2p账户
   * @param registerData 
   */
  async register(registerData: any): Promise<Myself> {
    let mobile = null
    let code_ = registerData.code
    let mobile_ = registerData.mobile
    if (code_ && mobile_) {
      let isPhoneNumberValid = false
      try {
        isPhoneNumberValid = MobileNumberUtil.isPhoneNumberValid(mobile_, MobileNumberUtil.getRegionCodeForCountryCode(code_))
      } catch (e) {
        console.log(e)
      }
      if (!isPhoneNumberValid) {
        throw new Error('InvalidMobileNumber')
      }
      mobile = MobileNumberUtil.formatE164(mobile_, MobileNumberUtil.getRegionCodeForCountryCode(code_))
    }
    let password = registerData.password
    let name = registerData.name
    if (password !== registerData.confirmPassword) {
      throw new Error('ErrorPassword')
    }
    let condition: any = { status: EntityStatus[EntityStatus.Effective] }
    condition.name = name
    let myselfPeer = await this.findOne(condition, null, null)
    if (myselfPeer) {
      throw new Error('SameNameAccountExists')
    }
    myselfPeer = new MyselfPeer()
    myselfPeer.status = EntityStatus[EntityStatus.Effective]
    myselfPeer.mobile = mobile
    myselfPeer.name = name
    myselfPeer.address = '127.0.0.1:8088'
    await p2pPeer.initMyself(password, myselfPeer)
    myselfPeer = myself.myselfPeer
    let currentDate = new Date()
    myselfPeer.createDate = currentDate
    myselfPeer.updateDate = currentDate
    myselfPeer.lastUpdateTime = currentDate
    myselfPeer.startDate = currentDate
    myselfPeer.endDate = new Date('9999-12-31T11:59:59.999Z')
    myselfPeer.statusDate = currentDate
    myselfPeer.version = 0
    myselfPeer.creditScore = 300
    myselfPeer.mobileVerified = 'N'
    myselfPeer.visibilitySetting = 'YYYYY'
    myselfPeer = await this.upsert(myselfPeer)
    myself.myselfPeer = myselfPeer

    // 初始化profile
    condition = { status: EntityStatus[EntityStatus.Effective] }
    condition.peerId = myselfPeer.peerId
    let peerProfiles = await peerProfileService.find(condition, null, null, null, null)
    if (peerProfiles && peerProfiles.length > 0) {
      await peerProfileService.delete(peerProfiles)
    }
    let peerProfile = new PeerProfile()
    peerProfile.status = EntityStatus[EntityStatus.Effective]
    peerProfile.clientId = myselfPeer._id
    peerProfile.peerId = myselfPeer.peerId
    peerProfile.clientType = config.appParams.clientType
    peerProfile.clientDevice = config.appParams.clientDevice
    peerProfile.language = config.appParams.language
    peerProfile.lightDarkMode = 'auto'
    peerProfile.primaryColor = '#19B7C7'
    peerProfile.secondaryColor = '#117EED'
    peerProfile.udpSwitch = false
    peerProfile.downloadSwitch = false
    peerProfile.localDataCryptoSwitch = false
    peerProfile.autoLoginSwitch = true
    peerProfile.developerOption = false
    peerProfile.logLevel = 'none'
    peerProfile.lastSyncTime = currentDate
    peerProfile = await peerProfileService.upsert(peerProfile)
    myself.peerProfile = peerProfile

    return myself
  }

  /**
   * 登录
   * @param loginData 
   */
  async login(loginData: any): Promise<Myself> {
    let mobile = null
    let code_ = loginData.code
    let mobile_ = loginData.credential
    if (code_ && mobile_) {
      let isPhoneNumberValid = false
      try {
        isPhoneNumberValid = MobileNumberUtil.isPhoneNumberValid(mobile_, MobileNumberUtil.getRegionCodeForCountryCode(code_))
      } catch (e) {
        console.log(e)
      }
      if (!isPhoneNumberValid) {
        throw new Error('InvalidMobileNumber')
      }
      mobile = MobileNumberUtil.formatE164(mobile_, MobileNumberUtil.getRegionCodeForCountryCode(code_))
    }
    let name = loginData.name
    let password = loginData.password
    await p2pPeer.getMyself(password, null, mobile, name)
    // 标志登录成功
    if (myself.myselfPeer) {
      cookie.setCookie('token', myself.myselfPeer.peerId)

      return myself
    }

    return null
  }

  /**
   * 修改密码
   * @param oldPassword 
   * @param newPassword 
   */
  async changePassword(oldPassword: string, newPassword: string): Promise<Myself> {
    // 使用新密码重新加密所有密钥（包括expired记录）
    let condition = {}
    condition['peerId'] = myself.myselfPeer.peerId
    condition['endDate'] = { $gt: null }
    let myselfPeers = await this.find(condition, [{ endDate: 'desc' }], null, null, null)
    if (myselfPeers && myselfPeers.length > 0) {
      let currentDate = new Date()
      for (let myselfPeer of myselfPeers) {
        let privateKey = null
        let priv = null
        try {
          privateKey = await openpgp.import(myselfPeer.privateKey, { password: oldPassword })
          if (privateKey) {
            let isEncrypted = privateKey.isEncrypted
            console.log('isEncrypted:' + isEncrypted)
            if (isEncrypted) {
              await privateKey.decrypt(oldPassword)
            }
          }
          priv = await libp2pcrypto.keys.import(myselfPeer.peerPrivateKey, oldPassword)
        } catch (e) {
          console.error(e)
          throw new Error('WrongPassword')
        }
        myselfPeer.privateKey = await openpgp.export(privateKey, newPassword)
        myselfPeer.peerPrivateKey = await priv.export(newPassword, 'libp2p-key')
        myselfPeer.signalPrivateKey = await signalProtocol.export(newPassword)
        myselfPeer.updateDate = currentDate
      }
      myselfPeers = await this.update(myselfPeers)
      for (let myselfPeer of myselfPeers) {
        if (myselfPeer._id === myself.myselfPeer._id) {
          myself.myselfPeer = myselfPeer
          myself.myselfPeerClient.privateKey = myselfPeer.privateKey
          myself.myselfPeerClient.peerPrivateKey = myselfPeer.peerPrivateKey
          myself.myselfPeerClient.signalPrivateKey = myselfPeer.signalPrivateKey
          break
        }
      }
      myself.password = newPassword
    }

    return myself
  }

  /**
   * 更新密钥
   */
  async resetKey(): Promise<Myself> {
    let currentDate = new Date()
    let oldMyselfPeer = myself.myselfPeer
    console.log(oldMyselfPeer)
    let newMyselfPeer = CollaUtil.clone(oldMyselfPeer)
    console.log(newMyselfPeer)
    oldMyselfPeer.status = EntityStatus[EntityStatus.Discarded]
    oldMyselfPeer.statusDate = currentDate
    oldMyselfPeer.endDate = currentDate
    oldMyselfPeer.updateDate = currentDate
    await this.update(oldMyselfPeer)

    /**
    加密对应的密钥对openpgp
    */
    let password = myself.password
    let userIds: any = [{ name: newMyselfPeer.name, mobile: newMyselfPeer.mobile, peerId: newMyselfPeer.peerId }]
    let keyPair = await openpgp.generateKey({
      userIds: userIds,
      namedCurve: 'ed25519',
      passphrase: password
    })
    let privateKey = keyPair.privateKey
    newMyselfPeer.privateKey = await openpgp.export(privateKey, password)
    //let privateKey = await openpgp.import(newMyselfPeer.privateKey, { password: password })
    newMyselfPeer.publicKey = await openpgp.export(keyPair.publicKey, null)

    newMyselfPeer.createDate = currentDate
    newMyselfPeer.updateDate = currentDate
    newMyselfPeer.lastUpdateTime = currentDate
    newMyselfPeer.startDate = currentDate
    newMyselfPeer.endDate = new Date("9999-12-31T11:59:59.999Z")
    newMyselfPeer.status = EntityStatus[EntityStatus.Effective]
    newMyselfPeer.statusDate = currentDate
    newMyselfPeer.version = newMyselfPeer.version + 1
    newMyselfPeer._id = undefined
    newMyselfPeer._rev = undefined
    newMyselfPeer = await this.insert(newMyselfPeer)

    myself.myselfPeer = newMyselfPeer
    this.setMyselfPeerClient()

    if (privateKey) {
      let isDecrypted = privateKey.isDecrypted()
      console.log('isDecrypted:' + isDecrypted)
      if (!isDecrypted) {
        await privateKey.decrypt(password)
      }
    }
    //myself.privateKey = keyPair.privateKey
    myself.privateKey = privateKey
    myself.publicKey = keyPair.publicKey

    return myself
  }

  async importID(json: string): Promise<number> {
    let ret: number = 0
    console.log('importID json:' + json)
    let peers = JSON.parse(json)
    if (!peers || !peers[0] || !peers[0].peerId || !peers[0].mobile) {
      throw new Error('InvalidID')
    } else {
      let condition = {}
      condition['peerId'] = peers[0].peerId
      let result = await this.find(condition, null, null, null, null)
      if (result && result.length > 0) {
        throw new Error('AccountExists')
      }
      let currentDate = new Date()
      let mobile = peers[0].mobile
      let myselfPeer = new MyselfPeer()
      myselfPeer.peerId = peers[0].peerId
      myselfPeer.mobile = mobile
      condition = { status: EntityStatus[EntityStatus.Effective] }
      condition['name'] = peers[0].name
      result = await this.find(condition, null, null, null, null)
      if (result && result.length > 0) {
        myselfPeer.name = peers[0].name + '(' + result.length + ')'
        ret = result.length
      } else {
        myselfPeer.name = peers[0].name
      }
      myselfPeer.peerPrivateKey = peers[0].peerPrivateKey
      myselfPeer.peerPublicKey = peers[0].peerPublicKey
      myselfPeer.privateKey = peers[0].privateKey
      myselfPeer.publicKey = peers[0].publicKey
      myselfPeer.address = '127.0.0.1:8088'
      myselfPeer.lastUpdateTime = peers[0].lastUpdateTime
      myselfPeer.securityContext = '{\"protocol\":\"OpenPGP\",\"keyPairType\":\"Ed25519\"}'
      myselfPeer.createDate = currentDate
      myselfPeer.updateDate = currentDate
      myselfPeer.startDate = currentDate
      myselfPeer.endDate = new Date('9999-12-31T11:59:59.999Z')
      myselfPeer.status = EntityStatus[EntityStatus.Effective]
      myselfPeer.statusDate = currentDate
      myselfPeer.version = 0
      myselfPeer.creditScore = 300
      myselfPeer.mobileVerified = peers[0].mobileVerified
      myselfPeer.visibilitySetting = peers[0].visibilitySetting
      myselfPeer = await this.upsert(myselfPeer)
      if (myselfPeer) {
        // 初始化profile
        let peerProfile = new PeerProfile()
        peerProfile.clientId = myselfPeer._id + ''
        peerProfile.peerId = myselfPeer.peerId
        peerProfile.clientType = config.appParams.clientType
        peerProfile.clientDevice = config.appParams.clientDevice
        peerProfile.language = peers[0].language
        peerProfile.lightDarkMode = peers[0].lightDarkMode
        peerProfile.primaryColor = peers[0].primaryColor
        peerProfile.secondaryColor = peers[0].secondaryColor
        peerProfile.udpSwitch = peers[0].udpSwitch
        peerProfile.downloadSwitch = peers[0].downloadSwitch
        peerProfile.localDataCryptoSwitch = peers[0].localDataCryptoSwitch
        peerProfile.autoLoginSwitch = peers[0].autoLoginSwitch
        peerProfile.developerOption = peers[0].developerOption
        peerProfile.logLevel = peers[0].logLevel
        peerProfile.lastSyncTime = new Date('1970-01-01T00:00:00.000Z')
        peerProfile.status = EntityStatus[EntityStatus.Effective]
        peerProfile.statusDate = currentDate
        peerProfile = await peerProfileService.upsert(peerProfile)

        myself.myselfPeer = myselfPeer
        myself.peerProfile = peerProfile
      }
    }

    return ret
  }

  exportID(): string {
    let json = ''
    if (myself.myselfPeerClient) {
      let peers = [CollaUtil.clone(myself.myselfPeerClient)]
      delete peers[0]._id
      delete peers[0]._rev
      delete peers[0].avatar
      delete peers[0].address
      delete peers[0].securityContext
      delete peers[0].createDate
      delete peers[0].updateDate
      delete peers[0].startDate
      delete peers[0].endDate
      delete peers[0].status
      delete peers[0].statusReason
      delete peers[0].statusDate
      delete peers[0].version
      delete peers[0].creditScore
      delete peers[0].activeStatus
      delete peers[0].clientId
      delete peers[0].clientType
      delete peers[0].clientDevice
      delete peers[0].lastSyncTime
      delete peers[0].signalPublicKey
      delete peers[0].signalPrivateKey
      json = JSON.stringify(peers)
    }

    console.log('exportID json:' + json)
    return json
  }

  async destroyID() {
    let condition = {}
    condition['peerId'] = myself.myselfPeer.peerId
    let myselfPeers = await this.find(condition, null, null, null, null)
    if (myselfPeers && myselfPeers.length > 0) {
      await this.delete(myselfPeers)
    }

    let peerProfiles = await peerProfileService.find(condition, null, null, null, null)
    if (peerProfiles && peerProfiles.length > 0) {
      await peerProfileService.delete(peerProfiles)
    }
  }

  setMyselfPeerClient() {
    if (!myself.myselfPeerClient) {
      myself.myselfPeerClient = {}
    }
    if (myself.myselfPeer) {
      myself.myselfPeerClient.peerPrivateKey = myself.myselfPeer.peerPrivateKey
      myself.myselfPeerClient.peerPublicKey = myself.myselfPeer.peerPublicKey
      myself.myselfPeerClient.privateKey = myself.myselfPeer.privateKey
      myself.myselfPeerClient.publicKey = myself.myselfPeer.publicKey
      myself.myselfPeerClient.peerId = myself.myselfPeer.peerId
      myself.myselfPeerClient.mobile = myself.myselfPeer.mobile
      myself.myselfPeerClient.name = myself.myselfPeer.name
      myself.myselfPeerClient.avatar = myself.myselfPeer.avatar,
      myself.myselfPeerClient.securityContext = myself.myselfPeer.securityContext
      myself.myselfPeerClient.address = myself.myselfPeer.address
      myself.myselfPeerClient.status = myself.myselfPeer.status
      myself.myselfPeerClient.statusReason = myself.myselfPeer.statusReason
      myself.myselfPeerClient.statusDate = myself.myselfPeer.statusDate
      myself.myselfPeerClient.startDate = myself.myselfPeer.startDate
      myself.myselfPeerClient.endDate = myself.myselfPeer.endDate
      myself.myselfPeerClient.version = myself.myselfPeer.version
      myself.myselfPeerClient.creditScore = myself.myselfPeer.creditScore
      myself.myselfPeerClient.activeStatus = myself.myselfPeer.activeStatus
      myself.myselfPeerClient.mobileVerified = myself.myselfPeer.mobileVerified
      myself.myselfPeerClient.visibilitySetting = myself.myselfPeer.visibilitySetting
      myself.myselfPeerClient.lastUpdateTime = myself.myselfPeer.lastUpdateTime
      myself.myselfPeerClient.signalPublicKey = myself.myselfPeer.signalPublicKey
      myself.myselfPeerClient.signalPrivateKey = myself.myselfPeer.signalPrivateKey 
    }
    if (myself.peerProfile) {
      myself.myselfPeerClient.clientId = myself.peerProfile.clientId,
      myself.myselfPeerClient.clientType = myself.peerProfile.clientType,
      myself.myselfPeerClient.clientDevice = myself.peerProfile.clientDevice,
      myself.myselfPeerClient.language = myself.peerProfile.language,
      myself.myselfPeerClient.lightDarkMode = myself.peerProfile.lightDarkMode,
      myself.myselfPeerClient.primaryColor = myself.peerProfile.primaryColor,
      myself.myselfPeerClient.secondaryColor = myself.peerProfile.secondaryColor,
      myself.myselfPeerClient.udpSwitch = myself.peerProfile.udpSwitch,
      myself.myselfPeerClient.downloadSwitch = myself.peerProfile.downloadSwitch,
      myself.myselfPeerClient.localDataCryptoSwitch = myself.peerProfile.localDataCryptoSwitch,
      myself.myselfPeerClient.autoLoginSwitch = myself.peerProfile.autoLoginSwitch,
      myself.myselfPeerClient.developerOption = myself.peerProfile.developerOption,
      myself.myselfPeerClient.logLevel = myself.peerProfile.logLevel,
      myself.myselfPeerClient.lastSyncTime = myself.peerProfile.lastSyncTime
    }
    return myself.myselfPeerClient
  }
}
export let myselfPeerService = new MyselfPeerService("blc_myselfPeer", ['endDate', 'peerId', 'mobile', 'status', 'updateDate'], null)