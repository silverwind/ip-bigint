# ip-bigint
[![](https://img.shields.io/npm/v/ip-bigint.svg?style=flat)](https://www.npmjs.org/package/ip-bigint) [![](https://img.shields.io/npm/dm/ip-bigint.svg)](https://www.npmjs.org/package/ip-bigint) [![](https://img.shields.io/bundlephobia/minzip/ip-bigint.svg)](https://bundlephobia.com/package/ip-bigint)

> Convert IPv4 and IPv6 addresses to native BigInt and vice-versa

## Install

```
npm i ip-bigint
```

## Example

```js
import {parseIp, stringifyIp} from "ip-bigint";

parseIp("2001:db8::");
// => {number: 42540766411282592856903984951653826560n, version: 6}

stringifyIp({number, version});
// => "2001:db8::"

normalizeIp("2001:db8::0:0:1")
// => "2001:db8::1"

```

## API

### parseIp(ip)

Parse a IP address string to a object (with null prototype).

For IPv4 returns `{number, version}`.
For IPv6 returns `{number, version, [ipv4mapped], [scopeid]}`.

There is only rudimentary validation that the passed string is actually an IP address. You are encouraged to validate yourself using modules like `ip-regex`.

### stringifyIp({number, version, [ipv4mapped], [scopeid]})

Convert a object to string. Returns `ip`. For IPv6, `ip` is normalized to the "best representation" all-lowercase shortest possible form.

### normalizeIp(ip)

Round-trip an IP address through `parseIp` and `stringifyIp`, effectively normalizing its representation.

### Constants

The module exports `max4` and `max6` properties which represent the biggest possible BigInt for IPv4 and IPv6 respectively.

## License

© [silverwind](https://github.com/silverwind), distributed under BSD licence
