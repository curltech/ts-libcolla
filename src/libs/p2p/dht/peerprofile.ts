import { BaseService, StatusEntity } from '../db/base'

/**
 * PeerProfile
 */
export class PeerProfile extends StatusEntity {
  public peerId!: string
  public clientId!: string
  public clientType!: string
  public clientDevice!: string
  // 对应的用户编号
  public userId!: string
  // 用户名
  public username!: string

  // 个性化配置
  public language!: string
  public primaryColor!: string
  public secondaryColor!: string
  public lightDarkMode!: string
  public udpSwitch!: boolean
  public downloadSwitch!: boolean
  public localDataCryptoSwitch!: boolean
  public fullTextSearchSwitch!: boolean
  public developerOption!: boolean
  public lastSyncTime!: Date
}
export class PeerProfileService extends BaseService {
}
export let peerProfileService = new PeerProfileService("blc_peerProfile", ['peerId'])