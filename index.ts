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
  let exp = 0n;
  const res: Partial<ParsedIP> = Object.create(null);

  if (version === 4) {
    for (const n of ip.split(".").map(BigInt).reverse()) {
      number += n * (2n ** exp);
      exp += 8n;
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

    for (const n of parts.map(part => BigInt(parseInt(part || "0", 16))).reverse()) {
      number += n * (2n ** exp);
      exp += 16n;
    }
  }

  res.number = number;
  res.version = version;
  return res as ParsedIP;
}

export function stringifyIp({number, version, ipv4mapped, scopeid}: ParsedIP, {compress = true, hexify = false}: StringifyOpts = {}): string {
  let step = version === 4 ? 24n : 112n;
  const stepReduction = version === 4 ? 8n : 16n;
  let remain = number;
  const parts: Array<bigint> = [];

  while (step > 0n) {
    const divisor = 2n ** step;
    parts.push(remain / divisor);
    remain = number % divisor;
    step -= stepReduction;
  }
  parts.push(remain);

  if (version === 4) {
    return parts.join(".");
  } else {
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
// Per RFC 5952 section 4.2.2, only compress sequences of 2 or more consecutive zeros
function compressIPv6(parts: Array<string>): string {
  let longest: Set<number> | null = null;
  let current: Set<number> | null = null;

  for (const [index, part] of parts.entries()) {
    if (part === "0") {
      if (!current) {
        current = new Set([index]);
      } else {
        current.add(index);
      }
    } else {
      if (current) {
        if (!longest || current.size > longest.size) {
          longest = current;
        }
        current = null;
      }
    }
  }

  if ((!longest && current) || (current && longest && current.size > longest.size)) {
    longest = current;
  }

  // Only compress if we have 2 or more consecutive zeros (RFC 5952 section 4.2.2)
  if (longest && longest.size >= 2) {
    for (const index of longest) {
      parts[index] = ":";
    }
  }

  return parts.filter(Boolean).join(":").replace(/:{2,}/, "::");
}
