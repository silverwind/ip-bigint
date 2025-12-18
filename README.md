# ip-bigint
[![](https://img.shields.io/npm/v/ip-bigint.svg?style=flat)](https://www.npmjs.org/package/ip-bigint) [![](https://img.shields.io/npm/dm/ip-bigint.svg)](https://www.npmjs.org/package/ip-bigint) [![](https://img.shields.io/bundlephobia/minzip/ip-bigint.svg)](https://bundlephobia.com/package/ip-bigint) [![](https://packagephobia.com/badge?p=ip-bigint)](https://packagephobia.com/result?p=ip-bigint) [![](https://depx.co/api/badge/ip-bigint)](https://depx.co/pkg/ip-bigint)

> Convert IPv4 and IPv6 addresses to and from BigInt

## Usage

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

### parseIp(ip: string)

Parse a IP address string to a `ParsedIp` object.

For IPv4 returns `{number, version}`.
For IPv6 returns `{number, version, [ipv4mapped], [scopeid]}`.

There is only rudimentary validation that the passed string is actually an IP address. You are encouraged to validate yourself using modules like [`ip-regex`](https://github.com/sindresorhus/ip-regex).

### stringifyIp({number, version, [ipv4mapped], [scopeid]}: ParsedIp, opts?: StringifyOpts)

Convert a `ParsedIp` object back to an IP address string.

`opts`: Options `StringifyOpts`
  - `compress`: boolean - Whether to compress the IP. For IPv6, this means the "best representation" all-lowercase shortest possible form. Default: `true`.
  - `hexify`: boolean - Whether to convert IPv4-Mapped IPv6 addresses to hex. Default: `false`.

### normalizeIp(ip: string, opts?: StringifyOpts)

Round-trip an IP address through `parseIp` and `stringifyIp`, effectively normalizing its representation.

`opts`: Options `StringifyOpts`
  - `compress`: boolean - Whether to compress the IP. For IPv6, this means the "best representation" all-lowercase shortest possible form. Default: `true`.
  - `hexify`: boolean - Whether to convert IPv4-Mapped IPv6 addresses to hex. Default: `false`.

### max4

A `bigint` value that holds the biggest possible IPv4 address.

### max6

A `bigint` value that holds the biggest possible IPv6 address.

### ipVersion(ip: string)

Returns a integer of the IP version, 4, 6 or 0 if it's not an IP. Very rudimentary and should not be used for validation.

## Related

- [ip-regex](https://github.com/sindresorhus/ip-regex) - Regular expression for matching IP addresses
- [is-cidr](https://github.com/silverwind/is-cidr) - Check if a string is an IP address in CIDR notation
- [is-ip](https://github.com/sindresorhus/is-ip) - Check if a string is an IP address
- [cidr-regex](https://github.com/silverwind/cidr-regex) - Check if a string is an IP address in CIDR notation
- [cidr-tools](https://github.com/silverwind/cidr-tools) - Tools to work with IPv4 and IPv6 CIDR network lists

## License

© [silverwind](https://github.com/silverwind), distributed under BSD licence
