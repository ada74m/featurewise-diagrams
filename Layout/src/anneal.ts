import { score, defaultWeights, type Score, type Weights } from "./fitness";
import type { Graph } from "./graph";
import { copyLayout, randomLayout, type Layout } from "./layout";
import { Random } from "./random";

// Simulated annealing. Each step makes a random change to the layout and scores it. A change for the
// better is always kept. A change for the worse is kept with probability e^(-worsening / temperature),
// which is what lets the layout climb out of a poor arrangement on its way to a better one. The
// temperature falls steadily, so changes start big and several at a time, and end small and one at a
// time, and worse changes are kept less and less often, until at the end it only keeps improvements.

export interface Options {
  seed: number;
  steps: number;
  weights: Weights;
}

export const defaultOptions: Options = { seed: 1, steps: 120000, weights: defaultWeights };

const FINAL = 1e-4;

export class Annealer {
  readonly graph: Graph;
  readonly options: Options;
  private readonly random: Random;
  layout: Layout;
  current: Score;
  best: Layout;
  bestScore: Score;
  step = 0;
  accepted = 0;
  readonly startTemperature: number;
  temperature: number;
  private readonly cooling: number;

  constructor(graph: Graph, options: Partial<Options> = {}) {
    this.graph = graph;
    this.options = { ...defaultOptions, ...options };
    this.random = new Random(this.options.seed);
    this.layout = randomLayout(graph, this.random);
    this.current = score(graph, this.layout, this.options.weights);
    this.best = copyLayout(this.layout);
    this.bestScore = this.current;
    this.startTemperature = this.calibrate();
    this.temperature = this.startTemperature;
    this.cooling = Math.pow(FINAL, 1 / this.options.steps);
  }

  get done(): boolean {
    return this.step >= this.options.steps;
  }

  // How hot it still is, from 1 at the start to nearly 0 at the end.
  get heat(): number {
    return this.temperature / this.startTemperature;
  }

  // Runs up to the given number of steps, stopping when the schedule ends.
  run(steps: number): void {
    for (let i = 0; i < steps && !this.done; i++)
      this.once();
  }

  once(): void {
    const candidate = this.change(this.layout, this.heat);
    const candidateScore = score(this.graph, candidate, this.options.weights);
    const worsening = candidateScore.total - this.current.total;
    if (worsening <= 0 || this.random.next() < Math.exp(-worsening / this.temperature)) {
      this.layout = candidate;
      this.current = candidateScore;
      this.accepted++;
      if (candidateScore.total < this.bestScore.total) {
        this.best = copyLayout(candidate);
        this.bestScore = candidateScore;
      }
    }
    this.temperature *= this.cooling;
    this.step++;
  }

  // A random change: big and to several boats while hot, small and to one boat as it cools.
  private change(layout: Layout, heat: number): Layout {
    const next = copyLayout(layout);
    const n = next.length;
    const boats = 1 + this.random.int(1 + Math.round(2 * heat));
    for (let k = 0; k < boats; k++) {
      const i = this.random.int(n);
      const p = next[i]!;
      const kind = this.random.next();
      if (kind < 0.6) {
        const reach = 8 + 320 * heat;
        p.x += this.random.gaussian() * reach;
        p.y += this.random.gaussian() * reach;
      } else if (kind < 0.88) {
        // Turning: sometimes a nudge, and more and more often, as it cools, a snap to a quarter turn.
        if (this.random.next() < 0.4 + 0.5 * (1 - heat))
          p.angle = (Math.round(p.angle / (Math.PI / 2)) + this.random.int(3) - 1) * (Math.PI / 2);
        else
          p.angle += this.random.gaussian() * (0.05 + Math.PI * heat);
      } else if (n > 1) {
        const j = (i + 1 + this.random.int(n - 1)) % n;
        const q = next[j]!;
        [p.x, q.x] = [q.x, p.x];
        [p.y, q.y] = [q.y, p.y];
      }
    }
    return next;
  }

  // A starting temperature at which a typical worsening is kept about half the time.
  private calibrate(): number {
    let sum = 0;
    let count = 0;
    for (let i = 0; i < 200; i++) {
      const candidate = this.change(this.layout, 1);
      const worsening = score(this.graph, candidate, this.options.weights).total - this.current.total;
      if (worsening > 0) {
        sum += worsening;
        count++;
      }
    }
    return count === 0 ? 1 : sum / count / Math.LN2;
  }
}
