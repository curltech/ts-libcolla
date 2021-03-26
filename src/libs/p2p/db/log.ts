import { BaseService, BaseEntity } from './base'
import { myself } from '../dht/myselfpeer'

export class Log extends BaseEntity {
	public peerId!: string
	public level!: string
	public code!: string
	public description!: string
	public createTimestamp!: number
}

export class LogService extends BaseService {
	private logLevel: string = 'none'
	public static logLevels = ['log', 'warn', 'error', 'none']

	setLogLevel(logLevel: string) {
		this.logLevel = logLevel
	}
    async log(description: string, code: string = '', level: string = 'error') {
		if (level === 'error') {
			console.error(code + ':' + description)
		} else if (level === 'warn') {
			console.warn(code + ':' + description)
		} else {
			level = 'log'
			console.log(code + ':' + description)
		}
		if (LogService.logLevels.indexOf(level) >= LogService.logLevels.indexOf(this.logLevel)) {
			let log = new Log()
			log.description = description
			log.code = code
			log.level = level
			log.peerId = myself.myselfPeer.peerId
			log.createTimestamp = new Date().getTime()
			log = await this.insert(log)
		}
	}
	async clean() {
		let condition = { peerId: myself.myselfPeer.peerId }
		let logs = await this.find(condition, null, null, null, null)
		if (logs && logs.length > 0) {
			await this.delete(logs)
		}
	}
	async search(phase: string, level: string, searchTimestamp: number): Promise<any> {
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
		let logResults = await this.searchPhase(phase, ['code', 'description'], options, null, 0, 0)
		console.info(logResults)
		if (logResults && logResults.rows && logResults.rows.length > 0) {
			for (let logResult of logResults.rows) {
				let log = logResult.doc
				let createTimestampStart: number
				let createTimestampEnd: number
				if (searchTimestamp) {
					createTimestampStart = searchTimestamp
					createTimestampEnd = searchTimestamp + 24 * 60 * 60 * 1000
				}
				if (log.peerId === myself.myselfPeer.peerId
				  && (!level || log.level === level)
				  && (!searchTimestamp || (log.createTimestamp >= createTimestampStart && log.createTimestamp < createTimestampEnd))) {
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
export let logService = new LogService("blc_log", ['peerId', 'level', 'createTimestamp'], ['code', 'description'])