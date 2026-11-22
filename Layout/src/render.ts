import { BEAM, boatLength, FONT_SIZE, hullPath, textOffset, textWidth } from "./boat";
import { extentOf } from "./fitness";
import { direction, sub, type Box, type Vec } from "./geometry";
import { QUEUE_LENGTH, type Graph } from "./graph";
import { bowOf, curveOf, keelOf, polylineOf, sternOf, type Layout } from "./layout";

// Draws a layout as an SVG document: the links first, as smooth curves from bow to stern with an
// arrowhead at the stern, then the boats over them, each with its name along the keel, reading upright.
// A boat's family shows twice, so it survives printing in black and white: in its fill, and in its
// outline, which is plain for a query, bold for a command and bold and dashed for a worker. A queue is a
// plain stack of slots, with no name: what it holds is the worker it leads to.

// The colours: each family's fill, the outlines and names, the links, and the background. The plain
// palette is the tool's own; the brand palette is Featurewise's, from the logo's blue and green, for
// featurewise.dev.
export interface Palette {
  fill: Record<string, string>;
  ink: string;
  outline: string;
  link: string;
  background: string;
}

export const PLAIN: Palette = {
  fill: { query: "#e8f1fb", command: "#fdf0dc", worker: "#eeeeee" },
  ink: "#111",
  outline: "#111",
  link: "#444",
  background: "#ffffff"
};

export const BRAND: Palette = {
  fill: { query: "#dce8f1", command: "#e1edd9", worker: "#f1f1f1" },
  ink: "#1d1d1f",
  outline: "#2e5f85",
  link: "#6b8599",
  background: "#ffffff"
};

const f = (n: number) => n.toFixed(1);

// The key: one boat for each family, one above the other, in a box in the bottom right-hand corner.
const KEY = [
  { label: "Query", family: "query" },
  { label: "Command", family: "command" },
  { label: "Worker", family: "worker" },
  { label: "Queue", family: "queue" }
];
const KEY_PAD = 0.6 * BEAM;
const KEY_ROW = 1.5 * BEAM;
// The key is drawn smaller than the diagram, text and all, so it doesn't compete with it.
const KEY_SCALE = 0.75;

export interface Options {
  title?: string;
  // Whether to draw the key. It's drawn unless told not to.
  key?: boolean;
  // The space around the diagram, in beams: 2.5 unless told otherwise, and less for a picture on a page.
  margin?: number;
  // The colours, the tool's own unless told otherwise.
  palette?: Palette;
}

export function svgOf(graph: Graph, layout: Layout, options: Options = {}): string {
  const title = options.title ?? graph.service;
  const withKey = options.key ?? true;
  const palette = options.palette ?? PLAIN;
  // The key shows a queue only if the diagram has one.
  const keyEntries = KEY.filter(entry => entry.family !== "queue" || graph.nodes.some(node => node.family === "queue"));
  const extent = extentOf(graph, layout);
  const margin = (options.margin ?? 2.5) * BEAM;
  const x = extent.minX - margin;
  const y = extent.minY - margin;
  let width = extent.maxX - extent.minX + 2 * margin;
  const height = extent.maxY - extent.minY + 2 * margin;

  // The key's boats are all as long as the longest, so they line up in a column.
  const keyBoat = Math.max(...keyEntries.map(entry => boatLength(entry.label)));
  const keyQueue = keyEntries.some(entry => entry.family === "queue") ? QUEUE_LENGTH + 0.3 * BEAM + textWidth("Queue") : 0;
  const keyInnerWidth = Math.max(keyBoat, keyQueue) + 2 * KEY_PAD;
  const keyInnerHeight = keyEntries.length * KEY_ROW - (KEY_ROW - BEAM) + 2 * KEY_PAD;
  const keyWidth = keyInnerWidth * KEY_SCALE;
  const keyHeight = keyInnerHeight * KEY_SCALE;
  // In the corner if it's clear of the diagram, and beside it otherwise.
  let keyLeft = x + width - BEAM - keyWidth;
  const keyTop = y + height - BEAM - keyHeight;
  if (withKey && !clear(graph, layout, { minX: keyLeft - BEAM / 2, minY: keyTop - BEAM / 2, maxX: keyLeft + keyWidth + BEAM / 2, maxY: keyTop + keyHeight + BEAM / 2 })) {
    keyLeft = extent.maxX + BEAM;
    width = keyLeft + keyWidth + BEAM - x;
  }
  const key = withKey
    ? [`  <g transform="translate(${f(keyLeft)} ${f(keyTop)}) scale(${KEY_SCALE})" class="key">`,
      `  <rect x="0" y="0" width="${f(keyInnerWidth)}" height="${f(keyInnerHeight)}" rx="8"/>`,
      ...keyEntries.map((entry, i) => entry.family === "queue"
        ? queueSvg(KEY_PAD + QUEUE_LENGTH / 2, KEY_PAD + BEAM / 2 + i * KEY_ROW, 0, "Queues", "Queue")
        : boatSvg(entry.label, entry.family, keyBoat, KEY_PAD + keyBoat / 2, KEY_PAD + BEAM / 2 + i * KEY_ROW, 0, `${entry.label}s`, palette)),
      "  </g>"]
    : [];

  const links = graph.edges.map(edge => {
    const { p0, p1, p2, p3 } = curveOf(edge, graph, layout);
    return `  <path d="M ${f(p0.x)} ${f(p0.y)} C ${f(p1.x)} ${f(p1.y)}, ${f(p2.x)} ${f(p2.y)}, ${f(p3.x)} ${f(p3.y)}" class="link"/>\n`
      + `  ${arrowhead(p3, sub(p3, p2))}`;
  });

  const boats = graph.nodes.map((node, i) => {
    const p = layout[i]!;
    return node.family === "queue"
      ? queueSvg(p.x, p.y, p.angle, node.name)
      : boatSvg(node.name, node.family, node.length, p.x, p.y, p.angle, `${node.name} (${node.family})`, palette);
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${f(x)} ${f(y)} ${f(width)} ${f(height)}" width="${f(width)}" height="${f(height)}">
  <title>${escape(title)}</title>
  <style>
    .link { fill: none; stroke: ${palette.link}; stroke-width: 1.6; }
    .arrow { fill: ${palette.link}; }
    .key > rect { fill: ${palette.background}; stroke: #999; stroke-width: 1.3; }
    .boat path { stroke: ${palette.outline}; stroke-width: 1.8; stroke-linejoin: round; }
    .boat.command path { stroke-width: 3.4; }
    .boat.worker path { stroke-width: 3.4; stroke-dasharray: 7 4.5; stroke-linecap: butt; }
    .queue rect, .queue line { fill: ${palette.background}; stroke: ${palette.outline}; stroke-width: 1.8; }
    .queue text { font-family: Helvetica, "Helvetica Neue", Arial, sans-serif; font-weight: bold; font-size: ${f(FONT_SIZE)}px;
                  fill: ${palette.ink}; dominant-baseline: central; }
    .boat text { font-family: Helvetica, "Helvetica Neue", Arial, sans-serif; font-weight: bold; font-size: ${f(FONT_SIZE)}px;
                 fill: ${palette.ink}; text-anchor: middle; dominant-baseline: central; }
  </style>
  <rect x="${f(x)}" y="${f(y)}" width="${f(width)}" height="${f(height)}" fill="${palette.background}"/>
${links.join("\n")}
${boats.join("\n")}
${key.join("\n")}
</svg>
`;
}

// Whether nothing of the diagram, boat or link, comes inside the box.
function clear(graph: Graph, layout: Layout, box: Box): boolean {
  const inside = (p: Vec) => p.x >= box.minX && p.x <= box.maxX && p.y >= box.minY && p.y <= box.maxY;
  for (const [i, node] of graph.nodes.entries()) {
    const [a, b] = keelOf(layout[i]!, node.length);
    const ends = [bowOf(layout[i]!, node.length), sternOf(layout[i]!, node.length), a, b];
    if (ends.some(inside) || [a, b].some(p => p.x >= box.minX - BEAM && p.x <= box.maxX + BEAM && p.y >= box.minY - BEAM && p.y <= box.maxY + BEAM))
      return false;
  }
  return !graph.edges.some(edge => polylineOf(curveOf(edge, graph, layout)).some(inside));
}

function boatSvg(name: string, family: string, length: number, x: number, y: number, angle: number, tooltip: string, palette: Palette): string {
  const degrees = (angle * 180) / Math.PI;
  // Names read stern to bow, as on the toy boat, unless that would turn them upside down.
  const flip = Math.cos(angle) < -1e-6 || (Math.abs(Math.cos(angle)) <= 1e-6 && Math.sin(angle) > 0);
  const along = textOffset(length, name);
  const text = flip
    ? `<text x="${f(-along)}" y="0" transform="rotate(180)">${escape(name)}</text>`
    : `<text x="${f(along)}" y="0">${escape(name)}</text>`;
  return `  <g transform="translate(${f(x)} ${f(y)}) rotate(${f(degrees)})" class="boat ${family}">\n`
    + `    <title>${escape(tooltip)}</title>\n`
    + `    <path d="${hullPath(length)}" fill="${palette.fill[family] ?? palette.background}"/>\n`
    + `    ${text}\n`
    + `  </g>`;
}

// A queue: a box divided into slots, along the line work moves through it. In the key, it's labelled
// beside the stack, since a queue has no name of its own to carry.
const SLOTS = 4;
const QUEUE_DEPTH = 0.8 * BEAM;

function queueSvg(x: number, y: number, angle: number, tooltip: string, label?: string): string {
  const degrees = (angle * 180) / Math.PI;
  const left = -QUEUE_LENGTH / 2;
  const top = -QUEUE_DEPTH / 2;
  const dividers = Array.from({ length: SLOTS - 1 }, (_, i) => {
    const at = left + ((i + 1) * QUEUE_LENGTH) / SLOTS;
    return `<line x1="${f(at)}" y1="${f(top)}" x2="${f(at)}" y2="${f(-top)}"/>`;
  }).join("");
  const text = label ? `\n    <text x="${f(QUEUE_LENGTH / 2 + 0.3 * BEAM)}" y="0">${escape(label)}</text>` : "";
  return `  <g transform="translate(${f(x)} ${f(y)}) rotate(${f(degrees)})" class="queue">\n`
    + `    <title>${escape(tooltip)}</title>\n`
    + `    <rect x="${f(left)}" y="${f(top)}" width="${f(QUEUE_LENGTH)}" height="${f(QUEUE_DEPTH)}" rx="2"/>${dividers}${text}\n`
    + `  </g>`;
}

function arrowhead(tip: Vec, heading: Vec): string {
  const angle = Math.atan2(heading.y, heading.x);
  const size = 9;
  const spread = 0.45;
  const left = direction(angle + Math.PI - spread);
  const right = direction(angle + Math.PI + spread);
  return `<path d="M ${f(tip.x)} ${f(tip.y)} L ${f(tip.x + left.x * size)} ${f(tip.y + left.y * size)} L ${f(tip.x + right.x * size)} ${f(tip.y + right.y * size)} Z" class="arrow"/>`;
}

const escape = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
