export class ExecuteResult {
	public static Fail = 'Fail'
	public static Success = 'Success'
	public status: string
	public msg: string
	constructor(status: string, msg: string) {
		this.status = status
		this.msg = msg
	}

	public isFail() {
		return this.status === ExecuteResult.Fail
	}

	public static create(status: string, msg: string) {
		return new ExecuteResult(status, msg)
	}
}