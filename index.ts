import {v4 as v4Re, v6 as v6Re} from "cidr-regex";

const re4 = v4Re({exact: true, prefix: "none"});
const re6 = v6Re({exact: true, prefix: "none"});

/** Biggest possible IPv4 address as a BigInt */
export const max4: bigint = 0xFFFFFFFFn;
/** Biggest possible IPv6 address as a BigInt */
export const max6: bigint = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFn;

/** IP version: `4` for IPv4, `6` for IPv6, `0` for invalid */
export type IPVersion = 4 | 6 | 0;

/** Result of parsing an IP address string */
export type ParsedIP = {
  /** Numeric representation of the IP address */
  number: bigint,
  /** IP version: `4` for IPv4, `6` for IPv6 */
  version: 4 | 6,
  /** Whether this is an IPv4-mapped IPv6 address (e.g. `::ffff:127.0.0.1`) */
  ipv4mapped?: boolean,
  /** IPv6 scope ID (the part after `%`, e.g. `eth0` in `fe80::1%eth0`), validated by cidr-regex */
  scopeid?: string,
};

/** Options for `parseIp` */
export type ParseOpts = {
  /** Whether to reject strings that are not well-formed IP addresses. Default: `true` */
  validate?: boolean,
};

/** Options for `stringifyIp` */
export type StringifyOpts = {
  /** Whether to compress IPv6 using `::` for longest zero run. Default: `true` */
  compress?: boolean,
  /** Whether to render IPv4-mapped IPv6 addresses in hex instead of dotted decimal. Default: `false` */
  hexify?: boolean,
  /** Whether to convert IPv4-mapped IPv6 addresses to plain IPv4. Default: `false` */
  mapv4?: boolean,
};

/** Options for `normalizeIp` */
export type NormalizeOpts = {
  /** Whether to reject strings that are not well-formed IP addresses. Default: `true` */
  validate?: boolean,
  /** Whether to compress IPv6 using `::` for longest zero run. Default: `true` */
  compress?: boolean,
  /** Whether to render IPv4-mapped IPv6 addresses in hex instead of dotted decimal. Default: `false` */
  hexify?: boolean,
  /** Whether to convert IPv4-mapped IPv6 addresses to plain IPv4. Default: `false` */
  mapv4?: boolean,
};

/** Returns the IP version: `4`, `6`, or `0` if not a valid IP */
export function ipVersion(ip: string): IPVersion {
  const version = ipFamily(ip);
  if (!version) return 0;
  return (version === 4 ? re4 : re6).test(ip) ? version : 0;
}

/** Which family a string is shaped like, before it is known to be valid. `0` is neither. */
function ipFamily(ip: string): 4 | 6 | 0 {
  for (let i = 0; i < ip.length; i++) {
    const c = ip.charCodeAt(i);
    if (c === 58) return 6; // ':'
    if (c === 46) return 4; // '.'
  }
  return 0;
}

/** Reusable buffer holding the 8 IPv6 groups of the address being parsed or stringified */
const groups = [0, 0, 0, 0, 0, 0, 0, 0];

const byteHex = new Array<string>(256);
const byteHexPad = new Array<string>(256);
for (let idx = 0; idx < 256; idx++) {
  byteHex[idx] = idx.toString(16);
  byteHexPad[idx] = idx.toString(16).padStart(2, "0");
}

/** Maps a char code to its hex digit value, or to a negative marker for the IPv6 separators */
const charValue = new Int8Array(256).fill(-4);
for (let idx = 0; idx < 10; idx++) charValue[48 + idx] = idx;
for (let idx = 0; idx < 6; idx++) charValue[97 + idx] = charValue[65 + idx] = 10 + idx;
charValue[58] = -1; // ':'
charValue[46] = -2; // '.'
charValue[37] = -3; // '%'

/** Shared DataView for BigInt to/from IPv6 groups conversion */
const extractView = new DataView(new ArrayBuffer(16));

/** Pack the 8 uint16 groups into a BigInt, minimizing the number of BigInt operations */
function packGroups(): bigint {
  const w0 = ((groups[0] << 16) | groups[1]) >>> 0;
  const w1 = ((groups[2] << 16) | groups[3]) >>> 0;
  const w2 = ((groups[4] << 16) | groups[5]) >>> 0;
  const w3 = ((groups[6] << 16) | groups[7]) >>> 0;

  // `::`-prefixed low addresses are the most common sparse shape and need a single BigInt op
  if (!w0 && !w1 && !w2) return BigInt(w3);
  if (!w0 && !w1 && w2 === 0xffff) return BigInt(0xffff00000000 + w3);

  // dense address: assembling two uint64s through the DataView beats four BigInt conversions
  if (w0 && w1 && w2 && w3) {
    extractView.setUint32(0, w0, false);
    extractView.setUint32(4, w1, false);
    extractView.setUint32(8, w2, false);
    extractView.setUint32(12, w3, false);
    return (extractView.getBigUint64(0, false) << 64n) | extractView.getBigUint64(8, false);
  }

  // sparse address, as `::` forms tend to be: every zero word skipped is a BigInt op saved
  let num = w0 ? BigInt(w0) << 96n : 0n;
  if (w1) num |= BigInt(w1) << 64n;
  if (w2) num |= BigInt(w2) << 32n;
  if (w3) num |= BigInt(w3);
  return num;
}

/** Decode a dotted-decimal octet whose digits were accumulated one per nibble */
function nibblesToDecimal(v: number): number {
  return (v >> 8) * 100 + ((v >> 4) & 0xf) * 10 + (v & 0xf);
}

/** Parse an IP address string into a `ParsedIP` object */
export function parseIp(ip: string, opts?: ParseOpts): ParsedIP {
  const version = opts?.validate === false ? ipFamily(ip) : ipVersion(ip);
  if (!version) throw new Error(`Invalid IP address: ${ip}`);
  const len = ip.length;

  if (version === 4) {
    let num = 0;
    let octet = 0;
    for (let i = 0; i < len; i++) {
      const c = ip.charCodeAt(i);
      if (c === 46) { // '.'
        num = num * 256 + octet;
        octet = 0;
      } else {
        octet = octet * 10 + c - 48;
      }
    }
    return {number: BigInt(num * 256 + octet), version: 4};
  }

  let scopeid: string | undefined;
  let count = 0;
  let doubleColonAt = -1;
  let currentHex = 0;
  let hasValue = false;
  let inDottedPart = false;
  let dottedVal = 0;

  for (let i = 0; i < len; i++) {
    const v = charValue[ip.charCodeAt(i)];

    if (v >= 0) { // hex digit
      currentHex = (currentHex << 4) | v;
      hasValue = true;
    } else if (v === -1) { // ':'
      if (hasValue) {
        groups[count++] = currentHex;
        currentHex = 0;
        hasValue = false;
      } else if (i) { // second colon of a `::`, excluding the leading colon of forms like `::1`
        doubleColonAt = count;
      }
    } else if (v === -2) { // '.'
      const octet = nibblesToDecimal(currentHex);
      dottedVal = inDottedPart ? dottedVal * 256 + octet : octet;
      inDottedPart = true;
      currentHex = 0;
      hasValue = false;
    } else { // '%'
      scopeid = ip.slice(i + 1);
      break;
    }
  }

  if (inDottedPart) {
    dottedVal = dottedVal * 256 + nibblesToDecimal(currentHex);
    groups[count++] = (dottedVal >>> 16) & 0xffff;
    groups[count++] = dottedVal & 0xffff;
  } else if (hasValue) {
    groups[count++] = currentHex;
  }

  // Expand `::` by moving the groups after it to the end and zero-filling the gap
  if (doubleColonAt !== -1) {
    for (let src = count - 1, dst = 7; src >= doubleColonAt; src--, dst--) {
      groups[dst] = groups[src];
    }
    for (let idx = doubleColonAt, end = doubleColonAt + 8 - count; idx < end; idx++) {
      groups[idx] = 0;
    }
  }

  const number = packGroups();
  const res: ParsedIP = {number, version: 6};
  // Only mark as IPv4-mapped for actual ::ffff:0:0/96 addresses (RFC 5952 Section 5)
  if (inDottedPart && number >= 0xffff00000000n && number <= 0xffffffffffffn) res.ipv4mapped = true;
  if (scopeid) res.scopeid = scopeid;
  return res;
}

/** Extract 8 IPv6 groups as uint16 values from a BigInt */
function extractGroups(number: bigint): void {
  if (number <= max4) {
    const n = Number(number);
    groups[0] = 0; groups[1] = 0; groups[2] = 0; groups[3] = 0;
    groups[4] = 0; groups[5] = 0;
    groups[6] = (n >>> 16) & 0xffff;
    groups[7] = n & 0xffff;
    return;
  }
  extractView.setBigUint64(0, number >> 64n, false);
  extractView.setBigUint64(8, number, false);
  groups[0] = extractView.getUint16(0, false);
  groups[1] = extractView.getUint16(2, false);
  groups[2] = extractView.getUint16(4, false);
  groups[3] = extractView.getUint16(6, false);
  groups[4] = extractView.getUint16(8, false);
  groups[5] = extractView.getUint16(10, false);
  groups[6] = extractView.getUint16(12, false);
  groups[7] = extractView.getUint16(14, false);
}

/** Convert a 32-bit number to dotted-decimal IPv4 string */
function ipv4Dotted(num: number): string {
  return `${(num >>> 24) & 0xff}.${(num >>> 16) & 0xff}.${(num >>> 8) & 0xff}.${num & 0xff}`;
}

/** Convert a `ParsedIP` object back to an IP address string */
export function stringifyIp({number, version, ipv4mapped, scopeid}: ParsedIP, {compress = true, hexify = false, mapv4 = false}: StringifyOpts = {}): string {
  if (version === 4) {
    return ipv4Dotted(Number(number));
  }

  if (compress && !ipv4mapped && !scopeid && number <= max4) {
    return compressSmallV6(Number(number));
  }

  // mapv4: convert true ::ffff:x.x.x.x mapped addresses (the ::ffff:0:0/96 range) to plain IPv4
  if (ipv4mapped && mapv4 && number >= 0xffff00000000n && number <= 0xffffffffffffn) {
    return ipv4Dotted(Number(number & 0xffffffffn));
  }

  extractGroups(number);

  const isMapped = ipv4mapped && !hexify;
  const count = isMapped ? 6 : 8;
  const suffix = isMapped ? ipv4Dotted((groups[6] << 16) | groups[7]) : undefined;
  const ip = compress ? compressIPv6(count, suffix) : joinHexGroups(count, suffix);

  return scopeid ? `${ip}%${scopeid}` : ip;
}

/** Round-trip an IP address through `parseIp` and `stringifyIp`, normalizing its representation */
export function normalizeIp(ip: string, opts?: NormalizeOpts): string {
  return stringifyIp(parseIp(ip, opts), opts);
}

/** Convert a uint16 to a minimal hex string */
function uint16Hex(v: number): string {
  if (v < 256) return byteHex[v];
  return byteHex[v >> 8] + byteHexPad[v & 0xff];
}

/** Join IPv6 hex groups with `:` separators, `count` being 6 for a v4-mapped address and 8 otherwise */
function joinHexGroups(count: number, suffix?: string): string {
  // one flat expression: engines build this with far fewer intermediate strings than a `+=` loop
  let result = `${uint16Hex(groups[0])}:${uint16Hex(groups[1])}:${uint16Hex(groups[2])}:${uint16Hex(groups[3])}:${uint16Hex(groups[4])}:${uint16Hex(groups[5])}`;
  if (count === 8) result += `:${uint16Hex(groups[6])}:${uint16Hex(groups[7])}`;
  if (suffix !== undefined) result += `:${suffix}`;
  return result;
}

/** Fast path: compressed IPv6 of a value fitting in 32 bits, pre-converted to number (no v4-mapped, no scope id) */
function compressSmallV6(n: number): string {
  if (n === 0) return "::";
  if (n < 0x10000) return `::${uint16Hex(n)}`;
  return `::${uint16Hex(n >>> 16)}:${uint16Hex(n & 0xffff)}`;
}

/** Compress IPv6 by replacing the longest zero-group run with `::` (RFC 5952 Section 4.2) */
function compressIPv6(count: number, suffix?: string): string {
  let longestStart = -1;
  let longestLen = 0;
  let currentLen = 0;

  // strict `>` keeps the first of several equally long runs (RFC 5952 section 4.2.3)
  for (let i = 0; i < count; i++) {
    if (groups[i] === 0) {
      currentLen++;
      if (currentLen > longestLen) {
        longestLen = currentLen;
        longestStart = i - currentLen + 1;
      }
    } else {
      currentLen = 0;
    }
  }

  // Only compress if we have 2 or more consecutive zeros (RFC 5952 section 4.2.2)
  if (longestLen >= 2) {
    let result = longestStart > 0 ? uint16Hex(groups[0]) : "";
    for (let i = 1; i < longestStart; i++) {
      result += `:${uint16Hex(groups[i])}`;
    }
    result += "::";
    const afterZeroRun = longestStart + longestLen;
    if (afterZeroRun < count) {
      result += uint16Hex(groups[afterZeroRun]);
      for (let i = afterZeroRun + 1; i < count; i++) {
        result += `:${uint16Hex(groups[i])}`;
      }
    }
    if (suffix !== undefined) {
      if (afterZeroRun < count) result += ":";
      result += suffix;
    }
    return result;
  }

  return joinHexGroups(count, suffix);
}
