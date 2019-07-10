"use strict";

const {parse, stringify, max4, max6} = require(".");
const assert = require("assert");

const exit = err => {
  if (err) console.error(err);
  process.exit(err ? 1 : 0);
};

const main = async () => {
  assert.deepEqual(parse("0.0.0.0"), {num: BigInt(0), version: 4});
  assert.deepEqual(parse("255.255.255.255"), {num: max4, version: 4});
  assert.deepEqual(parse("::"), {num: BigInt(0), version: 6, ipv4mapped: false});
  assert.deepEqual(parse("ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff"), {num: max6, version: 6, ipv4mapped: false});
  assert.deepEqual(stringify(parse("0.0.0.255")), "0.0.0.255");
  assert.deepEqual(stringify(parse("0.0.255.255")), "0.0.255.255");
  assert.deepEqual(stringify(parse("0.255.16.255")), "0.255.16.255");
  assert.deepEqual(stringify(parse("128.0.0.255")), "128.0.0.255");
  assert.deepEqual(stringify(parse("100.200.100.200")), "100.200.100.200");
  assert.deepEqual(stringify(parse("::ffff")), "::ffff");
  assert.deepEqual(stringify(parse("::ffff:ffff")), "::ffff:ffff");
  assert.deepEqual(stringify(parse("ffff::")), "ffff::");
  assert.deepEqual(stringify(parse("::ffff")), "::ffff");
  assert.deepEqual(stringify(parse("ffff::ffff")), "ffff::ffff");
  assert.deepEqual(stringify(parse("::ffff:ffff")), "::ffff:ffff");
  assert.deepEqual(stringify(parse("123:456:ffff::")), "123:456:ffff::");
  assert.deepEqual(stringify(parse("123:456:0:0::ffff")), "123:456::ffff");
  assert.deepEqual(stringify(parse("::ffff:191.239.213.197")), "::ffff:191.239.213.197");
  assert.deepEqual(stringify(parse("::ffff:127.0.0.1")), "::ffff:127.0.0.1");
  assert.throws(() => parse());
  assert.throws(() => parse(""));
  assert.throws(() => parse("0.0.0.256"));
  assert.throws(() => stringify());
  assert.throws(() => stringify({}));
  assert.throws(() => stringify({num: BigInt(0)}));
};

main().then(exit).catch(exit);
