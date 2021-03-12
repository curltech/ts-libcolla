import { TypeUtil } from '../util/util'

export class EntityState {
	public static None = 'None'
	public static New = 'New'
	public static Modified = 'Modified'
	public static Deleted = 'Deleted'
}

class SqlBuilder {
	constructor() { }
	/**
	 * 建表
	 * @param {*} tableName
	 * @param {*} fields
	 */
	create(tableName: string, fields: string[]): string {
		let query = 'CREATE TABLE IF NOT EXISTS ' + tableName + '('
		if (TypeUtil.isString(fields)) {
			query = query + fields
		} else {
			let i = 0
			for (let field of fields) {
				if (i === 0) {
					query = query + field
				} else {
					query = query + ', ' + field
				}
				++i
			}
		}
		query = query + ')'

		return query
	}
	/**
	 * 删除表
	 * @param {*} tableName
	 */
	drop(tableName: string): string {
		let query = 'DROP TABLE IF EXISTS ' + tableName

		return query
	}

	/**
	 * 查询记录
	 * @param {*} tableName
	 * @param {*} fields
	 * @param {*} condition
	 */
	select(tableName: string, condition: any, sort: any, fields: any, from: number, limit: number): any {
		let query = 'SELECT '
		let i = 0
		for (let field of fields) {
			if (i === 0) {
				query = query + field
			} else {
				query = query + ', ' + field
			}
			++i
		}
		query = query + ' FROM ' + tableName + ' WHERE '
		let params = []
		for (let j = 0; j < condition.length; ++j) {
			let con = condition[j]
			let key = con[0]
			let op = con[1]
			let param = con[2]
			params.push(param)
			if (j === 0) {
				query = query + key + ' ' + op + ' ?'
			} else {
				query = query + ' AND ' + key + ' ' + op + ' ?'
			}
		}
		if (sort) {
			query = query + ' ORDER BY ' + sort
		}
		if (limit) {
			query = query + ' LIMIT ' + limit
		}
		if (from) {
			query = query + ' OFFSET ' + from
		}

		return { query, params }
	}
	/**
	 * 插入一条记录
	 * @param {*} tableName
	 * @param {*} entity
	 */
	insert(tableName: string, entity: any): any {
		let params = []
		let query = 'INSERT INTO ' + tableName + ' ('
		let i = 0
		let valueQuery = ''
		for (let key in entity) {
			let param = entity[key]
			params.push(param)
			if (i === 0) {
				query = query + key
				valueQuery = valueQuery + '?'
			} else {
				query = query + ', ' + key
				valueQuery = valueQuery + ', ' + '?'
			}
			++i
		}
		query = query + ') values (' + valueQuery + ')'

		return { query, params }
	}

	/**
	 * 删除记录
	 * @param {*} tableName
	 * @param {*} condition
	 */
	delete(tableName: string, condition: any): any {
		let query = 'DELETE FROM ' + tableName + ' WHERE '
		let params = []
		for (let j = 0; j < condition.length; ++j) {
			let con = condition[j]
			let key = con[0]
			let op = con[1]
			let param = con[2]
			params.push(param)
			if (j === 0) {
				query = query + key + ' ' + op + ' ?'
			} else {
				query = query + ' AND ' + key + ' ' + op + ' ?'
			}
		}

		return { query, params }
	}
	/**
	 * 更新记录
	 * @param {*} tableName
	 * @param {*} entity
	 * @param {*} condition
	 */
	update(tableName: string, entity: any, condition: any): any {
		let query = 'UPDATE ' + tableName + ' SET '
		let params = []
		let i = 0
		for (let key in entity) {
			let param = entity[key]
			params.push(param)
			if (i === 0) {
				query = query + key + ' = ?'
			} else {
				query = query + ', ' + key + ' = ?'
			}
			++i
		}
		query = query + ' WHERE '

		for (let j = 0; j < condition.length; ++j) {
			let con = condition[j]
			let key = con[0]
			let op = con[1]
			let param = con[2]
			params.push(param)
			if (j === 0) {
				query = query + key + ' ' + op + ' ?'
			} else {
				query = query + ' AND ' + key + ' ' + op + ' ?'
			}
		}

		return { query, params }
	}
}
export let sqlBuilder = new SqlBuilder()

export abstract class DataStore {
	protected db!: any
	protected path!: string
	constructor() {
	}
	splice(entity: any, parent: any) {
		if (parent && TypeUtil.isArray(parent)) {
			for (let i = 0; i < parent.length; i++) {
				if (parent[i]._id === entity._id) {
					parent.splice(i, 1)
					break
				}
			}
		}
	}

	/**
	 * 建表
	 * @param {*} tableName
	 * @param {*} fields
	 */
	create(tableName: string, indexFields: string[], fields: string[]) {
		let query = sqlBuilder.create(tableName, fields)
		let _that: any = this

		return _that.run(query)
	}
	/**
	 * 删除表
	 * @param {*} tableName
	 */
	drop(tableName: string) {
		let query = sqlBuilder.drop(tableName)
		let _that: any = this

		return _that.run(query)
	}

	/**
	 * 查询记录
	 * @param {*} tableName
	 * @param {*} fields
	 * @param {*} condition
	 */
	findOne(tableName: string, condition: any, sort: any, fields: string[]): any {
		let { query, params } = sqlBuilder.select(tableName, condition, sort, fields, 0, 0)
		let _that: any = this

		return _that.find(query, params)
	}

	/**
	 * 插入一条记录
	 * @param {*} tableName
	 * @param {*} entity
	 */
	insert(tableName: string, entity: any): any {
		let operator = { type: 'insert', tableName: tableName, entity: entity }

		return this.transaction([operator])
	}

	/**
	 * 删除记录
	 * @param {*} tableName
	 * @param {*} condition
	 */
	delete(tableName: string, condition: any): any {
		let operator = { type: 'delete', tableName: tableName, condition: condition }

		return this.transaction([operator])
	}
	/**
	 * 更新记录
	 * @param {*} tableName
	 * @param {*} entity
	 * @param {*} condition
	 */
	update(tableName: string, entity: any, condition: any): any {
		let operator = { type: 'update', tableName: tableName, entity: entity, condition: condition }

		return this.transaction([operator])
	}
	/**
	 * 在一个事务里面执行多个操作（insert,update,delete)
	 * operators是一个operator对象的数组，operator有四个属性（type，tableName，entity，condition）
	 * @param {*} operators
	 */
	transaction(operators: any): any {
		let ps = []
		for (let i = 0; i < operators.length; ++i) {
			let operator = operators[i]
			let tableName = operator.tableName
			let entity = operator.entity
			let state = entity.state
			let condition = operator.condition
			let sql = null
			if (EntityState.New === state) {
				sql = sqlBuilder.insert(tableName, entity)
			} else if (EntityState.Modified === state) {
				sql = sqlBuilder.update(tableName, entity, condition)
			} else if (EntityState.Deleted === state) {
				sql = sqlBuilder.delete(tableName, condition)
			}
			let _that: any = this
			let p = _that.run(sql.query, sql.params)
			ps.push(p)
		}

		return ps
	}
}