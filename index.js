'use strict'

const goh = require('./gohttp.js')
const h2c = require('./hiio.js')

module.exports = {
  httpi : goh,
  httpii : h2c,
  httpcli : new goh(),
  http2cli : new h2c(),
}
