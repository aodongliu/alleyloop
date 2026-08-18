import type {
  ConnectionGameData,
  NormalizedConnectionDataset,
} from "./ConnectionDataAdapter.ts";

/** @deprecated Import the domain-neutral names from ConnectionDataAdapter instead. */
export type NormalizedSportDataset = NormalizedConnectionDataset & { sport: string };

/** @deprecated Import the domain-neutral names from ConnectionDataAdapter instead. */
export type SportGameData = Omit<ConnectionGameData, "dataset"> & {
  dataset: NormalizedSportDataset;
};

/** @deprecated New adapters should implement ConnectionDataAdapter with an `id`. */
export interface SportDataAdapter {
  readonly sport: string;
  load(): Promise<SportGameData>;
}
