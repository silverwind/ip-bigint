# ip-bigint
[![](https://img.shields.io/npm/v/ip-bigint.svg?style=flat)](https://www.npmjs.org/package/ip-bigint) [![](https://img.shields.io/npm/dm/ip-bigint.svg)](https://www.npmjs.org/package/ip-bigint) [![](https://api.travis-ci.org/silverwind/ip-bigint.svg?style=flat)](https://travis-ci.org/silverwind/ip-bigint)

> Convert IPv4 and IPv6 addresses to native BigInt and vice-versa

## Installation

```
$ npm i ip-bigint
```

## Example

```js
const {parse, stringify} = require("ip-bigint");

const {num, version} = parse("2001:db8::");
// => { num: 42540766411282592856903984951653826560n, version: 6 }

const ip = stringify({num, version});
// => "2001:db8::""

```

## API

### parse(ip)

Parse a IP address string. Returns `{num, version}`.

### stringify({num, version})

Convert a parsed IP object to string. Returns `ip`. For IPv6, `ip` is normalized to the "best representation" all-lowercase shortest possible form.

### Constants

The module additionally exports `max4` and `max6` properties which represent the biggest possible BigInt for IPv4 and IPv6 respectively.

## License

© [silverwind](https://github.com/silverwind), distributed under BSD licence
