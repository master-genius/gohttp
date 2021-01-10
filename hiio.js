'use strict';

const http2 = require('http2');
const crypto = require('crypto');
const fs = require('fs');
const urlparse = require('url');
const qs = require('querystring');
const bodymaker = require('./bodymaker');

function parseUrl (url) {

  let urlobj = new urlparse.URL(url);

  let headers = {
    ':method' : 'GET',
    ':path': urlobj.pathname+urlobj.search,
  }

  return {
    url : urlobj,
    headers:headers
  }

}

async function payload (reqobj, mkbody) {
  let needbody = false
  if (reqobj.method[0] === 'P') {
    needbody = true
  } else if (reqobj.method[0] === 'D' && reqobj.body) {
    needbody = true
  }

  if (!needbody) {
    return true
  }

  if (reqobj.body === undefined) {
    throw new Error(`${reqobj.method} must with body data`)
  }

  //直接转发请求过来的数据。
  if (reqobj.body instanceof Buffer) {
    return 'ok'
  }

  let formbody = {
    length: 0,
    data : '',
  }

  let bodytype = typeof reqobj.body

  if (bodytype === 'string' && reqobj.headers['content-type'] === undefined) {
    reqobj.headers['content-type'] = 'text/plain'
  }

  if (bodytype === 'object' && reqobj.headers['content-type'] === undefined) {
    reqobj.headers['content-type'] = 'application/x-www-form-urlencoded'
  }

  if (bodytype === 'string') {
    formbody.length = Buffer.byteLength(reqobj.body)
    formbody.data = reqobj.body
    reqobj.headers['content-length'] = formbody.length

  } else if (reqobj.multipart && bodytype === 'object') {

    let tmpbody = await mkbody.makeUploadData(reqobj.body)
    
    reqobj.headers['content-type'] = tmpbody['content-type']
    reqobj.headers['content-length'] = tmpbody['content-length']
    formbody.data = tmpbody.body

  } else if (bodytype === 'object') {
    if (reqobj.postform) {
      reqobj.headers['content-type'] = 'application/x-www-form-urlencoded'
    }
    if (reqobj.headers['content-type'] === 'application/x-www-form-urlencoded') {
      formbody.data = Buffer.from(qs.stringify(reqobj.body))
    } else {
      formbody.data = Buffer.from(JSON.stringify(reqobj.body))
    }
    formbody.length = formbody.data.length
    reqobj.headers['content-length'] = formbody.length
  }

  return formbody

}

/**
 * release self when session closed
 */

let _methodList = [
  'GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH', 'HEAD', 'TRACE'
]

class _response {

  constructor () {
    this.headers = null
    this.status = 0
    this.data = null
    this.timeout = null
    this.error = null
    this.ok = null
    this.buffers = []
    this.totalLength = 0
    this.contentLength = 0
  }

  text () {
    if (this.data !== null) {
      return this.data.toString()
    }
    return 'null'
  }

  json () {
    return JSON.parse(this.data.text())
  }

  blob () {
    return this.data
  }

}

async function _download (stream, reqobj, ret, payload) {

  if (!reqobj.dir) {
    reqobj.dir = './'
  } else if (reqobj.dir.length > 0 && reqobj.dir[ reqobj.dir.length - 1 ] !== '/') {
    reqobj.dir += '/'
  }

  let onResponse = (headers, flags) => {
    let filename = ''
    if(headers['content-disposition']) {
      let name_split = headers['content-disposition']
                        .split(';')
                        .filter(p => p.length > 0)

      for(let i=0; i < name_split.length; i++) {
        
        if (name_split[i].indexOf('filename*=') >= 0) {
          
          filename = name_split[i].trim().substring(10)
          filename = filename.split('\'')[2]
          filename = decodeURIComponent(filename)

        } else if(name_split[i].indexOf('filename=') >= 0) {
          filename = name_split[i].trim().substring(9)
        }
      }

    }

    if (headers['content-length']) {
      ret.contentLength = parseInt(headers['content-length'])
    }

    if (!filename) {
      let h = crypto.createHash('sha1')
      h.update(`${Date.now()}${Math.random()}`)
      filename = h.digest('hex')
    }

    let target = reqobj.target || `${reqobj.dir}${filename}`

    try {
      reqobj.writeStream = fs.createWriteStream(target, {encoding: 'binary'})
    } catch (err) {
      stream.emit('error', err)
    }

  }

  return new Promise((rv, rj) => {

    stream.on('response', onResponse)
    
    stream.on('timeout', () => {
      ret.ok = false
      ret.timeout = true
      stream.close()
      rv(ret)
    })

    stream.on('data', chunk => {
      ret.totalLength += chunk.length
      reqobj.writeStream.write(chunk)
      if (reqobj.callback && typeof reqobj.callback === 'function') {
        reqobj.callback(ret)
      }
    })

    stream.on('end', () => {
      rv(ret)
    })

    stream.on('error', err => {
      stream.close(http2.constants.NGHTTP2_INTERNAL_ERROR)
      rj(err)
    })

    stream.on('frameError', err => {
      stream.close()
      rj(err || new Error('frame error'))
    })

    if (payload === 'ok') {
      stream.end(reqobj.body)
    } else if (typeof payload === 'object') {
      stream.end(payload.data)
    } else {
      stream.end()
    }

  })
  .then(r => {
    return r
  })
  .catch (err => {
    r.error = err
    return r
  })
  .finally(() => {
    if (reqobj.writeStream) {
      reqobj.writeStream.end()
    }
  })
  
}

class _Request {

  constructor (options) {
    this.session = options.session
    this.host = options.host
    this.bodymaker = options.bodymaker
    this.parent = options.parent
    this.pending = options.pending
    this.debug = options.debug
    this.keepalive = options.keepalive
    this.init()
  }

  init() {
    this.session.on('close', () => {
      if (this.keepalive && typeof this.reconn === 'function') {
        this.reconn()
      } else {
        this.free()
      }
    })

    this.session.on('error', err => {
      if (this.debug) {
        console.error(err)
      }
      this.session.destroy()
    })
  }

  on (evt, callback) {
    return this.session.on(evt, callback)
  }

  free () {
    this.parent._freeRequest(this)
  }

  /**
   * {
   *    method : 'GET',
   *    path : '/',
   *    body : BODY,
   *    data : DATA,
   *    query : {},
   *    files : FILES,
   *    headers : {},
   *    options : {}
   * }
   * @param {object} reqobj
   */

  checkAndSetOptions (reqobj) {
    if (reqobj.headers === undefined || typeof reqobj.headers !== 'object') {
      reqobj.headers = {}
    }

    if (reqobj.method === undefined || _methodList.indexOf(reqobj.method) < 0) {
      reqobj.method = 'GET'
    }

    if (reqobj.path === undefined || reqobj.path === '') {
      reqobj.path = '/'
    }

    /* if (reqobj.path[0] !== '/') {
      reqobj.path = `/${reqobj.path}`
    } */

    if (reqobj.timeout === undefined) {
      reqobj.timeout = 15000
    }

    reqobj.headers[':path'] = reqobj.path
    reqobj.headers[':method'] = reqobj.method
  }

  async request (reqobj, events = {}) {

    this.checkAndSetOptions(reqobj)
    
    let rb = await payload(reqobj, this.bodymaker)

    let stm = this.session.request(reqobj.headers, reqobj.options || {})

    let ret = new _response()

    if (reqobj.selfHandle) {
      return {
        payload : rb,
        stream : stm,
        ret : ret
      }
    }

    if (events.response && typeof events.response === 'function') {
      stm.on('response', events.response)
    } else {
      stm.on('response', (headers, flags) => {
        ret.headers = headers
        ret.status = parseInt(headers[':status'] || 0)
        if (ret.status > 0 && ret.status < 400) {
          ret.ok = true
        } else {
          ret.ok = false
        }
      })
    }

    return new Promise((rv, rj) => {
      
      stm.on('timeout', () => {
        ret.ok = false
        ret.timeout = true
        stm.close()
        rv(ret)
      })

      if (events.data && typeof events.data === 'function') {
        stm.on('data', events.data)
      } else {
        stm.on('data', chunk => {
          ret.buffers.push(chunk)
          ret.totalLength += chunk.length
        })
      }

      stm.on('end', () => {
        if (ret.buffers && ret.buffers.length > 0) {
          ret.data = Buffer.concat(ret.buffers, ret.totalLength)
          ret.buffers = null
        }
        rv(ret)
      })

      stm.on('error', err => {
        stm.close(http2.constants.NGHTTP2_INTERNAL_ERROR)
        rj(err)
      })

      stm.on('frameError', err => {
        stm.close()
        rj(err || new Error('frame error'))
      })

      if (rb === 'ok') {
        stm.end(reqobj.body)
      } else if (typeof rb === 'object') {
        stm.end(rb.data)
      }

    })
    .then(r => {
      return r
    })
    .catch (err => {
      r.error = err
      return r
    })

  }

  async get (reqobj) {
    reqobj.method = 'GET'
    return this.request(reqobj)
  }

  async post (reqobj) {
    reqobj.method = 'POST'
    return this.request(reqobj)
  }

  async put (reqobj) {
    reqobj.method = 'PUT'
    return this.request(reqobj)
  }

  async delete (reqobj) {
    reqobj.method = 'DELETE'
    return this.request(reqobj)
  }

  async options (reqobj) {
    reqobj.method = 'OPTIONS'
    return this.request(reqobj)
  }

  async upload (reqobj) {
    reqobj.multipart = true
    if (reqobj.method === undefined) {
      reqobj.method = 'POST'
    }

    if (reqobj.body === undefined) {
      reqobj.body = {}
    }

    if (reqobj.form) {
      reqobj.body.form = reqobj.form
    }

    if (reqobj.files) {
      reqobj.body.files = reqobj.files
    }

    return this.request(reqobj)
  }

  async up (reqobj) {
    reqobj.files = {}
    reqobj.files[reqobj.name] = reqobj.file
    return this.upload(reqobj)
  }

  async download (reqobj) {
    reqobj.selfHandle = true
    let r = this.request(reqobj)
    return _download(r.stream, reqobj, r.ret, r.payload)
  }

}

/**

connect --> session --> session.request --> stream1
                                        --> stream2
                                        --> stream3
                                        ...
                                        ...

 */

var hiio = function () {

  if (!(this instanceof hiio)) {
    return new hiio()
  }

  //process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

  this.bodyMethods = 'PD'

  this.noBodyMethods = 'GOHT'

  this.bodymaker = new bodymaker()

  this.pool = []

  this.maxPool = 1000

}

hiio.prototype._freeRequest = function (req) {
  if (this.pool.length < this.maxPool) {
    req.pending = true
    req.session = null
    req.host = ''
    this.pool.push(req)
  }
}

hiio.prototype._getPool = function (options) {
  let r = this.pool.pop()
  
  if (r) {
    r.session = options.session
    r.host = options.host
    r.pending = false
    r.parent = options.parent
    r.bodymaker = options.bodymaker
    r.debug = options.debug === undefined ? false : options.debug
    r.keepalive = options.keepalive === undefined ? false : options.keepalive
    r.init()

    return r
  }

  return null
}

hiio.prototype._newRequest = function (options) {
  return this._getPool(options) || new _Request(options)
}

hiio.prototype.parseUrl = parseUrl

hiio.prototype.connect = function (url, options = {}) {

  if (options.requestCert  === undefined) {
    options.requestCert = false
  }

  if (options.rejectUnauthorized === undefined) {
    options.rejectUnauthorized = false
  }

  if (options.checkServerIdentity === undefined) {
    options.checkServerIdentity = (name, cert) => {}
  }

  let h = http2.connect(url, options)

  if (options.timeout && typeof options.timeout === 'number') {
    h.setTimeout(options.timeout, () => {
      h.close()
    })
  }

  if (options.sessionRequest) {
    options.sessionRequest.session = h
    return options.sessionRequest
  }

  let newReq = this._newRequest({
    session : h,
    host : url,
    bodymaker : this.bodymaker,
    parent : this,
    pending: false,
    debug: options.debug === undefined ? false : options.debug,
    keepalive : options.keepalive === undefined ? false : true,
  })

  if (options.keepalive) {
    newReq.reconn = () => {
      options.sessionRequest = newReq
      this.connect(url, options)
    }
  }

  return newReq

}

module.exports = new hiio()
