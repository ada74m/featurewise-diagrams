import { BEAM, boatLength } from "./boat";

// The extractor's JSON: a service's features and the links between them.
export interface GraphJson {
  service: string;
  features: { name: string; family: "command" | "query" | "worker"; cases: string[] }[];
  links: { from: string; to: string; via: string[] }[];
}

// A feature, drawn as a boat, or a queue, drawn as a plain stack of slots. A queue's family is "queue".
export interface Node {
  name: string;
  family: string;
  length: number;
}

// A queue is as long as a short boat: work goes in at its stern end and comes out at its bow end.
export const QUEUE_LENGTH = 2.6 * BEAM;

export interface Edge {
  from: number;
  to: number;
  via: string[];
}

export interface Graph {
  service: string;
  nodes: Node[];
  edges: Edge[];
}

// A link to a worker can't be offered to anyone, since nobody waits for a worker's result: the
// entrypoint puts it on a queue, and the worker takes it from there. So each worker with links to it gets
// a queue in front of it, the links go to the queue, and one more goes from the queue to the worker.
export function graphOf(json: GraphJson): Graph {
  const index = new Map(json.features.map((feature, i) => [feature.name, i]));
  const nodes: Node[] = json.features.map(feature => ({ name: feature.name, family: feature.family, length: boatLength(feature.name) }));
  const edges: Edge[] = [];
  const queues = new Map<number, number>();

  for (const link of json.links) {
    const from = index.get(link.from);
    const to = index.get(link.to);
    if (from === undefined || to === undefined)
      continue;
    if (nodes[to]!.family !== "worker") {
      edges.push({ from, to, via: link.via });
      continue;
    }
    let queue = queues.get(to);
    if (queue === undefined) {
      queue = nodes.push({ name: `${link.to} queue`, family: "queue", length: QUEUE_LENGTH }) - 1;
      queues.set(to, queue);
      edges.push({ from: queue, to, via: [] });
    }
    edges.push({ from, to: queue, via: link.via });
  }
  return { service: json.service, nodes, edges };
}
