'use strict';

const cache = require('./cache-merger');
const Promise = require('bluebird');
const LRU = require("lru-cache");
cache.promise = Promise;

describe('stash tests', function() {

  let a = undefined;
  let b = undefined;
  let c = undefined;
  let base = undefined;
  let localcache = undefined;
  let rclient = undefined;
  let getjoe = undefined;
  let geta = undefined;
  let getb = undefined;
  let seta = undefined;
  let setb = undefined;
  let setc = undefined;

  const baseval = 'base val';
  const keyval = 'keyval'

  beforeAll(() => {
    localcache = new LRU();
    const fakeredis = new LRU();
    rclient = {
      getAsync: key => Promise.resolve(fakeredis.get(key)),
      setexAsync: (key, exp, val) => Promise.resolve(fakeredis.set(key, val))
    };
  });

  beforeEach(() => {
    a = undefined;
    b = undefined;
    c = undefined;
    getjoe = jest.fn((key) => Promise.resolve('joe'));
    geta = jest.fn((val) => Promise.resolve(a));
    getb = jest.fn((val) => Promise.resolve(b));
    seta = jest.fn((key, val) => Promise.resolve(a = val)); 
    setb = jest.fn((key, val) => Promise.resolve(b = val));
    setc = jest.fn((key, val) => Promise.resolve(c = val));
    base = jest.fn((val) => Promise.resolve(baseval));
  })
  
  test(`Given [a:undefined, b:undefined, base:val] 
        when get is called
        then [a:val, b:val, base:val], and val is returned`, async () => {
    const base = jest.fn((val) => Promise.resolve(baseval));
    const stash = cache.merge(
      cache.stash(geta, seta), 
      cache.stash(getb, setb), 
      cache.stash(base)
    );
    const val = await stash.get(keyval);
    expect(val).toBe(baseval);
    expect(a).toBe(baseval);
    expect(b).toBe(baseval);
    expect(geta.mock.calls[0][0]).toBe(keyval)
    expect(seta.mock.calls[0][0]).toBe(keyval);
    expect(setb.mock.calls[0][0]).toBe(keyval);
    expect(seta.mock.calls.length).toBe(1);
    expect(setb.mock.calls.length).toBe(1);
    expect(setc.mock.calls.length).toBe(0);
    expect(geta.mock.calls.length).toBe(1);
    expect(getb.mock.calls.length).toBe(1);
    expect(base.mock.calls.length).toBe(1);
  });

  test(`Given [a:val, b:val, base:val] 
        when get is called
        then [a:val, b:val, base:val]
        and val is returned
        and only 0 get was invoked`, async () => {
    a = baseval;
    b = baseval;
    const stash = cache.merge(
      cache.stash(geta, seta), 
      cache.stash(getb, setb), 
      cache.stash(base)
    );
    const val2 = await stash.get(keyval);
    expect(val2).toBe(baseval);
    expect(geta.mock.calls.length).toBe(1);
    expect(getb.mock.calls.length).toBe(0);
    expect(base.mock.calls.length).toBe(0);
    expect(seta.mock.calls.length).toBe(0);
    expect(setb.mock.calls.length).toBe(0);
    expect(setc.mock.calls.length).toBe(0);
  });

  test(`Given [a:undefined, b:val, base:val] 
        when get is called
        then [a:val, b:val, base:val]
        and val is returned
        and geta and getb gets were invoked
        and seta was invoked`, async () => {
    b = baseval;
    const base = jest.fn((val) => Promise.resolve(baseval));
    const stash = cache.merge(
      cache.stash(geta, seta), 
      cache.stash(getb, setb), 
      cache.stash(base)
    );
    const val = await stash.get(keyval);
    expect(val).toBe(baseval);
    expect(geta.mock.calls.length).toBe(1);
    expect(getb.mock.calls.length).toBe(1);
    expect(base.mock.calls.length).toBe(0);
    expect(seta.mock.calls.length).toBe(1);
    expect(setb.mock.calls.length).toBe(0);
    expect(setc.mock.calls.length).toBe(0);
  });

  test(`Given redis has no value for key A 
        when getRedis is called for key A
        then the result will be undefined, not null`, async () => {
    const redisMock = { getAsync: jest.fn((val) => Promise.resolve(null)) }
    const val = await cache.getRedis(redisMock)('A');
    expect(val).toBe(undefined);
    expect(redisMock.getAsync.mock.calls.length).toBe(1);
  });

  test(`Given namedStash with name set to myapp
        and the getter returns joe
        when get is called
        then the result is Promise(joe)
        and the key is myapp:hash(key)`, async function() {
    const appstash = cache.namedStash('myapp');
    const mystash = appstash(getjoe, cache.noSet)
    const val = await mystash.get('tim');
    expect(val).toBe('joe');
    expect(getjoe.mock.calls.length).toBe(1);
    expect(getjoe.mock.calls[0][0]).toBe('myapp:0545e9b8dfadca14cf06d163e2d2514c161d5d17');
  });

  test(`Given hashedStash with name set to myapp
        and the getter returns joe
        when get is called
        then the result is Promise(joe)
        and the key is with hash(key)`, async function() {
    const mystash = cache.hashedStash(getjoe, cache.noSet);
    const val = await mystash.get('tim');
    expect(val).toBe('joe');
    expect(getjoe.mock.calls.length).toBe(1);
    expect(getjoe.mock.calls[0][0]).toBe('0545e9b8dfadca14cf06d163e2d2514c161d5d17');
  });

  test(`Given keyedStash with name set to myapp
        and the getter returns joe
        when get is called
        then the result is Promise(joe)
        and the key is myapp:val`, async function() {
    const mystash = cache.keyedStash('myapp')(getjoe, cache.noSet);
    const val = await mystash.get('tim');
    expect(val).toBe('joe');
    expect(getjoe.mock.calls.length).toBe(1);
    expect(getjoe.mock.calls[0][0]).toBe('myapp:tim');
  });

  test(`Given namedStash with name myapp
        when set is called
        then the external resource is set to the value
        and the key is myapp:hash(key)`, async function() {
    const appstash = cache.namedStash('myapp');
    const mystash = appstash(getjoe, seta);
    await mystash.set('tim', 1);
    expect(a).toBe(1);
    expect(seta.mock.calls.length).toBe(1);
    expect(seta.mock.calls[0][0]).toBe('myapp:0545e9b8dfadca14cf06d163e2d2514c161d5d17');
  });

  test(`Given hashedStash
        when set is called
        then the external resource is set to the value
        and the key is hash(key)`, async function() {
    const mystash = cache.hashedStash(getjoe, seta);
    await mystash.set('tim', 1);
    expect(a).toBe(1);
    expect(seta.mock.calls.length).toBe(1);
    expect(seta.mock.calls[0][0]).toBe('0545e9b8dfadca14cf06d163e2d2514c161d5d17');
  });

  test(`Given hashedStash
        when set is called
        then the external resource is set to the value
        and the key is name:key`, async function() {
    const mystash = cache.keyedStash('myapp')(getjoe, seta);
    await mystash.set('tim', 1);
    expect(a).toBe(1);
    expect(seta.mock.calls.length).toBe(1);
    expect(seta.mock.calls[0][0]).toBe('myapp:tim');
  });

  test(`full test`, async function() {
    let a = 'a treasure';
    let b = 'b treasure';
    let c = 'c treasure';
    const localmock = jest.fn((val) => cache.getLRU(localcache)(val))

    const appstash = cache.namedStash('myapp');
    const localstash = cache.stash(localmock, cache.setLRU(localcache)(5));
    const redisstash = appstash(cache.getRedis(rclient), cache.setRedis(rclient)(5));
    const stashes = cache.merge(localstash, redisstash);

    const cachedA = cache.merge(stashes, cache.stash(() => Promise.resolve(a)));
    const cachedB = cache.merge(stashes, cache.stash(() => Promise.resolve(b)));
    const cachedC = cache.merge(stashes, cache.stash(() => Promise.resolve(c)));

    await cachedA.get("keya").then((v) => expect(v).toBe('a treasure'));
    await cachedB.get("keyb").then((v) => expect(v).toBe('b treasure'));
    await cachedC.get("keyc").then((v) => expect(v).toBe('c treasure'));

    expect(localmock.mock.calls[0][0]).toBe('keya')
  });

});

/*

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
  const setLRU = (lru) => (exp) => (key) => (val) => Promise.resolve(lru.set(key, val, exp));

  const getRedis = (rclient) => (key) => rclient.getAsync(key).then(nullToUndefined).catch(() => undefined);
  const setRedis = (rclient) => (exp) => (key) => (val) => rclient.setexAsync(key, exp, val).catch(() => undefined);
  const noSet = (key) => (val) => Promise.resolve();

  const stash = (getter, setter = noSet) => ({
    get: getter,
    set: setter
  });

  test(`test caches`, async function() {


    let c = 'smaugs treasure'
    const stashA = stash(getLRU(localcache), setLRU(localcache)(5))
    const stashB = stash(getRedis(rclient), setRedis(5)(rclient)(5))
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
    const stashA = stash(getLRU(localcache), setLRU(localcache)(5))
    const stashB = appstash(getRedis(rclient), setRedis(rclient)(5))
    const stashC = stash(() => Promise.resolve(c))
    const totalStash = cache.merge(stashA, stashB, stashC)
    await totalStash.get("key").then((v) => console.log(`ret val was ${v}`))
      .tap(() => rclient.quit())
  });
  */