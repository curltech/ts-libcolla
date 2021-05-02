/**
 * 预定义的定位器
 */
export class ConnectPeerId {
	private _custom = [
		{
			label: 'peer1',
			value: '/dns4/localhost/tcp/5720/wss/p2p/12D3KooWBYydhJ5kSKf61hWZMfnupAZpuNZvNP4psDTxyKRyZKqg'
		},
		{
			label: 'peer2',
			value: '/dns4/localhost/tcp/5721/wss/p2p/12D3KooWKKa33PB6rAtoicEiCYuYjnPkVZRWAmUH3UK1ECBEJfgJ'
		}
	]
	private _pre = [
		{
			label: '深圳',
			value: ''
		},
		{
			label: '杭州',
			value: ''
		},
		{
			label: '韩国',
			value: ''
		},
	]

	constructor() { }

	addCustom(addr: any) {
		this._custom.push(addr)
	}

	get preOptions() {
		return this._pre
	}

	get allOptions() {
		let options = []
		for (let _p of this._pre) {
			options.push(_p)
		}
		for (let _p of this._custom) {
			options.push(_p)
		}
		return options
	}
}
export let connectPeerId = new ConnectPeerId()

export class ConnectAddress {
	private _custom = [
		{
			label: 'peer1',
			value: 'https://localhost:9091'
		},
		{
			label: 'peer2',
			value: 'wss://192.168.0.109:9092'
		}
	]
	private _pre = [
		{
			label: '深圳',
			value: ''
		},
		{
			label: '杭州',
			value: ''
		},
		{
			label: '韩国',
			value: ''
		},
	]

	constructor() { }

	addCustom(addr: any) {
		this._custom.push(addr)
	}

	get preOptions() {
		return this._pre
	}

	get allOptions() {
		let options = []
		for (let _p of this._pre) {
			options.push(_p)
		}
		for (let _p of this._custom) {
			options.push(_p)
		}
		return options
	}
}
export let connectAddress = new ConnectAddress()

export class IceServer {
	private _custom = [
		{
			label: 'peer1',
			value: [
				{
					urls: 'stun:192.168.0.109:3478'
				}, {
					urls: 'turn:192.168.0.109:3478',
					username: 'guest',
					credential: 'guest'
				}
			]
		}
	]
	private _pre = [
		{
			label: '深圳',
			value: [
				{
					urls: 'stun:120.79.254.124:3478'
				}, {
					urls: 'turn:120.79.254.124:3478',
					username: 'guest',
					credential: 'guest'
				}
			]
		},
		{
			label: '杭州',
			value: [
				{
					urls: 'stun::3478'
				}, {
					urls: 'turn::3478',
					username: 'guest',
					credential: 'guest'
				}
			]
		},
		{
			label: '韩国',
			value: [
				{
					urls: 'stun::3478'
				}, {
					urls: 'turn::3478',
					username: 'guest',
					credential: 'guest'
				}
			]
		},
	]

	constructor() { }

	addCustom(addr: any) {
		this._custom.push(addr)
	}

	get preOptions() {
		return this._pre
	}

	get allOptions() {
		let options = []
		for (let _p of this._pre) {
			options.push(_p)
		}
		for (let _p of this._custom) {
			options.push(_p)
		}
		return options
	}
}
export let iceServer = new IceServer()

export class Language {
	public static LanguageOptions = [
		{
			label: '中文',
			value: 'zh-hans'
		},
		{
			label: '繁体中文',
			value: 'zh-tw'
		},
		{
			label: 'English',
			value: 'en-us'
		},
		{
			label: '日本語',
			value: 'ja-jp'
		},
		{
			label: '한국어',
			value: 'ko-kr'
		}
	]
}

export class PeerMode {
	static P2pPeer: string = 'p2pPeer'
	static Client: string = 'client'
	static ModeOptions = [
		{
			label: '分布式节点',
			value: PeerMode.P2pPeer
		},
		{
			label: '客户端',
			value: PeerMode.Client
		}
	]
}

export class ClientDevice {
	static DESKTOP: string = 'DESKTOP'
	static MOBILE: string = 'MOBILE'
}

export class RouterMenu {
	private _base: string
	private _menu: any[]
	private _routers: Map<string, any>
	constructor(base: string) {
		this._base = base
	}

	set menu(menu: any[]) {
		this._menu = menu
	}

	get menu() {
		return this._menu
	}

	getRouter(routers: Map<string, any>): any[] {
		this._routers = routers
		return this._getRouter(this._menu)
	}

	private _getRouter(menu: any[]): any[] {
		let router = []
		if (menu && menu.length > 0) {
			for (let item of menu) {
				if (item.path && item.path.length > 0) {
					let r: any = { name: item.name, path: item.path }
					r.meta = { icon: item.icon, label: item.label }
					r.component = this._routers.get(item.name)//() => import(this._base + item.path)
					router.push(r)
				} else {
					if (item.children && item.children.length > 0) {
						let childrenRouter = this._getRouter(item.children)
						if (childrenRouter && childrenRouter.length > 0) {
							for (let r of childrenRouter) {
								router.push(r)
							}
						}
					}
				}
			}
		}

		return router
	}

	set title(title: string) {
		window.document.title = title
	}
}
export let routerMenu = new RouterMenu('@/components')