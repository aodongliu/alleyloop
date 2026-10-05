import type { DailyEntry } from "../../../core/daily.ts";
import type { ConnectionGraph } from "../../../core/graph.ts";
import type { Entity } from "../../../core/model.ts";
import { sampleRandomPair } from "../../../core/random-pair.ts";
import { isEligibleNbaEndpoint } from "./endpointEligibility.ts";

/** Extra-game endpoints should be names a typical NBA fan has a fair chance to know. */
export const NBA_RANDOM_MIN_KNOWNNESS = 70;
export const NBA_RANDOM_MAX_ERA_GAP = 25;
/** The best-known shortest route must run through players this recognizable. */
export const NBA_RANDOM_MIN_CONNECTOR_KNOWNNESS = 65;

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
  serial: number,
  rng: () => number = Math.random,
): DailyEntry => {
  const candidates = graph.entities().filter(isRecognizableNbaPlayer);
  let route: string[] = [];
  const pair = sampleRandomPair({
    graph,
    candidates,
    difficulty: "easy",
    rng,
    maxAttempts: 1024,
    pairFilter: (start, target, shortest) => {
      if (shortest.links > 3 || nbaCareerEraGap(start, target) > NBA_RANDOM_MAX_ERA_GAP) return false;
      route = graph.prominentShortestPath(start.id, target.id)?.ids ?? [];
      return route.slice(1, -1).every((id) => {
        const score = graph.getEntity(id)?.metadata?.knownnessScore;
        return typeof score === "number" && score >= NBA_RANDOM_MIN_CONNECTOR_KNOWNNESS;
      });
    },
  });
  const start = graph.getEntity(pair.startId);
  const target = graph.getEntity(pair.targetId);
  if (!start || !target) throw new Error("Random NBA matchup references an unknown player");
  return {
    id: `extra-${serial}-${pair.startId}-${pair.targetId}`,
    startId: pair.startId,
    targetId: pair.targetId,
    difficulty: "easy",
    expectedShortestLinks: pair.links,
    eraGapYears: nbaCareerEraGap(start, target),
    featuredOptimalPath: route,
  };
};
