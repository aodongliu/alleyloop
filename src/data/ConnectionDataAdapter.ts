import type { DailySchedule } from "../core/daily.ts";
import type { Entity, MembershipGroup } from "../core/model.ts";

/** Domain-neutral hand-off format consumed by the shared connection engine. */
export interface NormalizedConnectionDataset {
  schemaVersion: number;
  /** Preferred discriminator for new adapters such as movies. */
  domain?: string;
  /** Backward-compatible discriminator used by the first NBA dataset. */
  sport?: string;
  source?: Record<string, unknown>;
  entities: Entity[];
  groups: MembershipGroup[];
}

export interface ConnectionGameData {
  dataset: NormalizedConnectionDataset;
  schedule: DailySchedule;
}

/** A replaceable source adapter for any AlleyLoop domain. */
export interface ConnectionDataAdapter {
  readonly id: string;
  load(): Promise<ConnectionGameData>;
}
