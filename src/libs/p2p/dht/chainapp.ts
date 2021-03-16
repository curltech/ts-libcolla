import { BaseService, StatusEntity } from '../db/base'

export class ChainApp extends StatusEntity {
  public peerId!: string
  public appType!: string
  public registPeerId!: string
  public path!: string
  public mainClass!: string
  public codePackage!: string
  public appHash!: string
  public appSignature!: string
}
export class ChainAppService extends BaseService {
}
export let chainAppService = new ChainAppService("blc_chainApp", null, null)
