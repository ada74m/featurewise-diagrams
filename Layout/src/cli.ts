import { readFileSync, writeFileSync } from "node:fs";
import { Annealer } from "./anneal";
import { graphOf, type GraphJson } from "./graph";
import { svgOf } from "./render";

// Lays out a feature graph and writes it as SVG:
//   npm run layout -- <graph.json> <out.svg> [--seed n] [--steps n]

const args = process.argv.slice(2);
const option = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const [input, output] = args.filter((arg, i) => !arg.startsWith("--") && !args[i - 1]?.startsWith("--"));
if (!input || !output) {
  console.error("usage: layout <graph.json> <out.svg> [--seed n] [--steps n]");
  process.exit(1);
}

const graph = graphOf(JSON.parse(readFileSync(input, "utf8")) as GraphJson);
const annealer = new Annealer(graph, {
  seed: Number(option("--seed") ?? 1),
  steps: Number(option("--steps") ?? 120000)
});
const started = Date.now();
annealer.run(Infinity);
writeFileSync(output, svgOf(graph, annealer.best));

const terms = Object.entries(annealer.bestScore.terms).map(([k, v]) => `${k} ${v.toFixed(2)}`).join(", ");
console.log(`${graph.nodes.length} features, ${graph.edges.length} links, ${annealer.step} steps in ${Date.now() - started} ms`);
console.log(`score ${annealer.bestScore.total.toFixed(2)}: ${terms}`);
