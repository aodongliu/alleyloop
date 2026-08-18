import assert from "node:assert/strict";
import test from "node:test";
import { ConnectionGraph } from "../../src/core/graph.ts";
import { submitConnection } from "../../src/core/game.ts";
import {
  loadProgress,
  progressStorageKey,
  restoreGame,
  saveProgress,
  type StorageLike,
} from "../../src/game/persistence.ts";

class MemoryStorage implements StorageLike {
  values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

const graph = new ConnectionGraph(
  ["a", "b", "c"].map((id) => ({ id, label: id })),
  [
    { id: "one", label: "One", period: "2020", memberIds: ["a", "b"] },
    { id: "two", label: "Two", period: "2021", memberIds: ["b", "c"] },
  ],
);

test("progress round-trips and is revalidated through the graph", () => {
  const storage = new MemoryStorage();
  const key = progressStorageKey("test", "puzzle");
  let state = restoreGame(graph, "a", "c", null);
  state = submitConnection(graph, state, "b").state;
  state = submitConnection(graph, state, "c").state;
  saveProgress(storage, key, state, true);
  const snapshot = loadProgress(storage, key);
  assert.deepEqual(restoreGame(graph, "a", "c", snapshot).path, ["a", "b", "c"]);
  assert.equal(snapshot?.answerRevealed, true);
});

test("invalid and corrupted snapshots reset safely", () => {
  const storage = new MemoryStorage();
  const key = progressStorageKey("test", "bad");
  storage.setItem(key, "not json");
  assert.equal(loadProgress(storage, key), null);
  const invalid = { version: 1 as const, path: ["a", "c"], answerRevealed: false };
  assert.deepEqual(restoreGame(graph, "a", "c", invalid).path, ["a"]);
});
