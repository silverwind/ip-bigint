"use strict";

const {parse, stringify, max4, max6} = require(".");

test("parse and stringify", () => {
  expect(parse("0.0.0.0")).toEqual({number: BigInt(0), version: 4});
  expect(parse("255.255.255.255")).toEqual({number: max4, version: 4});
  expect(parse("::")).toEqual({number: BigInt(0), version: 6});
  expect(parse("ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff")).toEqual({number: max6, version: 6});
  expect(stringify(parse("0.0.0.255"))).toEqual("0.0.0.255");
  expect(stringify(parse("0.0.255.255"))).toEqual("0.0.255.255");
  expect(stringify(parse("0.255.16.255"))).toEqual("0.255.16.255");
  expect(stringify(parse("128.0.0.255"))).toEqual("128.0.0.255");
  expect(stringify(parse("100.200.100.200"))).toEqual("100.200.100.200");
  expect(stringify(parse("::ffff"))).toEqual("::ffff");
  expect(stringify(parse("::ffff:ffff"))).toEqual("::ffff:ffff");
  expect(stringify(parse("ffff::"))).toEqual("ffff::");
  expect(stringify(parse("::ffff"))).toEqual("::ffff");
  expect(stringify(parse("ffff::ffff"))).toEqual("ffff::ffff");
  expect(stringify(parse("::ffff:ffff"))).toEqual("::ffff:ffff");
  expect(stringify(parse("123:456:ffff::"))).toEqual("123:456:ffff::");
  expect(stringify(parse("123:456:0:0::ffff"))).toEqual("123:456::ffff");
  expect(stringify(parse("::ffff:191.239.213.197"))).toEqual("::ffff:191.239.213.197");
  expect(stringify(parse("::ffff:127.0.0.1"))).toEqual("::ffff:127.0.0.1");
  expect(stringify(parse("::%en1"))).toEqual("::%en1");
  expect(() => parse()).toThrow();
  expect(() => parse("")).toThrow();
  expect(() => parse("0.0.0.256")).toThrow();
  expect(() => stringify()).toThrow();
  expect(() => stringify({})).toThrow();
  expect(() => stringify({num: BigInt(0)})).toThrow();
});
