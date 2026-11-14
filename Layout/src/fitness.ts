import { BEAM } from "./boat";
import { angleBetween, boxesOverlap, boxOf, direction, distance, segmentsCross, segmentToSegment, sub, type Box, type Vec } from "./geometry";
import type { Graph } from "./graph";
import { bowOf, curveOf, keelOf, polylineOf, sternOf, type Layout } from "./layout";

// What makes a diagram look good, as penalties: the lower the total, the better the diagram. Each term is
// one aesthetic rule, and its weight says how much it matters against the others.

export interface Weights {
  // Boats closer than they should be, or overlapping.
  crowding: number;
  // Links crossing each other.
  crossings: number;
  // Links passing through a boat.
  throughBoats: number;
  // Links that have to turn, because the boats don't face each other.
  bends: number;
  // Links much longer or shorter than a comfortable length.
  lengths: number;
  // Uneven spacing between neighbouring boats.
  unevenness: number;
  // Boats not quite pointing along one of the page's axes.
  skew: number;
  // Boats nearly, but not quite, in a row or a column.
  nearMisses: number;
  // A diagram spread out, or the wrong shape for a page.
  sprawl: number;
  // Boats pointing backwards, against the way the links flow.
  backwards: number;
  // Boats standing up, rather than lying along the page, where their names are easy to read.
  upright: number;
  // Boats with no links to or from others, such as workers, apart from each other rather than together.
  strays: number;
}

export const defaultWeights: Weights = {
  crowding: 20,
  crossings: 60,
  throughBoats: 10,
  bends: 10,
  lengths: 1.5,
  unevenness: 5,
  skew: 1.5,
  nearMisses: 3,
  sprawl: 2.5,
  backwards: 5,
  upright: 5,
  strays: 3
};

export type Terms = Record<keyof Weights, number>;

export interface Score {
  total: number;
  terms: Terms;
}

const GAP = 36;
const COMFORTABLE = 200;
const NEAR = 24;
const ASPECT = 1.5;

export function score(graph: Graph, layout: Layout, weights: Weights = defaultWeights): Score {
  const n = graph.nodes.length;
  const keels = graph.nodes.map((node, i) => keelOf(layout[i]!, node.length));
  const curves = graph.edges.map(edge => curveOf(edge, graph, layout));
  const lines = curves.map(polylineOf);
  const lineBoxes = lines.map(line => boxOf(line));
  const keelBoxes = keels.map(keel => boxOf(keel));

  const terms: Terms = {
    crowding: 0,
    crossings: 0,
    throughBoats: 0,
    bends: 0,
    lengths: 0,
    unevenness: 0,
    skew: 0,
    nearMisses: 0,
    sprawl: 0,
    backwards: 0,
    upright: 0,
    strays: 0
  };

  // Boats with no links to or from other boats. A link to itself doesn't count.
  const linked = new Set<number>();
  for (const edge of graph.edges) {
    if (edge.from !== edge.to) {
      linked.add(edge.from);
      linked.add(edge.to);
    }
  }

  // Crowding, and each boat's nearest neighbour, for evenness. Strays should be near each other: as near
  // as crowding allows costs nothing, and every further step costs more.
  const nearest = new Array<number>(n).fill(Infinity);
  const wanted = BEAM + GAP;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const [a, b] = keels[i]!;
      const [c, d] = keels[j]!;
      const apart = segmentToSegment(a, b, c, d);
      nearest[i] = Math.min(nearest[i]!, apart);
      nearest[j] = Math.min(nearest[j]!, apart);
      if (apart < wanted)
        terms.crowding += ((wanted - apart) / wanted) ** 2;
      if (!linked.has(i) && !linked.has(j) && apart > wanted)
        terms.strays += (apart - wanted) / wanted;
    }
  }
  if (n > 1) {
    const mean = nearest.reduce((sum, d) => sum + d, 0) / n;
    const variance = nearest.reduce((sum, d) => sum + (d - mean) ** 2, 0) / n;
    terms.unevenness = mean > 0 ? variance / (mean * mean) : 0;
  }

  // Links crossing links.
  for (let e = 0; e < lines.length; e++) {
    for (let f = e + 1; f < lines.length; f++) {
      if (!boxesOverlap(lineBoxes[e]!, lineBoxes[f]!))
        continue;
      // Links that share a boat may meet there, so their ends next to it don't count.
      const ee = graph.edges[e]!;
      const ff = graph.edges[f]!;
      const shared = new Set([ee.from, ee.to].filter(node => node === ff.from || node === ff.to));
      terms.crossings += crossingsBetween(lines[e]!, lines[f]!, shared.size > 0 ? 2 : 0);
    }
  }

  // Links through boats. A link may touch its own boats only at its ends.
  const clearance = BEAM / 2 + 6;
  for (let e = 0; e < lines.length; e++) {
    const edge = graph.edges[e]!;
    const line = lines[e]!;
    for (let i = 0; i < n; i++) {
      if (!boxesOverlap(lineBoxes[e]!, keelBoxes[i]!, clearance))
        continue;
      const own = i === edge.from || i === edge.to;
      const first = own ? 2 : 0;
      const last = own ? line.length - 3 : line.length - 1;
      const [a, b] = keels[i]!;
      for (let s = first; s < last; s++) {
        if (segmentToSegment(line[s]!, line[s + 1]!, a, b) < clearance)
          terms.throughBoats += 1;
      }
    }
  }

  // Bends and lengths.
  for (let e = 0; e < graph.edges.length; e++) {
    const edge = graph.edges[e]!;
    if (edge.from === edge.to)
      continue;
    const from = layout[edge.from]!;
    const to = layout[edge.to]!;
    const start = bowOf(from, graph.nodes[edge.from]!.length);
    const end = sternOf(to, graph.nodes[edge.to]!.length);
    const chord = sub(end, start);
    const out = angleBetween(direction(from.angle), chord);
    const into = angleBetween(chord, direction(to.angle));
    terms.bends += (out * out + into * into) / (Math.PI * Math.PI);
    const span = distance(start, end);
    terms.lengths += ((span - COMFORTABLE) / COMFORTABLE) ** 2;
  }

  // Headings: along an axis, not backwards, and lying along the page rather than standing up.
  for (const p of layout) {
    terms.skew += Math.sin(2 * p.angle) ** 2;
    terms.backwards += (1 - Math.cos(p.angle)) / 2;
    terms.upright += Math.sin(p.angle) ** 2;
  }

  // Near misses: centres almost, but not quite, level or in line. Exactly level costs nothing, and so does
  // clearly apart; the cost peaks halfway between.
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      terms.nearMisses += nearMiss(Math.abs(layout[i]!.x - layout[j]!.x)) + nearMiss(Math.abs(layout[i]!.y - layout[j]!.y));
    }
  }

  // Sprawl: how far the boats are from their middle, against how far they'd need to be if packed, and the
  // diagram's shape against a page's. Every boat counts, so one with no links still keeps close.
  const centre = layout.reduce((sum, p) => ({ x: sum.x + p.x / n, y: sum.y + p.y / n }), { x: 0, y: 0 });
  const needed = graph.nodes.reduce((sum, node) => sum + (node.length + 2 * GAP) * (BEAM + 4 * GAP), 0);
  const radius = 0.5 * Math.sqrt(needed / Math.PI);
  const spread = layout.reduce((sum, p) => sum + ((p.x - centre.x) ** 2 + (p.y - centre.y) ** 2), 0) / (n * radius * radius);
  const extent = extentOf(graph, layout);
  const aspect = (extent.maxX - extent.minX) / Math.max(1, extent.maxY - extent.minY);
  terms.sprawl = spread + Math.log(aspect / ASPECT) ** 2;

  let total = 0;
  for (const key of Object.keys(terms) as (keyof Weights)[])
    total += weights[key] * terms[key];
  return { total, terms };
}

function crossingsBetween(a: Vec[], b: Vec[], skip: number): number {
  let count = 0;
  for (let s = skip; s < a.length - 1 - skip; s++) {
    for (let t = skip; t < b.length - 1 - skip; t++) {
      if (segmentsCross(a[s]!, a[s + 1]!, b[t]!, b[t + 1]!))
        count++;
    }
  }
  return count;
}

function nearMiss(gap: number): number {
  if (gap >= NEAR)
    return 0;
  const r = gap / NEAR;
  return 4 * r * (1 - r);
}

// The box around every boat, with room for the hull's beam.
export function extentOf(graph: Graph, layout: Layout): Box {
  const points: Vec[] = [];
  graph.nodes.forEach((node, i) => {
    points.push(bowOf(layout[i]!, node.length), sternOf(layout[i]!, node.length));
  });
  const box = boxOf(points);
  return { minX: box.minX - BEAM, minY: box.minY - BEAM, maxX: box.maxX + BEAM, maxY: box.maxY + BEAM };
}
