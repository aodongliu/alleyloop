#!/usr/bin/env python3
"""Experimental IMDb preprocessing spike; see MOVIES_HANDOFF.md before use.

The adapter deliberately keeps movie groups (rather than expanding an adjacency
list), and streams the potentially multi-gigabyte principals file line by line.
IMDb's free dataset contains principal credits, not a complete cast/crew list.

Important: this paused spike predates the final NormalizedConnectionDataset
shape and its output is not yet consumable by ConnectionGraph. It is retained as
implementation research, not as a supported data-build command.
"""
from __future__ import annotations

import argparse
import csv
import gzip
import json
import math
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Iterator

ADAPTER_VERSION = "imdb-principal-movie-v1"
SCHEMA_VERSION = 1


def _open_tsv(path: Path):
    return gzip.open(path, "rt", encoding="utf-8", newline="") if path.suffix == ".gz" else path.open("r", encoding="utf-8", newline="")


def _find(directory: Path, stem: str) -> Path:
    for name in (stem, stem + ".gz"):
        candidate = directory / name
        if candidate.exists():
            return candidate
    raise FileNotFoundError(f"Missing IMDb dataset: {stem}[.gz] in {directory}")


def _rows(path: Path) -> Iterator[dict[str, str]]:
    with _open_tsv(path) as handle:
        yield from csv.DictReader(handle, delimiter="\t")


def _int(value: str | None, default: int = 0) -> int:
    try:
        return int(value or "")
    except ValueError:
        return default


def _float(value: str | None, default: float = 0.0) -> float:
    try:
        return float(value or "")
    except ValueError:
        return default


def _score(title_count: int, votes: int, first_year: int | None, last_year: int | None, latest_year: int) -> float:
    """Recognizability proxy: exposure (titles/votes) plus career recency.

    This is a search/display heuristic, not a quality or popularity judgment:
    45% log-capped included-title count (cap 40), 35% log-capped vote exposure
    (cap 10 million), and 20% recency of the latest included title.
    """
    titles = min(1.0, math.log1p(title_count) / math.log1p(40))
    exposure = min(1.0, math.log1p(votes) / math.log1p(10_000_000))
    recency = min(1.0, max(0.0, (last_year or 0) - 1980) / max(1, latest_year - 1980))
    return round(100 * (0.45 * titles + 0.35 * exposure + 0.20 * recency), 2)


def build_graph(input_dir: Path, min_votes: int = 100) -> tuple[dict[str, Any], dict[str, Any]]:
    ratings: dict[str, tuple[float, int]] = {}
    for row in _rows(_find(input_dir, "title.ratings.tsv")):
        ratings[row["tconst"]] = (_float(row.get("averageRating")), _int(row.get("numVotes")))

    movies: dict[str, dict[str, Any]] = {}
    excluded = Counter()
    for row in _rows(_find(input_dir, "title.basics.tsv")):
        title_id = row.get("tconst", "").strip()
        year = _int(row.get("startYear"), -1)
        rating, votes = ratings.get(title_id, (0.0, 0))
        if row.get("titleType") != "movie":
            excluded["notMovie"] += 1
        elif row.get("isAdult") != "0":
            excluded["adult"] += 1
        elif year < 0:
            excluded["invalidYear"] += 1
        elif votes < min_votes:
            excluded["belowMinVotes"] += 1
        elif title_id:
            movies[title_id] = {"title": row.get("primaryTitle", ""), "year": year, "rating": rating, "votes": votes, "genres": row.get("genres", "")}

    roles: defaultdict[str, dict[str, set[str]]] = defaultdict(lambda: defaultdict(set))
    person_titles: defaultdict[str, set[str]] = defaultdict(set)
    for row in _rows(_find(input_dir, "title.principals.tsv")):
        title_id, person, category = row.get("tconst", "").strip(), row.get("nconst", "").strip(), row.get("category", "").strip()
        if title_id in movies and person and category in {"actor", "actress"}:
            roles[title_id][person].add(category)
            person_titles[person].add(title_id)
    for row in _rows(_find(input_dir, "title.crew.tsv")):
        title_id = row.get("tconst", "").strip()
        if title_id not in movies:
            continue
        for field, role in (("directors", "director"), ("writers", "writer")):
            for person in (row.get(field, "") or "").split(","):
                person = person.strip()
                if person and person != "\\N":
                    roles[title_id][person].add(role)
                    person_titles[person].add(title_id)

    names: dict[str, dict[str, Any]] = {}
    for row in _rows(_find(input_dir, "name.basics.tsv")):
        person = row.get("nconst", "").strip()
        if person in person_titles:
            names[person] = {"name": row.get("primaryName", ""), "professions": _split_array(row.get("primaryProfession", "")), "knownForTitles": _split_array(row.get("knownForTitles", ""))}

    latest_year = max((m["year"] for m in movies.values()), default=1980)
    entities: dict[str, dict[str, Any]] = {}
    for person in sorted(person_titles):
        records = [movies[t] for t in person_titles[person]]
        years = sorted(m["year"] for m in records)
        role_set = sorted({role for title in person_titles[person] for role in roles[title][person]})
        rating_votes = sum(m["votes"] for m in records)
        entity_id = f"imdb:person:{person}"
        data = names.get(person, {})
        entities[entity_id] = {"id": entity_id, "type": "person", "name": data.get("name", person), "professions": sorted(data.get("professions", [])), "activeYearRange": [years[0], years[-1]], "includedTitleIds": [f"imdb:movie:{title}" for title in sorted(person_titles[person])], "includedTitleCount": len(records), "creditRoles": role_set, "searchRank": _score(len(records), rating_votes, years[0], years[-1], latest_year)}

    groups = []
    memberships = 0
    for title_id in sorted(roles):
        members = sorted(f"imdb:person:{p}" for p in roles[title_id])
        if not members:
            continue
        movie = movies[title_id]
        groups.append({"id": f"imdb:movie:{title_id}", "type": "movie", "label": movie["title"], "year": movie["year"], "members": members, "evidence": {"titleId": title_id, "rating": movie["rating"], "votes": movie["votes"], "genres": _split_array(movie["genres"]), "roles": {f"imdb:person:{p}": sorted(roles[title_id][p]) for p in sorted(roles[title_id])}}})
        memberships += len(members)

    source = {"name": "IMDb Non-Commercial Datasets", "adapter": ADAPTER_VERSION, "tables": ["title.basics.tsv", "title.ratings.tsv", "title.principals.tsv", "title.crew.tsv", "name.basics.tsv"], "semantics": "feature films (titleType=movie, isAdult=0, valid startYear) with principal actor/actress credits plus directors/writers", "minVotes": min_votes, "license": "IMDb limited personal/non-commercial use; verify current terms before publication", "recognizability": "searchRank = 45% log-capped included titles (cap 40) + 35% log-capped summed movie votes (cap 10m) + 20% latest-year recency; heuristic only"}
    graph = {"schemaVersion": SCHEMA_VERSION, "domain": "movie", "source": source, "entities": entities, "groups": groups}
    report = {"schemaVersion": SCHEMA_VERSION, "domain": "movie", "adapter": ADAPTER_VERSION, "source": source, "counts": {"acceptedMovies": len(movies), "groups": len(groups), "entities": len(entities), "memberships": memberships, "roleRows": sum(len(v) for v in roles.values())}, "excluded": dict(sorted(excluded.items())), "qualityNotes": ["Groups are retained as movie evidence; adjacency is intentionally not materialized.", "IMDb title.principals is a selected principal-credit subset, not complete cast/crew.", "Persons absent from name.basics retain their stable nconst and a fallback label."]}
    return graph, report


def _split_array(value: str | None) -> list[str]:
    return sorted(x.strip() for x in (value or "").split(",") if x.strip() and x.strip() != "\\N")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--report", type=Path, required=True)
    parser.add_argument("--min-votes", type=int, default=100, help="Minimum IMDb votes per movie (default: 100)")
    args = parser.parse_args()
    graph, report = build_graph(args.input, args.min_votes)
    args.output.parent.mkdir(parents=True, exist_ok=True); args.report.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(graph, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report["counts"], sort_keys=True))


if __name__ == "__main__":
    main()
