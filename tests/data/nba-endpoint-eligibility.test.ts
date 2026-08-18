import assert from "node:assert/strict";
import test from "node:test";
import type { DailySchedule } from "../../src/core/daily.ts";
import type { Entity } from "../../src/core/model.ts";
import type { NormalizedConnectionDataset } from "../../src/data/ConnectionDataAdapter.ts";
import {
  assertEligibleNbaScheduleEndpoints,
  isEligibleNbaEndpoint,
} from "../../src/sports/nba/data/endpointEligibility.ts";

const player = (id: string, activeFrom: string): Entity => ({
  id,
  label: id,
  metadata: { activeFrom },
});

test("NBA endpoint eligibility includes 1996-97 and excludes earlier or malformed careers", () => {
  assert.equal(isEligibleNbaEndpoint(player("old", "1995-96")), false);
  assert.equal(isEligibleNbaEndpoint(player("boundary", "1996-97")), true);
  assert.equal(isEligibleNbaEndpoint(player("modern", "2020-21")), true);
  assert.equal(isEligibleNbaEndpoint(player("unknown", "2020")), false);
});

test("daily endpoint validation does not restrict intermediate graph members", () => {
  const dataset: NormalizedConnectionDataset = {
    schemaVersion: 1,
    sport: "nba",
    entities: [player("old", "1995-96"), player("start", "1996-97"), player("target", "2020-21")],
    groups: [{ id: "g", label: "Team", period: "2020-21", memberIds: ["start", "old", "target"] }],
  };
  const schedule: DailySchedule = {
    anchorDate: "2026-08-15",
    timeZone: "America/Los_Angeles",
    slates: [{
      easy: { difficulty: "easy", startId: "start", targetId: "target" },
      hard: { difficulty: "hard", startId: "target", targetId: "start" },
    }],
  };

  assert.doesNotThrow(() => assertEligibleNbaScheduleEndpoints(dataset, schedule));
  schedule.slates[0].easy.startId = "old";
  assert.throws(
    () => assertEligibleNbaScheduleEndpoints(dataset, schedule),
    /1996-97 or later/,
  );
  assert.deepEqual(dataset.groups[0].memberIds, ["start", "old", "target"]);
});
