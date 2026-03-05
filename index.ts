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

export function stringifyIp({number, version, ipv4mapped, scopeid}: ParsedIP, {compress = true, hexify = false}: StringifyOpts = {}): string {
  if (version === 4) {
    const num = Number(number);
    return `${(num >>> 24) & 0xff}.${(num >>> 16) & 0xff}.${(num >>> 8) & 0xff}.${num & 0xff}`;
  } else {
    let ip = "";

    if (ipv4mapped && !hexify) {
      const parts: string[] = new Array(7);
      let n = number;
      const ipv4Word = Number(n & 0xffffffffn);
      n >>= 32n;
      parts[6] = `${(ipv4Word >>> 24) & 0xff}.${(ipv4Word >>> 16) & 0xff}.${(ipv4Word >>> 8) & 0xff}.${ipv4Word & 0xff}`;
      for (let i = 2; i >= 0; i--) {
        const pair = Number(n & 0xffffffffn);
        parts[i * 2 + 1] = (pair & 0xffff).toString(16);
        parts[i * 2] = (pair >>> 16).toString(16);
        n >>= 32n;
      }
      ip = compress ? compressIPv6(parts) : parts.join(":");
    } else {
      const parts: string[] = new Array(8);
      let n = number;
      for (let i = 3; i >= 0; i--) {
        const pair = Number(n & 0xffffffffn);
        parts[i * 2 + 1] = (pair & 0xffff).toString(16);
        parts[i * 2] = (pair >>> 16).toString(16);
        n >>= 32n;
      }
      ip = compress ? compressIPv6(parts) : parts.join(":");
    }

    return scopeid ? `${ip}%${scopeid}` : ip;
  }
}

export function normalizeIp(ip: string, {compress = true, hexify = false}: StringifyOpts = {}): string {
  return stringifyIp(parseIp(ip), {compress, hexify});
}

// take the longest or first sequence of "0" segments and replace it with "::"
function compressIPv6(parts: Array<string>): string {
  let longestStart = -1;
  let longestLen = 0;
  let currentStart = -1;
  let currentLen = 0;

  for (let i = 0; i < parts.length; i++) {
    if (parts[i] === "0") {
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
      result += parts[i];
    }
    result += "::";
    let first = true;
    for (let i = longestStart + longestLen; i < parts.length; i++) {
      if (!first) result += ":";
      first = false;
      result += parts[i];
    }
    return result;
  }

  return parts.join(":");
}
