# ip-bigint
[![](https://img.shields.io/npm/v/ip-bigint.svg?style=flat)](https://www.npmjs.org/package/ip-bigint) [![](https://img.shields.io/npm/dm/ip-bigint.svg)](https://www.npmjs.org/package/ip-bigint) [![](https://img.shields.io/bundlephobia/minzip/ip-bigint.svg)](https://bundlephobia.com/package/ip-bigint) [![](https://packagephobia.com/badge?p=ip-bigint)](https://packagephobia.com/result?p=ip-bigint) [![](https://depx.co/api/badge/ip-bigint)](https://depx.co/pkg/ip-bigint)

> Convert IPv4 and IPv6 addresses to and from BigInt. Compliant with [RFC 5952](https://datatracker.ietf.org/doc/html/rfc5952) and [RFC 4291](https://datatracker.ietf.org/doc/html/rfc4291).

## Usage

```sh
pnpm add ip-bigint
```

```js
import {parseIp, stringifyIp, normalizeIp} from "ip-bigint";

const parsedIp = parseIp("2001:db8::");
// => {number: 42540766411282592856903984951653826560n, version: 6}

stringifyIp(parsedIp);
// => "2001:db8::"

normalizeIp("2001:db8::0:0:1");
// => "2001:db8::1"
```

## API

### parseIp(ip: string, opts?: ParseOpts)

Parse an IP address string to a `ParsedIP` object. Throws if the string is not a valid IP address.

For IPv4 returns `{number, version}`.
For IPv6 returns `{number, version, [ipv4mapped], [scopeid]}`.

`opts`: Options `ParseOpts`
  - `validate`: boolean - Whether to reject strings that are not well-formed IP addresses. Default: `true`.

Validation uses [cidr-regex](https://github.com/silverwind/cidr-regex), so it follows the addressing rules: zero-padded IPv4 octets (`01.02.03.04`), IPv6 groups longer than four hex digits, and empty or otherwise malformed scope ids are all rejected. Versions before 10 accepted these and parsed them leniently.

Passing `validate: false` skips the check for input already known to be valid, at the cost of the guarantee: malformed input is then parsed on a best-effort basis and can produce an IPv4 number above `max4`.

### stringifyIp({number, version, [ipv4mapped], [scopeid]}: ParsedIP, opts?: StringifyOpts)

Convert a `ParsedIP` object back to an IP address string.

`opts`: Options `StringifyOpts`
  - `compress`: boolean - Whether to compress the IP. For IPv6, this means the "best representation" all-lowercase shortest possible form. Default: `true`.
  - `hexify`: boolean - Whether to convert IPv4-Mapped IPv6 addresses to hex. Default: `false`.
  - `mapv4`: boolean - Whether to convert IPv4-Mapped IPv6 addresses (e.g. `::ffff:127.0.0.1`) to plain IPv4 (e.g. `127.0.0.1`). Default: `false`.

### normalizeIp(ip: string, opts?: NormalizeOpts)

Round-trip an IP address through `parseIp` and `stringifyIp`, effectively normalizing its representation.

`opts`: Options `NormalizeOpts`, which is `validate` plus every `StringifyOpts` key, as documented above.

### max4

A `bigint` value that holds the biggest possible IPv4 address.

### max6

A `bigint` value that holds the biggest possible IPv6 address.

### ipVersion(ip: string)

Returns an integer of the IP version, 4, 6 or 0 if it's not a valid IP address. Before version 10 this only looked for the first `.` or `:`, so it reported a version for malformed strings like `999.1.1.1`, which now return 0.

## Related

- [is-cidr](https://github.com/silverwind/is-cidr) - Check if a string is an IP address in CIDR notation
- [cidr-regex](https://github.com/silverwind/cidr-regex) - Regular expression for matching IP addresses in CIDR notation and bare IP addresses
- [cidr-tools](https://github.com/silverwind/cidr-tools) - Tools to work with IPv4 and IPv6 CIDR network lists

© [silverwind](https://github.com/silverwind), distributed under BSD licence
