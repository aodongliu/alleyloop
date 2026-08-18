#!/usr/bin/env python3
"""Validate curated AlleyLoop puzzles against a normalized graph.

The graph format intentionally mirrors ``src/core/model.ts``: an object with
``entities`` and ``groups`` arrays, where each group contains ``memberIds``.
This module is dependency-free so it can run during a data build or in a small
CI job without installing Python packages.
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import deque
from datetime import date
from itertools import combinations
from pathlib import Path
from typing import Any


class ValidationError(ValueError):
    """Raised when a graph or puzzle document fails validation."""


def _is_string(value: Any) -> bool:
    return isinstance(value, str) and bool(value.strip())


def _bfs(adjacency: dict[str, set[str]], start: str, target: str) -> tuple[int | None, list[str]]:
    if start not in adjacency or target not in adjacency:
        return None, []
    if start == target:
        return 0, [start]

    queue: deque[str] = deque([start])
    previous: dict[str, str | None] = {start: None}
    while queue:
        current = queue.popleft()
        for neighbor in sorted(adjacency[current]):
            if neighbor in previous:
                continue
            previous[neighbor] = current
            if neighbor == target:
                path: list[str] = []
                cursor: str | None = target
                while cursor is not None:
                    path.append(cursor)
                    cursor = previous[cursor]
                path.reverse()
                return len(path) - 1, path
            queue.append(neighbor)
    return None, []


def _graph_adjacency(graph: dict[str, Any], errors: list[str]) -> tuple[set[str], dict[str, set[str]]]:
    entities = graph.get("entities")
    groups = graph.get("groups")
    if not isinstance(entities, list):
        errors.append("graph.entities must be an array")
        return set(), {}
    if not isinstance(groups, list):
        errors.append("graph.groups must be an array")
        return set(), {}

    entity_ids: set[str] = set()
    for index, entity in enumerate(entities):
        if not isinstance(entity, dict) or not _is_string(entity.get("id")):
            errors.append(f"graph.entities[{index}] must have a non-empty string id")
            continue
        entity_id = entity["id"]
        if entity_id in entity_ids:
            errors.append(f"duplicate graph entity id: {entity_id}")
        entity_ids.add(entity_id)

    adjacency = {entity_id: set() for entity_id in entity_ids}
    group_ids: set[str] = set()
    for index, group in enumerate(groups):
        prefix = f"graph.groups[{index}]"
        if not isinstance(group, dict):
            errors.append(f"{prefix} must be an object")
            continue
        group_id = group.get("id")
        if not _is_string(group_id):
            errors.append(f"{prefix}.id must be a non-empty string")
        elif group_id in group_ids:
            errors.append(f"duplicate graph group id: {group_id}")
        else:
            group_ids.add(group_id)
        members = group.get("memberIds")
        if not isinstance(members, list) or not all(_is_string(member) for member in members):
            errors.append(f"{prefix}.memberIds must be an array of non-empty strings")
            continue
        if len(set(members)) != len(members):
            errors.append(f"{prefix}.memberIds contains duplicate entity ids")
        unknown = sorted(set(members) - entity_ids)
        if unknown:
            errors.append(f"{prefix}.memberIds references unknown entities: {', '.join(unknown[:5])}")
            continue
        for left, right in combinations(set(members), 2):
            adjacency[left].add(right)
            adjacency[right].add(left)
    return entity_ids, adjacency


def _slate_entries(document: dict[str, Any], errors: list[str]) -> list[tuple[str, dict[str, Any]]]:
    slates = document.get("slates")
    if not isinstance(slates, (list, dict)):
        errors.append("puzzles.slates must be an array or object")
        return []

    entries: list[tuple[str, dict[str, Any]]] = []
    if isinstance(slates, list):
        for index, slate in enumerate(slates):
            prefix = f"slates[{index}]"
            if not isinstance(slate, dict):
                errors.append(f"{prefix} must be an object")
                continue
            if set(slate) != {"date", "easy", "hard"}:
                errors.append(f"{prefix} must contain exactly date, easy, and hard")
                continue
            entries.append((prefix, slate))
    else:
        for slate_date, slate in slates.items():
            prefix = f"slates[{slate_date!r}]"
            if not isinstance(slate, dict):
                errors.append(f"{prefix} must be an object")
                continue
            if set(slate) != {"easy", "hard"}:
                errors.append(f"{prefix} must contain exactly easy and hard")
                continue
            entries.append((prefix, {"date": slate_date, **slate}))
    return entries


def validate_puzzles(graph: dict[str, Any], puzzles: dict[str, Any]) -> list[str]:
    """Return all validation errors; an empty list means the documents are valid."""

    errors: list[str] = []
    if not isinstance(graph, dict):
        return ["graph document must be an object"]
    if not isinstance(puzzles, dict):
        return ["puzzles document must be an object"]

    if puzzles.get("schemaVersion") != 1:
        errors.append("puzzles.schemaVersion must be 1")
    if puzzles.get("timeZone") != "America/Los_Angeles":
        errors.append("puzzles.timeZone must be America/Los_Angeles")
    max_era_gap = puzzles.get("maxEraGapYears")
    if isinstance(max_era_gap, bool) or not isinstance(max_era_gap, int) or max_era_gap < 0:
        errors.append("puzzles.maxEraGapYears must be a non-negative integer")
    anchor = puzzles.get("anchorDate")
    if not _is_string(anchor):
        errors.append("puzzles.anchorDate must be an ISO date")
    else:
        try:
            date.fromisoformat(anchor)
        except ValueError:
            errors.append("puzzles.anchorDate must be an ISO date")

    entity_ids, adjacency = _graph_adjacency(graph, errors)
    graph_entities = graph.get("entities")
    if not isinstance(graph_entities, list):
        graph_entities = []
    entity_records = {
        entity.get("id"): entity
        for entity in graph_entities
        if isinstance(entity, dict) and _is_string(entity.get("id"))
    }
    slates = _slate_entries(puzzles, errors)
    if not slates:
        errors.append("puzzles.slates must contain at least one slate")

    seen_dates: set[str] = set()
    seen_puzzle_ids: set[str] = set()
    for slate_prefix, slate in slates:
        slate_date = slate.get("date")
        if not _is_string(slate_date):
            errors.append(f"{slate_prefix}.date must be an ISO date")
        else:
            try:
                date.fromisoformat(slate_date)
            except ValueError:
                errors.append(f"{slate_prefix}.date must be an ISO date")
            if slate_date in seen_dates:
                errors.append(f"duplicate slate date: {slate_date}")
            seen_dates.add(slate_date)

        for difficulty in ("easy", "hard"):
            puzzle = slate.get(difficulty)
            prefix = f"{slate_prefix}.{difficulty}"
            if not isinstance(puzzle, dict):
                errors.append(f"{prefix} must be an object")
                continue

            required = {
                "id",
                "difficulty",
                "startId",
                "targetId",
                "expectedShortestLinks",
                "eraGapYears",
                "curationNote",
                "featuredOptimalPath",
            }
            missing = sorted(required - set(puzzle))
            if missing:
                errors.append(f"{prefix} is missing: {', '.join(missing)}")
                continue
            puzzle_id = puzzle.get("id")
            if not _is_string(puzzle_id):
                errors.append(f"{prefix}.id must be a non-empty string")
            elif puzzle_id in seen_puzzle_ids:
                errors.append(f"duplicate puzzle id: {puzzle_id}")
            else:
                seen_puzzle_ids.add(puzzle_id)
            if puzzle.get("difficulty") != difficulty:
                errors.append(f"{prefix}.difficulty must be {difficulty!r}")

            start = puzzle.get("startId")
            target = puzzle.get("targetId")
            for name, entity_id in (("startId", start), ("targetId", target)):
                if not _is_string(entity_id) or entity_id not in entity_ids:
                    errors.append(f"{prefix}.{name} must reference a graph entity")
            if start == target and _is_string(start):
                errors.append(f"{prefix} startId and targetId must differ")

            era_gap = puzzle.get("eraGapYears")
            if isinstance(era_gap, bool) or not isinstance(era_gap, int) or era_gap < 0:
                errors.append(f"{prefix}.eraGapYears must be a non-negative integer")
            else:
                start_entity = entity_records.get(start)
                target_entity = entity_records.get(target)
                start_years = start_entity.get("metadata", {}).get("activeYears") if isinstance(start_entity, dict) else None
                target_years = target_entity.get("metadata", {}).get("activeYears") if isinstance(target_entity, dict) else None
                valid_years = True
                for endpoint, years in (("startId", start_years), ("targetId", target_years)):
                    if (
                        not isinstance(years, dict)
                        or isinstance(years.get("from"), bool)
                        or not isinstance(years.get("from"), int)
                        or isinstance(years.get("to"), bool)
                        or not isinstance(years.get("to"), int)
                        or years["from"] > years["to"]
                    ):
                        errors.append(f"{prefix}.{endpoint} entity metadata.activeYears must contain ordered integer from/to values")
                        valid_years = False
                if valid_years:
                    computed_gap = max(
                        0,
                        max(start_years["from"], target_years["from"])
                        - min(start_years["to"], target_years["to"]),
                    )
                    if era_gap != computed_gap:
                        errors.append(
                            f"{prefix}.eraGapYears is {era_gap}, entity metadata computes {computed_gap}"
                        )
                    if isinstance(max_era_gap, int) and not isinstance(max_era_gap, bool) and computed_gap > max_era_gap:
                        errors.append(
                            f"{prefix} era gap {computed_gap} exceeds maxEraGapYears {max_era_gap}"
                        )

            expected = puzzle.get("expectedShortestLinks")
            if isinstance(expected, bool) or not isinstance(expected, int):
                errors.append(f"{prefix}.expectedShortestLinks must be an integer")
            elif difficulty == "easy" and not (1 <= expected <= 4):
                errors.append(f"{prefix} Easy shortest distance must be 1–4")
            elif difficulty == "hard" and not (4 <= expected <= 6):
                errors.append(f"{prefix} Hard shortest distance must be 4–6")
            if not _is_string(puzzle.get("curationNote")):
                errors.append(f"{prefix}.curationNote must be a non-empty string")

            path = puzzle.get("featuredOptimalPath")
            if not isinstance(path, list) or not all(_is_string(node) for node in path):
                errors.append(f"{prefix}.featuredOptimalPath must be an array of entity ids")
                continue
            if _is_string(start) and path and path[0] != start:
                errors.append(f"{prefix}.featuredOptimalPath must start at startId")
            if _is_string(target) and path and path[-1] != target:
                errors.append(f"{prefix}.featuredOptimalPath must end at targetId")
            if len(set(path)) != len(path):
                errors.append(f"{prefix}.featuredOptimalPath must not repeat entities")
            unknown_path = sorted(set(path) - entity_ids)
            if unknown_path:
                errors.append(f"{prefix}.featuredOptimalPath references unknown entities: {', '.join(unknown_path[:5])}")
            if isinstance(expected, int) and not isinstance(expected, bool) and len(path) != expected + 1:
                errors.append(f"{prefix}.featuredOptimalPath must contain expectedShortestLinks + 1 entities")

            if (
                _is_string(start)
                and _is_string(target)
                and start in entity_ids
                and target in entity_ids
                and isinstance(expected, int)
                and not isinstance(expected, bool)
            ):
                distance, _ = _bfs(adjacency, start, target)
                if distance is None:
                    errors.append(f"{prefix} endpoints are not connected in the graph")
                elif distance != expected:
                    errors.append(f"{prefix} expected shortest distance {expected}, graph distance is {distance}")
            if len(path) > 1 and all(node in entity_ids for node in path):
                for index, (left, right) in enumerate(zip(path, path[1:])):
                    if right not in adjacency[left]:
                        errors.append(f"{prefix}.featuredOptimalPath link {index} is not supported by a shared group")

    return errors


def validate_files(graph_path: str | Path, puzzles_path: str | Path) -> list[str]:
    with Path(graph_path).open(encoding="utf-8") as handle:
        graph = json.load(handle)
    with Path(puzzles_path).open(encoding="utf-8") as handle:
        puzzles = json.load(handle)
    return validate_puzzles(graph, puzzles)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Validate AlleyLoop puzzle slates against a normalized graph")
    parser.add_argument("--graph", required=True, help="normalized graph JSON")
    parser.add_argument("--puzzles", required=True, help="curated puzzle JSON")
    args = parser.parse_args(argv)
    try:
        errors = validate_files(args.graph, args.puzzles)
    except (OSError, json.JSONDecodeError, TypeError, ValueError) as exc:
        print(f"Validation could not run: {exc}", file=sys.stderr)
        return 2
    if errors:
        print("Puzzle validation failed:", file=sys.stderr)
        for error in errors:
            print(f"- {error}", file=sys.stderr)
        return 1
    print(f"Validated {len(json.loads(Path(args.puzzles).read_text(encoding='utf-8'))['slates'])} puzzle slates.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
