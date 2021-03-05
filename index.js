"use strict";

const isIP = require("is-ip");

const max4 = module.exports.max4 = 2n ** 32n - 1n;
const max6 = module.exports.max6 = 2n ** 128n - 1n;

module.exports.parse = ip => {
  const version = isIP.version(ip);
  if (!version) throw new Error(`Invalid IP address: ${ip}`);

  let number = 0n;
  let exp = 0n;

  if (version === 4) {
    for (const n of ip.split(".").map(Number).reverse()) {
      number += BigInt(n) * (2n ** BigInt(exp));
      exp += 8n;
    }
    return {number, version};
  } else if (version === 6) {
    const result = {};

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

    for (const n of parts.map(part => part ? `0x${part}` : `0`).map(Number).reverse()) {
      number += BigInt(n) * (2n ** BigInt(exp));
      exp += 16n;
    }

    result.number = number;
    result.version = version;
    return result;
  }
};

module.exports.stringify = ({number, version, ipv4mapped, scopeid} = {}) => {
  if (typeof number !== "bigint") throw new Error(`Expected a BigInt`);
  if (![4, 6].includes(version)) throw new Error(`Invalid version: ${version}`);
  if (number < 0n || number > (version === 4 ? max4 : max6)) throw new Error(`Invalid number: ${number}`);

  let step = version === 4 ? 24n : 112n;
  let remain = number;
  const parts = [];

  while (step > 0n) {
    const divisor = 2n ** BigInt(step);
    parts.push(remain / divisor);
    remain = number % divisor;
    step -= BigInt(version === 4 ? 8 : 16);
  }
  parts.push(remain);

  if (version === 4) {
    return parts.map(Number).join(".");
  } else {
    let ip = "";
    if (ipv4mapped) {
      for (let [index, num] of Object.entries(parts.map(Number))) {
        index = Number(index);
        if (index < 6) {
          ip += `${num.toString(16)}:`;
        } else {
          ip += `${String(num >> 8)}.${String(num & 255)}${index === 6 ? "." : ""}`;
        }
      }
    } else {
      ip = parts.map(n => Number(n).toString(16)).join(":");
    }

    if (scopeid) {
      ip = `${ip}%${scopeid}`;
    }

    return ip.replace(/\b:?(?:0+:?){2,}/, "::");
  }
};
