import LibPhoneNumber from 'google-libphonenumber';

export class TypeUtil {
	static isString(obj: any): boolean {
		return (typeof obj === 'string') && obj.constructor === String
	}
	static isArray(obj: any): boolean {
		return (typeof obj === 'object') && obj.constructor === Array
	}
	static isNumber(obj: any): boolean {
		return (typeof obj === 'number') && obj.constructor === Number
	}
	static isDate(obj: any): boolean {
		return (typeof obj === 'object') && obj.constructor === Date
	}
	static isFunction(obj: any): boolean {
		return (typeof obj === 'function')// && obj.constructor === Function;
	}
	static isObject(obj: any): boolean {
		return (typeof obj === 'object') && obj.constructor === Object
	}
}

const base32 = require('base32.js')

export class CodeUtil {
	static encodeBase32(buf: Uint8Array): string {
		let options = { type: "crockford", lc: true }
		let encoder = new base32.Encoder()
		let str = encoder.write(buf).finalize()

		return str
	}

	static decodeBase32(str: string): Uint8Array {
		let options = { type: "crockford" }
		let decoder = new base32.Decoder()
		let out = decoder.write(str).finalize()

		return Uint8Array.from(out)
	}
}

export class ObjectUtil {
	static copy(src: any, target: any) {
		for (let key in src) {
			let value = src[key]
			target[key] = value
		}
	}
	static merge(target, src, override) {
		if (src && target) {
			for (var key in src) {
				if (src.hasOwnProperty(key)) {
					if (!target.hasOwnProperty(key)) {
						target[key] = src[key]
					} else {
						if (override === true) {
						target[key] = src[key]
						}
					}
				}
			}
		} else {
		//console.warn('merged object is null!')
		}
	}
}

export class UUID {
	/*
		指定长度和基数
		*/
	static string(len, radix): string {
		let chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'.split('');
		let uuid = []
		let i
		radix = radix || chars.length

		if (len) {
			// Compact form
			for (i = 0; i < len; i++) uuid[i] = chars[0 | Math.random() * radix];
		} else {
			// rfc4122, version 4 form
			let r
			// rfc4122 requires these characters
			uuid[8] = uuid[13] = uuid[18] = uuid[23] = '-'
			uuid[14] = '4'

			// Fill in random data.  At i==19 set the high bits of clock sequence as
			// per rfc4122, sec. 4.1.5
			for (i = 0; i < 36; i++) {
				if (!uuid[i]) {
					r = 0 | Math.random() * 16
					uuid[i] = chars[(i === 19) ? (r & 0x3) | 0x8 : r]
				}
			}
		}

		return uuid.join('')
	}
}

export class BlobUtil {
	static blobToUrl(blob) {
		return blob ? window.URL.createObjectURL(blob) : null
	}
	static urlToBlob(url) {
		return new Promise((resolve, reject) => {
			var xhr = new XMLHttpRequest()
			xhr.open('get', url, true)
			xhr.responseType = 'blob'
			xhr.onload = function () {
				if (this.status === 200) {
					resolve(this.response)
				} else {
					reject(this.status)
				}
			}
			xhr.send()
		})
	}
	static blobToBase64(blob, opt = { type: 'data' }) {
		let reader = new FileReader()
		return new Promise((resolve, reject) => {
			reader.onloadend = function () {
				resolve(reader.result)
			}
			reader.onerror = function () {
				reject()
			}
			if (opt.type === 'array') {
				reader.readAsArrayBuffer(blob)
			} else if (opt.type === 'bin') {
				reader.readAsBinaryString(blob)
			} else if (opt.type === 'data') {
				reader.readAsDataURL(blob)
			} else if (opt.type === 'text') {
				reader.readAsText(blob)
			}
		})
	}
	// 格式转换 base64->blob 防止base64 too large
	static base64ToBlob(dataurl) {
		let arr = dataurl.split(';base64,')
		let mimes = arr[0].split(':')
		let mime = mimes[1].split(';')[0]
		let bstr = atob(arr[1])
		let n = bstr.length
		let u8arr = new Uint8Array(n)
		while (n--) {
			u8arr[n] = bstr.charCodeAt(n)
		}
		return new Blob([u8arr], { type: mime })
	}
	static fileObjectToBase64(file) {
		return new Promise((resolve, reject) => {
			let reader = new window.FileReader();
			reader.readAsDataURL(file);
			reader.onload = function (event) {
				let fileData = event.target.result;
				resolve(fileData)
			}
			reader.onerror = function () {
				reject(new Error('Could not load file'));
			};
		})
	}
	static base64ToFile(dataurl, filename) {
		let arr = dataurl.split(';base64,')
		let mimes = arr[0].split(':')
		let mime = mimes[1].split(';')[0]
		let bstr = atob(arr[1])
		let n = bstr.length
		let u8arr = new Uint8Array(n)
		while (n--) {
			u8arr[n] = bstr.charCodeAt(n)
		}
		return new File([u8arr], filename, { type: mime })
	}
}

export class StringUtil {
	static ltrim(str) {
		return str.replace(/(^\s*)/g, "");
	}
	static rtrim(str) {
		return str.replace(/(\s*$)/g, "");
	}
	static trim(str) {
		return str.replace(/(^\s*)|(\s*$)/g, "");
	}
	static left(str, len) {
		if (isNaN(len) || len == null) {
			len = str.length;
		} else {
			if (parseInt(len) < 0 || parseInt(len) > str.length) {
				len = str.length;
			}
		}

		return str.substr(0, len);
	}
	static right(str, len) {
		if (isNaN(len) || len == null) {
			len = str.length;
		} else {
			if (parseInt(len) < 0 || parseInt(len) > str.length) {
			len = str.length;
			}
		}

		return str.substring(str.length - len, str.length);
	}
	static mid(str, start, len) {
		return str.substr(start, len);
	}
	static inStr(src, str) {
		if (str == null) {
			str = "";
		}

		return src.indexOf(str);
	}
	static inStrRev(src, str) {
		if (str == null) {
			str = "";
		}

		return src.lastIndexOf(str);
	}
	static lengthW(str) {
		return str.replace(/[^\x00-\xff]/g, "**").length;
	}
	static substrBefore(src, str) {
		var pos = src.indexOf(str)

		return src.substring(0, pos)
	}
	static substrAfter(src, str) {
		var pos = src.indexOf(str)

		return src.substring(pos + str.length)
	}
	static substrBetween(src, str1, str2) {
		var pos1 = src.indexOf(str1)
		var pos2 = src.indexOf(str2)

		return src.substring(pos1 + 1, pos2)
	}
	static substrBeforeLast(src, str) {
		var pos = src.lastIndexOf(str)

		return src.substring(0, pos)
	}
	static substrAfterLast(src, str) {
		var pos = src.lastIndexOf(str)

		return src.substring(pos + str.length)
	}
	static uint8ArrayToString(fileData) {
		var dataString = ""
		for (var i = 0; i < fileData.length; i++) {
			dataString += String.fromCharCode(fileData[i])
		}

		return dataString
	}
	static stringToUint8Array(str) {
		var arr = []
		for (var i = 0, j = str.length; i < j; ++i) {
			arr.push(str.charCodeAt(i))
		}

		var tmpUint8Array = new Uint8Array(arr)
		return tmpUint8Array
	}
	static stringToArrayBuffer(str) {
		var buf = new ArrayBuffer(str.length * 2) // 每个字符占用2个字节
		var bufView = new Uint16Array(buf)
		for (var i = 0, strLen = str.length; i < strLen; i++) {
			bufView[i] = str.charCodeAt(i)
		}
		return buf
	}
	static arrayBufferToString(buf) {
		//return String.fromCharCode.apply(null, new Uint8Array(buf));
		// 解决过长（大）数据时报错的问题RangeError: too many arguments provided for a function call
		let array = new Uint8Array(buf)
		let ret = ''
		let chunk = 8 * 1024
		let i
		for (i = 0; i < array.length / chunk; i++) {
			ret += String.fromCharCode.apply(null, array.slice(i * chunk, (i + 1) * chunk))
		}
		ret += String.fromCharCode.apply(null, array.slice(i * chunk))
		return ret
	}
	static encodeURI(str) {
		return unescape(encodeURIComponent(str))
	}
	static decodeURI(str) {
		return decodeURIComponent(escape(str))
	}
}

const PhoneNumberFormat = LibPhoneNumber.PhoneNumberFormat;
const PhoneNumberType = LibPhoneNumber.PhoneNumberType;
const PhoneNumberUtil = LibPhoneNumber.PhoneNumberUtil.getInstance();
const MIN_SIZE = 3; // phone number length < 3 will have PhoneNumberUtil.parse() occur error
//const UNKNOWN_REGION_ = LibPhoneNumber.PhoneNumberUtil.UNKNOWN_REGION_; // "ZZ"

export class MobileNumberUtil {
	static isPhoneNumberValid = (phoneNumber, country) => {
		if (phoneNumber.length < MIN_SIZE) {
			return false;
		}

		// PhoneNumberUtil.parse() returns an i18n.phonenumbers.PhoneNumber object
		const phoneObject = PhoneNumberUtil.parse(phoneNumber, country);

		const type =  PhoneNumberUtil.getNumberType(phoneObject);

		return type === PhoneNumberType.MOBILE || type === PhoneNumberType.FIXED_LINE_OR_MOBILE;
	};

	static formatE164 = (phoneNumber, country) =>
		PhoneNumberUtil.format(PhoneNumberUtil.parse(phoneNumber, country), PhoneNumberFormat.E164);

	static formatInternational = (phoneNumber, country) =>
		PhoneNumberUtil.format(PhoneNumberUtil.parse(phoneNumber, country), PhoneNumberFormat.INTERNATIONAL);

	static formatNational = (phoneNumber, country) =>
		PhoneNumberUtil.format(PhoneNumberUtil.parse(phoneNumber, country), PhoneNumberFormat.NATIONAL);

	static formatRFC3966 = (phoneNumber, country) =>
		PhoneNumberUtil.format(PhoneNumberUtil.parse(phoneNumber, country), PhoneNumberFormat.RFC3966);

	static parse = (phoneNumber) =>
		PhoneNumberUtil.parse(phoneNumber, 'ZZ');

	static getRegionCodeForCountryCode = (countryCode) =>
		PhoneNumberUtil.getRegionCodeForCountryCode(countryCode)
	
	static getCountryCodeForRegion = (regionCode) =>
		PhoneNumberUtil.getCountryCodeForRegion(regionCode)
}

export class CollaUtil {
	static merge(target, src, override) {
		if (src && target) {
		for (var key in src) {
			if (src.hasOwnProperty(key)) {
			if (!target.hasOwnProperty(key)) {
				target[key] = src[key]
			} else {
				if (override === true) {
				target[key] = src[key]
				}
			}
			}
		}
		} else {
		//console.warn('merged object is null!')
		}
	}
	/**
	 * @desc 浅拷贝，支持常见类型
	 * @param {Any} values
	 */
	static clone(values) {
		let copy
		// Handle the 3 simple types, and null or undefined
		if (null === values || "object" !== typeof values) return values
		// Handle Date
		if (values instanceof Date) {
		copy = new Date()
		copy.setTime(values.getTime())
		return copy
		}
		// Handle Array
		if (values instanceof Array) {
		copy = []
		for (var i = 0, len = values.length; i < len; i++) {
			copy[i] = values[i]
		}
		return copy
		}
		// Handle Object
		if (values instanceof Object) {
		copy = {}
		for (var attr in values) {
			if (values.hasOwnProperty(attr)) copy[attr] = values[attr]
		}
		return copy
		}
		throw new Error("Unable to copy values! Its type isn't supported.");
	}
	/**
	 * @desc 深拷贝，支持常见类型
	 * @param {Any} values
	 */
	static deepClone(values) {
		let copy;
		// Handle the 3 simple types, and null or undefined
		if (null == values || "object" != typeof values) return values;
		// Handle Date
		if (values instanceof Date) {
		copy = new Date();
		copy.setTime(values.getTime());
		return copy;
		}
		// Handle Array
		if (values instanceof Array) {
		copy = [];
		for (var i = 0, len = values.length; i < len; i++) {
			copy[i] = this.deepClone(values[i]);
		}
		return copy;
		}
		// Handle Object
		if (values instanceof Object) {
		copy = {};
		for (var attr in values) {
			if (values.hasOwnProperty(attr)) copy[attr] = this.deepClone(values[attr]);
		}
		return copy;
		}
		throw new Error("Unable to copy values! Its type isn't supported.");
	}
	static formatSpaceSize(bytes) {
		let kiloBytes = bytes / 1024
		let megaBytes = bytes / (1024 * 1024)
		let gigaBytes = bytes / (1024 * 1024 * 1024)
		if (parseInt(gigaBytes.toString())) {
		return Math.round(gigaBytes * 10) / 10 + ' GB'
		} else if (parseInt(megaBytes.toString())) {
		return Math.round(megaBytes * 10) / 10 + ' MB'
		} else if (parseInt(kiloBytes.toString())) {
		return Math.round(kiloBytes * 10) / 10 + ' KB'
		} else {
		return bytes + ' B'
		}
	}
	//数组对象方法排序:
	static sortByKey(array, key, type) {
		return array.sort(function (a, b) {
		let x = a[key];
		let y = b[key];
		if (type === 'asc') {
			return ((x < y) ? -1 : ((x > y) ? 1 : 0));
		} else if (type === 'desc') {
			return ((y < x) ? -1 : ((y > x) ? 1 : 0));
		}

		});
	}
	// 时分秒补零
	static padZero(str) {
		return new RegExp(/^\d$/g).test(str) ? `0${str}` : str;
	}
	// 格式化秒为时分秒
	static formatSeconds(_seconds) {
		_seconds = parseInt(_seconds);
		let hours, mins, seconds;
		let result = '';
		seconds = parseInt((_seconds % 60).toString());
		mins = parseInt((_seconds % 3600 / 60).toString());
		hours = parseInt((_seconds / 3600).toString());
		if (hours) {
		result = `${this.padZero(hours)}:${this.padZero(mins)}:${this.padZero(seconds)}`;
		} else {
		result = `${this.padZero(mins)}:${this.padZero(seconds)}`;
		}
		return result;
	}
	static lengthWithChinese(_str) {
		_str = (_str || '').replace(/^(\s|\u00A0)+|(\s|\u00A0)+$/g, ''); //去除字符串的左右两边空格，+表示匹配一次或多次，|表示或者，\s和\u00A0匹配空白字符，/^以……开头，$以……结尾，/g全局匹配,/i忽略大小写
		let strlength = _str.length;
		if (!strlength) { //如果字符串长度为零，返回零
		return 0;
		}
		let chinese = _str.match(/[\u4e00-\u9fa5]/g); //匹配中文，match返回包含中文的数组
		return strlength + (chinese ? chinese.length : 0); //计算字符个数
	}
	static htmlDecode(text) {
		let temp = document.createElement("div"); 
		temp.innerHTML = text; 
		let output = temp.innerText || temp.textContent; 
		temp = null; 
		return output; 
	}
	static timerInterval(dom, Interval = 1000, format = null) {
		if (!dom) {
			return
		}
		let hour = 0,
		minutes = 0,
		seconds = 0;
		return setInterval(function () {
			seconds += 1;
			if (seconds >= 60) {
				seconds = 0;
				minutes = minutes + 1;
			}
			if (minutes >= 60) {
				minutes = 0;
				hour = hour + 1;
			}
			if (!format) {
				dom.innerHTML = (minutes < 10 ? '0' + minutes : minutes) + ':' + (seconds < 10 ? '0' + seconds : seconds);
			}
		}, Interval)
	}
	static getFrom(entity: any): number {
		let from = 0
		if (entity) {
			if (TypeUtil.isArray(entity)) {
				if (entity.length > 0) {
					from = entity[entity.length - 1]._id
				}
			} else {
				from = entity._id
			}
		}
		return from
	}
}