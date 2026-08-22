import importlib.util
import pathlib
import unittest


PATH = pathlib.Path(__file__).with_name("backtest.py")
SPEC = importlib.util.spec_from_file_location("signal_backtest", PATH)
BACKTEST = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(BACKTEST)


class BacktestTests(unittest.TestCase):
    def test_null_scores_do_not_crash_or_enter_the_verdict(self):
        data = {"cards": [
            {"card": "Exact", "game": "mtg", "catalog_id": "a", "score": 70, "baseline_price": 10, "new_set": False},
            {"card": "Null", "game": "mtg", "catalog_id": "b", "score": None, "baseline_price": 10, "new_set": False},
            {"card": "Fresh", "game": "mtg", "catalog_id": "c", "score": 20, "baseline_price": 10, "new_set": True},
        ]}
        prices = {"Exact": (12, "set"), "Null": (9, "set"), "Fresh": (8, "set")}
        rows, skipped = BACKTEST.build_rows(data, lambda entry: prices[entry["card"]])
        self.assertEqual(len(rows), 3)
        self.assertEqual(skipped, [])
        self.assertIsNone(BACKTEST.split_performance(rows))

    def test_name_only_rows_are_rejected(self):
        data = {"cards": [{"card": "Wrong printing", "game": "pokemon", "score": 80, "baseline_price": 100}]}
        rows, skipped = BACKTEST.build_rows(data, lambda _entry: (90, "other"))
        self.assertEqual(rows, [])
        self.assertEqual(skipped[0][1], "no exact printing id")

    def test_exact_mature_rows_can_be_split(self):
        rows = [
            {"score": 80, "move": 10, "new_set": False},
            {"score": 20, "move": -5, "new_set": False},
        ]
        split = BACKTEST.split_performance(rows)
        self.assertEqual(split["high"], [10])
        self.assertEqual(split["low"], [-5])


if __name__ == "__main__":
    unittest.main()
