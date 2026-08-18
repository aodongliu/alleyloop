# AlleyLoop Movies — paused-work handoff

Last reviewed: 2026-08-16 (America/Los_Angeles)

This is the operational handoff for resuming the movie version of AlleyLoop on a machine suited to large-data preprocessing. Movie work is intentionally paused. Do not download, regenerate, or publish movie data merely because the scaffolding exists.

## 1. State at handoff

- The standalone repository is the directory containing this handoff.
- Git is initialized as a standalone repository; movie work must remain isolated from the playable NBA release.
- `/` is a lightweight multi-domain hub.
- `/nba/` is the only playable game and must remain unaffected by movie work.
- `/movies/` is an explicit “Coming later · Not playable” placeholder. It loads no movie data and contains no puzzle.
- No IMDb-derived graph, schedule, report, image, or raw TSV remains in the project.
- IMDb-derived paths are ignored in `.gitignore` as an additional safety guard.
- The local Vite dev server may be running for the NBA/hub work; that is unrelated to preprocessing.

The raw snapshot and a duplicate `title.principals` file were permanently deleted at the user’s request. The snapshot was approximately 6.6 GB and the duplicate was approximately 4.2 GB.

Approximately 10.8 GB was removed. The files were removed directly, not moved to Trash; recovery means downloading a permitted snapshot again.

## 2. What is safely retained

These are scaffolding or experiments, not a completed movie game:

- `src/data/ConnectionDataAdapter.ts` — the domain-neutral runtime data boundary.
- `src/core/` — generic entities, membership groups, evidence, search, chain validation, and BFS shortest paths.
- `tests/integration/movie-domain.test.ts` — a small synthetic proof that films can be membership groups without importing NBA logic.
- `src/domains/movies/` — isolated cinema-themed portrait, evidence, career, and chain presentation components. They are not wired to a route.
- `scripts/build_imdb_graph.py` — an experimental streaming spike.
- `tests/data/test_build_imdb_graph.py` — fixture tests for that spike’s current output.
- `movies/index.html`, `src/movies-main.tsx`, and `src/movie-preview.css` — the non-playable placeholder.

Important: `scripts/build_imdb_graph.py` does **not** yet emit the exact `NormalizedConnectionDataset` schema consumed by `ConnectionGraph`. Its module header now says this explicitly. Do not run a full build until the schema work in section 7 is complete.

## 3. Existing architecture and intended boundary

```text
root hub (/)
├── NBA entry (/nba/)
│   ├── NBA build adapter + normalized JSON
│   ├── shared graph/game/daily/persistence core
│   └── NBA pass/hoop/dunk presentation
└── Movies entry (/movies/) — placeholder only
    ├── future movie build adapter + normalized JSON
    ├── the same shared graph/game/daily/persistence core
    └── movie filmstrip/projector/credits presentation
```

The reusable engine knows only:

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

For the NBA, one group is a team-season. For Movies, one group is a film. Two people connect when they belong to the same eligible film group. The shared engine must never learn about teams, seasons, films, roles, lobs, or clapperboards.

Keep these layers separate when work resumes:

1. **Build-time source adapter:** raw source files → normalized entity/group JSON.
2. **Runtime data adapter:** fetch/validate normalized graph plus the daily schedule.
3. **Core engine:** evidence, validation, shortest path, daily selection, and persistence.
4. **Game composition:** shared state flow and generic search behaviors.
5. **Presentation module:** domain-specific chain, evidence, hint, and success animation.

Soccer and NFL should later reuse layers 2–4 with their own build adapters and presentations.

## 4. Product behavior the movie version must preserve

The movie variant changes the metaphor, not the rules:

- A connection means two eligible people share one eligible movie credit group.
- Any valid completed chain is a win; shortest path is comparison only.
- Show the user’s link count versus the exact BFS shortest link count.
- Keep **Show answer** available before completion and reveal one optimal path on click.
- A hint should reveal a connecting movie clue, not the next person’s identity.
- Support search/autocomplete, undo, per-person rewind/removal, and reset.
- Keep only Easy (1–4 links) and Hard (4–6 links); do not add Medium.
- Difficulty must account for person recognizability and practical route knowledge, not distance alone.
- Avoid absurd endpoint-era gaps. Start with a maximum 20-year non-overlap between accepted-film career ranges and adjust only through human curation.
- Keep English/Chinese UI switching. Dataset-provided proper names/titles may remain in their source language until a separately licensed alias source is added.
- Use movie-specific completion feedback (for example, a film-frame pass ending with a clapper/projector “That’s a wrap!” moment), not NBA lob/dunk visuals.

The initial credit scope drafted in the UI is: principal actors/actresses plus directors and writers. That is a deliberate, explainable subset—not “everyone who worked on a movie.” Adding producers, composers, cinematographers, or full cast later is a source/product decision and must not be silently inferred.

## 5. IMDb snapshot facts observed before deletion

The browser supplied uncompressed TSVs even though IMDb’s official endpoints use `.tsv.gz`. Headers and file tails were checked before the move; all five selected files appeared complete.

| File | Observed uncompressed size | Planned role |
|---|---:|---|
| `name.basics.tsv` | ~918 MB | `nconst`, primary name, professions, known-for IDs |
| `title.basics.tsv` | ~1.0 GB | `tconst`, title type/name, adult flag, year, genres |
| `title.crew.tsv` | ~400 MB | director/writer `nconst` arrays |
| `title.principals.tsv` | ~4.2 GB | selected principal title/person credits |
| `title.ratings.tsv` | ~28 MB | rating and vote-count filter/evidence |

Stable identifiers are the useful join keys:

- `nconst` identifies a person/name record.
- `tconst` identifies a title.

IMDb states that these files are refreshed daily. `title.principals` is a selected principal-credit table, not a complete cast/crew table. A game built from it must say “principal cast plus directors/writers,” not “complete film credits.”

On the future machine, prefer leaving the official files compressed outside the repository; the experimental reader already supports both `.tsv` and `.tsv.gz`. Never put a raw snapshot under `public/`.

## 6. Licensing is a hard gate, not a footnote

The following official pages were rechecked on 2026-08-16:

- [IMDb Non-Commercial Datasets](https://developer.imdb.com/non-commercial-datasets/)
- [IMDb: Can I use IMDb data in my software?](https://help.imdb.com/article/imdb/general-information/can-i-use-imdb-data-in-my-software/G5JTRESSHJBBHTGX)
- [IMDb Conditions of Use](https://www.imdb.com/conditions/)

IMDb says local copies of the listed subsets are available for personal/non-commercial use, subject to its terms. Its Help page also says the data cannot be altered, republished, resold, or repurposed into an online/offline movie-information database except for individual personal use, requires source acknowledgment, and reserves the right to withdraw permission.

Therefore:

- “Free, ad-free personal website” is **not automatically equivalent** to permitted individual personal use.
- Do not publish raw files, a derived client graph, a searchable credit database, IMDb artwork, or an IMDb-backed public game without written clearance or an appropriate license.
- A private local prototype and a public GitHub Pages deployment are separate decisions.
- Before restarting, choose one path explicitly:
  1. obtain written confirmation/licensing for the intended public game;
  2. use IMDb only for a private local experiment; or
  3. evaluate a redistribution-friendly source such as Wikidata or a separately licensed movie-credit API, then re-audit its completeness and terms.

This is an engineering risk assessment, not legal advice. Recheck current terms at the time work resumes.

## 7. Fix the experimental builder before a full run

Current `scripts/build_imdb_graph.py` is useful streaming research, but its output mismatches the core in several material ways:

- `domain` is `"movie"`; use the project-wide identifier `"movies"`.
- `entities` is an object keyed by ID; the core expects an array.
- entities use `name`, `type`, `activeYearRange`, and `creditRoles` at the wrong levels instead of `label` and normalized metadata.
- groups use `year`, `members`, and `evidence`; the core expects `period`, `memberIds`, and `metadata`.
- singleton movie groups are currently retained even though they cannot form an edge.
- the default minimum of 100 votes will probably produce a graph too large and obscure for a lightweight browser game.
- presentation components expect metadata keys such as `roles`, `knownTitles`, `year`, `rating`, and `genres`; the spike does not yet align with them.

The build adapter—not a runtime compatibility shim—should emit the exact core schema. Target shape:

```json
{
  "schemaVersion": 1,
  "domain": "movies",
  "source": {
    "name": "IMDb Non-Commercial Datasets",
    "snapshotDate": "YYYY-MM-DD",
    "adapter": "imdb-principal-movie-v2",
    "minVotes": 10000,
    "semantics": "non-adult feature films; principal actor/actress credits plus directors/writers"
  },
  "entities": [
    {
      "id": "imdb:person:nm0000000",
      "label": "Person name",
      "aliases": [],
      "searchRank": 87.2,
      "metadata": {
        "domain": "movies",
        "nconst": "nm0000000",
        "professions": ["actor"],
        "roles": ["actor"],
        "activeYears": { "from": 1995, "to": 2026 },
        "knownTitles": ["Recognizable Film"],
        "includedTitleCount": 12
      }
    }
  ],
  "groups": [
    {
      "id": "imdb:movie:tt0000000",
      "label": "Film title",
      "period": "2024",
      "memberIds": ["imdb:person:nm0000000", "imdb:person:nm0000001"],
      "metadata": {
        "domain": "movies",
        "titleId": "tt0000000",
        "year": 2024,
        "rating": 7.5,
        "numVotes": 123456,
        "genres": ["Drama"],
        "rolesByPerson": {
          "imdb:person:nm0000000": ["actor"]
        }
      }
    }
  ]
}
```

Implementation requirements:

- Include only groups with at least two resolved people.
- Ensure every `memberId` has exactly one entity.
- Choose `knownTitles` as a small list of display labels (for example the person’s top 3–4 accepted films by votes), not a large ID list.
- Keep `rolesByPerson` only if measured output size justifies it; evidence does not require it for the first UI.
- Keep arrays and IDs deterministically sorted.
- Put snapshot date, filter values, credit semantics, and licensing caution in both source metadata and the report.
- Make tests assert the exact TypeScript-compatible shape rather than preserving the v1 spike shape.

## 8. Scale-conscious preprocessing plan

The safe next run is a benchmark, not a production build.

1. Keep compressed inputs in a dataset directory outside the repository.
2. Read `title.ratings` into a compact `tconst → (rating, numVotes)` map.
3. Stream `title.basics`; retain only `titleType=movie`, `isAdult=0`, numeric `startYear`, and titles meeting the selected vote threshold.
4. Stream `title.principals`; for accepted titles retain principal `actor`/`actress` rows.
5. Stream `title.crew`; add directors/writers to the same film membership sets.
6. Stream `name.basics` once and retain only people observed in accepted memberships.
7. Drop groups with fewer than two resolved people and then drop entities with no retained group.
8. Derive display metadata/search rank and serialize normalized groups—not pairwise adjacency.
9. Write graph and report to a temporary path outside source control.
10. Record wall time, peak resident memory, accepted counts, JSON size, and browser parse/BFS/search timings; then remove temporary outputs.

Start with `--min-votes 10000`. If the raw JSON or browser memory is still uncomfortable, compare 25,000. A 1,000-vote sample can measure coverage, but do not begin with a full 0/100-vote graph. Choose the final threshold from recognizability, connectivity, client size, and search responsiveness—not merely build success.

The spike still holds ratings, accepted movie metadata, and accepted membership sets in memory. If peak memory is unsuitable, use SQLite or sorted on-disk intermediates while continuing to stream `title.principals`; do not solve memory pressure by loading the 4.2 GB table wholesale.

## 9. Graph and data-quality audit

Before any UI wiring, load the actual output through `new ConnectionGraph(dataset.entities, dataset.groups)` and fail on schema or unknown-ID errors. Produce a report covering:

- accepted/excluded titles by reason;
- entity, group, and membership totals;
- role counts and year range;
- missing names and duplicate display labels;
- singleton groups removed and group-size distribution;
- degree distribution, component count, and largest-component share;
- shortest-path distance distribution on a deterministic sample;
- high-degree hubs and unexpectedly large film groups;
- raw/minified/compressed output size, JSON parse time, search latency, and BFS latency.

Manually inspect recognizable searches and paths, including several actors, directors, and writers. Every displayed edge must name at least one actual shared film. Stable IDs, never labels, determine identity; duplicate names must remain separate search results.

The current core search scans all entities for every query. If the retained graph is large enough to make autocomplete lag, first reduce/scope the playable graph or add a small precomputed search index behind the shared adapter. Do not add movie-specific search logic to `ConnectionGraph`.

## 10. Daily puzzle curation

Create `public/data/movie-puzzles.json` only after source/distribution is approved; it is currently ignored. Use the generic daily schedule shape with a separate `movies` persistence namespace.

For each hand-reviewed puzzle:

- verify endpoint IDs exist;
- verify the exact BFS distance;
- store one verified optimal path;
- validate every featured edge and its shared-film evidence;
- apply Easy 1–4 / Hard 4–6 link rules with no Medium;
- record a curation note about recognizability and practical difficulty;
- keep the endpoint career non-overlap within the initial 20-year cap;
- avoid obscure endpoints, misleading near-duplicate names, and accidental franchise/remake hubs;
- allow any valid user chain to win even when longer than the stored path.

Add a movie-specific validator or generalize the existing validator without importing NBA season/team assumptions. The validator—not the UI—must reject stale or invalid curated paths.

## 11. Runtime/UI integration after data approval

1. Add a movie runtime adapter under `src/domains/movies/data/` implementing `ConnectionDataAdapter` with `id = "movies"`.
2. Fetch the normalized graph and schedule with `import.meta.env.BASE_URL`, validate their discriminators/schema, then construct `ConnectionGraph`.
3. Extract a domain-neutral game-state hook/controller from `src/app/App.tsx` instead of copying the NBA game logic. Keep feedback copy and visuals in each domain composition.
4. Extract or introduce a generic entity autocomplete contract rather than reusing NBA-named markup/classes blindly.
5. Wire `MoviePersonPortrait`, `MoviePersonCareer`, `MovieEvidence`, and `MovieChainView` through `src/presentation/types.ts`.
6. Fix the paused presentation module’s known small issue: `MovieEvidence` currently formats scalar metadata but not a `genres: string[]` value.
7. Review the accepted-link animation: the existing film marker treatment is isolated but should visibly travel from the prior person to the new person.
8. Add movie-localized copy, film-only hints, always-available answer, undo/rewind, result comparison, and a movie-specific success celebration.
9. Use initials as the first portrait fallback. Add posters/headshots only from a separately cleared source and keep failures graceful.
10. Keep `/movies/` in placeholder mode until a real dataset, validated puzzles, performance budget, and distribution permission all pass review.

## 12. Verification strategy

Tests that require no full dataset must stay fixture-based and run on every machine:

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

The existing synthetic movie integration test already covers shared-film evidence, search, exact shortest paths, a longer-path win, daily selection, hints, and domain-separated persistence.

Before a future full run:

1. update `tests/data/test_build_imdb_graph.py` for the v2 normalized schema;
2. add failure cases for singleton films, unresolved names, malformed years, duplicate roles, and stable deterministic ordering;
3. add a small runtime adapter fixture test;
4. only then benchmark the large snapshot to `/tmp` or another disposable external path;
5. make any `data:build:movies` npm command use an explicit external input and ignored output, never a checked-in default.

## 13. Suggested next-agent sequence

1. Read this entire file, `README.md`, `src/core/model.ts`, `src/core/graph.ts`, `src/data/ConnectionDataAdapter.ts`, and the paused builder/tests.
2. Confirm the source/licensing path with the user. If public distribution is not cleared, keep the route unimplemented.
3. On the better-suited machine, decide whether to preserve compressed inputs, use larger storage, and/or use SQLite intermediates.
4. Patch the builder to the exact v2 schema above and update fixture tests before acquiring or scanning large data.
5. Obtain only the approved source files outside the repository.
6. Run a 10,000-vote benchmark to a disposable external path; record resource usage and graph metrics.
7. Tune the filter only after auditing recognizability, connectivity, size, and client performance.
8. Curate and validate a small Easy/Hard schedule.
9. Add the runtime adapter and shared game-state/search abstractions.
10. Wire the isolated movie presentation, fix its known metadata/animation gaps, and keep NBA behavior unchanged.
11. Run all tests/build checks and manually inspect representative movie paths.
12. Reconfirm distribution rights before placing any derived asset under `public/` or deploying.

## 14. Never commit or publish without explicit clearance

- raw or compressed IMDb TSV files;
- an IMDb-derived full graph or puzzle schedule;
- benchmark intermediates/reports containing redistributed source content;
- copied IMDb portraits, posters, logos, or page-scraped metadata;
- credentials or licensed API responses;
- any derived movie asset whose redistribution status has not been reviewed.

The movie scaffolding can remain in source control. The data cannot be assumed safe to publish simply because the game itself is free.
