import {parseIp, stringifyIp, max4, max6} from "./index.js";

function jsonStringifyWithBigInt(parsedIp, _, ...args) {
  return JSON.stringify(parsedIp, (_, value) => typeof value === "bigint" ? value.toString() : value, ...args);
}

test("parseIp and stringifyIp", () => {
  expect(parseIp("0.0.0.0")).toEqual({number: 0n, version: 4});
  expect(parseIp("255.255.255.255")).toEqual({number: max4, version: 4});
  expect(parseIp("::")).toEqual({number: 0n, version: 6});
  expect(parseIp("ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff")).toEqual({number: max6, version: 6});
  expect(stringifyIp(parseIp("0.0.0.255"))).toEqual("0.0.0.255");
  expect(stringifyIp(parseIp("0.0.255.255"))).toEqual("0.0.255.255");
  expect(stringifyIp(parseIp("0.255.16.255"))).toEqual("0.255.16.255");
  expect(stringifyIp(parseIp("128.0.0.255"))).toEqual("128.0.0.255");
  expect(stringifyIp(parseIp("100.200.100.200"))).toEqual("100.200.100.200");
  expect(stringifyIp(parseIp("::ffff"))).toEqual("::ffff");
  expect(stringifyIp(parseIp("::ffff:ffff"))).toEqual("::ffff:ffff");
  expect(stringifyIp(parseIp("ffff::"))).toEqual("ffff::");
  expect(stringifyIp(parseIp("::ffff"))).toEqual("::ffff");
  expect(stringifyIp(parseIp("ffff::ffff"))).toEqual("ffff::ffff");
  expect(stringifyIp(parseIp("::ffff:ffff"))).toEqual("::ffff:ffff");
  expect(stringifyIp(parseIp("123:456:ffff::"))).toEqual("123:456:ffff::");
  expect(stringifyIp(parseIp("123:456:0:0::ffff"))).toEqual("123:456::ffff");
  expect(stringifyIp(parseIp("::ffff:191.239.213.197"))).toEqual("::ffff:191.239.213.197");
  expect(stringifyIp(parseIp("::ffff:127.0.0.1"))).toEqual("::ffff:127.0.0.1");
  expect(stringifyIp(parseIp("::%en1"))).toEqual("::%en1");
  expect(stringifyIp(parseIp("1:2:0:4:5:6:7:8"))).toEqual("1:2::4:5:6:7:8");
  expect(stringifyIp(parseIp("0:0:0:4:5:6:7:8"))).toEqual("::4:5:6:7:8");
  expect(stringifyIp(parseIp("1:2:3:00:00::0"))).toEqual("1:2:3::");
  expect(stringifyIp(parseIp("1:0:0:0:0:0:0:1"))).toEqual("1::1");
  expect(stringifyIp(parseIp("1:0:0:2:3:0:0:1"))).toEqual("1::2:3:0:0:1");
  expect(stringifyIp(parseIp("1080::8:800:200C:417A"))).toEqual("1080::8:800:200c:417a");
  expect(stringifyIp(parseIp("1080::0:0:200C:417A"))).toEqual("1080::200c:417a");
  expect(() => parseIp()).toThrow();
  expect(() => parseIp("")).toThrow();
  expect(() => parseIp("1")).toThrow();
  expect(() => stringifyIp()).toThrow();
  expect(() => stringifyIp({})).toThrow();
  expect(() => stringifyIp({number: 0n})).toThrow();
  expect(jsonStringifyWithBigInt(parseIp("::"))).toEqual(`{"number":"0","version":6}`);
});
