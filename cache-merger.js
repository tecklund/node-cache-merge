'use strict';

const cache = module.exports;
const hash = require('object-hash');

const addPrefix = (prefix) => (key) => prefix+":"+hash(key);

cache.getLocal = (cache) => (key) => Promise.resolve(cache.get(key));
cache.setLocal = (exp) => (cache) => (key) => (val) => Promise.resolve(cache.set(key, val, exp));

cache.getRedis = (rclient) => (key) => rclient.getAsync(key).catch(() => undefined);
cache.setRedis = (exp) => (rclient) => (key) => (val) => rclient.setexAsync(key, exp, val).catch(() => undefined);


cache.namedStash = (name) => (cache) => (getter) => (setter) => ({
  get: (key) => getter(cache)(addPrefix(name)(key)),
  set: (key) => (val) => setter(cache)(addPrefix(name)(key))(val)
});

const noSet = (key) => (val) => Promise.resolve();

cache.stash = (getter) => (setter = noSet) => ({
    get: getter,
    set: setter
});

cache.promise = Promise;

/** 
 * takes two caches and chains them so that if the first cache misses, the second one will 
 * do the lookup and if that hits update the first cache
 */
cache.combine = (stash1, stash2) => ({
    get: (key) => 
            stash1.get(key)
            .then((val) => val 
              ? val 
              : stash2.get(key)
                .then((val) => {
                  if(val){
                    return stash1.set(key)(val).then(() => val)
                  } else {
                    return cache.promise.resolve(val)
                  }
                  
                }),
        ),
    set: (key) => (val) => stash1.set(key)(val).then(() => stash2.set(key)(val)).then(() => undefined)
  });

cache.merge = (...caches) => caches.reduce((acc, next) => cache.combine(acc, next));