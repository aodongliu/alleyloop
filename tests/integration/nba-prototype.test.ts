import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { selectDailySlate, type DailySchedule } from "../../src/core/daily.ts";
import { ConnectionGraph } from "../../src/core/graph.ts";
import { createGame, linkCount, revealShortestPath, submitConnection } from "../../src/core/game.ts";
import type { NormalizedConnectionDataset } from "../../src/data/ConnectionDataAdapter.ts";
import { isEligibleNbaEndpoint } from "../../src/sports/nba/data/endpointEligibility.ts";
import { NBA_RANDOM_HARD_ENDPOINT_PAIRS } from "../../src/sports/nba/data/randomNbaPuzzle.ts";
import { collapseNbaTeamEvidence, compactSeasonRanges } from "../../src/sports/nba/presentation/teamEvidence.ts";

const readJson = <T>(relativePath: string): T => JSON.parse(
  readFileSync(new URL(relativePath, import.meta.url), "utf8"),
) as T;

const dataset = readJson<NormalizedConnectionDataset>("../../public/data/nba-graph.json");
const schedule = readJson<DailySchedule>("../../public/data/nba-puzzles.json");
const graph = new ConnectionGraph(dataset.entities, dataset.groups);

test("generated NBA graph is connected enough for the curated prototype", () => {
  assert.equal(dataset.sport, "nba");
  assert.ok(graph.entities().length > 4_900);
  assert.ok(graph.groups().length > 1_600);
  assert.equal(schedule.maxEraGapYears, 25);
  for (const slate of schedule.slates) {
    for (const puzzle of [slate.easy, slate.hard]) {
      assert.equal(typeof puzzle.eraGapYears, "number");
      assert.ok(puzzle.eraGapYears! <= schedule.maxEraGapYears!);
      assert.equal(isEligibleNbaEndpoint(graph.getEntity(puzzle.startId)!), true);
      assert.equal(isEligibleNbaEndpoint(graph.getEntity(puzzle.targetId)!), true);
    }
  }
  const slate = selectDailySlate(schedule, new Date("2026-08-15T16:00:00Z"), graph);
  assert.equal(slate.easy.difficulty, "easy");
  assert.equal(slate.hard.difficulty, "hard");
});

test("a curated post-1996 Hard matchup uses supported real team-season bridges", () => {
  const puzzle = selectDailySlate(schedule, new Date("2026-08-16T16:00:00Z"), graph).hard;
  assert.deepEqual(puzzle.featuredOptimalPath, [
    "nba:person:1134",
    "nba:person:1710",
    "nba:person:2544",
    "nba:person:203484",
    "nba:person:1631094",
  ]);
  const teamLabels = puzzle.featuredOptimalPath!.slice(1).map((entityId, index) => (
    [...new Set(graph.sharedEvidence(puzzle.featuredOptimalPath![index], entityId).map((evidence) => evidence.label))]
  ));
  assert.deepEqual(teamLabels, [
    ["Vancouver Grizzlies"],
    ["Miami Heat"],
    ["Los Angeles Lakers"],
    ["Orlando Magic"],
  ]);
});

test("the endpoint-only cutoff leaves historical players in search and graph traversal", () => {
  assert.equal(graph.getEntity("nba:person:893")?.label, "Michael Jordan");
  assert.equal(graph.search("Michael Jordan")[0]?.id, "nba:person:893");
  assert.ok(graph.neighbors("nba:person:893").length > 0);
});

test("Unlimited Hard endpoint catalog stays post-1996 and 4–6 links apart", () => {
  for (const [startId, targetId] of NBA_RANDOM_HARD_ENDPOINT_PAIRS) {
    assert.equal(isEligibleNbaEndpoint(graph.getEntity(startId)!), true);
    assert.equal(isEligibleNbaEndpoint(graph.getEntity(targetId)!), true);
    const shortest = graph.shortestPath(startId, targetId);
    assert.ok(shortest);
    assert.ok(shortest.links >= 4 && shortest.links <= 6);
  }
});

test("a real curated path validates link-by-link, wins, and reveals an optimal path", () => {
  const puzzle = selectDailySlate(schedule, new Date("2026-08-15T16:00:00Z"), graph).easy;
  assert.ok(puzzle.featuredOptimalPath);
  let state = createGame(puzzle.startId, puzzle.targetId);
  const direct = submitConnection(graph, state, puzzle.targetId);
  assert.equal(direct.accepted, false, "the target is not accepted without a teammate edge");
  for (const entityId of puzzle.featuredOptimalPath!.slice(1)) {
    const submission = submitConnection(graph, state, entityId);
    assert.equal(submission.accepted, true);
    assert.ok(submission.evidence.length > 0);
    state = submission.state;
  }
  assert.equal(state.won, true);
  assert.equal(linkCount(state), puzzle.expectedShortestLinks);
  assert.equal(revealShortestPath(graph, state).links, puzzle.expectedShortestLinks);
});

test("Jordan-Simmons-Wizards and Simmons-Paul-Clippers evidence cannot be visually conflated", () => {
  const jordanToSimmons = collapseNbaTeamEvidence(
    graph.sharedEvidence("nba:person:893", "nba:person:2250"),
  );
  const simmonsToPaul = collapseNbaTeamEvidence(
    graph.sharedEvidence("nba:person:2250", "nba:person:101108"),
  );

  assert.deepEqual(jordanToSimmons.map(({ teamId, seasons }) => ({ teamId, seasons })), [{
    teamId: "1610612764",
    seasons: ["2001-02", "2002-03"],
  }]);
  assert.equal(jordanToSimmons[0].label, "Washington Wizards");
  assert.equal(jordanToSimmons[0].logoUrl, "https://cdn.nba.com/logos/nba/1610612764/primary/L/logo.svg");
  assert.doesNotMatch(jordanToSimmons[0].description, /Clippers/i);
  assert.deepEqual(simmonsToPaul.map(({ teamId, seasons }) => ({ teamId, seasons })), [{
    teamId: "1610612746",
    seasons: ["2011-12"],
  }]);
  assert.equal(simmonsToPaul[0].label, "Los Angeles Clippers");
});

test("autocomplete history collapses Curry to one Warriors logo and one season range", () => {
  const curryTeams = collapseNbaTeamEvidence(graph.membershipEvidence("nba:person:201939"));
  assert.equal(curryTeams.length, 1);
  assert.equal(curryTeams[0].teamId, "1610612744");
  assert.equal(curryTeams[0].label, "Golden State Warriors");
  assert.deepEqual(compactSeasonRanges(curryTeams[0].seasons), ["09/10–25/26"]);
});

test("autocomplete history keeps all Biyombo teams and compresses split Charlotte stints", () => {
  const biyomboTeams = collapseNbaTeamEvidence(graph.membershipEvidence("nba:person:202687"));
  assert.equal(biyomboTeams.length, 7);
  const charlotte = biyomboTeams.find((team) => team.teamId === "1610612766");
  assert.ok(charlotte);
  assert.equal(charlotte.label, "Charlotte Hornets");
  assert.deepEqual(compactSeasonRanges(charlotte.seasons), ["11/12–14/15", "18/19–20/21"]);
  assert.deepEqual(new Set(biyomboTeams.map((team) => team.teamId)), new Set([
    "1610612766",
    "1610612761",
    "1610612753",
    "1610612756",
    "1610612760",
    "1610612763",
    "1610612759",
  ]));
});
