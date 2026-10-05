import type { StorageLike } from "./persistence.ts";

const STATS_VERSION = 1;
const DAY_MS = 86400000;

/** How one daily puzzle was finished on its own day. */
export interface DailySolve {
  links: number;
  shortest: number;
  hints: number;
}

/** Solves keyed by the puzzle's ISO date. */
export type DailySolves = Record<string, DailySolve>;

export interface DailyStats {
  solved: number;
  /** Days in a row, counting today or, if today is still open, up to yesterday. */
  current: number;
  best: number;
  /** Solves that used no more links than the shortest route. */
  matchedShortest: number;
  averageHints: number;
}

export const statsStorageKey = (namespace: string): string => `alleyloop:${namespace}:stats:v${STATS_VERSION}`;

const dayNumber = (date: string): number => Math.floor(Date.parse(`${date}T00:00:00Z`) / DAY_MS);
const count = (value: unknown): number => (typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0);

export const loadDailySolves = (storage: StorageLike, namespace: string): DailySolves => {
  try {
    const value: unknown = JSON.parse(storage.getItem(statsStorageKey(namespace)) ?? "null");
    const stored = (value as { solves?: unknown } | null)?.solves;
    if (!stored || typeof stored !== "object") return {};
    const solves: DailySolves = {};
    for (const [date, solve] of Object.entries(stored as Record<string, Partial<DailySolve> | null>)) {
      if (!Number.isFinite(dayNumber(date)) || !solve) continue;
      solves[date] = { links: count(solve.links), shortest: count(solve.shortest), hints: count(solve.hints) };
    }
    return solves;
  } catch {
    return {};
  }
};

/** Keeps the first result for a date, so replaying a finished puzzle cannot improve it. */
export const recordDailySolve = (
  storage: StorageLike,
  namespace: string,
  date: string,
  solve: DailySolve,
): DailySolves => {
  const solves = loadDailySolves(storage, namespace);
  if (solves[date]) return solves;
  solves[date] = solve;
  try {
    storage.setItem(statsStorageKey(namespace), JSON.stringify({ version: STATS_VERSION, solves }));
  } catch {
    // Stats are optional; the game itself does not depend on them.
  }
  return solves;
};

export const dailyStats = (solves: DailySolves, today: string): DailyStats => {
  const days = Object.keys(solves).map(dayNumber).sort((a, b) => a - b);
  let best = 0;
  let run = 0;
  let current = 0;
  days.forEach((day, index) => {
    run = index > 0 && day === days[index - 1] + 1 ? run + 1 : 1;
    best = Math.max(best, run);
    // The streak survives until a whole day passes without a solve.
    if (day === dayNumber(today) || day === dayNumber(today) - 1) current = run;
  });
  const results = Object.values(solves);
  return {
    solved: results.length,
    current,
    best,
    matchedShortest: results.filter((solve) => solve.links <= solve.shortest).length,
    averageHints: results.length ? results.reduce((sum, solve) => sum + solve.hints, 0) / results.length : 0,
  };
};
