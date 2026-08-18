# AlleyLoop

AlleyLoop is a multi-domain connection-game project. The first and currently only playable version asks you to connect two NBA players through teammates who appeared for the same NBA team in the same season. The root hub and `/movies/` placeholder establish where later domains will plug in without claiming that their datasets or games are ready.

Any valid completed chain wins. The exact shortest distance is a comparison, and Hint/Show Answer are available whenever the player wants them.

This repository is standalone. It does not modify or depend on `aodongliu.github.io`.

## Run locally

Requirements:

- Node.js 22.13 or newer
- npm
- Python 3.10 or newer only when rebuilding or validating data

The generated NBA graph is checked into `public/data`, so the game can run without the raw Kaggle files:

```bash
npm ci
npm run dev
```

Open the local URL printed by Vite, normally `http://localhost:5173`. The hub is at `/`, the playable game is at `/nba/`, and `/movies/` is intentionally unimplemented.

Production build:

```bash
npm run build
npm run preview
```

## Prototype features

- daily Easy and Hard puzzles plus an Unlimited mode that generates fresh recognizable matchups; no Medium mode;
- matchup endpoints whose first recorded NBA season is 1996-97 or later, while intermediate guesses and graph paths may use players from any era;
- player search and keyboard-friendly autocomplete;
- stable player-ID disambiguation with era and team context;
- immediate same-team/same-season validation;
- all supporting shared teams and seasons retained;
- one clickable team-logo badge per shared franchise, with consecutive seasons compressed into ranges;
- complete team-logo and compact season-range history in autocomplete, with a rolling rail for long careers;
- a perspective hardwood-court approach that keeps every logo on its exact link, visually recedes prior passers without transparency, and moves each new player toward the foreground basket;
- a visible basketball lob between each newly connected pair, ending in a timed catch-and-dunk celebration;
- undo plus per-player rewind controls;
- team-only hints that never reveal the next player’s identity, plus a Show Answer control available before completion;
- any valid completed chain wins, even when it is longer than optimal;
- user link count versus exact BFS shortest distance;
- one curated, validated optimal path to reveal at any time;
- independent local progress for each puzzle;
- an NBA-specific pass/dunk chain module with headshot fallbacks;
- English and Chinese UI switching.

Unlimited matchups reuse the same Easy (1–4) and Hard (4–6) distance rules, restrict endpoints to players who entered in 1996-97 or later, favor the more recognizable portion of the NBA graph, and cap non-overlapping career gaps at 25 years. Because four-link pairs are rare among recognizable modern endpoints, Unlimited Hard selects from a small reviewed endpoint catalog; shortest paths still use the complete graph. The court background is an original AlleyLoop asset in `public/assets`; the players, evidence, pass, and dunk remain live presentation elements layered above it.

## Rebuild the NBA graph

The npm script expects the supplied dataset beside this repository:

```text
../KaggleDataset08152026/
```

Regenerate and validate:

```bash
npm run data:build
npm run data:validate
```

The build uses only Python's standard library and streams the 372 MB player-stat file. It writes:

- `public/data/nba-graph.json` — compact browser-ready normalized graph;
- `data-reports/nba-preprocessing-report.json` — readable coverage and quality audit.

The current output contains 4,938 players, 1,687 team-season groups, 28,561 memberships, and 170,034 unique teammate edges across 80 seasons (1946-47 through 2025-26). It is one connected component.

### NBA normalization rules

The adapter uses:

- `PlayerStatistics.csv` for player/game/team appearances;
- `Players.csv` for canonical player names and stable `personId` values;
- `Games.csv` to verify or recover a missing player team ID against the two game participants;
- `TeamHistories.csv` to restrict membership to NBA/BAA franchises and label historical teams.

Important details:

1. Seasons come from the NBA game-ID season token, not calendar dates. This correctly keeps the October 2020 Finals in 2019-20.
2. Competitive NBA games are accepted: regular season, playoffs, play-in, and NBA Cup variants.
3. Preseason, All-Star, foreign exhibition, unresolved-team, and team-mismatch rows are excluded.
4. Blank team IDs are recovered only when exactly one home/away game participant matches. Unresolved blanks are never merged.
5. Players are keyed by `nba:person:<personId>`, so duplicate names remain separate autocomplete choices.
6. A first-pass knownness score uses career exposure, scoring visibility, recency, and seasons. It helps order search/candidate inspection but is not a quality rating and does not replace human curation.

### Roster-data limitation

The Kaggle files do not contain a transaction-level roster table. This version therefore uses **appearance-derived roster presence**: a player counts for a team-season when they are present in a competitive-game box-score record, including zero-minute/DNP rows.

That is deterministic and sufficient for this prototype, but it can miss someone who was contractually rostered and never appeared in any supplied box score. A future official roster source can replace the NBA adapter without changing the graph or game layers.

## Normalized graph model

The graph engine receives only generic entities and membership groups:

```ts
interface Entity {
  id: string;
  label: string;
  aliases?: string[];
  searchRank?: number;
  metadata?: Record<string, unknown>;
}

interface MembershipGroup {
  id: string;
  label: string;
  period: string;
  memberIds: string[];
  metadata?: Record<string, unknown>;
}
```

For the NBA adapter, a group is one NBA team in one season. Two entities are connected when they share a group. The engine retains every shared group as evidence, builds unweighted adjacency, validates full chains, and finds an exact shortest path with breadth-first search.

## Architecture and domain boundaries

```text
Kaggle NBA CSVs
  -> scripts/build_nba_graph.py          NBA build-time adapter
  -> normalized entities + groups
  -> src/core/graph.ts                   domain-neutral connections/BFS
  -> src/core/game.ts                    domain-neutral chain/win rules
  -> src/core/daily.ts                   curated daily Easy/Hard selection
  -> src/game/persistence.ts             reusable local progress
  -> src/app/                            interaction and composition
  -> src/sports/nba/presentation/        NBA portraits, pass, hoop, dunk
```

The core has no NBA team, season, basketball, movie, or animation assumptions. NBA-specific data loading lives under `src/sports/nba/data`; basketball presentation lives under `src/sports/nba/presentation` and implements the generic contract in `src/presentation/types.ts`. The domain-neutral adapter contract lives in `src/data/ConnectionDataAdapter.ts`; the legacy sport-named compatibility types remain available during migration.

A synthetic movie-credit integration test maps people to entities and films to membership groups. It verifies shared-film evidence, search, exact shortest paths, hints, longer-path wins, daily puzzles, and separately namespaced saved progress without importing any NBA code.

To add another AlleyLoop domain:

1. Write a build adapter that emits the same entity/group format. Soccer/NFL groups are team-seasons; movie groups are films and their eligible credited people.
2. Supply curated Easy/Hard puzzles referencing those entity IDs.
3. Implement the generic chain-presentation props with domain-specific visuals: basketball lobs, soccer/football passes, or a filmstrip/projector treatment.
4. Compose the new adapter and presentation with the existing graph, game, daily, search, persistence, and results code.

The static-site structure is a lightweight root hub plus nested Vite entry pages such as `/nba/` and `/movies/`. Real nested HTML entry points are preferred over client-only routing for GitHub Pages: direct links work without a 404 rewrite, and each page downloads only its own graph and presentation bundle. Shared engine code remains in the common chunk. The movie entry is currently a placeholder; see [`MOVIES_HANDOFF.md`](./MOVIES_HANDOFF.md) before resuming that work.

## Daily puzzle curation

`public/data/nba-puzzles.json` contains a deterministic rotation anchored to `America/Los_Angeles`. Each slate has exactly one Easy and one Hard puzzle:

- Easy shortest distance: 1–4 links;
- Hard shortest distance: 4–6 links;
- a four-link puzzle can belong to either, based on recognizability and practical route difficulty.
- Every curated puzzle also records `eraGapYears`, computed from endpoint `metadata.activeYears` as `max(0, max(start years) - min(end years))`. The current rotation caps non-overlapping career gaps at 25 years (`maxEraGapYears`), keeping era-spanning challenges within a playable historical window while allowing overlapping careers to score zero.

Every puzzle includes a curation note and one preferred optimal path. `scripts/validate_puzzles.py` verifies endpoint existence, difficulty range, exact BFS distance, every teammate link, optimality, and the recomputed era-gap value/cap. Edit this file to accept/reject candidate slates, then run `npm run data:validate`.

The NBA data adapter separately rejects a curated schedule whose start or target entered before 1996-97. This is intentionally an endpoint-selection rule only: the full historical graph remains loaded, older players remain searchable, and they may be used as intermediate connections or appear in a shortest path.

## Photos and localization

The NBA presentation derives public NBA CDN headshot and team-logo URLs from `personId` and `teamId`, with initials/abbreviation fallbacks when an image is absent or fails. Team-season evidence is collapsed only in this presentation layer: the domain-neutral graph retains every season, while the UI shows one logo per team and reveals the deduplicated seasons on click. This external image source is a replaceable prototype dependency; its availability and usage terms should be reviewed before wider promotion. Replacing either resolver does not affect gameplay.

All interface copy is isolated in `src/i18n/copy.ts`. English and Chinese are enabled in this prototype; player and team proper names remain dataset-provided.

## Tests

```bash
npm test
npm run lint
npm run build
```

The suite covers graph evidence, whole-chain validation, exact shortest paths, non-shortest wins, daily constraints, persistence replay, season parsing, team-ID recovery, knownness calibration, normalized-output determinism, puzzle validation, and a real generated NBA puzzle end to end.

## GitHub Pages deployment

The app is a static Vite build with no backend or accounts. For a project page such as `aodongliu.github.io/alleyloop`, build with the repository base path:

```bash
VITE_BASE_PATH=/alleyloop/ npm run build
```

The standalone repository deploys automatically through `.github/workflows/deploy-pages.yml` whenever `main` is pushed, and can also be deployed manually from the Actions tab. The workflow installs locked dependencies, runs tests and lint, builds with the project base path, and publishes only `dist/`.

The raw Kaggle dataset is not uploaded to GitHub or required by deployment. The checked-in normalized graph and puzzle schedule under `public/data` are copied into the static build. The existing `aodongliu.github.io` repository is not part of this deployment; GitHub exposes this project repository at `https://aodongliu.github.io/alleyloop/`.
