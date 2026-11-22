import { Annealer } from "./anneal";
import { defaultWeights, type Weights } from "./fitness";
import { graphOf, type Graph, type GraphJson } from "./graph";
import { BRAND, svgOf } from "./render";

// The page: anneals a service's diagram while you watch, a batch of steps each frame, drawing the layout
// as it goes, and shows the score term by term. Change a weight or the seed and start again.

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const params = new URLSearchParams(location.search);
const source = params.get("graph") ?? "lost-property.json";

const weights: Weights = { ...defaultWeights };
let graph: Graph;
let annealer: Annealer;
let paused = false;

async function main() {
  graph = graphOf((await (await fetch(source)).json()) as GraphJson);
  $("service").textContent = graph.service;
  buildWeights();
  $("restart").addEventListener("click", start);
  $("random").addEventListener("click", () => {
    $<HTMLInputElement>("seed").value = String(Math.floor(Math.random() * 100000));
    start();
  });
  $("pause").addEventListener("click", () => {
    paused = !paused;
    $("pause").textContent = paused ? "Resume" : "Pause";
  });
  $("download").addEventListener("click", download);
  // The key and the margin change only the drawing, so it's drawn again, and the annealing goes on.
  $("key").addEventListener("change", draw);
  $("margin").addEventListener("input", draw);
  $("brand").addEventListener("change", draw);
  start();
  requestAnimationFrame(frame);
}

function start() {
  annealer = new Annealer(graph, {
    seed: Number($<HTMLInputElement>("seed").value),
    steps: Number($<HTMLInputElement>("steps").value),
    weights: { ...weights }
  });
  paused = false;
  $("pause").textContent = "Pause";
  draw();
}

function frame() {
  if (!paused && !annealer.done) {
    annealer.run(Number($<HTMLInputElement>("speed").value));
    draw();
  }
  requestAnimationFrame(frame);
}

function draw() {
  // While it anneals, show where it is; once done, the best it found.
  const layout = annealer.done ? annealer.best : annealer.layout;
  $("view").innerHTML = svgOf(graph, layout, drawing());
  const shown = annealer.done ? annealer.bestScore : annealer.current;
  const progress = annealer.step / annealer.options.steps;
  ($("progress").firstElementChild as HTMLElement).style.width = `${(progress * 100).toFixed(1)}%`;
  $("stats").textContent = `step ${annealer.step.toLocaleString()} · heat ${annealer.heat.toExponential(1)} · `
    + `kept ${((annealer.accepted / Math.max(1, annealer.step)) * 100).toFixed(0)}%`
    + (annealer.done ? " · done, showing the best" : "");
  $("terms").innerHTML = Object.entries(shown.terms)
    .map(([name, value]) => `<tr><td>${name}</td><td class="num">${(value * weights[name as keyof Weights]).toFixed(2)}</td></tr>`)
    .join("") + `<tr><td><b>total</b></td><td class="num"><b>${shown.total.toFixed(2)}</b></td></tr>`;
}

function buildWeights() {
  const container = $("weights");
  for (const name of Object.keys(defaultWeights) as (keyof Weights)[]) {
    const label = document.createElement("label");
    label.className = "weight";
    const max = Math.max(10, defaultWeights[name] * 4);
    label.innerHTML = `<span>${name}</span><span class="value">${weights[name]}</span>`
      + `<input type="range" min="0" max="${max}" step="${max / 100}" value="${weights[name]}">`;
    const input = label.querySelector("input")!;
    const value = label.querySelector(".value")!;
    input.addEventListener("input", () => {
      weights[name] = Number(input.value);
      value.textContent = String(Number(input.value).toFixed(2));
    });
    // A new weight changes what "good" means, so start again with it.
    input.addEventListener("change", start);
    container.append(label);
  }
}

// How to draw: with or without the key, and with how much margin, in beams. A picture for a page wants
// no key and a margin of about half a beam.
function drawing() {
  const margin = Number($<HTMLInputElement>("margin").value);
  return {
    key: $<HTMLInputElement>("key").checked,
    margin: Number.isFinite(margin) && margin >= 0 ? margin : 2.5,
    palette: $<HTMLInputElement>("brand").checked ? BRAND : undefined
  };
}

// Saves what's shown. A layout found here is best saved here: the browser and Node can differ in the last
// digits of their arithmetic, and annealing magnifies that, so the command line may not reproduce it.
function download() {
  const svg = svgOf(graph, annealer.done ? annealer.best : annealer.layout, drawing());
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${graph.service}-seed-${annealer.options.seed}.svg`;
  a.click();
  URL.revokeObjectURL(url);
}

void main();
