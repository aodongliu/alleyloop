import type { DailySchedule } from "../../../core/daily.ts";
import type { Entity } from "../../../core/model.ts";
import type { NormalizedConnectionDataset } from "../../../data/ConnectionDataAdapter.ts";

/** Matchup endpoints must have entered the NBA in 1996-97 or later. */
export const NBA_MIN_ENDPOINT_ENTRY_SEASON_START_YEAR = 1996;

export const nbaEntrySeasonStartYear = (entity: Entity): number | null => {
  const activeFrom = entity.metadata?.activeFrom;
  if (typeof activeFrom !== "string") return null;
  const match = /^(\d{4})-\d{2}$/.exec(activeFrom);
  return match ? Number(match[1]) : null;
};

export const isEligibleNbaEndpoint = (entity: Entity): boolean => {
  const entryYear = nbaEntrySeasonStartYear(entity);
  return entryYear !== null && entryYear >= NBA_MIN_ENDPOINT_ENTRY_SEASON_START_YEAR;
};

/** Validate only curated start/target selection; this intentionally leaves the graph untouched. */
export const assertEligibleNbaScheduleEndpoints = (
  dataset: NormalizedConnectionDataset,
  schedule: DailySchedule,
): void => {
  const entityById = new Map(dataset.entities.map((entity) => [entity.id, entity]));
  for (const slate of schedule.slates) {
    for (const puzzle of [slate.easy, slate.hard]) {
      for (const endpointId of [puzzle.startId, puzzle.targetId]) {
        const entity = entityById.get(endpointId);
        if (!entity || !isEligibleNbaEndpoint(entity)) {
          throw new Error(`NBA matchup endpoint ${endpointId} must have entered the league in 1996-97 or later`);
        }
      }
    }
  }
};
