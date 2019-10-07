node-cache-merge is a highly extensible cache manager with only one dependency (object-hash). It is build specifically to be able to work with any kind of cache, although several default implementations are available for your convienience.

Example of use:  

```
const axios = require('axios');
const redis = require('redis');
Promise.promisifyAll(redis);
const rclient = redis.createClient({enable_offline_queue: false, retry_strategy: function (options){
  return 10000;
}});
rclient.on('error', function (er) {})
const cache = require('./cache');
const LRU = require("lru-cache");
const localcache = new LRU({ max: 70 });

const localstash = cache.namedStash("local")(localcache)(cache.getLocal)(cache.setLocal(1000));
const redisstash = cache.namedStash("redis")(rclient)(cache.getRedis)(cache.setRedis(5));
const base = cache.stash(
                    (key) => 
                      Promise.resolve(axios.get(`http://localhost:3003`))
                      .then((payload) => payload.data)
                      .tap((val) => console.log("hit http" + val)))()

const stash = cache.merge(localstash, redisstash, base);

highland(function (push, next) {
  push(null, {key: "key1"}); //+ Math.floor(Math.random() * 100));
  next();
})
.flatMap((item) => highland(stash.get(item).catch(console.error))).done();
```
