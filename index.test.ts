import {parseIp, normalizeIp, max4, max6, ipVersion, stringifyIp} from "./index.ts";

function jsonStringifyBigInt(obj: any) {
  return JSON.stringify(obj, (_, value) => typeof value === "bigint" ? value.toString() : value);
}

test("tests", () => {
  expect(parseIp("0.0.0.0")).toEqual({number: 0n, version: 4});
  expect(parseIp("255.255.255.255")).toEqual({number: max4, version: 4});
  expect(parseIp("::")).toEqual({number: 0n, version: 6});
  expect(parseIp("ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff")).toEqual({number: max6, version: 6});
  expect(() => parseIp("")).toThrow();
  expect(() => parseIp("1")).toThrow();

  expect(normalizeIp("0.0.0.0")).toEqual("0.0.0.0");
  expect(normalizeIp("0.0.0.255")).toEqual("0.0.0.255");
  expect(normalizeIp("000.0.00.255")).toEqual("0.0.0.255");
  expect(normalizeIp("0000.0.00.255")).toEqual("0.0.0.255");
  expect(normalizeIp("01.02.03.04")).toEqual("1.2.3.4");
  expect(normalizeIp("01.02.03.04", {hexify: true})).toEqual("1.2.3.4");
  expect(normalizeIp("0.0.255.255")).toEqual("0.0.255.255");
  expect(normalizeIp("0.255.16.255")).toEqual("0.255.16.255");
  expect(normalizeIp("128.0.0.255")).toEqual("128.0.0.255");
  expect(normalizeIp("100.200.100.200")).toEqual("100.200.100.200");
  expect(normalizeIp("::")).toEqual("::");
  expect(normalizeIp("::0001")).toEqual("::1");
  expect(normalizeIp("::0001", {hexify: true})).toEqual("::1");
  expect(normalizeIp("::ffff")).toEqual("::ffff");
  expect(normalizeIp("0::ffff")).toEqual("::ffff");
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
  expect(normalizeIp("1:2:0:4:5:6:7:8")).toEqual("1:2:0:4:5:6:7:8");
  expect(normalizeIp("0:0:0:4:5:6:7:8")).toEqual("::4:5:6:7:8");
  expect(normalizeIp("1:2:3:00:00::0")).toEqual("1:2:3::");
  expect(normalizeIp("1:0:0:0:0:0:0:1")).toEqual("1::1");
  expect(normalizeIp("1:0:0:2:3:0:0:1")).toEqual("1::2:3:0:0:1");
  expect(normalizeIp("1080::8:800:200C:417A")).toEqual("1080::8:800:200c:417a");
  expect(normalizeIp("1080::0:0:200C:417A")).toEqual("1080::200c:417a");
  expect(normalizeIp("2001:db8::0:0:1")).toEqual("2001:db8::1");
  expect(normalizeIp("2001:0:0:0db8:0:0:0:1")).toEqual("2001:0:0:db8::1");
  expect(normalizeIp("2001:000:00000:0db8:0:0:0:1")).toEqual("2001:0:0:db8::1");
  expect(normalizeIp("6620:0:1ff2::")).toEqual("6620:0:1ff2::");
  expect(normalizeIp("6620:0000:1ff2::")).toEqual("6620:0:1ff2::");
  expect(normalizeIp("6620:00000000000:1ff2::0")).toEqual("6620:0:1ff2::");
  expect(normalizeIp("6620:1ff2::0")).toEqual("6620:1ff2::");
  expect(normalizeIp("6620:1ff2::00000")).toEqual("6620:1ff2::");
  expect(normalizeIp("6620:1ff2::00000", {compress: false})).toEqual("6620:1ff2:0:0:0:0:0:0");
  expect(normalizeIp("::1", {compress: false})).toEqual("0:0:0:0:0:0:0:1");
  expect(normalizeIp("1::1", {compress: false})).toEqual("1:0:0:0:0:0:0:1");
  expect(normalizeIp("01.02.03.04")).toEqual("1.2.3.4");
  expect(normalizeIp("::FFFF:34.90.242.162", {hexify: true})).toEqual("::ffff:225a:f2a2");
  expect(normalizeIp("2001:db8:0:1:1:1:1:1")).toEqual("2001:db8:0:1:1:1:1:1");
  expect(normalizeIp("1:2:0:4:5:6:7:8")).toEqual("1:2:0:4:5:6:7:8");
  expect(normalizeIp("1:0:3:4:5:6:7:8")).toEqual("1:0:3:4:5:6:7:8");
  expect(normalizeIp("1:2:0:0:5:6:7:8")).toEqual("1:2::5:6:7:8");
  expect(normalizeIp("1:2:0:0:0:6:7:8")).toEqual("1:2::6:7:8");
  expect(normalizeIp("1:0:0:0:0:0:0:8")).toEqual("1::8");

  expect(jsonStringifyBigInt(parseIp("::"))).toEqual(`{"number":"0","version":6}`);

  const {number, version} = parseIp("255.255.255.255");
  expect(stringifyIp({number, version})).toEqual("255.255.255.255");

  expect(ipVersion("1.2.3.4")).toEqual(4);
  expect(ipVersion("::1.2.3.4")).toEqual(6);
  expect(ipVersion("::")).toEqual(6);
  expect(ipVersion("foo")).toEqual(0);
});
