export const max4 = 2n ** 32n - 1n;
export const max6 = 2n ** 128n - 1n;
const isIP = ip => ip.includes(":") ? 6 : ip.includes(".") ? 4 : 0;

export function parseIp(ip) {
  const version = isIP(ip);
  if (!version) throw new Error(`Invalid IP address: ${ip}`);

  const result = Object.create(null);
  let number = 0n;
  let exp = 0n;

  if (version === 4) {
    for (const n of ip.split(".").map(BigInt).reverse()) {
      number += n * (2n ** exp);
      exp += 8n;
    }

    result.number = number;
    result.version = version;
    return result;
  } else {
    if (ip.includes(".")) {
      result.ipv4mapped = true;
      ip = ip.split(":").map(part => {
        if (part.includes(".")) {
          const digits = part.split(".").map(str => Number(str).toString(16).padStart(2, "0"));
          return `${digits[0]}${digits[1]}:${digits[2]}${digits[3]}`;
        } else {
          return part;
        }
      }).join(":");
    }

    if (ip.includes("%")) {
      let scopeid;
      [, ip, scopeid] = /(.+)%(.+)/.exec(ip);
      result.scopeid = scopeid;
    }

    const parts = ip.split(":");
    const index = parts.indexOf("");

    if (index !== -1) {
      while (parts.length < 8) {
        parts.splice(index, 0, "");
      }
    }

    for (const n of parts.map(part => BigInt(parseInt(part || 0, 16))).reverse()) {
      number += n * (2n ** exp);
      exp += 16n;
    }

    result.number = number;
    result.version = version;
    return result;
  }
}

export function stringifyIp({number, version, ipv4mapped, scopeid} = {}) {
  if (typeof number !== "bigint") throw new Error(`Expected a BigInt`);
  if (![4, 6].includes(version)) throw new Error(`Invalid version: ${version}`);
  if (number < 0n || number > (version === 4 ? max4 : max6)) throw new Error(`Invalid number: ${number}`);

  let step = version === 4 ? 24n : 112n;
  const stepReduction = version === 4 ? 8n : 16n;
  let remain = number;
  const parts = [];

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
    if (ipv4mapped) {
      for (const [index, num] of parts.entries()) {
        if (index < 6) {
          ip += `${num.toString(16)}:`;
        } else {
          ip += `${String(num >> 8n)}.${String(num & 255n)}${index === 6 ? "." : ""}`;
        }
      }
      ip = compressIPv6(ip.split(":"));
    } else {
      ip = compressIPv6(parts.map(n => n.toString(16)));
    }

    if (scopeid) {
      ip = `${ip}%${scopeid}`;
    }

    return ip;
  }
}

export function normalizeIp(ip) {
  return stringifyIp(parseIp(ip));
}

// take the longest or first sequence of "0" segments and replace it with "::"
function compressIPv6(parts) {
  let longestSequence;
  let currentSequence;
  for (const [index, part] of parts.entries()) {
    if (part === "0") {
      if (!currentSequence) {
        currentSequence = new Set([index]);
      } else {
        currentSequence.add(index);
      }
    } else {
      if (currentSequence) {
        if (!longestSequence) {
          longestSequence = currentSequence;
        } else if (currentSequence.size > longestSequence.size) {
          longestSequence = currentSequence;
        }
        currentSequence = null;
      }
    }
  }
  if (!longestSequence && currentSequence) longestSequence = currentSequence;

  for (const index of longestSequence || []) {
    parts[index] = ":";
  }

  return parts.filter(Boolean).join(":").replace(/:{2,}/, "::");
}
