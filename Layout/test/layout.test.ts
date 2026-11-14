import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { Annealer } from "../src/anneal";
import { boatLength, hullPath, textWidth } from "../src/boat";
import { score } from "../src/fitness";
import { pointToSegment, segmentsCross, vec } from "../src/geometry";
import { graphOf, type GraphJson } from "../src/graph";
import { svgOf } from "../src/render";

const lostProperty = graphOf(JSON.parse(readFileSync(new URL("../public/lost-property.json", import.meta.url), "utf8")) as GraphJson);

describe("geometry", () => {
  it("knows when segments cross, and not when they only touch", () => {
    expect(segmentsCross(vec(0, 0), vec(10, 10), vec(0, 10), vec(10, 0))).toBe(true);
    expect(segmentsCross(vec(0, 0), vec(10, 0), vec(0, 5), vec(10, 5))).toBe(false);
    expect(segmentsCross(vec(0, 0), vec(10, 0), vec(10, 0), vec(20, 5))).toBe(false);
    expect(pointToSegment(vec(5, 5), vec(0, 0), vec(10, 0))).toBe(5);
  });
});

describe("boats", () => {
  it("are long enough for their names, and closed shapes", () => {
    expect(boatLength("HandleCharityCollectionDue")).toBeGreaterThan(boatLength("ClaimItem"));
    expect(boatLength("ClaimItem")).toBeGreaterThan(textWidth("ClaimItem"));
    expect(hullPath(200).trim().endsWith("Z")).toBe(true);
  });
});

describe("the lost property office", () => {
  it("reads every feature and link the extractor found", () => {
    expect(lostProperty.nodes).toHaveLength(9);
    expect(lostProperty.edges).toHaveLength(16);
    expect(lostProperty.edges.filter(edge => edge.from === edge.to)).toHaveLength(3);
  });

  it("anneals to a layout with no crossings or crowding, the same way every time for a seed", () => {
    const first = new Annealer(lostProperty, { seed: 7, steps: 60000 });
    const start = first.current.total;
    first.run(Infinity);
    expect(first.bestScore.terms.crossings).toBe(0);
    expect(first.bestScore.terms.crowding).toBeLessThan(0.05);
    expect(first.bestScore.total).toBeLessThan(start / 3);

    const again = new Annealer(lostProperty, { seed: 7, steps: 60000 });
    again.run(Infinity);
    expect(again.bestScore.total).toBe(first.bestScore.total);
    expect(score(lostProperty, first.best).total).toBeCloseTo(first.bestScore.total);
  }, 30000);

  it("draws every boat and every link, and a key of the families", () => {
    const annealer = new Annealer(lostProperty, { seed: 1, steps: 100 });
    annealer.run(Infinity);
    const svg = svgOf(lostProperty, annealer.best);
    expect(svg.match(/class="boat /g)).toHaveLength(9 + 3);
    expect(svgOf(lostProperty, annealer.best, { key: false }).match(/class="boat /g)).toHaveLength(9);
    expect(svg).toContain(">Handler</text>");
    expect(svg.match(/class="link"/g)).toHaveLength(16);
    expect(svg).toContain(">HandleCharityCollectionDue</text>");
  });
});
