"use strict";

const isIp = require("is-ip");
const ipv6Normalize = require("ipv6-normalize");

const max4 = module.exports.max4 = BigInt(2) ** BigInt(32) - BigInt(1);
const max6 = module.exports.max6 = BigInt(2) ** BigInt(128) - BigInt(1);

module.exports.parse = ip => {
  const version = isIp.version(ip);
  if (![4, 6].includes(version)) throw new Error(`Invalid IP address: ${ip}`);

  let number = BigInt(0);
  let exp = BigInt(0);

  if (version === 4) {
    for (const n of ip.split(".").map(Number).reverse()) {
      number += BigInt(n) * (BigInt(2) ** BigInt(exp));
      exp += BigInt(8);
    }
    return {number, version};
  } else if (version === 6) {
    let ipv4mapped = false;
    if (ip.includes(".")) {
      ipv4mapped = true;
      ip = ip.split(":").map(part => {
        if (part.includes(".")) {
          const digits = part.split(".").map(str => Number(str).toString(16).padStart(2, "0"));
          return `${digits[0]}${digits[1]}:${digits[2]}${digits[3]}`;
        } else {
          return part;
        }
      }).join(":");
    }

    const parts = ip.split(":");
    const index = parts.indexOf("");

    if (index !== -1) {
      while (parts.length < 8) {
        parts.splice(index, 0, "");
      }
    }

    for (const n of parts.map(part => part ? `0x${part}` : `0`).map(Number).reverse()) {
      number += BigInt(n) * (BigInt(2) ** BigInt(exp));
      exp += BigInt(16);
    }

    return {number, version, ipv4mapped};
  }
};

module.exports.stringify = ({number, version, ipv4mapped} = {}) => {
  if (typeof number !== "bigint") throw new Error(`Expected a BigInt`);
  if (![4, 6].includes(version)) throw new Error(`Invalid version: ${version}`);
  if (!(BigInt(0) < number < (version === 4 ? max4 : max6))) throw new Error(`Invalid number: ${number}`);

  let step = version === 4 ? BigInt(24) : BigInt(112);
  let remain = number;
  const parts = [];

  while (step > BigInt(0)) {
    const divisor = BigInt(2) ** BigInt(step);
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

    return ipv6Normalize(ip);
  }
};
