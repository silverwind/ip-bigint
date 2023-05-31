import {parseIp, stringifyIp} from "./index.js";

let t;
const ip4s = [];
const ip6s = [];

t = performance.now();
for (let i = 0; i < 1e5; i++) ip4s.push(stringifyIp({number: BigInt(i), version: 4}));
console.info(`stringify v4: ${Math.round(performance.now() - t)}ms`);

t = performance.now();
for (let i = 0; i < 1e5; i++) ip6s.push(stringifyIp({number: BigInt(i), version: 6}));
console.info(`stringify v6: ${Math.round(performance.now() - t)}ms`);

t = performance.now();
for (const ip of ip4s) parseIp(ip);
console.info(`parse v4: ${Math.round(performance.now() - t)}ms`);

t = performance.now();
for (const ip of ip6s) parseIp(ip);
console.info(`parse v6: ${Math.round(performance.now() - t)}ms`);
