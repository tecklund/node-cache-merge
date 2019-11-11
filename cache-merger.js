'use strict';

const cache = module.exports;
const hash = require('object-hash');
cache.promise = Promise;

cache.addPrefix = (prefix) => (key) => `${prefix}:${key}`
cache.compose = (f, g) => (args) => f(g(args))
cache.identity = x => x

cache.getLRU = (lru) => (key) => cache.promise.resolve(lru.get(key));
cache.setLRU = (lru) => (exp) => (key) => (val) => cache.promise.resolve(lru.set(key, val, exp));

const nullToUndefined = (val) => val === null ? undefined : val;

cache.getRedis = (rclient) => (key) => rclient.getAsync(key).then(nullToUndefined).catch(() => undefined);
cache.setRedis = (rclient) => (exp) => (key) => (val) => rclient.setexAsync(key, exp, val).catch(() => undefined);

cache.keyGenStash = (keyGen) => (getter, setter) => ({
  get: (key) => getter(keyGen(key)),
  set: (key) => (val) => setter(keyGen(key))(val)
});

cache.namedStash = (name) => cache.keyGenStash(cache.compose(cache.addPrefix(name), hash))

cache.hashedStash = cache.keyGenStash(hash)

cache.keyedStash = (name) => cache.keyGenStash(cache.addPrefix(name))

const noSet = (key) => (val) => cache.promise.resolve();

cache.stash = (getter, setter = noSet) => cache.keyGenStash(cache.identity)(getter, setter)

/** 
 * takes two caches and chains them so that if the first cache misses, the second one will 
 * do the lookup and if that hits update the first cache
 */
cache.combine = (stash1, stash2) => ({
    get: (key) => 
      stash1.get(key).then((stash1_val) =>                      //attempt to get the key from stash1
        stash1_val !== undefined                                //check if val from stash1 is undefined
        ? stash1_val                                            //val was not undefined, return val
        : stash2.get(key).then((stash2_val) =>                  //val was undefined, get val from stash2
          stash2_val !== undefined                              //check if val from stash2 is undefined
          ? stash1.set(key)(stash2_val).then(() => stash2_val)  //val from stash2 not undefined, set val in stash 1 and return val
          : cache.promise.resolve(undefined)                    //val from stash2 was undefined, return undefined
        ),
      ),
    set: (key) => (val) => stash1.set(key)(val).then(() => stash2.set(key)(val)).then(() => undefined)
  });

cache.merge = (...stashes) => stashes.reduce(cache.combine);