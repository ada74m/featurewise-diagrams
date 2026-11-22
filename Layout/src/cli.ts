import { readFileSync, writeFileSync } from "node:fs";
import { Annealer } from "./anneal";
import { defaultWeights, type Weights } from "./fitness";
import { graphOf, type GraphJson } from "./graph";
import { BRAND, svgOf } from "./render";

// Lays out a feature graph and writes it as SVG:
//   npm run layout -- <graph.json> <out.svg> [--seed n] [--steps n] [--no-key] [--margin beams] [--brand]
//     [--weights name=value,name=value…]   weights other than the defaults, as the page's sliders set them

const args = process.argv.slice(2);
const option = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const [input, output] = args.filter((arg, i) => !arg.startsWith("--") && !args[i - 1]?.startsWith("--"));
if (!input || !output) {
  console.error("usage: layout <graph.json> <out.svg> [--seed n] [--steps n] [--no-key] [--margin beams]");
  process.exit(1);
}

const graph = graphOf(JSON.parse(readFileSync(input, "utf8")) as GraphJson);
const weights: Weights = { ...defaultWeights };
for (const pair of (option("--weights") ?? "").split(",").filter(Boolean)) {
  const [name, value] = pair.split("=");
  if (!name || !(name in weights) || value === undefined || Number.isNaN(Number(value))) {
    console.error(`no such weight, or not a number: ${pair}. The weights are ${Object.keys(weights).join(", ")}.`);
    process.exit(1);
  }
  weights[name as keyof Weights] = Number(value);
}
const annealer = new Annealer(graph, {
  seed: Number(option("--seed") ?? 1),
  steps: Number(option("--steps") ?? 120000),
  weights
});
const started = Date.now();
annealer.run(Infinity);
writeFileSync(output, svgOf(graph, annealer.best, { key: !args.includes("--no-key"), margin: option("--margin") === undefined ? undefined : Number(option("--margin")), palette: args.includes("--brand") ? BRAND : undefined }));

const terms = Object.entries(annealer.bestScore.terms).map(([k, v]) => `${k} ${v.toFixed(2)}`).join(", ");
const queues = graph.nodes.filter(node => node.family === "queue").length;
console.log(`${graph.nodes.length - queues} features, ${queues} queue${queues === 1 ? "" : "s"}, ${graph.edges.length} links, ${annealer.step} steps in ${Date.now() - started} ms`);
console.log(`score ${annealer.bestScore.total.toFixed(2)}: ${terms}`);
