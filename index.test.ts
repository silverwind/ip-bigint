import {parseIp, normalizeIp, max4, max6, ipVersion, stringifyIp, type NormalizeOpts} from "./index.ts";

function expectEach<T>(cases: Record<string, T>, fn: (ip: string) => T) {
  expect(Object.fromEntries(Object.keys(cases).map(ip => [ip, fn(ip)]))).toEqual(cases);
}

test("parseIp", () => {
  expectEach({
    "0.0.0.0": {number: 0n, version: 4},
    "255.255.255.255": {number: max4, version: 4},
    "::": {number: 0n, version: 6},
    "ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff": {number: max6, version: 6},
  }, ip => parseIp(ip));
  expect(parseIp("999.1.1.1", {validate: false}).version).toEqual(4);
  expect(JSON.stringify(parseIp("::"), (_, value) => typeof value === "bigint" ? value.toString() : value)).toEqual(`{"number":"0","version":6}`);
});

test("parseIp and normalizeIp throw on invalid input", () => {
  for (const ip of [
    "", "1", "1.2.3", "nope", "000.0.00.255", "01.02.03.04", "1.2.3.4%eth0",
    "::1::2", "fe80::1%", "6620:1ff2::00000", "::ffff:001.002.003.004",
  ]) {
    expect(() => parseIp(ip)).toThrow();
    expect(() => normalizeIp(ip)).toThrow();
  }
});

test("ipVersion", () => {
  expectEach({"1.2.3.4": 4, "::1.2.3.4": 6, "::": 6, "fe80::1%eth0": 6, "foo": 0, "999.1.1.1": 0}, ip => ipVersion(ip));
});

test("stringifyIp", () => {
  expect(stringifyIp({number: max4, version: 4})).toEqual("255.255.255.255");
  expect(stringifyIp(parseIp("::ffff:10.0.0.1"), {mapv4: true})).toEqual("10.0.0.1");
});

test("normalizeIp", () => {
  const unchanged = [
    "0.0.0.0", "0.0.0.255", "0.0.255.255", "0.255.16.255", "128.0.0.255", "100.200.100.200",
    "::", "::ffff", "::ffff:ffff", "ffff::", "ffff::ffff", "123:456:ffff::", "6620:0:1ff2::",
    "::ffff:191.239.213.197", "::ffff:127.0.0.1", "::ffff:255.255.255.255", "::%en1", "fe80::1%eth0",
    "1:2:0:4:5:6:7:8", "1:0:3:4:5:6:7:8", "2001:db8:0:1:1:1:1:1",
  ];
  expect(unchanged.map(ip => normalizeIp(ip))).toEqual(unchanged);

  for (const [opts, cases] of [
    [undefined, {
      "::0001": "::1", "0::ffff": "::ffff", "123:456:0:0::ffff": "123:456::ffff",
      "2001:0000:0000:0db8:0000:0000:0000:0001": "2001:0:0:db8::1", "2001:0:0:0db8:0:0:0:1": "2001:0:0:db8::1",
      "0:0:0:4:5:6:7:8": "::4:5:6:7:8", "1:2:3:00:00::0": "1:2:3::", "1:0:0:0:0:0:0:1": "1::1",
      "1:0:0:0:0:0:0:8": "1::8", "1:0:0:2:3:0:0:1": "1::2:3:0:0:1", "1:2:0:0:5:6:7:8": "1:2::5:6:7:8",
      "1:2:0:0:0:6:7:8": "1:2::6:7:8", "1080::8:800:200C:417A": "1080::8:800:200c:417a",
      "1080::0:0:200C:417A": "1080::200c:417a", "2001:db8::0:0:1": "2001:db8::1", "6620:0000:1ff2::": "6620:0:1ff2::",
      "6620:1ff2::0": "6620:1ff2::", "0:0:0:0:0:ffff:127.0.0.1": "::ffff:127.0.0.1",
    }],
    [{validate: false}, {"01.02.03.04": "1.2.3.4", "::ffff:0127.0000.00.001": "::ffff:127.0.0.1"}],
    [{hexify: true}, {"::0001": "::1", "::FFFF:34.90.242.162": "::ffff:225a:f2a2"}],
    [{compress: false}, {
      "::1": "0:0:0:0:0:0:0:1", "1::1": "1:0:0:0:0:0:0:1", "6620:1ff2::": "6620:1ff2:0:0:0:0:0:0",
      "::ffff:127.0.0.1": "0:0:0:0:0:ffff:127.0.0.1",
    }],
    [{hexify: true, compress: false}, {"::ffff:127.0.0.1": "0:0:0:0:0:ffff:7f00:1"}],
    [{mapv4: false}, {"::ffff:127.0.0.1": "::ffff:127.0.0.1"}],
    [{mapv4: true}, {
      "::ffff:127.0.0.1": "127.0.0.1", "::ffff:192.168.1.1": "192.168.1.1", "::ffff:0.0.0.0": "0.0.0.0",
      "::ffff:255.255.255.255": "255.255.255.255", "127.0.0.1": "127.0.0.1", "2001:db8::1": "2001:db8::1", "::": "::",
      "64:ff9b::1.2.3.4": "64:ff9b::102:304", "::1.2.3.4": "::102:304",
    }],
  ] satisfies Array<[NormalizeOpts | undefined, Record<string, string>]>) {
    expectEach(cases, ip => normalizeIp(ip, opts));
  }
});

test("unchecked short IPv6 does not reuse the previous address's groups", () => {
  expect(normalizeIp("a:b:c:d:e:f:1:2")).toEqual("a:b:c:d:e:f:1:2");
  expect(normalizeIp("a:b:c", {validate: false})).toEqual("a:b:c::");
});
