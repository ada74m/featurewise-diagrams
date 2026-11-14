import { BEAM, FONT_SIZE, hullPath, textOffset } from "./boat";
import { extentOf } from "./fitness";
import { direction, sub, type Vec } from "./geometry";
import type { Graph } from "./graph";
import { curveOf, type Layout } from "./layout";

// Draws a layout as an SVG document: the links first, as smooth curves from bow to stern with an
// arrowhead at the stern, then the boats over them, each with its name along the keel, reading upright.

const FILL: Record<string, string> = {
  query: "#e8f1fb",
  command: "#fdf0dc",
  worker: "#eeeeee"
};

const f = (n: number) => n.toFixed(1);

export function svgOf(graph: Graph, layout: Layout, title = graph.service): string {
  const extent = extentOf(graph, layout);
  const margin = 2.5 * BEAM;
  const x = extent.minX - margin;
  const y = extent.minY - margin;
  const width = extent.maxX - extent.minX + 2 * margin;
  const height = extent.maxY - extent.minY + 2 * margin;

  const links = graph.edges.map(edge => {
    const { p0, p1, p2, p3 } = curveOf(edge, graph, layout);
    return `  <path d="M ${f(p0.x)} ${f(p0.y)} C ${f(p1.x)} ${f(p1.y)}, ${f(p2.x)} ${f(p2.y)}, ${f(p3.x)} ${f(p3.y)}" class="link"/>\n`
      + `  ${arrowhead(p3, sub(p3, p2))}`;
  });

  const boats = graph.nodes.map((node, i) => {
    const p = layout[i]!;
    const degrees = (p.angle * 180) / Math.PI;
    // Names read stern to bow, as on the toy boat, unless that would turn them upside down.
    const flip = Math.cos(p.angle) < -1e-6 || (Math.abs(Math.cos(p.angle)) <= 1e-6 && Math.sin(p.angle) > 0);
    const along = textOffset(node.length, node.name);
    const text = flip
      ? `<text x="${f(-along)}" y="0" transform="rotate(180)">${escape(node.name)}</text>`
      : `<text x="${f(along)}" y="0">${escape(node.name)}</text>`;
    return `  <g transform="translate(${f(p.x)} ${f(p.y)}) rotate(${f(degrees)})" class="boat ${node.family}">\n`
      + `    <title>${escape(node.name)} (${node.family})</title>\n`
      + `    <path d="${hullPath(node.length)}" fill="${FILL[node.family] ?? "#ffffff"}"/>\n`
      + `    ${text}\n`
      + `  </g>`;
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${f(x)} ${f(y)} ${f(width)} ${f(height)}" width="${f(width)}" height="${f(height)}">
  <title>${escape(title)}</title>
  <style>
    .link { fill: none; stroke: #444; stroke-width: 1.6; }
    .arrow { fill: #444; }
    .boat path { stroke: #111; stroke-width: 1.8; stroke-linejoin: round; }
    .boat text { font-family: Helvetica, "Helvetica Neue", Arial, sans-serif; font-weight: bold; font-size: ${f(FONT_SIZE)}px;
                 fill: #111; text-anchor: middle; dominant-baseline: central; }
  </style>
  <rect x="${f(x)}" y="${f(y)}" width="${f(width)}" height="${f(height)}" fill="#ffffff"/>
${links.join("\n")}
${boats.join("\n")}
</svg>
`;
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
