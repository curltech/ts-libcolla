import { pounchDb } from '../../db/pounchdb'
import { TypeUtil } from '../../util/util'


export enum EntityStatus {
	Draft,
	Effective,
	Expired,
	Deleted,
	Canceled,
	Checking,
	Undefined,
	Locked,
	Checked,
	Unchecked,
	Disable,
	Discarded,
	Merged,
	Reversed,
}

export enum ActiveStatus {
	Up,
	Down
}

export abstract class BaseEntity {
	public _id!: number
	public _rev!: string
	public createDate!: Date
	public updateDate!: Date
	public entityId!: string
	public state!: string
}

export abstract class StatusEntity extends BaseEntity {
	public status!: string
	public statusReason!: string
	public statusDate!: Date
}

export abstract class PeerLocation extends StatusEntity {
	public peerId!: string
	public kind!: string
	public name!: string
	public securityContext!: string
	/**
	libp2p的公私钥
	*/
	public peerPublicKey!: string
	/**
	openpgp的公私钥
	*/
	public publicKey!: string
	public address!: string
	public lastUpdateTime!: Date
}

export abstract class PeerEntity extends PeerLocation {
	public mobile!: string
	public email!: string
	public startDate!: Date
	public endDate!: Date
	public creditScore!: number
	public preferenceScore!: number
	public badCount!: number
	public staleCount!: number
	public lastAccessMillis!: number
	public lastAccessTime!: Date
	public activeStatus!: string
	public blockId!: string
	public balance!: number
	public currency!: string
	public lastTransactionTime!: Date
	public previousPublicKeySignature!: string
	public signature!: string
	public signatureData!: string
	public expireDate!: number
	public version!: number
}

/**
 * 本地pounchdb的通用访问类，所有的表访问服务都是这个类的实例
 */
export class BaseService {
	private tableName: string
	constructor(tableName: string, indexFields: string[], searchFields: string[]) {
		this.tableName = tableName
		pounchDb.create(this.tableName, indexFields, searchFields)
	}

	compact() {
		return pounchDb.compact(this.tableName)
	}

	get(id: number): Promise<any> {
		return pounchDb.get(this.tableName, id)
	}

	findOne(condition: any, sort: any, fields: any): Promise<any> {
		return pounchDb.findOne(this.tableName, condition, sort, fields)
	}

	find(condition: any, sort: any, fields: any, from: number, limit: number): Promise<any> {
		return pounchDb.find(this.tableName, condition, sort, fields, from, limit)
	}

	insert(entity: any | []): Promise<any> {
		if (TypeUtil.isArray(entity)) {
			let ps = []
			for (let e of entity) {
				let p = pounchDb.insert(this.tableName, e)
				ps.push(p)
			}
			return Promise.all(ps)
		} else {
			return pounchDb.insert(this.tableName, entity)
		}
	}

	delete(entity: any | []): Promise<any> {
		if (TypeUtil.isArray(entity)) {
			let ps = []
			for (let e of entity) {
				let p = pounchDb.delete(this.tableName, e)
				ps.push(p)
			}
			return Promise.all(ps)
		} else {
			return pounchDb.delete(this.tableName, entity)
		}
	}

	update(entity: any | []): Promise<any> {
		if (TypeUtil.isArray(entity)) {
			let ps = []
			for (let e of entity) {
				let p = pounchDb.update(this.tableName, e, null)
				ps.push(p)
			}
			return Promise.all(ps)
		} else {
			return pounchDb.update(this.tableName, entity, null)
		}
	}

	/**
	 * 批量保存，根据脏标志新增，修改或者删除
	 * @param entities 
	 * @param ignore 
	 * @param parent 
	 */
	async save(entities: any[], ignore: any, parent: any): Promise<any> {
		for (let entity of entities) {
			await this.check(entity)
		}
		return pounchDb.execute(this.tableName, entities, ignore, parent)
	}

	/**
	 * 根据_id是否存在逐条增加或者修改
	 * @param entity 
	 */
	async upsert(entity: any | []): Promise<any> {
		if (TypeUtil.isArray(entity)) {
			let ps = []
			for (let e of entity) {
				let exist = await this.check(e)
				if (exist) {
					let p = this.update(e)
					ps.push(p)
				} else {
					let p = this.insert(e)
					ps.push(p)
				}
			}
			return Promise.all(ps)
		} else {
			let exist = await this.check(entity)
			if (exist) {
				return this.update(entity)
			} else {
				return this.insert(entity)
			}
		}
	}

	/**
	 * 检查_id是否存在，避免更新失败，如还需判断重复记录，应自行实现Override方法
	 * @param entity 
	 */
	async check(entity: any): Promise<any> {
		if (entity._id) {
			let e = await this.get(entity._id)
			if (e) {
				entity._id = e._id
				entity._rev = e._rev
				for (let key of entity) {
					let value = entity[key]
					if (value) {
						e[key] = value
					}
				}

				return e
			} else {
				entity._id = undefined
				entity._rev = undefined
			}
		} else {
			entity._id = undefined
			entity._rev = undefined
		}

		return null
	}
}