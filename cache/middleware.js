'use strict';

class middleware {
  constructor () {
    this.chain = [];
    this.stack = [];
    this.init();
  }

  init () {
    this.chain = [];
    let first = async (ctx) => {
      if (ctx && typeof ctx === 'object' && ctx.exec && typeof ctx.exec === 'function') {
        return await ctx.exec(ctx);
      }
    };

    this.chain.push(first);
  }

  add (midcall) {
    if (typeof midcall !== 'function' || midcall.constructor.name !== 'AsyncFunction') {
      throw new Error(`middleware must be a async function`);
    }

    let last = this.chain.length - 1;
    let nextcall = this.chain[last];

    let realmid = function () {
      return async (ctx) => {
        return await midcall(ctx, nextcall.bind(null, ctx));
      };
    };

    this.chain.push( realmid() );
  }

  loadstack () {
    this.init();
    for (let i = this.stack.length - 1; i >= 0; i--) {
      this.add(this.stack[i]);
    }
  }

  use (midcall) {
    this.stack.push(midcall);
    this.loadstack();
  }

  async run (ctx) {
    let last = this.chain.length - 1;
    return await this.chain[last](ctx);
  }

}

module.exports = middleware;
