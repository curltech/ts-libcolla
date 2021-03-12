// import sqlite3 from 'sqlite3' //原生electron下使用sqlite3才需要
import { DataStore } from './datastore'
class ElectronSqlite3 extends DataStore {
	constructor() {
		super()
	}
	/**
	 * 创建或者打开数据库
	 * @param {*} options
	 */
	open(options = {
		name: '/Users/hujingsong/colla.db'
	}) {
		this.path = options.name
		let sqlite3: any
		const sqlite = sqlite3.verbose()
		return new Promise((resolve, reject) => {
			this.db = new sqlite.Database(this.path, (err: any) => {
				if (err === null) {
					resolve(null)
				} else {
					reject(err)
				}
			})
		})
	}
	/**
	 * 关闭数据库
	 */
	close() {
		this.db.close()
	}
	/**
	 * 删除数据库
	 * @param {*} options
	 */
	remove() {

	}
	/**
	 * 批量执行sql，参数是二维数组
	 * @param {*} sqls
	 * @param {*} params
	 */
	execute(sqls: string[], parameters: any, mode: string = 'serialize') {
		let ps: any[] = []
		let _that: any = this
		if (mode === 'serialize') {
			this.db.serialize(function () {
				for (let i = 0; i < sqls.length; ++i) {
					let sql = sqls[i]
					let params = parameters[i]
					let p = _that.run(sql, params)
					ps.push(p)
				}
			})
		} else if (mode === 'parallelize') {
			this.db.parallelize(function () {
				for (let i = 0; i < sqls.length; ++i) {
					let sql = sqls[i]
					let params = parameters[i]
					let p = _that.run(sql, params)
					ps.push(p)
				}
			})
		}
		return ps
	}
	/**
	 * 执行单条sql
	 * @param {*} sqls
	 * @param {*} params
	 */
	run(sql: string, params: any) {
		return new Promise((resolve, reject) => {
			this.db.run(sql, params, (err: any) => {
				if (err === null) {
					resolve(err)
				} else {
					reject(err)
				}
			})
		})
	}

	find(sql: string, params: any, from: number, limit: number) {
		return new Promise((resolve, reject) => {
			if (limit) {
				sql = sql + ' LIMIT ' + limit
			}
			if (from) {
				sql = sql + ' OFFSET ' + from
			}
			this.db.all(sql, params, (err: any, data: any) => {
				if (err) {
					reject(err)
				} else {
					console.log('Record count: ' + data.rows.length)
					let results = []
					for (let i = 0; i < data.rows.length; ++i) {
						results.push(data.rows.item(i))
					}
					let page = { data: results, from: from, limit: limit, total: data.rows.length }
					resolve(page)
				}
			})
		})
	}
	async test() {
		this.open()
		let sqls = []
		sqls.push('DROP TABLE IF EXISTS test_table')
		sqls.push('CREATE TABLE IF NOT EXISTS test_table (id integer primary key, data text, data_num integer)')
		this.execute(sqls, null)
		this.insert('test_table', { id: 1, data: 'hello1', data_num: 1234561 })
		this.insert('test_table', { id: 2, data: 'hello2', data_num: 1234562 })
		let results = await this.findOne('test_table', ['id', 'data', 'data_num'], [['data', 'like', 'hello%']], [])
		console.info(results)
		this.update('test_table', { data: 'hello-update', data_num: 12345678 }, [['id', '=', 1]])
		this.delete('test_table', [['id', '=', 1]])
	}
}
export let electronSqlite3 = new ElectronSqlite3()