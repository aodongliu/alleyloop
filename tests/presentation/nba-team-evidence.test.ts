import assert from "node:assert/strict";
import test from "node:test";
import type { ConnectionEvidence } from "../../src/core/model.ts";
import { collapseNbaTeamEvidence, compactSeasonRanges, shortSeasonLabel } from "../../src/sports/nba/presentation/teamEvidence.ts";

const evidence = (
  teamId: string,
  label: string,
  period: string,
  seasonStartYear: number,
  teamAbbrev: string,
): ConnectionEvidence => ({
  groupId: `nba:team-season:${teamId}:${period}`,
  label,
  period,
  metadata: { teamId, teamAbbrev, seasonStartYear },
});

test("NBA evidence renders one team entry while preserving every shared season", () => {
  const collapsed = collapseNbaTeamEvidence([
    evidence("1610612741", "Chicago Bulls", "1997-98", 1997, "CHI"),
    evidence("1610612741", "Chicago Bulls", "1995-96", 1995, "CHI"),
    evidence("1610612741", "Chicago Bulls", "1996-97", 1996, "CHI"),
    evidence("1610612741", "Chicago Bulls", "1996-97", 1996, "CHI"),
  ]);

  assert.equal(collapsed.length, 1);
  assert.equal(collapsed[0].label, "Chicago Bulls");
  assert.deepEqual(collapsed[0].seasons, ["1995-96", "1996-97", "1997-98"]);
  assert.equal(collapsed[0].logoUrl, "https://cdn.nba.com/logos/nba/1610612741/primary/L/logo.svg");
});

test("distinct team IDs stay distinct and historical labels remain available", () => {
  const collapsed = collapseNbaTeamEvidence([
    evidence("1610612740", "Oklahoma City Hornets", "2006-07", 2006, "NOK"),
    evidence("1610612740", "New Orleans Hornets", "2007-08", 2007, "NOH"),
    evidence("1610612746", "Los Angeles Clippers", "2011-12", 2011, "LAC"),
  ]);

  assert.equal(collapsed.length, 2);
  assert.deepEqual(collapsed[0].labels, ["Oklahoma City Hornets", "New Orleans Hornets"]);
  assert.equal(collapsed[0].label, "New Orleans Hornets");
  assert.match(collapsed[0].description, /2006-07, 2007-08/);
  assert.equal(collapsed[1].teamId, "1610612746");
});

test("season labels are short and consecutive seasons collapse into ranges", () => {
  assert.equal(shortSeasonLabel("2025-26"), "25/26");
  assert.deepEqual(compactSeasonRanges([
    "2018-19",
    "2019-20",
    "2020-21",
    "2011-12",
    "2012-13",
    "2013-14",
    "2014-15",
  ]), ["11/12–14/15", "18/19–20/21"]);
  assert.deepEqual(compactSeasonRanges(["2025-26"]), ["25/26"]);
});
