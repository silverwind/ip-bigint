import {parseIp, stringifyIp} from "./index.js";

const res = [];
const t1 = performance.now();
for (let i = 0; i < 1e5; i++) res.push(stringifyIp({number: BigInt(i), version: 6}));
console.info(`stringifyIp: ${Math.round(performance.now() - t1)}ms`);
const t2 = performance.now();
for (const r of res) parseIp(r);
console.info(`parseIp: ${Math.round(performance.now() - t2)}ms`);
