import assert from "node:assert/strict";
import test from "node:test";
import { ConnectionGraph } from "../../src/core/graph.ts";
import { sampleRandomPair } from "../../src/core/random-pair.ts";

const easyEntities = ["a", "b", "c"].map((id) => ({ id, label: id }));
const easyGraph = new ConnectionGraph(easyEntities, [
  { id: "one", label: "One", period: "2020", memberIds: ["a", "b"] },
  { id: "two", label: "Two", period: "2021", memberIds: ["b", "c"] },
]);

test("random pair sampler accepts an injected RNG and enforces easy bounds", () => {
  const values = [0, 0.99];
  const pair = sampleRandomPair({
    graph: easyGraph,
    candidates: easyEntities,
    difficulty: "easy",
    rng: () => values.shift() ?? 0,
  });
  assert.deepEqual(pair, { startId: "a", targetId: "c", links: 2 });
});

test("random pair sampler applies domain pair filters after graph bounds", () => {
  const pair = sampleRandomPair({
    graph: easyGraph,
    candidates: easyEntities,
    difficulty: "easy",
    rng: (() => {
      const values = [0, 0.34];
      return () => values.shift() ?? 0;
    })(),
    pairFilter: (start, target) => start.id === "a" && target.id === "b",
  });
  assert.deepEqual(pair, { startId: "a", targetId: "b", links: 1 });
});

test("random pair sampler reports when no pair can satisfy the requested difficulty", () => {
  assert.throws(() => sampleRandomPair({
    graph: easyGraph,
    candidates: easyEntities,
    difficulty: "hard",
    rng: () => 0,
    maxAttempts: 4,
  }), /Could not find a random hard pair/);
});
