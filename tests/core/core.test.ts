import assert from "node:assert/strict";
import test from "node:test";
import { ConnectionGraph, normalizeSearchText } from "../../src/core/graph.ts";
import { createGame, linkCount, nextShortestHint, revealShortestPath, rewindGame, submitConnection } from "../../src/core/game.ts";
import { selectDailyChallenge, selectDailySlate } from "../../src/core/daily.ts";

const entities = ["a", "b", "c", "d", "e"].map((id) => ({
  id,
  label: id === "a" ? "José Alpha" : id.toUpperCase(),
  searchRank: id === "c" ? 90 : 10,
}));
const graph = new ConnectionGraph(entities, [
  { id: "g1", label: "Club One", period: "2020", memberIds: ["a", "b", "c"] },
  { id: "g2", label: "Club Two", period: "2021", memberIds: ["c", "d"] },
  { id: "g3", label: "Club Three", period: "2022", memberIds: ["d", "e"] },
]);

test("groups provide all shared evidence and graph adjacency", () => {
  assert.deepEqual(graph.sharedEvidence("a", "b"), [{ groupId: "g1", label: "Club One", period: "2020", metadata: undefined }]);
  assert.deepEqual(graph.neighbors("c").sort(), ["a", "b", "d"]);
  assert.equal(graph.areConnected("a", "d"), false);
  assert.deepEqual(graph.membershipEvidence("d"), [
    { groupId: "g2", label: "Club Two", period: "2021", metadata: undefined },
    { groupId: "g3", label: "Club Three", period: "2022", metadata: undefined },
  ]);
  assert.deepEqual(graph.membershipEvidence("missing"), []);
});

test("validateChain reports each link and its shared evidence", () => {
  const result = graph.validateChain(["a", "b", "d"]);
  assert.equal(result.valid, false);
  assert.deepEqual(result.invalidLinks, [1]);
  assert.equal(result.links[0].valid, true);
  assert.deepEqual(result.links[0].evidence, [
    { groupId: "g1", label: "Club One", period: "2020", metadata: undefined },
  ]);
  assert.equal(result.links[1].evidence.length, 0);
  assert.equal(graph.validateChain(["a", "c", "d"]).valid, true);
  assert.equal(graph.validateChain(["a", "missing"]).valid, false);
});

test("search folds accents and matches aliases", () => {
  assert.equal(graph.search("jose")[0].id, "a");
  assert.equal(graph.search("ALP")[0].id, "a");
  assert.equal(graph.search("c")[0].id, "c");
  assert.equal(normalizeSearchText("O’Neal"), "oneal");
});

test("BFS returns exact shortest path", () => {
  assert.deepEqual(graph.shortestPath("a", "e"), { ids: ["a", "c", "d", "e"], links: 3 });
  assert.equal(graph.shortestPath("b", "e", ["c"]), null);
});

test("a longer valid chain wins despite a shorter available route", () => {
  let state = createGame("a", "e");
  const first = submitConnection(graph, state, "b"); state = first.state;
  assert.equal(first.accepted, true);
  state = submitConnection(graph, state, "c").state;
  state = submitConnection(graph, state, "d").state;
  const final = submitConnection(graph, state, "e");
  assert.equal(final.won, true);
  assert.equal(linkCount(final.state), 4);
  assert.deepEqual(revealShortestPath(graph, createGame("a", "e")), { ids: ["a", "c", "d", "e"], links: 3 });
  assert.deepEqual(revealShortestPath(graph, final.state), { ids: ["a", "c", "d", "e"], links: 3 });
});

test("hint reveals shared evidence, not the unused player on the shortest remaining route", () => {
  let state = createGame("a", "e");
  assert.deepEqual(nextShortestHint(graph, state), {
    evidence: [{ groupId: "g1", label: "Club One", period: "2020", metadata: undefined }],
  });
  state = submitConnection(graph, state, "b").state;
  assert.deepEqual(nextShortestHint(graph, state), {
    evidence: [{ groupId: "g1", label: "Club One", period: "2020", metadata: undefined }],
  });
  state = submitConnection(graph, state, "c").state;
  state = submitConnection(graph, state, "d").state;
  assert.deepEqual(nextShortestHint(graph, state), {
    evidence: [{ groupId: "g3", label: "Club Three", period: "2022", metadata: undefined }],
  });
  state = submitConnection(graph, state, "e").state;
  assert.equal(nextShortestHint(graph, state), null);
});

test("duplicates are rejected and do not mutate state", () => {
  const state = submitConnection(graph, createGame("a", "e"), "b").state;
  const duplicate = submitConnection(graph, state, "a");
  assert.equal(duplicate.accepted, false);
  assert.equal(duplicate.duplicate, true);
  assert.deepEqual(duplicate.state.path, ["a", "b"]);
});

test("rewind removes later players while retaining the requested player", () => {
  let state = createGame("a", "e");
  state = submitConnection(graph, state, "b").state;
  state = submitConnection(graph, state, "c").state;
  state = submitConnection(graph, state, "d").state;
  const rewound = rewindGame(state, 1);
  assert.deepEqual(rewound.path, ["a", "b"]);
  assert.equal(rewound.won, false);
  assert.deepEqual(rewindGame(rewound, -1), rewound);
  assert.deepEqual(rewindGame(rewound, 99), rewound);
});

test("rewinding a completed chain clears the win and never removes the start", () => {
  let state = createGame("a", "e");
  for (const id of ["b", "c", "d", "e"]) state = submitConnection(graph, state, id).state;
  assert.equal(state.won, true);
  const undone = rewindGame(state, 3);
  assert.deepEqual(undone.path, ["a", "b", "c", "d"]);
  assert.equal(undone.won, false);
  assert.deepEqual(rewindGame(state, 0).path, ["a"]);
  assert.equal(rewindGame(state, 0).won, false);
  assert.deepEqual(rewindGame(state, state.path.length - 1), state);
});

test("daily selection is timezone-stable, deterministic, and has only easy/hard", () => {
  const rotation = [
    { startId: "a", targetId: "b", difficulty: "easy" as const },
    { startId: "a", targetId: "e", difficulty: "hard" as const },
  ];
  const now = new Date("2026-08-15T23:30:00Z");
  const la = selectDailyChallenge(rotation, "easy", now, "America/Los_Angeles");
  const again = selectDailyChallenge(rotation, "easy", now, "America/Los_Angeles");
  assert.deepEqual(la, again);
  assert.equal(la.difficulty, "easy");
  assert.throws(() => selectDailyChallenge(rotation, "medium" as never, now));

  const schedule = {
    anchorDate: "2026-08-15",
    timeZone: "America/Los_Angeles",
    slates: [{
      id: "opening-day",
      easy: { id: "easy-1", startId: "a", targetId: "b", difficulty: "easy" as const },
      hard: {
        id: "hard-1",
        startId: "a",
        targetId: "e",
        difficulty: "hard" as const,
        expectedShortestLinks: 3,
      },
    }],
  };
  assert.throws(() => selectDailySlate(schedule, now, graph), /Hard challenge/);
  const selected = selectDailySlate(schedule, now);
  assert.equal(selected.id, "opening-day");
  assert.equal(selected.date, "2026-08-15");
});
