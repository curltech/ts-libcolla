import { BaseService } from '../db/base'
import { messageSerializer } from '../chain/message'
import { CodeUtil } from '../../util/util'
import { openpgp } from '../crypto/openpgp'
import { peerClientService } from '../dht/peerclient'
import { peerEndpointService } from '../dht/peerendpoint'
import { chainAppService } from '../dht/chainapp'
import { dataBlockService } from '../chain/datablock'
import { transactionKeyService } from '../chain/transactionkey'
const { Adapter } = require('interface-datastore')
const Key = require('interface-datastore').Key
const { kaddht, utils } = require('libp2p-kad-dht')
const { Record } = require('libp2p-record')

export class Namespace {
	public static PeerEndpointPrefix: string = 'peerEndpoint'
	public static PeerClientPrefix: string = 'peerClient'
	public static ChainAppPrefix: string = 'chainApp'
	public static DataBlockPrefix: string = 'dataBlock'
	public static TransactionKeyPrefix: string = 'transactionKey'
}

export class DispatchRequest {
	public Name!: string
	public Keyname!: string
	public Datastore: any
	public Service: BaseService
	public Keyvalue: any
}

export class DispatchPool {
	private datastorePool = new Map()
	private servicePool = new Map()
	private keynamePool = new Map<string, string>()

	constructor() {
	}

	init() {
		this.regist(Namespace.PeerEndpointPrefix, 'PeerId', pounchDatastore, peerEndpointService)
		this.regist(Namespace.PeerClientPrefix, 'PeerId', pounchDatastore, peerClientService)
		this.regist(Namespace.ChainAppPrefix, 'PeerId', pounchDatastore, chainAppService)
		this.regist(Namespace.DataBlockPrefix, 'BlockId', pounchDatastore, dataBlockService)
		this.regist(Namespace.TransactionKeyPrefix, 'Key', pounchDatastore, transactionKeyService)
	}

	regist(name: string, keyname: string, ds: any, service: any) {
		this.keynamePool.set(name, keyname)
		this.datastorePool.set(name, ds)
		this.servicePool.set(name, service)
	}

	get(name: string): DispatchRequest {
		let request = new DispatchRequest()
		request.Keyname = this.keynamePool.get(name) as string
		request.Datastore = this.datastorePool.get(name)
		request.Service = this.servicePool.get(name)

		return request
	}

	newKeyRequest(key: any): DispatchRequest {
		let s = key.toString()
		s = s.substr(1)
		let buf = CodeUtil.decodeBase32(s)
		let strKey = openpgp.uint8ArrayToStr(buf)
		let segs: string[] = strKey.split('/')
		let prefix: string = segs[1]
		let request = this.newPrefixRequest(prefix)
		/**
		在delete，put操作的时候，segs[2]也就是key必须是唯一确定数据的主键和唯一索引，因为它决定了要删除和保存的数据存放的节点
		最近节点是根据这个决定的
		在get的时候，最好也是主键或者唯一索引，并且与put的时候的值相同，假如需要作更复杂的搜索，可以让key成为一个json
		但是，网络在递归搜索节点的时候会根据key的值来决定搜索的节点，因此是盲目的，搜索量会很大，
		现在的实现是如果不是json默认是主键或者唯一索引的模式
		如果自己实现递归搜索也是一种方案
		*/
		let Keyvalue: any = {}
		try {
			messageSerializer.textUnmarshal(segs[2])
		} catch (err) {
			Keyvalue[request.Keyname] = segs[2]
		}
		request.Keyvalue = Keyvalue

		return request
	}

	newPrefixRequest(prefix: string): DispatchRequest {
		let request = this.get(prefix)
		if (request) {
			request.Name = prefix
		}

		return request
	}
}
export let dispatchPool = new DispatchPool()

class DispatchDatastore extends Adapter {
	constructor() {
		super()
	}
	put(key: any, val: any, options: any) {
		let request = dispatchPool.newKeyRequest(key)
		return request.Datastore.put(key, val, options)
	}

	get(key: any, options: any) {
		let request = dispatchPool.newKeyRequest(key)
		return request.Datastore.get(key, options)
	}

	has(key: any, options: any) {
		let request = dispatchPool.newKeyRequest(key)
		return request.Datastore.has(key, options)
	}

	delete(key: any, options: any) {
		let request = dispatchPool.newKeyRequest(key)
		return request.Datastore.delete(key, options)
	}
}
export let dispatchDatastore = new DispatchDatastore()

class PounchDatastore extends Adapter {
	constructor() {
		super()
	}

	async put(key: any, val: any, options: any) {
		let request = dispatchPool.newKeyRequest(key)
		let record = Record.deserialize(val)
		let {
			k,
			value,
			timeReceived
		} = record.prepareSerialize()
		let entity = messageSerializer.unmarshal(value)
		let result = await request.Service.upsert(entity)

		return result
	}

	get(key: any, options: any) {
		let request = dispatchPool.newKeyRequest(key)
		return request.Service.findOne(request.Keyvalue,null,null)
	}

	has(key: any, options: any) {
		let request = dispatchPool.newKeyRequest(key)
		let result = request.Service.findOne(request.Keyvalue,null,null)

		return result ? true : false
	}

	delete(key: any, options: any) {
		let request = dispatchPool.newKeyRequest(key)
		return request.Service.delete(request.Keyvalue)
	}
}
export let pounchDatastore = new PounchDatastore()