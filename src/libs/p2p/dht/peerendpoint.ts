import { PeerEntity, BaseService } from '../db/base'

export class PeerEndpoint extends PeerEntity {
  public endpointType!: string
  public discoveryAddress!: string
  public priority!: number
  public ownerPeerId!: string
  public lastConnectTime!: Date
}
export class PeerEndpointService extends BaseService {
}
export let peerEndpointService = new PeerEndpointService("blc_peerEndpoint", ['ownerPeerId', 'priority', 'address'], null)