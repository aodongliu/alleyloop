import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from scripts.validate_puzzles import validate_puzzles  # noqa: E402


def graph_fixture():
    active_years = {
        "a": {"from": 2020, "to": 2021},
        "b": {"from": 2020, "to": 2022},
        "c": {"from": 2022, "to": 2023},
        "d": {"from": 2022, "to": 2024},
        "e": {"from": 2015, "to": 2016},
    }
    return {
        "schemaVersion": 1,
        "sport": "fixture",
        "entities": [
            {
                "id": node,
                "label": node.upper(),
                "metadata": {"activeYears": active_years[node]},
            }
            for node in "abcde"
        ],
        "groups": [
            {"id": "g-ab", "label": "Group AB", "period": "2020", "memberIds": ["a", "b"]},
            {"id": "g-bc", "label": "Group BC", "period": "2021", "memberIds": ["b", "c"]},
            {"id": "g-cd", "label": "Group CD", "period": "2022", "memberIds": ["c", "d"]},
            {"id": "g-de", "label": "Group DE", "period": "2023", "memberIds": ["d", "e"]},
        ],
    }


def puzzle_fixture():
    return {
        "schemaVersion": 1,
        "timeZone": "America/Los_Angeles",
        "anchorDate": "2026-08-15",
        "maxEraGapYears": 25,
        "slates": [
            {
                "date": "2026-08-15",
                "easy": {
                    "id": "fixture-easy",
                    "difficulty": "easy",
                    "startId": "a",
                    "targetId": "c",
                    "expectedShortestLinks": 2,
                    "eraGapYears": 1,
                    "curationNote": "A short fixture route.",
                    "featuredOptimalPath": ["a", "b", "c"],
                },
                "hard": {
                    "id": "fixture-hard",
                    "difficulty": "hard",
                    "startId": "a",
                    "targetId": "e",
                    "expectedShortestLinks": 4,
                    "eraGapYears": 4,
                    "curationNote": "A longer fixture route.",
                    "featuredOptimalPath": ["a", "b", "c", "d", "e"],
                },
            }
        ],
    }


class ValidatePuzzlesTests(unittest.TestCase):
    def test_valid_fixture_has_no_errors(self):
        self.assertEqual(validate_puzzles(graph_fixture(), puzzle_fixture()), [])

    def test_validator_checks_exact_shortest_distance(self):
        document = puzzle_fixture()
        document["slates"][0]["easy"]["expectedShortestLinks"] = 3
        errors = validate_puzzles(graph_fixture(), document)
        self.assertTrue(any("graph distance is 2" in error for error in errors), errors)

    def test_validator_checks_each_featured_link(self):
        document = puzzle_fixture()
        document["slates"][0]["easy"]["featuredOptimalPath"] = ["a", "d", "c"]
        errors = validate_puzzles(graph_fixture(), document)
        self.assertTrue(any("link 0 is not supported" in error for error in errors), errors)

    def test_validator_rejects_medium_and_invalid_hard_distance(self):
        document = puzzle_fixture()
        document["slates"][0]["hard"]["difficulty"] = "medium"
        document["slates"][0]["hard"]["expectedShortestLinks"] = 3
        errors = validate_puzzles(graph_fixture(), document)
        self.assertTrue(any("difficulty must be 'hard'" in error for error in errors), errors)
        self.assertTrue(any("Hard shortest distance must be 4–6" in error for error in errors), errors)

    def test_validator_rejects_unknown_endpoints_and_duplicate_ids(self):
        document = puzzle_fixture()
        document["slates"][0]["easy"]["targetId"] = "missing"
        document["slates"][0]["hard"]["id"] = document["slates"][0]["easy"]["id"]
        errors = validate_puzzles(graph_fixture(), document)
        self.assertTrue(any("targetId must reference a graph entity" in error for error in errors), errors)
        self.assertTrue(any("duplicate puzzle id" in error for error in errors), errors)

    def test_validator_recomputes_era_gap_from_endpoint_metadata(self):
        document = puzzle_fixture()
        document["slates"][0]["easy"]["eraGapYears"] = 0
        errors = validate_puzzles(graph_fixture(), document)
        self.assertTrue(any("eraGapYears is 0, entity metadata computes 1" in error for error in errors), errors)

    def test_validator_rejects_era_gap_cap_violation(self):
        graph = graph_fixture()
        graph["entities"][2]["metadata"]["activeYears"] = {"from": 2050, "to": 2051}
        document = puzzle_fixture()
        document["slates"][0]["easy"]["eraGapYears"] = 29
        errors = validate_puzzles(graph, document)
        self.assertTrue(any("era gap 29 exceeds maxEraGapYears 25" in error for error in errors), errors)


if __name__ == "__main__":
    unittest.main()
