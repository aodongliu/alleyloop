import gzip
import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[2] / "scripts"))
from build_imdb_graph import build_graph  # noqa: E402


class ImdbGraphTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self._write("title.ratings.tsv", "tconst\taverageRating\tnumVotes\ntt1\t8.0\t1000\ntt2\t5.0\t2\ntt3\t7.0\t1000\n")
        self._write("title.basics.tsv", "tconst\ttitleType\tprimaryTitle\toriginalTitle\tisAdult\tstartYear\tendYear\truntimeMinutes\tgenres\ntt1\tmovie\tOne\tOne\t0\t2000\\t\\N\t90\tDrama,Comedy\ntt2\tmovie\tToo Obscure\tToo Obscure\t0\t2001\\t\\N\t90\tDrama\ntt3\ttvSeries\tShow\tShow\t0\t2002\\t\\N\t90\tDrama\n")
        self._write("title.principals.tsv", "tconst\tordering\tnconst\tcategory\tjob\tcharacters\ntt1\t1\tnm1\tactor\t\\N\t[\"A\"]\ntt1\t2\tnm2\tactress\t\\N\t[\"B\"]\ntt1\t3\tnm3\tproducer\tproducer\t\\N\ntt2\t1\tnm4\tactor\t\\N\t[\"C\"]\n")
        self._write("title.crew.tsv", "tconst\tdirectors\twriters\ntt1\tnm3\tnm4,nm1\n")
        self._write("name.basics.tsv", "nconst\tprimaryName\tbirthYear\tdeathYear\tprimaryProfession\tknownForTitles\nnm1\tActor One\t1970\t\\N\tactor,writer\ttt1\nnm2\tActress Two\t1980\t\\N\tactress\ttt1\nnm3\tDirector Three\t1960\t\\N\tdirector\ttt1\nnm4\tWriter Four\t1965\t\\N\twriter\ttt1\n")

    def tearDown(self):
        self.tmp.cleanup()

    def _write(self, name, text):
        (self.root / name).write_text(text.replace("\\t", "\t"), encoding="utf-8")

    def test_filters_joins_roles_and_groups(self):
        graph, report = build_graph(self.root, min_votes=100)
        self.assertEqual(report["counts"]["acceptedMovies"], 1)
        self.assertEqual(len(graph["groups"]), 1)
        group = graph["groups"][0]
        self.assertEqual(group["id"], "imdb:movie:tt1")
        self.assertEqual(group["evidence"]["roles"]["imdb:person:nm3"], ["director"])
        self.assertEqual(group["evidence"]["roles"]["imdb:person:nm1"], ["actor", "writer"])
        self.assertEqual(graph["entities"]["imdb:person:nm1"]["activeYearRange"], [2000, 2000])
        self.assertEqual(report["excluded"]["belowMinVotes"], 1)
        self.assertEqual(report["excluded"]["notMovie"], 1)

    def test_gzip_and_determinism(self):
        for path in self.root.glob("*.tsv"):
            data = path.read_bytes()
            path.unlink()
            with gzip.open(str(path) + ".gz", "wb") as handle:
                handle.write(data)
        first = build_graph(self.root, min_votes=0)
        second = build_graph(self.root, min_votes=0)
        self.assertEqual(json.dumps(first, sort_keys=True), json.dumps(second, sort_keys=True))
        self.assertEqual(len(first[0]["groups"]), 2)


if __name__ == "__main__":
    unittest.main()
