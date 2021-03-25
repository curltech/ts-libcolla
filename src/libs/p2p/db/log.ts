import { BaseService, BaseEntity } from './base'
import { myself } from '../dht/myselfpeer'

export class Log extends BaseEntity {
	public peerId!: string
	public level!: string
	public code!: string
	public description!: string
}

export class LogService extends BaseService {
    async log(description: string, code: string = '', level: string = 'error'): Promise<Log> {
		let log = new Log()
		log.description = description
		log.code = code
		log.level = level
		log.peerId = myself.myselfPeer.peerId
		log.createDate = new Date()
		log = await this.insert(log)
		if (level === 'error') {
			console.error(code + ':' + description)
		} else if (level === 'warn') {
			console.warn(code + ':' + description)
		} else {
			console.log(code + ':' + description)
		}

		return log
	}
	async clean() {
		let condition = { peerId: myself.myselfPeer.peerId }
		let logs = await this.find(condition, null, null, null, null)
		if (logs && logs.length > 0) {
			await this.delete(logs)
		}
	}
	search(phase: string, level: string, searchDate: number): any[] {
		let logResultList = []

		let options = {
			highlighting_pre: '<font color="' + myself.myselfPeerClient.primaryColor + '">',
			highlighting_post: '</font>'
		}
		/*if (!filter) {
			filter = function (doc) {
				return doc.peerId === myself.myselfPeer.peerId
			}
		}*/
		let logResults = this.searchPhase(phase, ['code', 'description'], options, null, 0, 0)
		console.info(logResults)
		if (logResults && logResults.rows && logResults.rows.length > 0) {
			for (let logResult of logResults.rows) {
				let log = logResult.doc
				let createDateStart: number
				let createDateEnd: number
				if (searchDate) {
					createDateStart = searchDate
					createDateEnd = searchDate + 24 * 60 * 60 * 1000
				}
				if (log.peerId === myself.myselfPeer.peerId
				  && (!level || log.level === level)
				  && (!searchDate || (log.createDate >= createDateStart && log.createDate < createDateEnd))) {
					if (logResult.highlighting.code) {
						log.highlighting = logResult.highlighting.code
					} else if (logResult.highlighting.description) {
						log.highlighting = logResult.highlighting.description
					}
					logResultList.push(log)
				}
			}
		}

		return logResultList
	}
}
export let logService = new LogService("blc_log", ['peerId', 'level', 'createDate'], ['code', 'description'])