// Plane geometry for boats and the curves between them. Angles are in radians, measured as SVG measures
// them: clockwise from the positive x axis, since y points down.

export interface Vec {
  x: number;
  y: number;
}

export const vec = (x: number, y: number): Vec => ({ x, y });
export const add = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y });
export const scale = (a: Vec, k: number): Vec => ({ x: a.x * k, y: a.y * k });
export const dot = (a: Vec, b: Vec): number => a.x * b.x + a.y * b.y;
export const length = (a: Vec): number => Math.hypot(a.x, a.y);
export const distance = (a: Vec, b: Vec): number => Math.hypot(a.x - b.x, a.y - b.y);
export const direction = (angle: number): Vec => ({ x: Math.cos(angle), y: Math.sin(angle) });
// The direction a quarter turn anticlockwise on screen from the given one.
export const perpendicular = (a: Vec): Vec => ({ x: a.y, y: -a.x });

// The smallest angle between two directions, from 0 to pi.
export function angleBetween(a: Vec, b: Vec): number {
  const la = length(a);
  const lb = length(b);
  if (la === 0 || lb === 0)
    return 0;
  return Math.acos(Math.max(-1, Math.min(1, dot(a, b) / (la * lb))));
}

// A point on a cubic Bezier curve.
export function cubic(p0: Vec, p1: Vec, p2: Vec, p3: Vec, t: number): Vec {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return { x: a * p0.x + b * p1.x + c * p2.x + d * p3.x, y: a * p0.y + b * p1.y + c * p2.y + d * p3.y };
}

// A cubic Bezier curve as a polyline of the given number of segments.
export function sampleCubic(p0: Vec, p1: Vec, p2: Vec, p3: Vec, segments: number): Vec[] {
  const points: Vec[] = [];
  for (let i = 0; i <= segments; i++)
    points.push(cubic(p0, p1, p2, p3, i / segments));
  return points;
}

const cross = (o: Vec, a: Vec, b: Vec): number => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

// Whether segments ab and cd cross, touching excepted.
export function segmentsCross(a: Vec, b: Vec, c: Vec, d: Vec): boolean {
  const d1 = cross(c, d, a);
  const d2 = cross(c, d, b);
  const d3 = cross(a, b, c);
  const d4 = cross(a, b, d);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

// The distance from point p to segment ab.
export function pointToSegment(p: Vec, a: Vec, b: Vec): number {
  const ab = sub(b, a);
  const lengthSquared = dot(ab, ab);
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, dot(sub(p, a), ab) / lengthSquared));
  return distance(p, add(a, scale(ab, t)));
}

// The distance between segments ab and cd.
export function segmentToSegment(a: Vec, b: Vec, c: Vec, d: Vec): number {
  if (segmentsCross(a, b, c, d))
    return 0;
  return Math.min(pointToSegment(a, c, d), pointToSegment(b, c, d), pointToSegment(c, a, b), pointToSegment(d, a, b));
}

// A bounding box, for quick rejection before the exact tests.
export interface Box {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function boxOf(points: Vec[]): Box {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}

export const boxesOverlap = (a: Box, b: Box, margin = 0): boolean =>
  a.minX - margin <= b.maxX && b.minX - margin <= a.maxX && a.minY - margin <= b.maxY && b.minY - margin <= a.maxY;
