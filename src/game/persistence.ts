import type { ConnectionGraph } from "../core/graph.ts";
import { createGame, submitConnection, type GameState } from "../core/game.ts";
import type { EntityId } from "../core/model.ts";

const SNAPSHOT_VERSION = 1;

export interface GameProgressSnapshot {
  version: typeof SNAPSHOT_VERSION;
  path: EntityId[];
  answerRevealed: boolean;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const progressStorageKey = (sport: string, puzzleId: string): string =>
  `alleyloop:${sport}:${puzzleId}:v${SNAPSHOT_VERSION}`;

const isSnapshot = (value: unknown): value is GameProgressSnapshot => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<GameProgressSnapshot>;
  return candidate.version === SNAPSHOT_VERSION
    && Array.isArray(candidate.path)
    && candidate.path.every((id) => typeof id === "string")
    && typeof candidate.answerRevealed === "boolean";
};

export const loadProgress = (storage: StorageLike, key: string): GameProgressSnapshot | null => {
  try {
    const serialized = storage.getItem(key);
    if (!serialized) return null;
    const value: unknown = JSON.parse(serialized);
    return isSnapshot(value) ? value : null;
  } catch {
    return null;
  }
};

export const saveProgress = (
  storage: StorageLike,
  key: string,
  state: GameState,
  answerRevealed: boolean,
): void => {
  const snapshot: GameProgressSnapshot = {
    version: SNAPSHOT_VERSION,
    path: [...state.path],
    answerRevealed,
  };
  try {
    storage.setItem(key, JSON.stringify(snapshot));
  } catch {
    // Storage may be blocked or full; gameplay should continue in memory.
  }
};

export const clearProgress = (storage: StorageLike, key: string): void => {
  try {
    storage.removeItem(key);
  } catch {
    // Treat persistence as an optional enhancement.
  }
};

/** Replays a saved path through the engine so stale or tampered state is never trusted. */
export const restoreGame = (
  graph: ConnectionGraph,
  startId: EntityId,
  targetId: EntityId,
  snapshot: GameProgressSnapshot | null,
): GameState => {
  let state = createGame(startId, targetId);
  if (!snapshot || snapshot.path[0] !== startId) return state;
  for (const entityId of snapshot.path.slice(1)) {
    const submission = submitConnection(graph, state, entityId);
    if (!submission.accepted) return createGame(startId, targetId);
    state = submission.state;
  }
  return state;
};
