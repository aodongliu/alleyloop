import type { ConnectionEvidence } from "../../../core/model.ts";

interface SeasonEntry {
  period: string;
  startYear?: number;
}

export interface NbaTeamEvidenceGroup {
  key: string;
  teamId?: string;
  teamAbbrev: string;
  label: string;
  labels: readonly string[];
  seasons: readonly string[];
  earliestSeasonStart: number;
  logoUrl?: string;
  description: string;
}

interface MutableTeamGroup {
  key: string;
  teamId?: string;
  abbreviations: string[];
  entries: Array<{ label: string; season: SeasonEntry }>;
}

export const shortSeasonLabel = (season: string): string => {
  const [start, end] = season.split("-");
  if (!start || !end) return season;
  return `${start.slice(-2)}/${end.slice(-2)}`;
};

export const compactSeasonRanges = (seasons: readonly string[]): string[] => {
  const sorted = [...new Set(seasons)].sort((a, b) => {
    const aYear = Number.parseInt(a.slice(0, 4), 10);
    const bYear = Number.parseInt(b.slice(0, 4), 10);
    return (Number.isFinite(aYear) ? aYear : Number.MAX_SAFE_INTEGER)
      - (Number.isFinite(bYear) ? bYear : Number.MAX_SAFE_INTEGER)
      || a.localeCompare(b);
  });
  if (!sorted.length) return [];

  const ranges: string[] = [];
  let runStart = sorted[0];
  let runEnd = sorted[0];
  for (const season of sorted.slice(1)) {
    const previousYear = Number.parseInt(runEnd.slice(0, 4), 10);
    const nextYear = Number.parseInt(season.slice(0, 4), 10);
    if (Number.isFinite(previousYear) && nextYear === previousYear + 1) {
      runEnd = season;
      continue;
    }
    ranges.push(runStart === runEnd
      ? shortSeasonLabel(runStart)
      : `${shortSeasonLabel(runStart)}–${shortSeasonLabel(runEnd)}`);
    runStart = season;
    runEnd = season;
  }
  ranges.push(runStart === runEnd
    ? shortSeasonLabel(runStart)
    : `${shortSeasonLabel(runStart)}–${shortSeasonLabel(runEnd)}`);
  return ranges;
};

const metadataString = (value: unknown): string | undefined => {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return undefined;
};

const fallbackKey = (evidence: ConnectionEvidence): string =>
  `label:${evidence.label.trim().toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-")}`;

const initials = (label: string): string => label
  .split(/\s+/)
  .filter(Boolean)
  .map((part) => part[0]?.toUpperCase() ?? "")
  .join("")
  .slice(0, 3);

const seasonStart = (evidence: ConnectionEvidence): number => {
  const value = evidence.metadata?.seasonStartYear;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number.parseInt(evidence.period.slice(0, 4), 10);
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
};

/** Collapse team-season evidence into one NBA team entry without losing seasons. */
export const collapseNbaTeamEvidence = (
  evidence: readonly ConnectionEvidence[],
): NbaTeamEvidenceGroup[] => {
  const grouped = new Map<string, MutableTeamGroup>();

  for (const item of evidence) {
    const teamId = metadataString(item.metadata?.teamId);
    const key = teamId ? `team:${teamId}` : fallbackKey(item);
    const teamAbbrev = metadataString(item.metadata?.teamAbbrev);
    const group = grouped.get(key) ?? {
      key,
      teamId,
      abbreviations: [],
      entries: [],
    };
    if (teamAbbrev && !group.abbreviations.includes(teamAbbrev)) group.abbreviations.push(teamAbbrev);
    group.entries.push({
      label: item.label,
      season: { period: item.period, startYear: seasonStart(item) },
    });
    grouped.set(key, group);
  }

  return [...grouped.values()].map((group): NbaTeamEvidenceGroup => {
    const sortedEntries = [...group.entries].sort((a, b) =>
      (a.season.startYear ?? Number.MAX_SAFE_INTEGER) - (b.season.startYear ?? Number.MAX_SAFE_INTEGER)
      || a.season.period.localeCompare(b.season.period));
    const labels = [...new Set(sortedEntries.map((entry) => entry.label))];
    const seasons = [...new Set(sortedEntries.map((entry) => entry.season.period))];
    const label = sortedEntries.at(-1)?.label ?? "NBA team";
    const teamAbbrev = group.abbreviations.at(-1) ?? initials(label);
    const earliestSeasonStart = sortedEntries[0]?.season.startYear ?? Number.MAX_SAFE_INTEGER;
    const historicalNames = labels.length > 1 ? ` (${labels.join(" / ")})` : "";
    const description = `${label}${historicalNames}; shared roster season${seasons.length === 1 ? "" : "s"}: ${seasons.join(", ")}`;

    return {
      key: group.key,
      teamId: group.teamId,
      teamAbbrev,
      label,
      labels,
      seasons,
      earliestSeasonStart,
      logoUrl: group.teamId
        ? `https://cdn.nba.com/logos/nba/${encodeURIComponent(group.teamId)}/primary/L/logo.svg`
        : undefined,
      description,
    };
  }).sort((a, b) =>
    a.earliestSeasonStart - b.earliestSeasonStart
    || (Number(a.teamId) || Number.MAX_SAFE_INTEGER) - (Number(b.teamId) || Number.MAX_SAFE_INTEGER)
    || a.label.localeCompare(b.label));
};
