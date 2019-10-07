'use strict';

const cache = require('./cache-merger');

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