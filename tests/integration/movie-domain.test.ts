import assert from "node:assert/strict";
import test from "node:test";
import { selectDailySlate, type DailySchedule } from "../../src/core/daily.ts";
import { ConnectionGraph } from "../../src/core/graph.ts";
import {
  createGame,
  linkCount,
  nextShortestHint,
  submitConnection,
} from "../../src/core/game.ts";
import {
  loadProgress,
  progressStorageKey,
  restoreGame,
  saveProgress,
  type StorageLike,
} from "../../src/game/persistence.ts";
import type { ConnectionDataAdapter } from "../../src/data/ConnectionDataAdapter.ts";

const people = [
  { id: "person:1", label: "José Stone", aliases: ["Jose Stone"], searchRank: 10 },
  { id: "person:2", label: "Ben Lee", searchRank: 20 },
  { id: "person:3", label: "Cora Diaz", searchRank: 90 },
  { id: "person:4", label: "Drew Kim", searchRank: 30 },
  { id: "person:5", label: "Eli Park", searchRank: 40 },
  { id: "person:6", label: "Faye Noor", searchRank: 50 },
];

const films = [
  {
    id: "movie:1",
    label: "First Feature",
    period: "2020",
    memberIds: ["person:1", "person:2", "person:3"],
    metadata: { medium: "film" },
  },
  { id: "movie:2", label: "Second Feature", period: "2021", memberIds: ["person:3", "person:4"] },
  { id: "movie:3", label: "Third Feature", period: "2022", memberIds: ["person:4", "person:5"] },
  { id: "movie:4", label: "Final Feature", period: "2023", memberIds: ["person:5", "person:6"] },
];

const graph = new ConnectionGraph(people, films);
const movieSchedule: DailySchedule = {
  anchorDate: "2026-08-16",
  timeZone: "America/Los_Angeles",
  slates: [{
    easy: {
      id: "movie-easy",
      startId: "person:1",
      targetId: "person:2",
      difficulty: "easy",
      expectedShortestLinks: 1,
    },
    hard: {
      id: "movie-hard",
      startId: "person:1",
      targetId: "person:6",
      difficulty: "hard",
      expectedShortestLinks: 4,
    },
  }],
};
const movieAdapter: ConnectionDataAdapter = {
  id: "movies",
  async load() {
    return {
      dataset: {
        schemaVersion: 1,
        domain: "movies",
        entities: people,
        groups: films,
      },
      schedule: movieSchedule,
    };
  },
};

class MemoryStorage implements StorageLike {
  private readonly values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

test("the shared engine treats films as connection evidence without movie-specific logic", () => {
  assert.deepEqual(graph.sharedEvidence("person:1", "person:3"), [{
    groupId: "movie:1",
    label: "First Feature",
    period: "2020",
    metadata: { medium: "film" },
  }]);
  assert.equal(graph.validateChain(["person:1", "person:3", "person:4"]).valid, true);
  assert.deepEqual(graph.validateChain(["person:1", "person:2", "person:4"]).invalidLinks, [1]);
  assert.deepEqual(graph.shortestPath("person:1", "person:6"), {
    ids: ["person:1", "person:3", "person:4", "person:5", "person:6"],
    links: 4,
  });
  assert.equal(graph.search("jose")[0].id, "person:1");
  assert.equal(graph.search("cor")[0].id, "person:3");
});

test("a movie adapter loads through the same domain-neutral boundary as the NBA adapter", async () => {
  const loaded = await movieAdapter.load();
  assert.equal(movieAdapter.id, "movies");
  assert.equal(loaded.dataset.domain, "movies");
  assert.equal(new ConnectionGraph(loaded.dataset.entities, loaded.dataset.groups).groups().length, 4);
});

test("a longer movie-credit chain still wins and the hint exposes only a film", () => {
  let state = createGame("person:1", "person:6");
  assert.deepEqual(nextShortestHint(graph, state), {
    evidence: [{
      groupId: "movie:1",
      label: "First Feature",
      period: "2020",
      metadata: { medium: "film" },
    }],
  });
  for (const id of ["person:2", "person:3", "person:4", "person:5", "person:6"]) {
    const submission = submitConnection(graph, state, id);
    assert.equal(submission.accepted, true);
    state = submission.state;
  }
  assert.equal(state.won, true);
  assert.equal(linkCount(state), 5);
  assert.equal(graph.shortestPath(state.startId, state.targetId)?.links, 4);
});

test("daily movie puzzles and saved progress reuse the shared contracts", () => {
  const slate = selectDailySlate(movieSchedule, new Date("2026-08-16T18:00:00Z"), graph);
  assert.equal(slate.hard.id, "movie-hard");

  const storage = new MemoryStorage();
  const movieKey = progressStorageKey("movies", "fixture");
  assert.notEqual(movieKey, progressStorageKey("nba", "fixture"));
  let state = createGame("person:1", "person:6");
  state = submitConnection(graph, state, "person:3").state;
  saveProgress(storage, movieKey, state, false);
  assert.deepEqual(
    restoreGame(graph, "person:1", "person:6", loadProgress(storage, movieKey)).path,
    ["person:1", "person:3"],
  );
});
