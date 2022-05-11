import PouchDB from 'pouchdb'
import { EntityState, DataStore } from './datastore'
import PouchdbFind from 'pouchdb-find'
import PouchdbSearch from 'pouchdb-quick-search-curltech'
import { TypeUtil } from '../util/util'

/**
 * 使用于各种浏览器和手机的数据库pounchdb，支持全文检索
 */
export class PounchDb extends DataStore {
	private auto_compaction: boolean = true
	constructor() {
		super()
		//PouchDB.plugin(PouchdbSize)
		//PouchDB.plugin(PouchdbReplicationStream)
		PouchDB.plugin(PouchdbFind)
		PouchDB.plugin(PouchdbSearch)
		/**
		 * 中文的支持
		 * 把下面的代码加入pouchdb-quick-search的index.js文件中，方便获取内置的lunr
		 * 然后就实现自己的tokenizer，trimmer，stopWordFilter
		 * exports.lunr = function () {
			return lunr
			}
		 */
		if (PouchdbSearch.lunr) {
			let lunr: any = PouchdbSearch.lunr()
			lunr.tokenizer = this.tokenizer
			lunr.trimmer = this.trimmer
		}
		this.db = {}
	}
	/**
	 * 创建或者打开数据库
	 * @param {*} options
	 */
	open(options: any = {}) {
	}
	/**
	 * 关闭数据库
	 */
	close() {
	}
	/**
	 * 删除数据库
	 * @param {*} options
	 */
	remove(options: any = {}) {

	}

	compact(tableName: string) {
		let ds = this.db[tableName]
		if (ds) {
			return ds.compact()
		}
	}

	/**
	 * 建表
	 * @param {*} tableName
	 * @param {*} fields
	 */
	async create(tableName: string, indexFields: string[], searchFields: string[]) {
		let ds = this.db[tableName]
		if (!ds) {
			ds = new PouchDB(tableName, { auto_compaction: this.auto_compaction })
			this.db[tableName] = ds
			if (indexFields && indexFields.length > 0) {
				for (let i = 0; i < indexFields.length; ++i) {
					await ds.createIndex({
						index: {
							fields: [indexFields[i]]
						}
					})
				}
			}
			if (searchFields && searchFields.length > 0) {
				this.buildIndex(tableName, searchFields)
			}
		}
		//ds.installSizeWrapper()
		let info = await ds.info()
		console.log(JSON.stringify(info))
		//let diskSize = await ds.getDiskSize()
		//console.log('diskSize:' + diskSize)

		return ds
	}
	/**
	 * 删除表
	 * @param {*} tableName
	 */
	async drop(tableName: string) {
		let ds = this.db[tableName]
		if (ds) {
			delete this.db[tableName]
			return await ds.destroy()
		}

		return null
	}
	_ignore(entity: any, ignore: any) {
		let back: any = {}
		for (let key in entity) {
			let value = entity[key]
			let isIgnore = false
			if (ignore) {
				if (TypeUtil.isArray(ignore)) {
					if (ignore.indexOf(key) > -1) {
						isIgnore = true
					}
				} else if (ignore === key) {
					isIgnore = true
				}
			}
			if (key === 'state') {
				isIgnore = true
			}
			if (!isIgnore) {
				back[key] = value
			}
		}

		return back
	}
	async get(tableName: string, _id: number) {
		let ds = this.db[tableName]
		try {
			return await ds.get(_id)
		} catch (err) {
			if (err.status === 404) { // not found!
				return null
			} else { // hm, some other error
				throw err
			}
		}
	}
	getAll(tableName: string, options: any) {
		let ds = this.db[tableName]
		if (!options) {
			options = {
				include_docs: true,
				attachments: true
			}
		}
		try {
			return ds.allDocs(options)
		} catch (err) {
			if (err.status === 404) { // not found!
				return null
			} else { // hm, some other error
				throw err
			}
		}
	}
	prepareOne(tableName: string, entity: any, ignore: any, entityMap: any) {
		let ds = this.db[tableName]
		let state = entity.state
		let _id = entity._id
		let back = this._ignore(entity, ignore)
		if (EntityState.New === state) {
			if (!_id) {
				let timestamp = new Date().getTime()
				_id = '' + timestamp
				back._id = _id
				if (entityMap) {
					let i = 0
					while (entityMap.get(_id)) {
						++i
						_id = timestamp + '-' + i
						back._id = _id
					}
				}
			}
			back._rev = null
		} else if (EntityState.Deleted === state) {
			back._deleted = true
		} else if (!state || EntityState.Modified === state) {
		}
		if (entityMap) {
			entityMap.set(_id, entity)
		}

		return back
	}
	prepareAny(tableName: string, entities: any[], ignore: any) {
		let backs = []
		let entityMap = new Map()
		for (let key in entities) {
			let entity = entities[key]
			let back = this.prepareOne(tableName, entity, ignore, entityMap)
			backs.push(back)
		}

		return { backs, entityMap }
	}

	/**
	 * 批量执行多个文档
	 * @param {*} tableName
	 * @param {*} entity
	 * @param {*} ignore
	 * @param {*} parent
	 */
	execute(tableName: string, entities: any[], ignore: any, parent: any): Promise<any> {
		let _that = this
		if (TypeUtil.isArray(entities)) {
			let ds = this.db[tableName]
			let { backs, entityMap } = this.prepareAny(tableName, entities, ignore)
			return ds.bulkDocs(backs).then(function (results: any) {
				for (let key in results) {
					let result = results[key]
					let error = result.error
					if (error) {
						console.error('bulkDocs failure!' + result)
						continue
					}
					let _id = result.id
					let _rev = result.rev
					let state = null
					let current = entityMap.get(_id)
					if (current) {
						current._id = _id
						current._rev = _rev
						state = current.state
						current.state = undefined

						if (EntityState.Deleted === state) {
							if (parent && TypeUtil.isArray(parent)) {
								_that.splice(current, parent)
							}
						} else if (EntityState.New === state) {
							if (parent && TypeUtil.isArray(parent)) {
								parent.push(current)
							}
						}
					}
				}
				return entities
			}).catch(function (err: any) {
				console.log(err)
			})
		}
	}
	/**
	 * 执行单条文档的操作
	 * @param {*} tableName
	 * @param {*} entity
	 * @param {*} ignore
	 * @param {*} parent
	 */
	run(tableName: string, entity: any, ignore: any, parent: any): Promise<any> {
		let _that = this
		let ds = this.db[tableName]
		let state = entity.state
		let back = this.prepareOne(tableName, entity, ignore, null)
		entity.state = undefined
		if (EntityState.New === state) {
			return ds.put(back).then(function (newDoc: any) {
				if (newDoc && newDoc.ok === true) {
					console.log('insert:' + newDoc.id)
					entity._id = newDoc.id
					entity._rev = newDoc.rev
					if (parent && TypeUtil.isArray(parent)) {
						parent.push(entity)
					}

					return entity
				} else {
					console.error(newDoc)
				}
			}).catch(function (err: any) {
				console.log(err)
			})
		} else if (EntityState.Deleted === state) {
			return ds.put(back).then(function (result: any) {
				if (result && result.ok === true) {
					entity._rev = result.rev
					console.log('remove:' + entity._id)
					_that.splice(entity, parent)

					return entity
				} else {
					console.error(result)
				}
			}).catch(function (err: any) {
				console.log(err)
			})
		} else if (!state || EntityState.Modified === state) {
			return ds.put(back).then(function (doc: any) {
				if (doc && doc.ok === true) {
					entity._rev = doc.rev
					console.log('update:' + entity._id)

					return entity
				} else {
					console.error(doc)
				}
			}).catch(function (err: any) {
				console.log(err)
				console.log(entity)
			})
		}
	}
	/**
	 * 执行查询语句
	 * @param {*} tableName
	 * @param {*} condition
	 * @param {*} sort
	 * @param {*} fields
	 * @param {*} from
	 * @param {*} limit
	 */
	find(tableName: string, condition: any, sort: any, fields: string[], from: number, limit: number): Promise<any> {
		let ds = this.db[tableName]
		if (!sort) {
			sort = ['_id']
		}
		let options: any = {
			selector: condition,
			sort: sort
		}
		if (fields) {
			options.fields = fields
		}
		if (from >= 0) {
			options.skip = from
		}
		if (limit > 0) {
			options.limit = limit
		}
		return ds.find(options).then(function (result: any) {
			let data = null
			if (result && result.docs) {
				data = result.docs
			}
			return data
		}).catch(function (err: any) {
			console.log(err)
		})
	}

	/**
	 * 查询单条记录
	 * @param {*} tableName
	 * @param {*} condition
	 * @param {*} sort
	 * @param {*} fields
	 */
	findOne(tableName: string, condition: any, sort: any, fields: string[]): Promise<any> {
		return this.find(tableName, condition, sort, fields, 0, 0).then(function (result: any) {
			if (result) {
				if (TypeUtil.isArray(result)) {
					if (result.length > 0) {
						return result[0]
					}
				} else {
					return result
				}
			}
			return null
		}).catch(function (err: any) {
			console.log(err)
		})
	}

	/**
	 * 查询分页记录
	 * @param {*} tableName
	 * @param {*} condition
	 * @param {*} sort
	 * @param {*} fields
	 * @param {*} from
	 * @param {*} limit
	 */
	findPage(tableName: string, condition: any, sort: any, fields: string[], from: number, limit: number): Promise<any> {
		return this.find(tableName, condition, sort, fields, from, limit).then(function (result: any) {
		  	let page: any = {}
		  	if (result && result.length > 0) {
				page.total = result.length
		  	}
		  	page.result = result
		  	page.from = from
		  	page.limit = limit
	
		  	return page
		}).catch(function (err: any) {
		  	console.log(err)
		})
	}

	/**
	 * 插入一条记录
	 * @param {*} tableName
	 * @param {*} entity
	 */
	insert(tableName: string, entity: any): Promise<any> {
		entity.state = EntityState.New

		return this.run(tableName, entity, null, null)
	}

	/**
	 * 删除记录
	 * @param {*} tableName
	 * @param {*} entity
	 */
	delete(tableName: string, entity: any): Promise<any> {
		entity.state = EntityState.Deleted
		let ds = this.db[tableName]
		return ds.remove(entity).then(function (result: any) {
			if (result && result.ok === true) {
				entity._rev = result.rev
				console.log('remove:' + entity._id)

				return entity
			} else {
				console.error(result)
			}
		}).catch(function (err: any) {
			console.log(err)
		})
		//return this.run(tableName, entity, null, null)
	}
	/**
	 * 更新记录
	 * @param {*} tableName
	 * @param {*} entity
	 * @param {*} condition
	 */
	update(tableName: string, entity: any, condition: any): Promise<any> {
		entity.state = EntityState.Modified

		return this.run(tableName, entity, null, null)
	}
	/**
	 * 在一个事务里面执行多个操作（insert,update,delete)
	 * operators是一个operator对象的数组，operator有2个属性（tableName，entity）
	 * @param {*} operators
	 */
	async transaction(operators: any): Promise<any> {
		let result = []
		for (let operator of operators) {
			let tableName = operator.tableName
			let entity = operators.entity
			await this.run(tableName, entity, null, null)
			result.push(entity)
		}

		return result
	}

	tokenizer(text: string) {
		if (!text) return []
		const { Segment, useDefault } = require('segmentit')
		const segmenter = useDefault(new Segment())
		let tokens = segmenter.doSegment(text, {
			simple: true,
			stripPunctuation: true,
			convertSynonym: true,
			stripStopword: true
		})
		if (Array.isArray(tokens)) {
			return tokens.map(function (t) { return t.toLowerCase() })
		}
	}

	trimmer(token: string) {
		/**
			**check it contains Chinese (including Japanese and Korean)
		*/
		function isChineseChar(str: string) {
			var reg = /[\u4E00-\u9FA5\uF900-\uFA2D]/
			return reg.test(str)
		}
		//by ming300 check token is chinese then not replace   
		if (isChineseChar(token)) {
			return token
		}
		return token
			.replace(/^\W+/, '')
			.replace(/\W+$/, '')
	}
	/**
	 *  全文检索功能，使用pouchdb-quick-search
	 * @param {*} tableName
	 * @param {*} condition {
				query: 'kong',
				fields: ['title', 'text'],
				include_docs: true
			}
	 */
	search(tableName: string, condition: any) {
		let ds = this.db[tableName]

		return ds.search(condition)
	}

	buildIndex(tableName: string, fields: string[]) {
		let condition = { fields: fields, build: true }

		return this.search(tableName, condition)
	}

	destroyIndex(tableName: string, fields: string[]) {
		let condition = { fields: fields, destroy: true }

		return this.search(tableName, condition)
	}

	searchPhase(tableName: string, phase: string, fields: string[], options: any, filter: any, from: number, limit: number) {
		let condition: any = { query: phase, fields: fields }
		if (!options) {
			options = {
				include_docs: true,
				highlighting: true,
				mm: '100%'
			}
		}
		if (options.include_docs) {
			condition.include_docs = options.include_docs
		} else {
			condition.include_docs = true
		}
		if (options.highlighting) {
			condition.highlighting = options.highlighting
		} else {
			condition.highlighting = true
		}
		if (options.mm) {
			condition.mm = options.mm
		} else {
			condition.mm = '100%'
		}
		if (options.highlighting_pre) {
			condition.highlighting_pre = options.highlighting_pre
		}
		if (options.highlighting_post) {
			condition.highlighting_post = options.highlighting_post
		}
		if (from) {
			condition.skip = from
		}/* else {
			condition.skip = 0
		}*/
		if (limit) {
			condition.limit = limit
		}/* else {
			condition.limit = 10
		}*/
		if (filter) {
			condition.filter = filter
		}

		return this.search(tableName, condition)
	}

	async test() {
		await this.create('test_table', [], ['data'])
		let entity = await this.insert('test_table', { data: 'the package manager for JavaScript. Contribute to npm/cli development by creating an account on GitHub', data_num: 1234561 })
		await this.insert('test_table', { data: '它可以直接在浏览器上运行，不依赖24服务端来完成对网页上纯文本的搜索功能', data_num: 1234562 })
		//this.buildIndex('test_table', ['data'])
		let results = await this.searchPhase('test_table', 'manager', ['data'], null, null, 0, 0)
		console.info(results)
		results = await this.searchPhase('test_table', '服务端', ['data'], null, null, 0, 0)
		console.info(results)
	}
}
export let pounchDb = new PounchDb()