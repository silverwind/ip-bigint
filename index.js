"use strict";

const isIp = require("is-ip");
const ipv6Normalize = require("ipv6-normalize");

const max4 = module.exports.max4 = BigInt(2) ** BigInt(32) - BigInt(1);
const max6 = module.exports.max6 = BigInt(2) ** BigInt(128) - BigInt(1);

module.exports.parse = ip => {
  const version = isIp.version(ip);
  if (![4, 6].includes(version)) throw new Error(`Invalid IP address: ${ip}`);

  let num = BigInt(0);
  let exp = BigInt(0);

  if (version === 4) {
    for (const n of ip.split(".").map(Number).reverse()) {
      num += BigInt(n) * (BigInt(2) ** BigInt(exp));
      exp += BigInt(8);
    }
  } else if (version === 6) {
    const parts = ip.split(":");
    const index = parts.indexOf("");

    if (index !== -1) {
      while (parts.length < 8) {
        parts.splice(index, 0, "");
      }
    }

    for (const n of parts.map(part => part ? `0x${part}` : `0`).map(Number).reverse()) {
      num += BigInt(n) * (BigInt(2) ** BigInt(exp));
      exp += BigInt(16);
    }
  }

  return {num, version};
};

module.exports.stringify = ({num, version}) => {
  if (typeof num !== "bigint") throw new Error(`Expected a BigInt`);
  if (![4, 6].includes(version)) throw new Error(`Invalid version: ${version}`);

  if (version === 4 && !(BigInt(0) < num < max4)) throw new Error(`Invalid num: ${num}`);
  if (version === 6 && !(BigInt(0) < num < max6)) throw new Error(`Invalid num: ${num}`);

  let step = version === 4 ? BigInt(24) : BigInt(112);
  let remain = num;
  const parts = [];
  while (step > BigInt(0)) {
    const divisor = BigInt(2) ** BigInt(step);
    parts.push(remain / divisor);
    remain = num % divisor;
    step -= BigInt(version === 4 ? 8 : 16);
  }
  parts.push(remain);

  if (version === 4) {
    return parts.map(Number).join(".");
  } else {
    return ipv6Normalize(parts.map(Number).map(n => n.toString(16)).join(":"));
  }
};
