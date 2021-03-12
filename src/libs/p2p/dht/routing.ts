import { p2pPeer } from '@/libs/p2p/p2ppeer'
class ContentRouting {
	constructor() {

	}

	put(key: any, value: any, options: any) {
		p2pPeer.contentRouting.put(key, value, options)
	}
	get(key: any, options: any) {
		return p2pPeer.contentRouting.get(key, options)
	}
	getMany(key: any, nvals: any, options: any) {
		return p2pPeer.contentRouting.get(key, nvals, options)
	}
	findPeer(peerId: any, options: any) {
		return p2pPeer.peerRouting.findPeer(peerId, options)
	}
}

class AddressBook {
	add() { }
	delete() { }
	get() { }
	getMultiaddrsForPeer() { }
	set() { }
}

class KeyBook {
	delete() {

	}
	get() {

	}
	set() {

	}
}

class MetadataBook {

	delete() {

	}
	deleteValue() {

	}
	get() {

	}
	getValue() {

	}
	set() { }
}

class ProtoBook {
	add() { }
	delete() { }
	get() { }
	set() { }
}

class PeerStore {
	delete() { }
	get() { }
	peers() { }
}