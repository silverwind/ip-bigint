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

  let number = 0n;
  const res: Partial<ParsedIP> = {};

  if (version === 4) {
    const parts = ip.split(".");
    for (let i = 0; i < 4; i++) {
      number = (number << 8n) | BigInt(parts[i]);
    }
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
      let scopeid: string;
      [, ip, scopeid] = (/(.+)%(.+)/.exec(ip) || []);
      res.scopeid = scopeid;
    }

    const parts = ip.split(":");
    const index = parts.indexOf("");

    if (index !== -1) {
      while (parts.length < 8) {
        parts.splice(index, 0, "");
      }
    }

    for (const part of parts) {
      number = (number << 16n) | BigInt(parseInt(part || "0", 16));
    }
  }

  res.number = number;
  res.version = version;
  return res as ParsedIP;
}

export function stringifyIp({number, version, ipv4mapped, scopeid}: ParsedIP, {compress = true, hexify = false}: StringifyOpts = {}): string {
  if (version === 4) {
    const num = Number(number);
    return `${(num >>> 24) & 0xff}.${(num >>> 16) & 0xff}.${(num >>> 8) & 0xff}.${num & 0xff}`;
  } else {
    const parts: bigint[] = new Array(8);
    let n = number;
    for (let i = 7; i >= 0; i--) {
      parts[i] = n & 0xffffn;
      n >>= 16n;
    }
    let ip = "";
    if (ipv4mapped && !hexify) {
      for (const [index, num] of parts.entries()) {
        if (index < 6) {
          ip += `${num.toString(16)}:`;
        } else {
          ip += `${String(num >> 8n)}.${String(num & 255n)}${index === 6 ? "." : ""}`;
        }
      }
      if (compress) {
        ip = compressIPv6(ip.split(":"));
      }
    } else {
      if (compress) {
        ip = compressIPv6(parts.map(n => n.toString(16)));
      } else {
        ip = parts.map(n => n.toString(16)).join(":");
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
    const before = parts.slice(0, longestStart).join(":");
    const after = parts.slice(longestStart + longestLen).join(":");
    if (before && after) return `${before}::${after}`;
    if (before) return `${before}::`;
    if (after) return `::${after}`;
    return "::";
  }

  return parts.join(":");
}
