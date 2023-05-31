import {parseIp, stringifyIp, normalizeIp, max4, max6} from "./index.js";

function jsonStringifyWithBigInt(parsedIp, _, ...args) {
  return JSON.stringify(parsedIp, (_, value) => typeof value === "bigint" ? value.toString() : value, ...args);
}

test("parseIp and stringifyIp", () => {
  expect(parseIp("0.0.0.0")).toEqual({number: 0n, version: 4});
  expect(parseIp("255.255.255.255")).toEqual({number: max4, version: 4});
  expect(parseIp("::")).toEqual({number: 0n, version: 6});
  expect(parseIp("ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff")).toEqual({number: max6, version: 6});

  expect(normalizeIp("0.0.0.255")).toEqual("0.0.0.255");
  expect(normalizeIp("0.0.255.255")).toEqual("0.0.255.255");
  expect(normalizeIp("0.255.16.255")).toEqual("0.255.16.255");
  expect(normalizeIp("128.0.0.255")).toEqual("128.0.0.255");
  expect(normalizeIp("100.200.100.200")).toEqual("100.200.100.200");
  expect(normalizeIp("::ffff")).toEqual("::ffff");
  expect(normalizeIp("::ffff:ffff")).toEqual("::ffff:ffff");
  expect(normalizeIp("ffff::")).toEqual("ffff::");
  expect(normalizeIp("::ffff")).toEqual("::ffff");
  expect(normalizeIp("ffff::ffff")).toEqual("ffff::ffff");
  expect(normalizeIp("::ffff:ffff")).toEqual("::ffff:ffff");
  expect(normalizeIp("123:456:ffff::")).toEqual("123:456:ffff::");
  expect(normalizeIp("123:456:0:0::ffff")).toEqual("123:456::ffff");
  expect(normalizeIp("::ffff:191.239.213.197")).toEqual("::ffff:191.239.213.197");
  expect(normalizeIp("::ffff:127.0.0.1")).toEqual("::ffff:127.0.0.1");
  expect(normalizeIp("::%en1")).toEqual("::%en1");
  expect(normalizeIp("2001:0000:0000:0db8:0000:0000:0000:0001")).toEqual("2001:0:0:db8::1");
  expect(normalizeIp("1:2:0:4:5:6:7:8")).toEqual("1:2::4:5:6:7:8");
  expect(normalizeIp("0:0:0:4:5:6:7:8")).toEqual("::4:5:6:7:8");
  expect(normalizeIp("1:2:3:00:00::0")).toEqual("1:2:3::");
  expect(normalizeIp("1:0:0:0:0:0:0:1")).toEqual("1::1");
  expect(normalizeIp("1:0:0:2:3:0:0:1")).toEqual("1::2:3:0:0:1");
  expect(normalizeIp("1080::8:800:200C:417A")).toEqual("1080::8:800:200c:417a");
  expect(normalizeIp("1080::0:0:200C:417A")).toEqual("1080::200c:417a");
  expect(normalizeIp("2001:db8::0:0:1")).toEqual("2001:db8::1");
  expect(normalizeIp("2001:0:0:0db8:0:0:0:1")).toEqual("2001:0:0:db8::1");
  expect(normalizeIp("6620:0:1ff2::")).toEqual("6620:0:1ff2::");

  expect(() => parseIp()).toThrow();
  expect(() => parseIp("")).toThrow();
  expect(() => parseIp("1")).toThrow();
  expect(() => stringifyIp()).toThrow();
  expect(() => stringifyIp({})).toThrow();
  expect(() => stringifyIp({number: 0n})).toThrow();
  expect(jsonStringifyWithBigInt(parseIp("::"))).toEqual(`{"number":"0","version":6}`);
});
