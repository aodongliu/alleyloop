import type { DailyDifficulty, DailyEntry } from "../../../core/daily.ts";
import type { ConnectionGraph } from "../../../core/graph.ts";
import type { Entity } from "../../../core/model.ts";
import { sampleRandomPair } from "../../../core/random-pair.ts";
import { isEligibleNbaEndpoint } from "./endpointEligibility.ts";

/** Unlimited endpoints should be names a typical NBA fan has a fair chance to know. */
export const NBA_RANDOM_MIN_KNOWNNESS = 70;
export const NBA_RANDOM_MAX_ERA_GAP = 25;

/** Reviewed post-1996 endpoint pairs that retain Hard's required 4–6-link distance. */
export const NBA_RANDOM_HARD_ENDPOINT_PAIRS = [
  ["nba:person:1000", "nba:person:1631114"],
  ["nba:person:1000", "nba:person:1631096"],
  ["nba:person:1000", "nba:person:1642851"],
  ["nba:person:1607", "nba:person:1641739"],
  ["nba:person:1607", "nba:person:1630703"],
  ["nba:person:1134", "nba:person:1631094"],
  ["nba:person:1641824", "nba:person:955"],
  ["nba:person:949", "nba:person:1642349"],
  ["nba:person:1496", "nba:person:1642349"],
  ["nba:person:1000", "nba:person:1641717"],
] as const;

const seasonYear = (value: unknown): number | null => {
  if (typeof value !== "string") return null;
  const match = /^(\d{4})/.exec(value);
  return match ? Number(match[1]) : null;
};

export const nbaCareerEraGap = (a: Entity, b: Entity): number => {
  const aFrom = seasonYear(a.metadata?.activeFrom);
  const aTo = seasonYear(a.metadata?.activeTo);
  const bFrom = seasonYear(b.metadata?.activeFrom);
  const bTo = seasonYear(b.metadata?.activeTo);
  if (aFrom === null || aTo === null || bFrom === null || bTo === null) {
    return Number.POSITIVE_INFINITY;
  }
  return Math.max(0, Math.max(aFrom, bFrom) - Math.min(aTo, bTo));
};

export const isRecognizableNbaPlayer = (entity: Entity): boolean =>
  isEligibleNbaEndpoint(entity)
  && typeof entity.metadata?.knownnessScore === "number"
  && entity.metadata.knownnessScore >= NBA_RANDOM_MIN_KNOWNNESS
  && seasonYear(entity.metadata.activeFrom) !== null
  && seasonYear(entity.metadata.activeTo) !== null;

export const randomNbaPuzzle = (
  graph: ConnectionGraph,
  difficulty: DailyDifficulty,
  serial: number,
  rng: () => number = Math.random,
): DailyEntry => {
  if (difficulty === "hard") {
    const validPairs = NBA_RANDOM_HARD_ENDPOINT_PAIRS.flatMap(([leftId, rightId]) => {
      const left = graph.getEntity(leftId);
      const right = graph.getEntity(rightId);
      if (!left || !right || !isEligibleNbaEndpoint(left) || !isEligibleNbaEndpoint(right)) return [];
      const shortest = graph.shortestPath(leftId, rightId);
      if (!shortest || shortest.links < 4 || shortest.links > 6) return [];
      if (nbaCareerEraGap(left, right) > NBA_RANDOM_MAX_ERA_GAP) return [];
      return [{ left, right, links: shortest.links }];
    });
    if (validPairs.length) {
      const pairIndex = Math.min(validPairs.length - 1, Math.floor(Math.max(0, rng()) * validPairs.length));
      const pair = validPairs[pairIndex];
      const reverse = rng() >= 0.5;
      const start = reverse ? pair.right : pair.left;
      const target = reverse ? pair.left : pair.right;
      return {
        id: `unlimited-${difficulty}-${serial}-${start.id}-${target.id}`,
        startId: start.id,
        targetId: target.id,
        difficulty,
        expectedShortestLinks: pair.links,
        eraGapYears: nbaCareerEraGap(start, target),
      };
    }
  }

  const candidates = graph.entities().filter(isRecognizableNbaPlayer);
  const pair = sampleRandomPair({
    graph,
    candidates,
    difficulty,
    rng,
    maxAttempts: 1024,
    pairFilter: (start, target) => nbaCareerEraGap(start, target) <= NBA_RANDOM_MAX_ERA_GAP,
  });
  const start = graph.getEntity(pair.startId);
  const target = graph.getEntity(pair.targetId);
  if (!start || !target) throw new Error("Random NBA matchup references an unknown player");
  return {
    id: `unlimited-${difficulty}-${serial}-${pair.startId}-${pair.targetId}`,
    startId: pair.startId,
    targetId: pair.targetId,
    difficulty,
    expectedShortestLinks: pair.links,
    eraGapYears: nbaCareerEraGap(start, target),
  };
};
