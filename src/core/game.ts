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
  /** The suggested next entity; a presentation may keep it hidden and show only the evidence. */
  readonly nextId: EntityId;
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

/**
 * Once the player has added someone who shares a group with the target, the last
 * link is no longer a decision, so the chain completes itself. The untouched
 * opening position is left alone: a direct start-to-target link still has to be played.
 */
export const finishIfLinked = (graph: ConnectionGraph, state: GameState): Submission | null => {
  if (state.won || state.path.length < 2) return null;
  const submission = submitConnection(graph, state, state.targetId);
  return submission.accepted ? submission : null;
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

/** The best-known unused neighbor on a shortest route from the current entity, with its shared-group clue. */
export const nextShortestHint = (
  graph: ConnectionGraph,
  state: GameState,
  /** The answer the presentation would reveal; while the chain is still on it, the hint follows it. */
  answer: readonly EntityId[] = [],
): ConnectionHint | null => {
  if (state.won) return null;
  const current = state.path.at(-1);
  if (!current) return null;
  const onAnswer = state.path.length < answer.length && state.path.every((id, index) => id === answer[index]);
  const nextId = onAnswer
    ? answer[state.path.length]
    : graph.prominentShortestPath(current, state.targetId, state.path.slice(0, -1))?.ids[1];
  if (!nextId) return null;
  const evidence = graph.sharedEvidence(current, nextId);
  return evidence.length ? { nextId, evidence } : null;
};

/** The answer is presentation-controlled and may be revealed before completion. */
export const revealShortestPath = (graph: ConnectionGraph, state: GameState): ShortestPath => {
  const path = graph.shortestPath(state.startId, state.targetId);
  if (!path) throw new Error("Target is unreachable");
  return path;
};
