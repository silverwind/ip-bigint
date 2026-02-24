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

  const res: Partial<ParsedIP> = {};

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
    res.number = BigInt(num * 256 + octet);
  } else {
    if (ip.includes(".")) {
      res.ipv4mapped = true;
      ip = ip.split(":").map(part => {
        if (part.includes(".")) {
          const [a, b, c, d] = part.split(".").map(str => Number(str).toString(16).padStart(2, "0"));
          return `${a}${b}:${c}${d}`;
        } else {
          return part;
        }
      }).join(":");
    }

    if (ip.includes("%")) {
      const pctIdx = ip.indexOf("%");
      res.scopeid = ip.slice(pctIdx + 1);
      ip = ip.slice(0, pctIdx);
    }

    const parts = ip.split(":");
    const index = parts.indexOf("");

    let num = 0n;
    if (index !== -1) {
      let emptyEnd = index;
      while (emptyEnd < parts.length && parts[emptyEnd] === "") emptyEnd++;
      const missing = 8 - (parts.length - (emptyEnd - index));
      for (let i = 0; i < index; i++) {
        num = (num << 16n) | BigInt(parseInt(parts[i], 16));
      }
      const rightCount = parts.length - emptyEnd;
      num <<= BigInt((missing + rightCount) * 16);
      let rightShift = BigInt((rightCount - 1) * 16);
      for (let i = emptyEnd; i < parts.length; i++) {
        num |= BigInt(parseInt(parts[i], 16)) << rightShift;
        rightShift -= 16n;
      }
    } else {
      for (const part of parts) {
        num = (num << 16n) | BigInt(parseInt(part, 16));
      }
    }

    res.number = num;
  }

  res.version = version;
  return res as ParsedIP;
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
