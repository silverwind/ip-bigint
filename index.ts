export const max4: bigint = 2n ** 32n - 1n;
export const max6: bigint = 2n ** 128n - 1n;

export type IPVersion = 4 | 6 | 0;

export type ParsedIP = {
  number: bigint,
  version: IPVersion,
  ipv4mapped?: boolean,
  scopeid?: string,
};

export type StringifyOpts = {
  compress?: boolean,
  hexify?: boolean,
};

export function ipVersion(ip: string): IPVersion {
  return ip.includes(":") ? 6 : ip.includes(".") ? 4 : 0;
}

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

  // IPv6: single-pass char-by-char parsing
  let ipv4mapped: boolean | undefined;
  let scopeid: string | undefined;
  let end = ip.length;

  const pctIdx = ip.indexOf("%");
  if (pctIdx !== -1) {
    scopeid = ip.slice(pctIdx + 1);
    end = pctIdx;
  }

  let leftNum = 0n;
  let leftCount = 0;
  let rightNum = 0n;
  let hasDoubleColon = false;
  let currentHex = 0;
  let currentDec = 0;
  let hasValue = false;
  let inDottedPart = false;
  let dottedVal = 0;

  for (let i = 0; i < end; i++) {
    const c = ip.charCodeAt(i);

    if (c === 58) { // ':'
      if (hasValue) {
        if (hasDoubleColon) {
          rightNum = (rightNum << 16n) | BigInt(currentHex);
        } else {
          leftNum = (leftNum << 16n) | BigInt(currentHex);
          leftCount++;
        }
        currentHex = 0;
        currentDec = 0;
        hasValue = false;
      }
      if (i + 1 < end && ip.charCodeAt(i + 1) === 58) {
        hasDoubleColon = true;
        i++;
      }
    } else if (c === 46) { // '.'
      if (!inDottedPart) {
        inDottedPart = true;
        ipv4mapped = true;
        dottedVal = currentDec;
      } else {
        dottedVal = dottedVal * 256 + currentDec;
      }
      currentHex = 0;
      currentDec = 0;
      hasValue = false;
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
      rightNum = (rightNum << 32n) | BigInt(dottedVal);
    } else {
      leftNum = (leftNum << 32n) | BigInt(dottedVal);
      leftCount += 2;
    }
  } else if (hasValue) {
    if (hasDoubleColon) {
      rightNum = (rightNum << 16n) | BigInt(currentHex);
    } else {
      leftNum = (leftNum << 16n) | BigInt(currentHex);
      leftCount++;
    }
  }

  // Build 128-bit number
  const number = hasDoubleColon ?
    (leftNum << BigInt((8 - leftCount) * 16)) | rightNum :
    leftNum;

  const res: ParsedIP = {number, version: 6};
  if (ipv4mapped) res.ipv4mapped = ipv4mapped;
  if (scopeid) res.scopeid = scopeid;
  return res;
}

// Extract 8 IPv6 groups as uint16 numbers from a BigInt via hex string conversion.
// Replaces 8 BigInt operations (4 masks + 4 shifts) with a single BigInt.toString(16) call.
function extractGroups(number: bigint, groups: number[]): void {
  const hex = number.toString(16);
  const hLen = hex.length;
  for (let i = 7; i >= 0; i--) {
    const gEnd = hLen - (7 - i) * 4;
    const gStart = gEnd - 4;
    if (gEnd <= 0) {
      groups[i] = 0;
    } else if (gStart >= 0) {
      const c0 = hex.charCodeAt(gStart);
      const c1 = hex.charCodeAt(gStart + 1);
      const c2 = hex.charCodeAt(gStart + 2);
      const c3 = hex.charCodeAt(gStart + 3);
      groups[i] = ((c0 <= 57 ? c0 - 48 : c0 - 87) << 12) |
                  ((c1 <= 57 ? c1 - 48 : c1 - 87) << 8) |
                  ((c2 <= 57 ? c2 - 48 : c2 - 87) << 4) |
                   (c3 <= 57 ? c3 - 48 : c3 - 87);
    } else {
      let val = 0;
      for (let j = 0; j < gEnd; j++) {
        const c = hex.charCodeAt(j);
        val = (val << 4) | (c <= 57 ? c - 48 : c - 87);
      }
      groups[i] = val;
    }
  }
}

export function stringifyIp({number, version, ipv4mapped, scopeid}: ParsedIP, {compress = true, hexify = false}: StringifyOpts = {}): string {
  if (version === 4) {
    const num = Number(number);
    return `${(num >>> 24) & 0xff}.${(num >>> 16) & 0xff}.${(num >>> 8) & 0xff}.${num & 0xff}`;
  } else {
    let ip = "";

    if (ipv4mapped && !hexify) {
      const groups = new Array(8);
      extractGroups(number, groups);
      const ipv4Num = (groups[6] << 16) | groups[7];
      const ipv4Str = `${(ipv4Num >>> 24) & 0xff}.${(ipv4Num >>> 16) & 0xff}.${(ipv4Num >>> 8) & 0xff}.${ipv4Num & 0xff}`;
      ip = compress ? compressIPv6(groups, 6, ipv4Str) : joinHexGroups(groups, 6, ipv4Str);
    } else {
      const groups = new Array(8);
      extractGroups(number, groups);
      ip = compress ? compressIPv6(groups, 8) : joinHexGroups(groups, 8);
    }

    return scopeid ? `${ip}%${scopeid}` : ip;
  }
}

export function normalizeIp(ip: string, {compress = true, hexify = false}: StringifyOpts = {}): string {
  return stringifyIp(parseIp(ip), {compress, hexify});
}

function joinHexGroups(groups: number[], count: number, suffix?: string): string {
  let result = groups[0].toString(16);
  for (let i = 1; i < count; i++) {
    result += `:${groups[i].toString(16)}`;
  }
  if (suffix !== undefined) result += `:${suffix}`;
  return result;
}

// take the longest or first sequence of 0 groups and replace it with "::"
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
      result += groups[i].toString(16);
    }
    result += "::";
    let first = true;
    for (let i = longestStart + longestLen; i < count; i++) {
      if (!first) result += ":";
      first = false;
      result += groups[i].toString(16);
    }
    if (suffix !== undefined) {
      if (!first) result += ":";
      result += suffix;
    }
    return result;
  }

  return joinHexGroups(groups, count, suffix);
}
