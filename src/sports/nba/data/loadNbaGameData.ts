import type { DailySchedule } from "../../../core/daily.ts";
import type {
  ConnectionDataAdapter,
  ConnectionGameData,
  NormalizedConnectionDataset,
} from "../../../data/ConnectionDataAdapter.ts";
import { assertEligibleNbaScheduleEndpoints } from "./endpointEligibility.ts";

interface PuzzleDocument extends DailySchedule {
  schemaVersion: number;
}

const fetchJson = async (path: string): Promise<unknown> => {
  const response = await fetch(`${import.meta.env.BASE_URL}${path}`);
  if (!response.ok) throw new Error(`Failed to load ${path}: ${response.status}`);
  return response.json() as Promise<unknown>;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object";

const parseDataset = (value: unknown): NormalizedConnectionDataset => {
  if (!isRecord(value)
    || value.sport !== "nba"
    || !Array.isArray(value.entities)
    || !Array.isArray(value.groups)
    || typeof value.schemaVersion !== "number") {
    throw new Error("NBA graph data has an unsupported shape");
  }
  return value as unknown as NormalizedConnectionDataset;
};

const parseSchedule = (value: unknown): PuzzleDocument => {
  if (!isRecord(value)
    || !Array.isArray(value.slates)
    || typeof value.anchorDate !== "string"
    || typeof value.timeZone !== "string"
    || typeof value.schemaVersion !== "number") {
    throw new Error("NBA puzzle schedule has an unsupported shape");
  }
  return value as unknown as PuzzleDocument;
};

export class NbaDataAdapter implements ConnectionDataAdapter {
  readonly id = "nba";

  async load(): Promise<ConnectionGameData> {
    const [datasetValue, scheduleValue] = await Promise.all([
      fetchJson("data/nba-graph.json"),
      fetchJson("data/nba-puzzles.json"),
    ]);
    const dataset = parseDataset(datasetValue);
    const schedule = parseSchedule(scheduleValue);
    assertEligibleNbaScheduleEndpoints(dataset, schedule);
    return { dataset, schedule };
  }
}
