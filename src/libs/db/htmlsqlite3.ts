import { DataStore } from './datastore'
/**
 * 适用于移动手机（无数据限制），electron和chrome浏览器的sqlite3的数据库（50M数据限制）
 */
class Html5Sqlite3 extends DataStore {
	constructor() {
		super()
	}
	/**
	 * 创建或者打开数据库
	 * @param {*} options
	 */
	open(options: any = {
		name: 'colla.db',
		location: 'default'
	}) {
		let w: any = window
		if (w.device && (w.device.platform === 'Android' || w.device.platform === 'iOS')) {
			this.db = w.sqlitePlugin.openDatabase(options)
		} else if (!w.device) {
			this.db = w.openDatabase(options.name, '1.0.0', '', 50 * 1024 * 1024)
		}
	}
	/**
	 * 关闭数据库
	 */
	close() {
		return new Promise((resolve, reject) => {
			this.db.close(function () {
				console.log('DB closed!')
				resolve(null)
			}, function (err: any) {
				console.log('Error closing DB:' + err.message)
				reject(err)
			})
		})
	}
	/**
	 * 删除数据库
	 * @param {*} options
	 */
	remove(options: any = {
		name: 'colla.db',
		location: 'default'
	}) {
		return new Promise((resolve, reject) => {
			let w: any = window
			w.sqlitePlugin.deleteDatabase(options,
				function () {
					console.log('removing DB')
					resolve(null)
				},
				function (error: any) {
					console.log('Error removing DB:' + error.message)
					reject(error)
				})
		})
	}
	/**
	 * 批量执行sql，参数是二维数组
	 * @param {*} sqls
	 * @param {*} params
	 */
	execute(sqls: string[], parameters: any) {
		return new Promise((resolve, reject) => {
			this.db.transaction(function (tx: any) {
				let i = 0
				for (let sql of sqls) {
					if (parameters && parameters[i]) {
						tx.executeSql(sql, parameters[i])
					} else {
						tx.executeSql(sql)
					}
					++i
				}
			}, function (error: any) {
				console.log('Transaction ERROR: ' + error.message)
				reject(error)
			}, function () {
				console.log('Execute database OK')
				resolve(null)
			})
		})
	}
	/**
	 * 执行单条sql
	 * @param {*} sqls
	 * @param {*} params
	 */
	run(sql: string, params: any) {
		return new Promise((resolve, reject) => {
			this.db.transaction(function (tx: any) {
				if (params) {
					tx.executeSql(sql, params)
				} else {
					tx.executeSql(sql)
				}
			}, function (error: any) {
				console.log('Transaction ERROR: ' + error.message)
				reject(error)
			}, function () {
				console.log('Run database OK')
				resolve(null)
			})
		})
	}
	/**
	 * 执行查询语句
	 * @param {*} sql
	 * @param {*} params
	 */
	get(sql: string, params: any): any {
		return new Promise((resolve, reject) => {
			this.db.transaction(function (tx: any) {
				tx.executeSql(sql, params, function (tx: any, rs: any) {
					console.log('Record count: ' + rs.rows.length)
					resolve(rs.rows.item(0))
				}, function (tx: any, error: any) {
					console.log('Find error: ' + error.message)
					reject(error)
				})
			})
		})
	}

	find(sql: string, params: any, from: number, limit: number): any {
		return new Promise((resolve, reject) => {
			this.db.transaction(function (tx: any) {
				if (limit) {
					sql = sql + ' LIMIT ' + limit
				}
				if (from) {
					sql = sql + ' OFFSET ' + from
				}
				tx.executeSql(sql, params, function (tx: any, rs: any) {
					console.log('Record count: ' + rs.rows.length)
					let results = []
					for (let i = 0; i < rs.rows.length; ++i) {
						results.push(rs.rows.item(i))
					}
					let page = { data: results,  total: rs.rows.length }
					resolve(page)
				}, function (tx: any, error: any) {
					console.log('Page error: ' + error.message)
					reject(error)
				})
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
export let html5Sqlite3 = new Html5Sqlite3()