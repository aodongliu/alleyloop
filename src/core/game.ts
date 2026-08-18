import type { ConnectionEvidence, EntityId } from "./model.ts";
import type { ConnectionGraph, ShortestPath } from "./graph.ts";

export interface GameState {
  readonly startId: EntityId;
  readonly targetId: EntityId;
  readonly path: readonly EntityId[];
  readonly won: boolean;
}

export interface Submission {
  readonly accepted: boolean;
  readonly won: boolean;
  readonly duplicate: boolean;
  readonly evidence: readonly ConnectionEvidence[];
  readonly state: GameState;
}

export interface ConnectionHint {
  readonly evidence: readonly ConnectionEvidence[];
}

export const createGame = (startId: EntityId, targetId: EntityId): GameState => ({
  startId,
  targetId,
  path: [startId],
  won: startId === targetId,
});

export const submitConnection = (graph: ConnectionGraph, state: GameState, nextId: EntityId): Submission => {
  const current = state.path[state.path.length - 1];
  const duplicate = state.path.includes(nextId);
  const evidence = duplicate ? [] : graph.sharedEvidence(current, nextId);
  if (state.won || duplicate || evidence.length === 0) {
    return { accepted: false, won: state.won, duplicate, evidence, state };
  }
  const path = [...state.path, nextId];
  const nextState = { ...state, path, won: nextId === state.targetId };
  return { accepted: true, won: nextState.won, duplicate: false, evidence, state: nextState };
};

export const linkCount = (state: GameState): number => Math.max(0, state.path.length - 1);

/** Keep the chain through `pathIndex`, removing later players and recomputing completion. */
export const rewindGame = (state: GameState, pathIndex: number): GameState => {
  if (!Number.isInteger(pathIndex) || pathIndex < 0 || pathIndex >= state.path.length) return state;
  const path = state.path.slice(0, pathIndex + 1);
  return {
    ...state,
    path,
    won: path.at(-1) === state.targetId,
  };
};

/** Reveal only the shared-group clue for an unused shortest-route neighbor. */
export const nextShortestHint = (graph: ConnectionGraph, state: GameState): ConnectionHint | null => {
  if (state.won) return null;
  const current = state.path.at(-1);
  if (!current) return null;
  const nextId = graph.shortestPath(current, state.targetId, state.path.slice(0, -1))?.ids[1];
  if (!nextId) return null;
  const evidence = graph.sharedEvidence(current, nextId);
  return evidence.length ? { evidence } : null;
};

/** The answer is presentation-controlled and may be revealed before completion. */
export const revealShortestPath = (graph: ConnectionGraph, state: GameState): ShortestPath => {
  const path = graph.shortestPath(state.startId, state.targetId);
  if (!path) throw new Error("Target is unreachable");
  return path;
};
