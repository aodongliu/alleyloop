#!/usr/bin/env python3
"""Build AlleyLoop's normalized NBA entity/group graph.

The adapter intentionally consumes only the small, tabular pieces needed to
turn the Kaggle box-score feed into deterministic player/team/season evidence.
It does not build an adjacency list: the sport-neutral TypeScript graph engine
derives edges from ``groups`` at runtime.
"""

from __future__ import annotations

import argparse
import csv
import json
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Iterable


COMPETITIVE_GAME_TYPES = frozenset(
    {
        "Regular Season",
        "Playoffs",
        "Play-in Tournament",
        "NBA Emirates Cup",
        "Emirates NBA Cup",
        "NBA Cup",
        "in-season-knockout",
    }
)
NBA_LEAGUES = frozenset({"NBA", "BAA"})
SCHEMA_VERSION = 1
ADAPTER_VERSION = "nba-appearance-roster-v1"


def season_from_game_id(game_id: str) -> str:
    """Return the NBA season represented by an NBA game ID.

    NBA IDs use their first digit for game type and the following two digits
    for the season's starting year modulo 100.  The local dataset spans
    1946-2025, so 00-45 are 2000-2045 and 46-99 are 1946-1999.  This is more
    reliable than using the calendar date for the 2020 bubble playoffs.
    """

    token = game_id[1:3] if isinstance(game_id, str) else ""
    if len(token) != 2 or not token.isdigit():
        raise ValueError(f"Invalid NBA game ID season token: {game_id!r}")
    token_number = int(token)
    start_year = 2000 + token_number if token_number <= 45 else 1900 + token_number
    return f"{start_year}-{(start_year + 1) % 100:02d}"


def _float(value: str | None) -> float:
    if not value:
        return 0.0
    try:
        return float(value)
    except ValueError:
        return 0.0


def _int(value: str | None) -> int:
    if not value:
        return 0
    try:
        return int(float(value))
    except ValueError:
        return 0


def _name(first: str | None, last: str | None) -> str:
    return " ".join(part.strip() for part in (first or "", last or "") if part and part.strip())


def _clean_aliases(values: Iterable[str], label: str) -> list[str]:
    return sorted({value.strip() for value in values if value and value.strip() and value.strip() != label}, key=str.casefold)


def _game_teams(game: dict[str, str]) -> list[dict[str, str]]:
    return [
        {"id": game.get("hometeamId", "").strip(), "city": game.get("hometeamCity", "").strip(), "name": game.get("hometeamName", "").strip()},
        {"id": game.get("awayteamId", "").strip(), "city": game.get("awayteamCity", "").strip(), "name": game.get("awayteamName", "").strip()},
    ]


def recover_team_id(row: dict[str, str], game: dict[str, str] | None) -> tuple[str | None, str]:
    """Resolve a player row to exactly one game-side team.

    A supplied ID is accepted only if it is one of the two teams in the game.
    Missing IDs are recovered by exact city/name matching.  ``unresolved`` is
    returned for zero or ambiguous matches; callers must not merge such rows.
    """

    if game is None:
        return None, "missing-game"
    sides = _game_teams(game)
    supplied = row.get("playerteamId", "").strip()
    if supplied:
        if supplied in {side["id"] for side in sides}:
            return supplied, "supplied"
        return None, "team-mismatch"
    city = row.get("playerteamCity", "").strip()
    name = row.get("playerteamName", "").strip()
    matches = [
        side
        for side in sides
        if side["id"]
        and city
        and side["city"] == city
        and (not name or side["name"] == name)
    ]
    if not matches and name:
        matches = [side for side in sides if side["id"] and side["name"] == name and (not city or side["city"] == city)]
    if len(matches) == 1:
        return matches[0]["id"], "recovered"
    if not matches:
        return None, "unresolved"
    return None, "ambiguous"


def _canonical_team(team_id: str, season_start: int, histories: dict[str, list[dict[str, str]]]) -> dict[str, Any]:
    records = histories.get(team_id, [])
    chosen = None
    for record in records:
        founded = _int(record.get("seasonFounded"))
        active_till = _int(record.get("seasonActiveTill"))
        if founded <= season_start <= (active_till or season_start):
            chosen = record
            break
    chosen = chosen or (records[-1] if records else {})
    return {
        "teamId": team_id,
        "teamCity": chosen.get("teamCity", ""),
        "teamName": chosen.get("teamName", ""),
        "teamAbbrev": chosen.get("teamAbbrev", "").strip(),
        "league": chosen.get("league", "NBA"),
        "history": [
            {
                "city": record.get("teamCity", ""),
                "name": record.get("teamName", ""),
                "abbrev": record.get("teamAbbrev", "").strip(),
                "seasonFounded": _int(record.get("seasonFounded")),
                "seasonActiveTill": _int(record.get("seasonActiveTill")),
                "league": record.get("league", ""),
            }
            for record in records
        ],
    }


def knownness_score(games: int, minutes: float, points: float, seasons: int, latest_season_start: int) -> float:
    """First-pass recognizability score, not a player-quality rating.

    This intentionally uses *linear* caps rather than logarithms, which were
    too saturating for long but ordinary careers.  The weights are games 17%,
    minutes 11%, points 20%, seasons 14%, points-per-game visibility 21%, and
    recency 17%.  Caps are 1,000 games, 30,000 minutes, 30,000 points, 12
    seasons and 25 points per game.  Recency rises linearly from 1980 to the
    latest source season (2025).  The constants are documented, heuristic and
    replaceable once human curation data exists.
    """

    def capped_linear(value: float, ceiling: float) -> float:
        return min(1.0, max(0.0, value) / ceiling)

    points_per_game = points / games if games else 0.0
    recency = min(1.0, max(0.0, (latest_season_start - 1980) / (2025 - 1980)))
    score = 100.0 * (
        0.17 * capped_linear(games, 1000)
        + 0.11 * capped_linear(minutes, 30000)
        + 0.20 * capped_linear(points, 30000)
        + 0.14 * capped_linear(seasons, 12)
        + 0.21 * capped_linear(points_per_game, 25)
        + 0.17 * recency
    )
    return round(score, 2)


def build_graph(input_dir: Path) -> tuple[dict[str, Any], dict[str, Any]]:
    """Build the normalized graph and preprocessing quality report."""

    players_path = input_dir / "Players.csv"
    games_path = input_dir / "Games.csv"
    histories_path = input_dir / "TeamHistories.csv"
    stats_path = input_dir / "PlayerStatistics.csv"

    player_records: dict[str, dict[str, str]] = {}
    with players_path.open(newline="", encoding="utf-8-sig") as handle:
        for row in csv.DictReader(handle):
            person_id = row.get("personId", "").strip()
            if person_id:
                player_records[person_id] = row

    games: dict[str, dict[str, str]] = {}
    with games_path.open(newline="", encoding="utf-8-sig") as handle:
        for row in csv.DictReader(handle):
            game_id = row.get("gameId", "").strip()
            if game_id:
                games[game_id] = row

    histories: dict[str, list[dict[str, str]]] = defaultdict(list)
    accepted_team_ids: set[str] = set()
    with histories_path.open(newline="", encoding="utf-8-sig") as handle:
        for row in csv.DictReader(handle):
            team_id = row.get("teamId", "").strip()
            histories[team_id].append(row)
            if team_id and row.get("league", "").strip() in NBA_LEAGUES:
                accepted_team_ids.add(team_id)

    stats: dict[str, dict[str, Any]] = {}
    groups: dict[tuple[str, str], dict[str, Any]] = {}
    quality: Counter[str] = Counter()
    excluded_by_reason: Counter[str] = Counter()
    game_type_counts: Counter[str] = Counter()
    recovered_by_type: Counter[str] = Counter()
    stat_game_ids: set[str] = set()
    accepted_game_ids: set[str] = set()
    accepted_team_ids_observed: set[str] = set()
    names_to_ids: defaultdict[str, set[str]] = defaultdict(set)
    season_starts: set[int] = set()

    with stats_path.open(newline="", encoding="utf-8-sig") as handle:
        for row in csv.DictReader(handle):
            quality["statsRows"] += 1
            person_id = row.get("personId", "").strip()
            game_id = row.get("gameId", "").strip()
            if game_id:
                stat_game_ids.add(game_id)
            game = games.get(game_id)
            game_type = row.get("gameType", "").strip() or (game or {}).get("gameType", "").strip()
            game_type_counts[game_type or "<blank>"] += 1
            if game_type not in COMPETITIVE_GAME_TYPES:
                excluded_by_reason["nonCompetitiveGameType"] += 1
                continue
            if not game:
                excluded_by_reason["missingGameJoin"] += 1
                continue
            if not person_id:
                excluded_by_reason["missingPersonId"] += 1
                continue
            try:
                season = season_from_game_id(game_id)
            except ValueError:
                excluded_by_reason["invalidGameIdSeason"] += 1
                continue
            season_start = int(season[:4])
            season_starts.add(season_start)
            team_id, resolution = recover_team_id(row, game)
            if resolution == "recovered":
                quality["recoveredTeamIds"] += 1
                recovered_by_type[game_type] += 1
            elif resolution == "team-mismatch":
                excluded_by_reason["teamIdMismatch"] += 1
            elif resolution in {"unresolved", "ambiguous", "missing-game"}:
                excluded_by_reason[resolution] += 1
            if not team_id:
                continue
            if team_id not in accepted_team_ids:
                excluded_by_reason["nonNBAOrForeignTeam"] += 1
                continue
            if not game_id:
                excluded_by_reason["missingGameId"] += 1
                continue
            quality["acceptedRows"] += 1
            accepted_game_ids.add(game_id)
            accepted_team_ids_observed.add(team_id)
            stats_entry = stats.setdefault(
                person_id,
                {
                    "id": f"nba:person:{person_id}",
                    "personId": person_id,
                    "statsNames": set(),
                    "games": set(),
                    "minutes": 0.0,
                    "points": 0.0,
                    "seasons": set(),
                    "teams": defaultdict(set),
                },
            )
            stats_name = _name(row.get("firstName"), row.get("lastName"))
            if stats_name:
                stats_entry["statsNames"].add(stats_name)
                names_to_ids[stats_name].add(person_id)
            stats_entry["games"].add(game_id)
            stats_entry["minutes"] += _float(row.get("numMinutes"))
            stats_entry["points"] += _float(row.get("points"))
            stats_entry["seasons"].add(season)
            stats_entry["teams"][team_id].add(season)

            group = groups.setdefault(
                (team_id, season),
                {
                    "teamId": team_id,
                    "season": season,
                    "members": set(),
                    "gameIds": set(),
                    "gameTypes": set(),
                    "observedLabels": set(),
                },
            )
            group["members"].add(person_id)
            group["gameIds"].add(game_id)
            group["gameTypes"].add(game_type)
            for side in _game_teams(game):
                if side["id"] == team_id:
                    label = " ".join(part for part in (side["city"], side["name"]) if part).strip()
                    if label:
                        group["observedLabels"].add(label)

    entities: list[dict[str, Any]] = []
    missing_canonical_names = 0
    duplicate_name_ids = {name: ids for name, ids in names_to_ids.items() if len(ids) > 1}
    for person_id in sorted(stats):
        entry = stats[person_id]
        player = player_records.get(person_id, {})
        canonical_name = _name(player.get("firstName"), player.get("lastName"))
        if not canonical_name:
            missing_canonical_names += 1
            canonical_name = sorted(entry["statsNames"], key=str.casefold)[0] if entry["statsNames"] else f"Player {person_id}"
        aliases = _clean_aliases(entry["statsNames"], canonical_name)
        season_values = sorted(entry["seasons"])
        team_values = []
        for team_id in sorted(entry["teams"]):
            team_seasons = sorted(entry["teams"][team_id])
            team_start = int(team_seasons[0][:4]) if team_seasons else 1946
            team_record = _canonical_team(team_id, team_start, histories)
            team_label = " ".join(part for part in (team_record["teamCity"], team_record["teamName"]) if part).strip() or team_id
            team_values.append(
                {
                    "teamId": team_id,
                    "seasons": team_seasons,
                    "label": team_label,
                }
            )
        latest_start = max((int(value[:4]) for value in season_values), default=1946)
        knownness = knownness_score(len(entry["games"]), entry["minutes"], entry["points"], len(entry["seasons"]), latest_start)
        team_labels = sorted({team["label"] for team in team_values if team["label"]}, key=str.casefold)
        entities.append(
            {
                "id": entry["id"],
                "label": canonical_name,
                "aliases": aliases,
                "searchRank": knownness,
                "metadata": {
                    "sport": "nba",
                    "personId": person_id,
                    "activeFrom": season_values[0] if season_values else "",
                    "activeTo": season_values[-1] if season_values else "",
                    "activeYears": {"from": int(season_values[0][:4]), "to": latest_start + 1} if season_values else None,
                    "teams": team_values,
                    "teamLabels": team_labels,
                    "games": len(entry["games"]),
                    "minutes": round(entry["minutes"], 3),
                    "points": round(entry["points"], 3),
                    "knownnessScore": knownness,
                    "knownnessMethod": "first-pass visibility score: games 17%, minutes 11%, points 20%, seasons 14%, points-per-game 21%, recency 17%; linear caps; not a player-quality rating",
                },
            }
        )

    normalized_groups: list[dict[str, Any]] = []
    for (team_id, season), group in sorted(groups.items(), key=lambda item: (item[0][1], item[0][0])):
        season_start = int(season[:4])
        canonical = _canonical_team(team_id, season_start, histories)
        label = sorted(group["observedLabels"], key=str.casefold)[0] if group["observedLabels"] else " ".join(part for part in (canonical["teamCity"], canonical["teamName"]) if part).strip()
        normalized_groups.append(
            {
                "id": f"nba:team-season:{team_id}:{season}",
                "label": label or canonical["teamName"] or team_id,
                "period": season,
                "memberIds": [f"nba:person:{person_id}" for person_id in sorted(group["members"])],
                "metadata": {
                    "sport": "nba",
                    "teamId": team_id,
                    "teamCity": canonical["teamCity"],
                    "teamName": canonical["teamName"],
                    "teamAbbrev": canonical["teamAbbrev"],
                    "league": canonical["league"],
                    "seasonStartYear": season_start,
                    "seasonEndYear": season_start + 1,
                    "sourceGameCount": len(group["gameIds"]),
                    "sourceGameTypes": sorted(group["gameTypes"]),
                },
            }
        )

    memberships = sum(len(group["members"]) for group in groups.values())
    unique_edges = 0
    adjacency: defaultdict[str, set[str]] = defaultdict(set)
    for group in groups.values():
        members = sorted(group["members"])
        unique_edges += len(members) * (len(members) - 1) // 2
        for index, left in enumerate(members):
            for right in members[index + 1 :]:
                adjacency[left].add(right)
                adjacency[right].add(left)
    # Count each edge once; groups can support the same pair across seasons.
    unique_edges = sum(len(neighbors) for neighbors in adjacency.values()) // 2
    components = 0
    visited: set[str] = set()
    for node in adjacency:
        if node in visited:
            continue
        components += 1
        stack = [node]
        visited.add(node)
        while stack:
            current = stack.pop()
            for neighbor in adjacency[current]:
                if neighbor not in visited:
                    visited.add(neighbor)
                    stack.append(neighbor)

    source = {
        "name": "Kaggle NBA dataset",
        "adapter": ADAPTER_VERSION,
        "tables": ["Players.csv", "Games.csv", "TeamHistories.csv", "PlayerStatistics.csv"],
        "rosterSemantics": "appearance-derived roster presence from competitive-game box scores; zero-minute rows are retained; explicit non-appearance roster transactions are not present in the source",
        "seasonKey": "gameId token characters 2-3, not calendar date",
        "knownness": "First-pass recognizability proxy using linear caps for games/minutes/points/seasons, points-per-game visibility and recency (weights 17/11/20/14/21/17; caps 1000/30000/30000/12/25; recency baseline 1980); it is not a player-quality rating and remains curator-replaceable.",
    }
    graph = {
        "schemaVersion": SCHEMA_VERSION,
        "sport": "nba",
        "source": source,
        "entities": entities,
        "groups": normalized_groups,
    }
    report = {
        "schemaVersion": SCHEMA_VERSION,
        "sport": "nba",
        "adapter": ADAPTER_VERSION,
        "source": source,
        "counts": {
            "statsRows": quality["statsRows"],
            "acceptedRows": quality["acceptedRows"],
            "recoveredTeamIds": quality["recoveredTeamIds"],
            "gamesInStats": len(stat_game_ids),
            "acceptedGames": len(accepted_game_ids),
            "acceptedTeamsObserved": len(accepted_team_ids_observed),
            "entities": len(entities),
            "groups": len(normalized_groups),
            "memberships": memberships,
            "uniqueEdges": unique_edges,
            "connectedComponents": components,
            "seasons": len(season_starts),
            "duplicateNameGroups": len(duplicate_name_ids),
            "missingCanonicalNames": missing_canonical_names,
        },
        "duplicateNameExamples": [
            {"name": name, "personIds": sorted(person_ids)}
            for name, person_ids in sorted(duplicate_name_ids.items(), key=lambda item: item[0].casefold())[:20]
        ],
        "coverage": {
            "seasonStartYears": sorted(season_starts),
            "seasonLabels": sorted({group["season"] for group in groups.values()}),
            "competitiveGameTypes": sorted(COMPETITIVE_GAME_TYPES),
            "gameTypeRows": dict(sorted(game_type_counts.items())),
            "recoveredTeamIdsByGameType": dict(sorted(recovered_by_type.items())),
        },
        "excluded": dict(sorted(excluded_by_reason.items())),
        "qualityNotes": [
            "All-Star and preseason rows are excluded; foreign exhibition teams are excluded by NBA/BAA TeamHistories membership.",
            "Rows with unresolved or ambiguous team identity are never merged into a group.",
            "Canonical player labels come from Players.csv; distinct names observed in PlayerStatistics.csv are aliases.",
            "The graph engine should derive edges from group co-membership and preserve every group as connection evidence.",
        ],
    }
    return graph, report


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, required=True, help="Kaggle dataset directory")
    parser.add_argument("--output", type=Path, required=True, help="Normalized graph JSON path")
    parser.add_argument("--report", type=Path, required=True, help="Preprocessing quality report JSON path")
    args = parser.parse_args()
    graph, report = build_graph(args.input)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(graph, ensure_ascii=False, separators=(",", ":"), sort_keys=False) + "\n", encoding="utf-8")
    args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2, sort_keys=False) + "\n", encoding="utf-8")
    print(json.dumps(report["counts"], sort_keys=True))


if __name__ == "__main__":
    main()
