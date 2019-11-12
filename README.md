node-cache-merge is a highly extensible cache manager with only one dependency (object-hash). It is build specifically to be able to work with any kind of cache, although several default implementations are available for your convienience.  

What is a cache manager? A cache manager lets you take multiple caches and merge them together, hiding the gross and repetative details of looking things up in muliple places. For example, you might want to cache something locally with a short timeout, and then in a remote cache (like redis) with a longer timeout before eventually hitting your source of truth. Without a cache manager you would need to nest your calls, leading to a lot of boilerplate.

With a cache manager all of those details are taken care of. Simply wrap your base getter and setter in a function and pass it to the manager. When you call `get` the manager will iterate through the list of caches, pulling out the first unexpired value that it finds. The manager will then update the previous caches in the list with the value that it found. `set` works similarly, and will push a value to all of the caches within the manager.
  
Advantages of node-cache-merge over other cache managers:
- Clients are not created as part of the manager, so you can use the most up to date versions of your client
- Highly testable
- Objects as keys built in
- Labels on keys built in
- Promises by default
- Very simple to extend - simply create a stash object that follows the interface:
```
{
  get: (key) => ... //returns a promise, undefined if value not found
  set: (key, val) => ... //returns promise(undefined)
}
```

Example of use:  

```
'use strict';

const axios = require('axios');
const redis = require('redis');
const Promise = require('bluebird');
const highland = require('highland')
Promise.promisifyAll(redis);

/**
 * rclient is set up so that if redis goes down it will not queue attempts
 * and it will not attempt a retry for 10 seconds. 
*/
const rclient = redis.createClient({enable_offline_queue: false, retry_strategy: function (options){
  return 10000;
}});
rclient.on('error', function (err) {})
const cache = require('./cache-merge');
cache.promise = Promise;
const LRU = require("lru-cache");
const localcache = new LRU({ max: 70 });

/**
 * Set up the stashes at the beginning of your program
 */
const localstash = cache.hashedStash(cache.getLRU(localcache), cache.setLRU(localcache)(1000));
const redisstash = cache.namedStash('myapp')(cache.getRedis(rclient), cache.setRedis(rclient)(5));
const stashes = cache.merge(localstash, redisstash);

/**
 * create a base stash that reaches out to an endpoint
 */
const stash = cache.merge(stashes,
  cache.stash( (key) => 
    Promise.resolve(axios.get(`http://localhost:3003`))
    .then((payload) => payload.data)
    .tap((val) => console.log("hit http" + val))
  )
)

//generate a stream of objects
highland(function (push, next) {
  push(null, {key: "key1"}); 
  next();
})
.flatMap((item) => highland(stash.get(item).catch(console.error))).done(() => rclient.quit());

```
