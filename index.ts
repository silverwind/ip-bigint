/** Biggest possible IPv4 address as a BigInt */
export const max4: bigint = 2n ** 32n - 1n;
/** Biggest possible IPv6 address as a BigInt */
export const max6: bigint = 2n ** 128n - 1n;

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
  /** IPv6 scope ID (the part after `%`, e.g. `eth0` in `fe80::1%eth0`) */
  scopeid?: string,
};

/** Options for `stringifyIp` and `normalizeIp` */
export type StringifyOpts = {
  /** Whether to compress IPv6 using `::` for longest zero run. Default: `true` */
  compress?: boolean,
  /** Whether to render IPv4-mapped IPv6 addresses in hex instead of dotted decimal. Default: `false` */
  hexify?: boolean,
  /** Whether to convert IPv4-mapped IPv6 addresses to plain IPv4. Default: `false` */
  mapv4?: boolean,
};

/** Returns the IP version: `4`, `6`, or `0` if not a valid IP */
export function ipVersion(ip: string): IPVersion {
  for (let i = 0; i < ip.length; i++) {
    const c = ip.charCodeAt(i);
    if (c === 58) return 6; // ':'
    if (c === 46) return 4; // '.'
  }
  return 0;
}

/** Reusable buffer for collecting IPv6 groups left of `::` */
const leftGroups = [0, 0, 0, 0, 0, 0, 0, 0];
/** Reusable buffer for collecting IPv6 groups right of `::` */
const rightGroups = [0, 0, 0, 0, 0, 0, 0, 0];
/** Pre-computed shift amounts for `::` BigInt construction (indexed by group count 1-7) */
const shiftAmounts = [0n, 112n, 96n, 80n, 64n, 48n, 32n, 16n];

/** Precomputed decimal strings for bytes 0-255 */
const octetStrings = new Array<string>(256);
/** Precomputed unpadded hex strings for bytes 0-255 */
const byteHex = new Array<string>(256);
/** Precomputed zero-padded hex strings for bytes 0-255 */
const byteHexPad = new Array<string>(256);
for (let i = 0; i < 256; i++) {
  octetStrings[i] = String(i);
  byteHex[i] = i.toString(16);
  byteHexPad[i] = i.toString(16).padStart(2, "0");
}

/** Shared DataView for BigInt to/from IPv6 groups conversion */
const extractView = new DataView(new ArrayBuffer(16));

/** Parse an IP address string into a `ParsedIP` object */
export function parseIp(ip: string): ParsedIP {
  const version = ipVersion(ip);
  if (!version) throw new Error(`Invalid IP address: ${ip}`);

  if (version === 4) {
    let num = 0;
    let octet = 0;
    for (let i = 0; i < ip.length; i++) {
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

  // IPv6: single-pass char-by-char parsing, collecting uint16 groups
  let ipv4mapped: boolean | undefined;
  let scopeid: string | undefined;

  let leftCount = 0;
  let rightCount = 0;
  let hasDoubleColon = false;
  let currentHex = 0;
  let currentDec = 0;
  let hasValue = false;
  let inDottedPart = false;
  let dottedVal = 0;

  for (let i = 0; i < ip.length; i++) {
    const c = ip.charCodeAt(i);

    if (c === 58) { // ':'
      if (hasValue) {
        if (hasDoubleColon) {
          rightGroups[rightCount++] = currentHex;
        } else {
          leftGroups[leftCount++] = currentHex;
        }
        currentHex = 0;
        currentDec = 0;
        hasValue = false;
      }
      if (i + 1 < ip.length && ip.charCodeAt(i + 1) === 58) {
        hasDoubleColon = true;
        i++;
      }
    } else if (c === 46) { // '.'
      if (!inDottedPart) {
        inDottedPart = true;
        dottedVal = currentDec;
      } else {
        dottedVal = dottedVal * 256 + currentDec;
      }
      currentHex = 0;
      currentDec = 0;
      hasValue = false;
    } else if (c === 37) { // '%'
      scopeid = ip.slice(i + 1);
      break;
    } else {
      if (inDottedPart) {
        currentDec = currentDec * 10 + c - 48;
      } else {
        if (c <= 57) { // 0-9
          currentHex = (currentHex << 4) | (c - 48);
          currentDec = currentDec * 10 + c - 48;
        } else if (c >= 97) { // a-f
          currentHex = (currentHex << 4) | (c - 87);
        } else { // A-F
          currentHex = (currentHex << 4) | (c - 55);
        }
      }
      hasValue = true;
    }
  }

  // Handle last value
  if (inDottedPart) {
    dottedVal = dottedVal * 256 + currentDec;
    if (hasDoubleColon) {
      rightGroups[rightCount++] = (dottedVal >>> 16) & 0xffff;
      rightGroups[rightCount++] = dottedVal & 0xffff;
    } else {
      leftGroups[leftCount++] = (dottedVal >>> 16) & 0xffff;
      leftGroups[leftCount++] = dottedVal & 0xffff;
    }
  } else if (hasValue) {
    if (hasDoubleColon) {
      rightGroups[rightCount++] = currentHex;
    } else {
      leftGroups[leftCount++] = currentHex;
    }
  }

  // Build 128-bit BigInt, minimizing BigInt operations
  let number: bigint;
  if (!hasDoubleColon) {
    // Full address: all 8 groups, pack via DataView for fewer BigInt ops
    extractView.setUint32(0, ((leftGroups[0] << 16) | leftGroups[1]) >>> 0, false);
    extractView.setUint32(4, ((leftGroups[2] << 16) | leftGroups[3]) >>> 0, false);
    extractView.setUint32(8, ((leftGroups[4] << 16) | leftGroups[5]) >>> 0, false);
    extractView.setUint32(12, ((leftGroups[6] << 16) | leftGroups[7]) >>> 0, false);
    number = (extractView.getBigUint64(0, false) << 64n) | extractView.getBigUint64(8, false);
  } else {
    // Has ::, build left and right parts with 32-bit packing to reduce BigInt ops
    let leftNum = 0n;
    if (leftCount > 0) {
      let i = 0;
      for (; i + 1 < leftCount; i += 2) {
        leftNum = (leftNum << 32n) | BigInt(((leftGroups[i] << 16) | leftGroups[i + 1]) >>> 0);
      }
      if (i < leftCount) {
        leftNum = (leftNum << 16n) | BigInt(leftGroups[i]);
      }
    }
    let rightNum = 0n;
    if (rightCount > 0) {
      let i = 0;
      for (; i + 1 < rightCount; i += 2) {
        rightNum = (rightNum << 32n) | BigInt(((rightGroups[i] << 16) | rightGroups[i + 1]) >>> 0);
      }
      if (i < rightCount) {
        rightNum = (rightNum << 16n) | BigInt(rightGroups[i]);
      }
    }
    number = leftCount > 0 ? (leftNum << shiftAmounts[leftCount]) | rightNum : rightNum;
  }

  // Only mark as IPv4-mapped for actual ::ffff:0:0/96 addresses (RFC 5952 Section 5)
  if (inDottedPart && number >= 0xffff00000000n && number <= 0xffffffffffffn) {
    ipv4mapped = true;
  }

  const res: ParsedIP = {number, version: 6};
  if (ipv4mapped) res.ipv4mapped = ipv4mapped;
  if (scopeid) res.scopeid = scopeid;
  return res;
}

/** Extract 8 IPv6 groups as uint16 values from a BigInt */
function extractGroups(number: bigint, groups: number[]): void {
  const n = Number(number);
  if (n <= 0xFFFFFFFF) {
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
  return `${octetStrings[(num >>> 24) & 0xff]}.${octetStrings[(num >>> 16) & 0xff]}.${octetStrings[(num >>> 8) & 0xff]}.${octetStrings[num & 0xff]}`;
}

/** Convert a `ParsedIP` object back to an IP address string */
export function stringifyIp({number, version, ipv4mapped, scopeid}: ParsedIP, {compress = true, hexify = false, mapv4 = false}: StringifyOpts = {}): string {
  if (version === 4) {
    return ipv4Dotted(Number(number));
  } else {
    extractGroups(number, leftGroups);

    // mapv4: convert true ::ffff:x.x.x.x mapped addresses to plain IPv4
    if (ipv4mapped && mapv4 &&
        leftGroups[0] === 0 && leftGroups[1] === 0 && leftGroups[2] === 0 &&
        leftGroups[3] === 0 && leftGroups[4] === 0 && leftGroups[5] === 0xffff) {
      return ipv4Dotted((leftGroups[6] << 16) | leftGroups[7]);
    }

    let ip = "";
    if (ipv4mapped && !hexify) {
      const ipv4Num = (leftGroups[6] << 16) | leftGroups[7];
      const ipv4Str = ipv4Dotted(ipv4Num);
      ip = compress ? compressIPv6(leftGroups, 6, ipv4Str) : joinHexGroups(leftGroups, 6, ipv4Str);
    } else {
      ip = compress ? compressIPv6(leftGroups, 8) : joinHexGroups(leftGroups, 8);
    }

    return scopeid ? `${ip}%${scopeid}` : ip;
  }
}

/** Round-trip an IP address through `parseIp` and `stringifyIp`, normalizing its representation */
export function normalizeIp(ip: string, opts: StringifyOpts = {}): string {
  return stringifyIp(parseIp(ip), opts);
}

/** Convert a uint16 to a minimal hex string */
function uint16Hex(v: number): string {
  if (v < 256) return byteHex[v];
  return byteHex[v >> 8] + byteHexPad[v & 0xff];
}

/** Join IPv6 hex groups with `:` separators */
function joinHexGroups(groups: number[], count: number, suffix?: string): string {
  let result = uint16Hex(groups[0]);
  for (let i = 1; i < count; i++) {
    result += `:${uint16Hex(groups[i])}`;
  }
  if (suffix !== undefined) result += `:${suffix}`;
  return result;
}

/** Compress IPv6 by replacing the longest zero-group run with `::` (RFC 5952 Section 4.2) */
function compressIPv6(groups: number[], count: number, suffix?: string): string {
  let longestStart = -1;
  let longestLen = 0;
  let currentStart = -1;
  let currentLen = 0;

  for (let i = 0; i < count; i++) {
    if (groups[i] === 0) {
      if (currentStart === -1) {
        currentStart = i;
        currentLen = 1;
      } else {
        currentLen++;
      }
    } else {
      if (currentLen > longestLen) {
        longestStart = currentStart;
        longestLen = currentLen;
      }
      currentStart = -1;
      currentLen = 0;
    }
  }
  if (currentLen > longestLen) {
    longestStart = currentStart;
    longestLen = currentLen;
  }

  // Only compress if we have 2 or more consecutive zeros (RFC 5952 section 4.2.2)
  if (longestLen >= 2) {
    let result = "";
    for (let i = 0; i < longestStart; i++) {
      if (i > 0) result += ":";
      result += uint16Hex(groups[i]);
    }
    result += "::";
    let first = true;
    for (let i = longestStart + longestLen; i < count; i++) {
      if (!first) result += ":";
      first = false;
      result += uint16Hex(groups[i]);
    }
    if (suffix !== undefined) {
      if (!first) result += ":";
      result += suffix;
    }
    return result;
  }

  return joinHexGroups(groups, count, suffix);
}
