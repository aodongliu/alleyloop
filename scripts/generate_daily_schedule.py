#!/usr/bin/env python3
"""Extend the AlleyLoop daily schedule with non-repeating matchups.

Existing slates are kept exactly as they are, so curated days and every date
that has already been played stay stable. New days are appended after the last
slate, one per calendar day, until ``--through``. Each new day is drawn with a
random generator seeded from its own date, so re-running the script with a
later ``--through`` only adds days.

A matchup is never reused: no two slates share the same pair of endpoints in
either direction. Endpoints also rest for ``--rest-days`` before appearing
again. A matchup only qualifies when well-known players can connect it, and
the featured answer is the best-known shortest route. Like the validator, this module needs only the standard library.
"""

from __future__ import annotations

import argparse
import json
import random
import re
import sys
import unicodedata
from collections import deque
from datetime import date, timedelta
from pathlib import Path
from typing import Any

from validate_puzzles import _graph_adjacency, validate_puzzles

MIN_ENTRY_YEAR = 1996
MIN_KNOWNNESS = 70
MIN_LINKS = 2
MAX_LINKS = 3
LONG_ROUTE_SHARE = 1 / 8
# Players in between must be recognizable too, and a one-connector day needs several fair answers.
MIN_CONNECTOR_KNOWNNESS = 70
MIN_KNOWN_CONNECTORS = 3


def _slug(label: str) -> str:
    ascii_label = unicodedata.normalize("NFKD", label).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", ascii_label.lower()).strip("-")


def _candidates(graph: dict[str, Any]) -> list[dict[str, Any]]:
    """Recognizable players who are allowed to be a daily start or target."""

    eligible = []
    for entity in graph["entities"]:
        metadata = entity.get("metadata", {})
        years = metadata.get("activeYears")
        score = metadata.get("knownnessScore")
        if (
            isinstance(years, dict)
            and isinstance(score, (int, float))
            and score >= MIN_KNOWNNESS
            and years["from"] >= MIN_ENTRY_YEAR
        ):
            eligible.append(entity)
    return sorted(eligible, key=lambda entity: entity["id"])


def _distances(adjacency: dict[str, set[str]], start: str, limit: int) -> dict[str, int]:
    seen = {start: 0}
    queue: deque[str] = deque([start])
    while queue:
        current = queue.popleft()
        if seen[current] == limit:
            continue
        for neighbor in adjacency[current]:
            if neighbor not in seen:
                seen[neighbor] = seen[current] + 1
                queue.append(neighbor)
    return seen


def _era_gap(left: dict[str, Any], right: dict[str, Any]) -> int:
    a, b = left["metadata"]["activeYears"], right["metadata"]["activeYears"]
    return max(0, max(a["from"], b["from"]) - min(a["to"], b["to"]))


def _known_route(
    adjacency: dict[str, set[str]],
    knownness: dict[str, float],
    start: str,
    target: str,
    links: int,
) -> list[str] | None:
    """Best-known shortest route, or None when too few well-known players connect the pair."""

    def known(candidates: set[str]) -> list[str]:
        ranked = [node for node in candidates if knownness.get(node, 0) >= MIN_CONNECTOR_KNOWNNESS]
        return sorted(ranked, key=lambda node: (-knownness[node], node))

    if links == 2:
        connectors = known(adjacency[start] & adjacency[target])
        return [start, connectors[0], target] if len(connectors) >= MIN_KNOWN_CONNECTORS else None
    if links == 3:
        routes = [
            (min(knownness[first], knownness[second]), knownness[first] + knownness[second], [start, first, second, target])
            for first in known(adjacency[start])
            for second in known(adjacency[first] & adjacency[target])
        ]
        return max(routes, key=lambda route: route[:2])[2] if routes else None
    return None


def extend_schedule(
    graph: dict[str, Any],
    puzzles: dict[str, Any],
    through: date,
    rest_days: int = 10,
) -> int:
    """Append slates to ``puzzles`` in place and return how many were added."""

    slates = puzzles["slates"]
    anchor = date.fromisoformat(puzzles["anchorDate"])
    max_era_gap = puzzles["maxEraGapYears"]
    _, adjacency = _graph_adjacency(graph, [])
    candidates = _candidates(graph)
    knownness = {
        entity["id"]: entity.get("metadata", {}).get("knownnessScore", 0)
        for entity in graph["entities"]
    }
    # Every allowed matchup, grouped by its exact shortest distance.
    pools: dict[int, list[tuple[dict[str, Any], dict[str, Any]]]] = {links: [] for links in range(MIN_LINKS, MAX_LINKS + 1)}
    routes: dict[frozenset[str], list[str]] = {}
    for index, left in enumerate(candidates):
        reachable = _distances(adjacency, left["id"], MAX_LINKS)
        for right in candidates[index + 1:]:
            links = reachable.get(right["id"])
            if links not in pools or _era_gap(left, right) > max_era_gap:
                continue
            route = _known_route(adjacency, knownness, left["id"], right["id"], links)
            if route:
                pools[links].append((left, right))
                routes[frozenset((left["id"], right["id"]))] = route

    used_pairs = {frozenset((slate["easy"]["startId"], slate["easy"]["targetId"])) for slate in slates}
    added = 0
    day = anchor + timedelta(days=len(slates))
    while day <= through:
        resting = {
            endpoint
            for slate in (slates[-rest_days:] if rest_days else [])
            for endpoint in (slate["easy"]["startId"], slate["easy"]["targetId"])
        }
        rng = random.Random(f"alleyloop-nba-daily:{day.isoformat()}")
        # Longer routes between well-known players are scarce, so they are an occasional harder day.
        wanted = MAX_LINKS if rng.random() < LONG_ROUTE_SHARE else MIN_LINKS
        for links in sorted(pools, key=lambda value: abs(value - wanted)):
            available = [
                pair for pair in pools[links]
                if frozenset((pair[0]["id"], pair[1]["id"])) not in used_pairs
                and pair[0]["id"] not in resting
                and pair[1]["id"] not in resting
            ]
            if available:
                start, target = rng.sample(rng.choice(available), 2)
                break
        else:
            raise RuntimeError(f"No unused matchup found for {day.isoformat()}")
        gap = _era_gap(start, target)

        path = routes[frozenset((start["id"], target["id"]))]
        if path[0] != start["id"]:
            path = path[::-1]
        slates.append({
            "date": day.isoformat(),
            "easy": {
                "id": f"nba-{day.isoformat()}-easy-{_slug(start['label'])}-{_slug(target['label'])}",
                "difficulty": "easy",
                "startId": start["id"],
                "targetId": target["id"],
                "expectedShortestLinks": links,
                "eraGapYears": gap,
                "curationNote": f"Generated: endpoints and featured connectors score at least {MIN_KNOWNNESS} for knownness.",
                "featuredOptimalPath": path,
            },
        })
        used_pairs.add(frozenset((start["id"], target["id"])))
        added += 1
        day += timedelta(days=1)
    return added


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Append non-repeating daily matchups to the puzzle schedule")
    parser.add_argument("--graph", required=True, help="normalized graph JSON")
    parser.add_argument("--puzzles", required=True, help="puzzle schedule JSON, updated in place")
    parser.add_argument("--through", required=True, help="last ISO date the schedule should cover")
    parser.add_argument("--rest-days", type=int, default=10, help="days before an endpoint may appear again")
    args = parser.parse_args(argv)

    graph = json.loads(Path(args.graph).read_text(encoding="utf-8"))
    puzzles_path = Path(args.puzzles)
    puzzles = json.loads(puzzles_path.read_text(encoding="utf-8"))
    added = extend_schedule(graph, puzzles, date.fromisoformat(args.through), args.rest_days)
    errors = validate_puzzles(graph, puzzles)
    if errors:
        print("Generated schedule failed validation:", file=sys.stderr)
        for error in errors[:20]:
            print(f"- {error}", file=sys.stderr)
        return 1
    puzzles_path.write_text(json.dumps(puzzles, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Added {added} slates; schedule now covers {len(puzzles['slates'])} days through {puzzles['slates'][-1]['date']}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
