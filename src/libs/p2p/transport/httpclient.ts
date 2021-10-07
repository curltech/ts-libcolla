import axios from 'axios'
import * as cookie from 'tiny-cookie'
import {config} from '../conf/conf'
import {TypeUtil} from '../../util/util'

export class HttpClient {
    private _client: any
    private address: string

    constructor(address: string) {
        this._client = axios.create()
        if (address && address.startsWith('http')) {
            this._client.defaults.baseURL = address
            this.address = address
        }
        this._client.defaults.timeout = 1800000
        //this._client.defaults.withCredentials = true

        // request interceptor
        this._client.interceptors.request.use(config => {
            let token = cookie.get('token')
            if (token) {
                // 让每个请求携带token-- ['X-Token']为自定义key 请根据实际情况自行修改
                config.headers['Authorization'] = 'Bearer ' + token
            }
            return config
        }, error => {
            Promise.reject(error)
        })

        // respone interceptor
        this._client.interceptors.response.use(
            response => {
                if (response.status !== 200) {
                    console.error('response.status:' + response.status)
                    return Promise.reject('error');
                } else {
                    return response;
                }
            },
            error => {
                if (error.response && error.response.status === 401) {
                    console.error('error response:' + error.response)
                } else if (error.response && error.response.status === 500) {
                } else if (error.message.indexOf("timeout") > -1) {
                } else if (error == "403") {

                } else {
                }
                return Promise.reject(error)
            })
    }

    send(url: string, data: any) {
        return this._client.post(url, data)
    }

    get(url: string) {
        return this._client.get(url)
    }
}

export class HttpClientPool {
    private httpClients = new Map<string, HttpClient>()
    private _httpClient: HttpClient = null

    constructor() {
        let connectAddress = config.appParams.connectAddress
        if (connectAddress && TypeUtil.isArray(connectAddress)) {
            for (let address of connectAddress) {
                if (address.startsWith('http')) {
                    let httpClient = new HttpClient(address)
                    this.httpClients.set(address, httpClient)
                    if (this._httpClient === null) {
                        this._httpClient = httpClient
                    }
                }
            }
        }
    }

    get(address: string): HttpClient {
        if (this.httpClients.has(address)) {
            return this.httpClients.get(address)
        } else {
            let httpClient = new HttpClient(address)
            this.httpClients.set(address, httpClient)

            return httpClient
        }
    }

    get httpClient(): HttpClient {
        return this._httpClient
    }

    setHttpClient(address: string) {
        let httpClient = null
        if (this.httpClients.has(address)) {
            httpClient = this.httpClients.get(address)
        } else {
            httpClient = new HttpClient(address)
            this.httpClients.set(address, httpClient)
        }

        this._httpClient = httpClient
    }
}

export let httpClientPool = new HttpClientPool()
