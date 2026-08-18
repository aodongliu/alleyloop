# AlleyLoop agent handoff

Last verified: 2026-08-17 (America/Los_Angeles)

This file is operational context for future agents. Product behavior, architecture, data semantics, and local-development instructions live in `README.md`; the paused movie-data plan lives in `MOVIES_HANDOFF.md`.

## Scope and safety

- This is the standalone public repository `aodongliu/alleyloop`.
- The existing `aodongliu/aodongliu.github.io` repository is separate. Do not modify it unless the user explicitly asks.
- Never commit raw Kaggle or IMDb source files. The normalized NBA graph under `public/data` is intentionally public and is the only dataset needed at runtime.
- `/movies/` is a non-playable placeholder. Do not publish IMDb-derived data without resolving the licensing gate in `MOVIES_HANDOFF.md`.
- Preserve unrelated user changes in a dirty worktree.

## GitHub and Pages

- Remote: `https://github.com/aodongliu/alleyloop.git`
- Deployment branch: `main`
- Repository: <https://github.com/aodongliu/alleyloop>
- Public hub: <https://aodongliu.github.io/alleyloop/>
- NBA game: <https://aodongliu.github.io/alleyloop/nba/>
- Workflow: `.github/workflows/deploy-pages.yml`
- The workflow runs on every push to `main` and on manual dispatch. It installs locked dependencies, runs tests and lint, builds with `VITE_BASE_PATH=/alleyloop/`, and deploys `dist/` through GitHub Pages.
- The existing website repository is not part of this workflow.

The public deployment was smoke-tested from the GitHub Pages URL: the hub rendered, `/nba/` loaded the normalized graph, the UI reported 4,938 players and 1,687 team seasons, and autocomplete returned Stephen Curry with a single Warriors career range.

## GitHub CLI continuity on this Mac

The official `gh` CLI is installed. Its OAuth token is stored in the macOS keychain; no token is stored in this repository.

The normal `~/.config/gh` location is unavailable because `~/.config` is owned by `root`. Do not change that directory's ownership without explicit user approval. Durable, non-secret CLI metadata is therefore stored outside the repository at `../.gh-config`, with private filesystem permissions.

From the repository root, verify CLI access with:

```bash
GH_CONFIG_DIR=../.gh-config gh auth status --hostname github.com
```

The repository-local Git credential helper already points to this durable configuration, and `git ls-remote origin HEAD` was verified without another device approval. Normal `git fetch` and `git push` should therefore work on this Mac. For direct `gh` commands, prefix `GH_CONFIG_DIR=../.gh-config`.

Never print, copy, commit, or request the OAuth token. Never add `../.gh-config` to the repository. A new machine, a removed keychain entry, or revoked GitHub authorization will require a fresh login; an ordinary future agent in this same workspace should not request another device approval unless the status check fails.

## Release checks

Before pushing application changes, run:

```bash
npm test
npm run lint
VITE_BASE_PATH=/alleyloop/ npm run build
```

After pushing, inspect the workflow with:

```bash
GH_CONFIG_DIR=../.gh-config gh run list --repo aodongliu/alleyloop --workflow deploy-pages.yml --limit 3
```

Then verify both the hub and `/nba/` from the public URL. The raw Kaggle directory is not needed for installation, testing, building, or deployment; it is needed only for `npm run data:build`.

## Current public-data boundary

- `public/data/nba-graph.json`: normalized entities and team-season groups, intentionally shipped to each NBA client.
- `public/data/nba-puzzles.json`: curated daily schedule.
- `public/assets/nba-court-perspective.webp`: checked-in original court artwork.
- Player headshots and team logos currently resolve from public NBA CDN URLs with graceful fallbacks. The interface includes an unofficial-fan-project disclaimer; review the external image source's availability and usage terms before wider promotion.

## Startup checklist for the next agent

1. Read this file, `README.md`, and any task-specific handoff before editing.
2. Run `git status --short --branch` and preserve unrelated changes.
3. Run the `gh auth status` command above before any GitHub mutation.
4. Treat `main` as the Pages deployment branch and monitor Actions after every push.
5. Keep sport/domain data adapters and presentations replaceable; do not add NBA assumptions to the shared graph/game engine.
