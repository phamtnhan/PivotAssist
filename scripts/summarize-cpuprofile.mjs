/**
 * Summarize a V8 .cpuprofile: top exclusive hitCount frames.
 * Usage: node scripts/summarize-cpuprofile.mjs path/to/file.cpuprofile
 */
import fs from "node:fs";

const file = process.argv[2];
if (!file) {
  console.error("usage: node scripts/summarize-cpuprofile.mjs <file.cpuprofile>");
  process.exit(1);
}
const profile = JSON.parse(fs.readFileSync(file, "utf8"));
const nodes = profile.nodes ?? [];
const hits = new Map();
for (const node of nodes) {
  const name = node.callFrame?.functionName || "(anonymous)";
  const url = node.callFrame?.url || "";
  const key = `${name}\t${url}`;
  hits.set(key, (hits.get(key) ?? 0) + (node.hitCount ?? 0));
}
const ranked = [...hits.entries()]
  .map(([key, count]) => {
    const [name, url] = key.split("\t");
    return { name, url, hitCount: count };
  })
  .filter((row) => row.hitCount > 0)
  .sort((a, b) => b.hitCount - a.hitCount)
  .slice(0, 40);
const total = ranked.reduce((sum, row) => sum + row.hitCount, 0);
console.log(JSON.stringify({ file, nodes: nodes.length, samples: profile.samples?.length ?? 0, top: ranked, topHitSum: total }, null, 2));
