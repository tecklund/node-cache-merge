'use strict';

const cache = require('./cache-merger');
const Promise = require('bluebird');
const hash = require('object-hash');

test(`Given [0:undefined, 1:undefined, 2:val] 
      when get is called
      then [0:val, 1:val, 2:val], and val is returned`, () => {
  var a = undefined;
  var b = undefined;
  const setmockA = jest.fn((val) => Promise.resolve(a = val))
  const setmockB = jest.fn((val) => Promise.resolve(b = val))
  const setmockC = jest.fn((val) => Promise.resolve(undefined))
  const getmockA = jest.fn((val) => Promise.resolve(a))
  const getmockB = jest.fn((val) => Promise.resolve(b))
  const getmockC = jest.fn((val) => Promise.resolve("val"))
  const stashA = ({
    get: getmockA,
    set: (key) => setmockA
  })
  const stashB = ({
    get: getmockB,
    set: (key) => setmockB
  })
  const stashC = ({
    get: getmockC,
    set: (key) => setmockC
  })
  const stash = cache.merge(stashA, stashB, stashC)
  return stash.get("key").then((val) => {
    expect(val).toBe("val");
    expect(a).toBe("val");
    expect(b).toBe("val");
    expect(getmockA.mock.calls[0][0]).toBe("key")
    expect(setmockA.mock.calls[0][0]).toBe("val");
    expect(setmockB.mock.calls[0][0]).toBe("val");
    expect(setmockC.mock.calls.length).toBe(0);
    return stash.get("key");
  }).then((val) => {
    expect(val).toBe("val");
    expect(getmockA.mock.calls.length).toBe(2);
    expect(getmockB.mock.calls.length).toBe(1);
    expect(getmockC.mock.calls.length).toBe(1);
    expect(setmockA.mock.calls.length).toBe(1);
    expect(setmockB.mock.calls.length).toBe(1);
    expect(setmockC.mock.calls.length).toBe(0);
  })
  
});

test(`Given redis has no value for key A 
      when getRedis is called for key A
      then the result will be undefined, not null`, () => {

  const redisMock = { getAsync: jest.fn((val) => Promise.resolve(undefined)) }
  cache.getRedis(redisMock)('A').then((val) => {
    expect(val).toBe(undefined)
    expect(redisMock.getAsync.mock.calls.length).toBe(1)
  })
});


test(`test code`, () => {

    let a = undefined;
    let b = undefined;
    let c = 'smaugs treasure'
    const stashA = ({
      get: (key) => Promise.resolve(a),
      set: (key) => (val) => Promise.resolve(a = val)
    })
    const stashB = ({
      get: (key) => Promise.resolve(b),
      set: (key) => (val) => Promise.resolve(b = val)
    })
    const stashC = ({
      get: (key) => Promise.resolve(c),
      set: (key) => (val) => Promise.resolve(c = val)
    })
    const stash = cache.merge(stashA, stashB, stashC)
    stash.get("key").then((val) => console.log(val)).then(() => console.log(a))
      
});

const LRU = require("lru-cache");
const localcache = new LRU({ max: 70 });

const redis = require('redis');
Promise.promisifyAll(redis);

const rclient = redis.createClient();
const nullToUndefined = (val) => val === null ? undefined : val;
test(`test caches`, async function() {
  let c = 'smaugs treasure'
  const stashA = ({
    get: (key) => Promise.resolve(localcache.get(key)),
    set: (key) => (val) => Promise.resolve(localcache.set(key, val, 1))
  })
  const stashB = ({
    get: (key) => rclient.getAsync(key).then(nullToUndefined).catch(() => undefined),
    set: (key) => (val) => rclient.setexAsync(key, 1, val).catch(() => undefined)
  })
  const stashC = ({
    get: (key) => Promise.resolve(c),
    set: (key) => (val) => Promise.resolve(c = val)
  })
  const stash = cache.merge(stashA, stashB, stashC)
  await stash.get("key").then((v) => console.log(`ret val was ${v}`))
    .tap(() => rclient.getAsync("key").then((v) => console.log(`redis result was ${v}`)))
    .tap(() => rclient.quit())
});


const getLRU = (lru) => (key) => Promise.resolve(lru.get(key));
const setLRU = (exp) => (lru) => (key) => (val) => Promise.resolve(lru.set(key, val, exp));

const getRedis = (rclient) => (key) => rclient.getAsync(key).then(nullToUndefined).catch(() => undefined);
const setRedis = (exp) => (rclient) => (key) => (val) => rclient.setexAsync(key, exp, val).catch(() => undefined);
const noSet = (key) => (val) => Promise.resolve();

const stash = (getter, setter = noSet) => ({
  get: getter,
  set: setter
});

test(`test caches`, async function() {


  let c = 'smaugs treasure'
  const stashA = stash(getLRU(localcache), setLRU(5)(localcache))
  const stashB = stash(getRedis(rclient), setRedis(5)(rclient))
  const stashC = stash(() => Promise.resolve(c))
  const totalStash = cache.merge(stashA, stashB, stashC)
  await totalStash.get("key").then((v) => console.log(`ret val was ${v}`))
    .tap(() => rclient.quit())
});


test(`test caches`, async function() {
  const addPrefix = (prefix) => (key) => prefix+":"+hash(key);
  const namedStash = (name) => (getter, setter) => ({
    get: (key) => getter(addPrefix(name)(key)),
    set: (key) => (val) => setter(addPrefix(name)(key))(val)
  });
  const appstash = namedStash('myapp');

  let c = 'smaugs treasure'
  const stashA = stash(getLRU(localcache), setLRU(5)(localcache))
  const stashB = appstash(getRedis(rclient), setRedis(5)(rclient))
  const stashC = stash(() => Promise.resolve(c))
  const totalStash = cache.merge(stashA, stashB, stashC)
  await totalStash.get("key").then((v) => console.log(`ret val was ${v}`))
    .tap(() => rclient.quit())
});

test.only(`test get namedStash`, async function() {
  const appstash = cache.namedStash('myapp');
  const mystash = appstash((key) => Promise.resolve(key), () => Promise.resolve(undefined))
  await mystash.get('tim').then((val) => {
    expect(val).toBe('myapp:0545e9b8dfadca14cf06d163e2d2514c161d5d17')
  })
});

test.only(`test get hashedStash`, async function() {
  const mystash = cache.hashedStash((key) => Promise.resolve(key), () => Promise.resolve(undefined))
  await mystash.get('tim').then((val) => {
    expect(val).toBe('0545e9b8dfadca14cf06d163e2d2514c161d5d17')
  })
});

test.only(`test get keyedStash`, async function() {
  const mystash = cache.keyedStash('myapp')((key) => Promise.resolve(key), () => Promise.resolve(undefined))
  await mystash.get('tim').then((val) => {
    expect(val).toBe('myapp:tim')
  })
});

test.only(`test set namedStash`, async function() {
  let a = undefined;
  const appstash = cache.namedStash('myapp');
  const mystash = appstash((key) => Promise.resolve(key), (key) => (val) => Promise.resolve(a = key))
  await mystash.set('tim')(1).then(() => {
    expect(a).toBe('myapp:0545e9b8dfadca14cf06d163e2d2514c161d5d17')
  })
});

test.only(`test set hashedStash`, async function() {
  let a = undefined;
  const mystash = cache.hashedStash((key) => Promise.resolve(key), (key) => (val) => Promise.resolve(a = key))
  await mystash.set('tim')(1).then(() => {
    expect(a).toBe('0545e9b8dfadca14cf06d163e2d2514c161d5d17')
  })
});

test.only(`test set keyedStash`, async function() {
  let a = undefined;
  const mystash = cache.keyedStash('myapp')((key) => Promise.resolve(key), (key) => (val) => Promise.resolve(a = key))
  await mystash.set('tim')(1).then(() => {
    expect(a).toBe('myapp:tim')
  })
});