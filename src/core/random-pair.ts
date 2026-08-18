import type { ConnectionGraph, ShortestPath } from "./graph.ts";
import type { Entity, EntityId } from "./model.ts";

export type RandomPairDifficulty = "easy" | "hard";

export interface RandomPair {
  startId: EntityId;
  targetId: EntityId;
  links: number;
}

export interface RandomPairOptions {
  graph: ConnectionGraph;
  candidates: readonly Entity[];
  difficulty: RandomPairDifficulty;
  /** Injectable for deterministic tests and seeded experiences. */
  rng?: () => number;
  /** Additional domain-specific filtering, such as an NBA career-era limit. */
  pairFilter?: (start: Entity, target: Entity, shortest: ShortestPath) => boolean;
  maxAttempts?: number;
}

const bounds: Record<RandomPairDifficulty, readonly [number, number]> = {
  easy: [1, 4],
  hard: [4, 6],
};

const randomIndex = (length: number, rng: () => number): number => {
  const raw = rng();
  const value = Number.isFinite(raw) ? raw : 0;
  return Math.min(length - 1, Math.max(0, Math.floor(Math.max(0, Math.min(0.999999999, value)) * length)));
};

/**
 * Selects an eligible random endpoint pair at the requested difficulty.
 * The graph and candidate list are generic; sport-specific recognizability and
 * era rules belong in pairFilter/candidate preparation at the composition edge.
 */
export const sampleRandomPair = ({
  graph,
  candidates,
  difficulty,
  rng = Math.random,
  pairFilter,
  maxAttempts = 512,
}: RandomPairOptions): RandomPair => {
  const [minimumLinks, maximumLinks] = bounds[difficulty];
  const eligible = [...new Map(candidates
    .filter((candidate) => graph.getEntity(candidate.id))
    .map((candidate) => [candidate.id, candidate])).values()];
  if (eligible.length < 2) throw new Error("Random pair needs at least two known candidates");

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const start = eligible[randomIndex(eligible.length, rng)];
    const target = eligible[randomIndex(eligible.length, rng)];
    if (start.id === target.id) continue;
    const shortest = graph.shortestPath(start.id, target.id);
    if (!shortest || shortest.links < minimumLinks || shortest.links > maximumLinks) continue;
    if (pairFilter && !pairFilter(start, target, shortest)) continue;
    return { startId: start.id, targetId: target.id, links: shortest.links };
  }
  throw new Error(`Could not find a random ${difficulty} pair after ${maxAttempts} attempts`);
};
