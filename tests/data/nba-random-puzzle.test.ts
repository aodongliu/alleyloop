import assert from "node:assert/strict";
import test from "node:test";
import { ConnectionGraph } from "../../src/core/graph.ts";
import { NBA_RANDOM_MAX_ERA_GAP, randomNbaPuzzle } from "../../src/sports/nba/data/randomNbaPuzzle.ts";

const entities = ["a", "b", "c", "d", "e"].map((id) => ({
  id,
  label: id.toUpperCase(),
  metadata: {
    knownnessScore: 80,
    activeFrom: "2000-01",
    activeTo: "2010-11",
  },
}));
const graph = new ConnectionGraph(entities, [
  { id: "ab", label: "AB", period: "2000-01", memberIds: ["a", "b"] },
  { id: "bc", label: "BC", period: "2001-02", memberIds: ["b", "c"] },
  { id: "cd", label: "CD", period: "2002-03", memberIds: ["c", "d"] },
  { id: "de", label: "DE", period: "2003-04", memberIds: ["d", "e"] },
]);

test("NBA unlimited puzzles keep recognizable endpoints inside difficulty and era bounds", () => {
  const values = [0, 0.999];
  const puzzle = randomNbaPuzzle(graph, "hard", 7, () => values.shift() ?? 0);
  assert.equal(puzzle.startId, "a");
  assert.equal(puzzle.targetId, "e");
  assert.equal(puzzle.expectedShortestLinks, 4);
  assert.ok((puzzle.eraGapYears ?? Infinity) <= NBA_RANDOM_MAX_ERA_GAP);
  assert.match(puzzle.id ?? "", /^unlimited-hard-7-/);
});
