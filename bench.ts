import {parseIp, stringifyIp, type ParsedIP} from "./index.ts";

const iterations = 1e6;
const reps = 5;

// shapes chosen to cover the distinct code paths: dense groups, `::` runs, embedded IPv4 and scope ids
const cases: Array<[string, string]> = [
  ["v4     ", "192.168.100.200"],
  ["full v6", "2001:0db8:85a3:1319:8a2e:0370:7344:1234"],
  ["mid v6 ", "2001:db8:85a3::8a2e:370:7344"],
  ["small  ", "fe80::1"],
  ["low v6 ", "::c0a8:1"],
  ["mapped ", "::ffff:191.239.213.197"],
  ["scoped ", "fe80::1%eth0"],
];

// report the best of several runs, which is far more stable than a single timed pass
function bench(name: string, fn: () => void) {
  let best = Infinity;
  for (let rep = 0; rep < reps; rep++) {
    for (let i = 0; i < 2e5; i++) fn(); // warmup
    const t = performance.now();
    for (let i = 0; i < iterations; i++) fn();
    best = Math.min(best, performance.now() - t);
  }
  console.info(`${name}: ${best.toFixed(1)}ms`);
}

for (const [name, ip] of cases) {
  bench(`parse     ${name}`, () => { parseIp(ip); });
}

const parsed: ParsedIP[] = cases.map(([, ip]) => parseIp(ip));
for (const [index, [name]] of cases.entries()) {
  bench(`stringify ${name}`, () => { stringifyIp(parsed[index]); });
}

bench("stringify uncompressed", () => { stringifyIp(parsed[1], {compress: false}); });
bench("stringify mapv4       ", () => { stringifyIp(parsed[4], {mapv4: true}); });
