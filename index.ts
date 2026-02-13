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

    let hex = "";
    if (index !== -1) {
      let emptyEnd = index;
      while (emptyEnd < parts.length && parts[emptyEnd] === "") emptyEnd++;
      const missing = 8 - (parts.length - (emptyEnd - index));
      for (let i = 0; i < index; i++) hex += `0000${parts[i]}`.slice(-4);
      for (let i = 0; i < missing; i++) hex += "0000";
      for (let i = emptyEnd; i < parts.length; i++) hex += `0000${parts[i]}`.slice(-4);
    } else {
      for (const part of parts) hex += `0000${part}`.slice(-4);
    }

    res.number = BigInt(`0x${hex}`);
  }

  res.version = version;
  return res as ParsedIP;
}

export function stringifyIp({number, version, ipv4mapped, scopeid}: ParsedIP, {compress = true, hexify = false}: StringifyOpts = {}): string {
  if (version === 4) {
    const num = Number(number);
    return `${(num >>> 24) & 0xff}.${(num >>> 16) & 0xff}.${(num >>> 8) & 0xff}.${num & 0xff}`;
  } else {
    const hex = number.toString(16).padStart(32, "0");
    let ip = "";

    if (ipv4mapped && !hexify) {
      const parts: string[] = new Array(7);
      for (let i = 0; i < 6; i++) {
        const offset = i * 4;
        let start = offset;
        while (start < offset + 3 && hex.charCodeAt(start) === 48) start++;
        parts[i] = hex.substring(start, offset + 4);
      }
      const o1 = parseInt(hex.substring(24, 26), 16);
      const o2 = parseInt(hex.substring(26, 28), 16);
      const o3 = parseInt(hex.substring(28, 30), 16);
      const o4 = parseInt(hex.substring(30, 32), 16);
      parts[6] = `${o1}.${o2}.${o3}.${o4}`;

      if (compress) {
        ip = compressIPv6(parts);
      } else {
        ip = parts.join(":");
      }
    } else {
      const parts: string[] = new Array(8);
      for (let i = 0; i < 8; i++) {
        const offset = i * 4;
        let start = offset;
        while (start < offset + 3 && hex.charCodeAt(start) === 48) start++;
        parts[i] = hex.substring(start, offset + 4);
      }

      if (compress) {
        ip = compressIPv6(parts);
      } else {
        ip = parts.join(":");
      }
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
