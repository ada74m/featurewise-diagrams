import { boatLength } from "./boat";

// The extractor's JSON: a service's features and the links between them.
export interface GraphJson {
  service: string;
  features: { name: string; family: "command" | "query" | "worker"; cases: string[] }[];
  links: { from: string; to: string; via: string[] }[];
}

export interface Node {
  name: string;
  family: string;
  length: number;
}

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

export function graphOf(json: GraphJson): Graph {
  const index = new Map(json.features.map((feature, i) => [feature.name, i]));
  return {
    service: json.service,
    nodes: json.features.map(feature => ({ name: feature.name, family: feature.family, length: boatLength(feature.name) })),
    edges: json.links
      .filter(link => index.has(link.from) && index.has(link.to))
      .map(link => ({ from: index.get(link.from)!, to: index.get(link.to)!, via: link.via }))
  };
}
