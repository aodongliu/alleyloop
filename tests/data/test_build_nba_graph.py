import json
import sys
import unittest
from pathlib import Path


SCRIPT_DIR = Path(__file__).resolve().parents[2] / "scripts"
sys.path.insert(0, str(SCRIPT_DIR))

from build_nba_graph import build_graph, recover_team_id, season_from_game_id  # noqa: E402


FIXTURE_DIR = Path(__file__).resolve().parent


class BuildNbaGraphTests(unittest.TestCase):
    def test_game_id_season_parser_handles_bubble_and_modern_ids(self):
        self.assertEqual(season_from_game_id("41900406"), "2019-20")
        self.assertEqual(season_from_game_id("42500405"), "2025-26")
        self.assertEqual(season_from_game_id("14600001"), "1946-47")
        with self.assertRaises(ValueError):
            season_from_game_id("bad")

    def test_team_recovery_requires_one_exact_game_side(self):
        game = {
            "hometeamId": "1",
            "hometeamCity": "Atlanta",
            "hometeamName": "Hawks",
            "awayteamId": "2",
            "awayteamCity": "Boston",
            "awayteamName": "Celtics",
        }
        team, method = recover_team_id({"playerteamId": "", "playerteamCity": "Atlanta", "playerteamName": "Hawks"}, game)
        self.assertEqual((team, method), ("1", "recovered"))
        team, method = recover_team_id({"playerteamId": "", "playerteamCity": "Unknown", "playerteamName": ""}, game)
        self.assertEqual((team, method), (None, "unresolved"))
        team, method = recover_team_id({"playerteamId": "99", "playerteamCity": "Atlanta", "playerteamName": "Hawks"}, game)
        self.assertEqual((team, method), (None, "team-mismatch"))

    def test_fixture_output_is_deterministic_and_normalized(self):
        first_graph, first_report = build_graph(FIXTURE_DIR)
        second_graph, second_report = build_graph(FIXTURE_DIR)
        self.assertEqual(first_graph, second_graph)
        self.assertEqual(first_report, second_report)
        json.dumps(first_graph, sort_keys=True)
        self.assertEqual([entity["id"] for entity in first_graph["entities"]], ["nba:person:1001", "nba:person:1002", "nba:person:1003"])
        self.assertEqual(first_report["counts"]["recoveredTeamIds"], 3)
        self.assertEqual(first_report["counts"]["entities"], 3)
        self.assertEqual(first_report["counts"]["groups"], 3)
        self.assertEqual(first_report["excluded"]["nonCompetitiveGameType"], 1)
        bubble_group = next(group for group in first_graph["groups"] if group["period"] == "2019-20" and len(group["memberIds"]) == 2)
        self.assertEqual(bubble_group["metadata"]["seasonStartYear"], 2019)
        self.assertEqual(bubble_group["memberIds"], ["nba:person:1001", "nba:person:1002"])
        self.assertEqual(first_graph["entities"][0]["searchRank"], first_graph["entities"][0]["metadata"]["knownnessScore"])
        self.assertEqual(first_graph["entities"][0]["metadata"]["activeFrom"], "2019-20")
        self.assertEqual(first_graph["entities"][0]["metadata"]["activeTo"], "2020-21")
        self.assertEqual(first_graph["entities"][0]["metadata"]["teamLabels"], ["Atlanta Hawks"])
        self.assertNotIn("franchiseHistory", bubble_group["metadata"])

    def test_knownness_calibration_on_real_graph(self):
        graph_path = FIXTURE_DIR.parents[1] / "public" / "data" / "nba-graph.json"
        if not graph_path.exists():
            self.skipTest("generated NBA graph is not present")
        graph = json.loads(graph_path.read_text(encoding="utf-8"))
        by_name = {entity["label"]: entity["metadata"]["knownnessScore"] for entity in graph["entities"]}
        self.assertGreater(by_name["Michael Jordan"], 90)
        self.assertLess(by_name["Bobby Simmons"], 70)
        self.assertGreater(by_name["Victor Wembanyama"], 45)


if __name__ == "__main__":
    unittest.main()
