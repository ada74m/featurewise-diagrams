import { BEAM } from "./boat";
import { add, direction, distance, perpendicular, sampleCubic, scale, sub, type Vec } from "./geometry";
import type { Edge, Graph } from "./graph";
import type { Random } from "./random";

// Where each boat is: its centre, and the way its bow points.
export interface Placement {
  x: number;
  y: number;
  angle: number;
}

export type Layout = Placement[];

export const copyLayout = (layout: Layout): Layout => layout.map(p => ({ ...p }));

export function randomLayout(graph: Graph, random: Random): Layout {
  const side = Math.sqrt(graph.nodes.length) * 260;
  return graph.nodes.map(() => ({
    x: random.next() * side,
    y: random.next() * side * 0.7,
    angle: random.next() * Math.PI * 2
  }));
}

export const centreOf = (p: Placement): Vec => ({ x: p.x, y: p.y });
export const bowOf = (p: Placement, length: number): Vec => add(centreOf(p), scale(direction(p.angle), length / 2));
export const sternOf = (p: Placement, length: number): Vec => sub(centreOf(p), scale(direction(p.angle), length / 2));

// A boat's keel, from stern to bow, shortened at each end by half the beam: a capsule around it of radius
// half the beam is a good stand-in for the hull.
export function keelOf(p: Placement, length: number): [Vec, Vec] {
  const d = direction(p.angle);
  const half = Math.max(0, length / 2 - BEAM / 2);
  return [sub(centreOf(p), scale(d, half)), add(centreOf(p), scale(d, half))];
}

// A link's curve: it leaves the linker's bow the way the bow points, and arrives at the linkee's stern the
// way that boat points. A link from a feature to itself loops from the bow round to the stern, beside it.
export interface Curve {
  p0: Vec;
  p1: Vec;
  p2: Vec;
  p3: Vec;
}

export function curveOf(edge: Edge, graph: Graph, layout: Layout): Curve {
  const from = layout[edge.from]!;
  const to = layout[edge.to]!;
  const p0 = bowOf(from, graph.nodes[edge.from]!.length);
  const p3 = sternOf(to, graph.nodes[edge.to]!.length);
  const outward = direction(from.angle);
  const inward = direction(to.angle);

  if (edge.from === edge.to) {
    const reach = 1.4 * BEAM;
    const aside = scale(perpendicular(outward), 2.2 * BEAM);
    return { p0, p1: add(add(p0, scale(outward, reach)), aside), p2: add(sub(p3, scale(inward, reach)), aside), p3 };
  }
  const reach = Math.max(30, Math.min(150, 0.32 * distance(p0, p3)));
  return { p0, p1: add(p0, scale(outward, reach)), p2: sub(p3, scale(inward, reach)), p3 };
}

export const SEGMENTS = 10;

export const polylineOf = (curve: Curve): Vec[] => sampleCubic(curve.p0, curve.p1, curve.p2, curve.p3, SEGMENTS);
