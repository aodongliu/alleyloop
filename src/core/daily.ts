import type { ConnectionGraph } from "./graph.ts";
import type { EntityId } from "./model.ts";

export type DailyDifficulty = "easy" | "hard";
export interface DailyEntry {
  id?: string;
  startId: EntityId;
  targetId: EntityId;
  difficulty: DailyDifficulty;
  expectedShortestLinks?: number;
  /** Precomputed curation metadata; selection keeps it opaque and sport-neutral. */
  eraGapYears?: number;
  featuredOptimalPath?: EntityId[];
  recognizability?: number;
  curationNote?: string;
}
export interface DailyChallenge extends DailyEntry {
  date: string;
  index: number;
}
export interface DailySlate {
  id?: string;
  date?: string;
  easy: DailyEntry & { difficulty: "easy" };
  hard: DailyEntry & { difficulty: "hard" };
}
export interface DailySchedule {
  anchorDate: string;
  timeZone: string;
  maxEraGapYears?: number;
  slates: DailySlate[];
}
export interface ResolvedDailySlate extends DailySlate {
  date: string;
  index: number;
}

const localDate = (date: Date, timezone: string): string => {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
};
const dayNumber = (date: string): number => Math.floor(Date.parse(`${date}T00:00:00Z`) / 86400000);

const validateDifficulty = (entry: DailyEntry, graph: ConnectionGraph): void => {
  const shortest = graph.shortestPath(entry.startId, entry.targetId);
  if (!shortest) throw new Error(`Daily challenge ${entry.id ?? ""} is unreachable`.trim());
  if (entry.difficulty === "easy" && (shortest.links < 1 || shortest.links > 4)) {
    throw new Error("Easy challenge must be within 1–4 links");
  }
  if (entry.difficulty === "hard" && (shortest.links < 4 || shortest.links > 6)) {
    throw new Error("Hard challenge must be 4–6 links");
  }
  if (entry.expectedShortestLinks !== undefined && entry.expectedShortestLinks !== shortest.links) {
    throw new Error(`Expected ${entry.expectedShortestLinks} links but graph has ${shortest.links}`);
  }
  if (entry.featuredOptimalPath) {
    const featured = entry.featuredOptimalPath;
    const validation = graph.validateChain(featured);
    if (!validation.valid
      || featured[0] !== entry.startId
      || featured.at(-1) !== entry.targetId
      || featured.length - 1 !== shortest.links) {
      throw new Error("Featured path must be a valid optimal path between the puzzle endpoints");
    }
  }
};

/** Selects from a curated, prevalidated rotation. The rotation contains no Medium mode. */
export const selectDailyChallenge = (
  rotation: readonly DailyEntry[],
  difficulty: DailyDifficulty,
  now = new Date(),
  timezone = "UTC",
  graph?: ConnectionGraph,
): DailyChallenge => {
  if (difficulty !== "easy" && difficulty !== "hard") throw new Error("Difficulty must be easy or hard");
  const candidates = rotation.filter((entry) => entry.difficulty === difficulty);
  if (!candidates.length) throw new Error(`No ${difficulty} challenges in rotation`);
  const date = localDate(now, timezone);
  const index = ((dayNumber(date) % candidates.length) + candidates.length) % candidates.length;
  const entry = candidates[index];
  if (graph) validateDifficulty(entry, graph);
  return { ...entry, date, index };
};

/** Resolve the same curated Easy/Hard slate for every visitor in a timezone day. */
export const selectDailySlate = (
  schedule: DailySchedule,
  now = new Date(),
  graph?: ConnectionGraph,
): ResolvedDailySlate => {
  if (!schedule.slates.length) throw new Error("Daily schedule has no slates");
  const date = localDate(now, schedule.timeZone);
  const offset = dayNumber(date) - dayNumber(schedule.anchorDate);
  if (!Number.isFinite(offset)) throw new Error("Daily schedule has an invalid anchor date");
  const index = ((offset % schedule.slates.length) + schedule.slates.length) % schedule.slates.length;
  const slate = schedule.slates[index];
  if (slate.easy.difficulty !== "easy" || slate.hard.difficulty !== "hard") {
    throw new Error("Each daily slate must contain exactly Easy and Hard puzzles");
  }
  if (graph) {
    validateDifficulty(slate.easy, graph);
    validateDifficulty(slate.hard, graph);
  }
  return { ...slate, date, index };
};
