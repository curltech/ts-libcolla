import { ObjectUtil } from '../../util/util'

export class AppParams {
	public p2pProtocol: string
	public timeFormat: string
	public mode: string
	public language: string
	public clientDevice: string
	public clientType: string
	/**
	 * 带地址前缀，由设置界面设置，存储在localstorage，用于缺省的bootstrap，缺省的连接节点
	 */
	public connectPeerId: string[]
	/**
	 * 非libp2p的连接地址前缀，比如http和ws
	 */
	public connectAddress: string[]
	public iceServer: [][]
}

export class P2pParams {
	public chainProtocolId: string = '/chain/1.0.0'
}

export class Libp2pParams {
	public enable: boolean
	public topic: string
	public addrs: string[] = []
}

class Config {
	public appParams: AppParams = new AppParams()
	public p2pParams: P2pParams = new P2pParams()
	public libp2pParams: Libp2pParams = new Libp2pParams()
	constructor() {
		let json = window.localStorage.getItem('AppParams')
		if (json) {
			let appParams = JSON.parse(json)
			ObjectUtil.copy(appParams, this.appParams)
		}
		json = window.localStorage.getItem('P2pParams')
		if (json) {
			let p2pParams = JSON.parse(json)
			ObjectUtil.copy(p2pParams, this.p2pParams)
		}
		json = window.localStorage.getItem('Libp2pParams')
		if (json) {
			let libp2pParams = JSON.parse(json)
			ObjectUtil.copy(libp2pParams, this.libp2pParams)
		}
	}

	setAppParams() {
		window.localStorage.setItem('AppParams', JSON.stringify(this.appParams))
	}

	setP2pParams() {
		window.localStorage.setItem('P2pParams', JSON.stringify(this.p2pParams))
	}

	setLibp2pParams() {
		window.localStorage.setItem('Libp2pParams', JSON.stringify(this.libp2pParams))
	}
}
export let config = new Config()