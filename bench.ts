import {parseIp, stringifyIp} from "./index.ts";

const runs = Number(process.env.BENCH_RUNS) || 5;
const filter = process.env.BENCH_FILTER;

// Results escape here, otherwise V8 deletes the measured work outright.
let sink: unknown;

function bench(name: string, ops: number, fn: () => unknown): void {
  if (filter && !name.includes(filter)) return;
  for (let i = 0; i < ops; i++) sink = fn(); // warmup
  const times: number[] = [];
  for (let run = 0; run < runs; run++) {
    const start = performance.now();
    for (let i = 0; i < ops; i++) sink = fn();
    times.push((performance.now() - start) * 1e6 / ops);
  }
  times.sort((a, b) => a - b);
  console.info(`${name.padEnd(30)}${times[runs >> 1].toFixed(1).padStart(9)} ns/op`);
}

// shapes chosen to cover the distinct code paths: dense groups, `::` runs, embedded IPv4 and scope ids
const cases: Array<[string, string]> = [
  ["v4", "192.168.100.200"],
  ["full v6", "2001:0db8:85a3:1319:8a2e:0370:7344:1234"],
  ["mid v6", "2001:db8:85a3::8a2e:370:7344"],
  ["small", "fe80::1"],
  ["low v6", "::c0a8:1"],
  ["mapped", "::ffff:191.239.213.197"],
  ["scoped", "fe80::1%eth0"],
];

const ops = 1e6;

// `parse` includes validation, `unchecked` is the same work without it, so the pair shows its cost
const unchecked = {validate: false};
for (const [name, ip] of cases) {
  bench(`parse ${name}`, ops, () => parseIp(ip));
  bench(`parse ${name} unchecked`, ops, () => parseIp(ip, unchecked));
}

const parsed = cases.map(entry => parseIp(entry[1]));
for (const [index, [name]] of cases.entries()) {
  bench(`stringify ${name}`, ops, () => stringifyIp(parsed[index]));
}

bench("stringify uncompressed", ops, () => stringifyIp(parsed[1], {compress: false}));
bench("stringify mapv4", ops, () => stringifyIp(parsed[5], {mapv4: true}));

if (sink === undefined) console.error("sink is empty, results were optimized away");
