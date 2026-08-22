"""Does the score predict anything?

The scorecard has never been checked against what prices actually did. This
script is the check. It is deliberately boring: freeze a baseline today, come
back in a month, print whether the high scores beat the low ones.

    python3 scripts/backtest.py snapshot   # freeze today's prices into the baseline
    python3 scripts/backtest.py check      # re-price and report movement since

Baseline lives in scripts/backtest-baseline.json and is committed, so the
comparison survives a new phone, a reinstall, or a cleared cache.

Prices come from the same free APIs the app itself uses — pokemontcg.io
(TCGPlayer, USD), Scryfall (USD), YGOPRODeck (TCGPlayer, USD). All three are
US-market, matching what the app shows the user. Cardmarket is deliberately not
used: it is European, in euros, and carries no data at all on the high-value
chase cards, which are the ones worth testing.

Known limits, stated up front so nobody over-reads the output:
  * Small n. This is a smoke test, not a study.
  * Cards from brand-new sets have no price history and decay for reasons that
    have nothing to do with signal, so they are flagged rather than trusted.
  * YGOPRODeck prices the base printing, not alternate-art or Starlight prints,
    so a scan of a premium print cannot be matched. Those rows are skipped.
"""

import json
import os
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
BASELINE = os.path.join(HERE, "backtest-baseline.json")

UA = {
    "User-Agent": "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/126 Mobile Safari/537.36",
    "Accept": "application/json",
}


def get(url, tries=6):
    """pokemontcg.io 500s and 502s freely; retry with backoff before giving up."""
    last = None
    for i in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30) as r:
                return json.load(r)
        except Exception as exc:  # noqa: BLE001 - any transport failure is retryable here
            last = exc
            time.sleep(2 + i * 2)
    raise last


def price_pokemon(entry):
    """Price one exact Pokémon catalogue printing."""
    if entry.get("catalog_id"):
        payload = get("https://api.pokemontcg.io/v2/cards/" + urllib.parse.quote(str(entry["catalog_id"])))
        cards = [payload.get("data")] if payload.get("data") else []
    elif entry.get("set_id") and entry.get("collector_number"):
        query = f'set.id:{entry["set_id"]} number:{entry["collector_number"]}'
        cards = get("https://api.pokemontcg.io/v2/cards?q=" + urllib.parse.quote(query) + "&pageSize=2").get("data", [])
    else:
        return None
    if len(cards) != 1 or not cards[0]:
        return None
    card = cards[0]
    variants = (card.get("tcgplayer") or {}).get("prices") or {}
    wanted = entry.get("price_variant")
    selected = variants.get(wanted) if wanted else None
    if selected is None:
        priced = [value for value in variants.values() if value.get("market") or value.get("mid")]
        selected = max(priced, key=lambda value: value.get("market") or value.get("mid"), default=None)
    value = (selected or {}).get("market") or (selected or {}).get("mid")
    return (float(value), (card.get("set") or {}).get("name")) if value else None


def price_mtg(entry):
    if entry.get("catalog_id"):
        url = "https://api.scryfall.com/cards/" + urllib.parse.quote(str(entry["catalog_id"]))
    elif entry.get("set_code") and entry.get("collector_number"):
        url = ("https://api.scryfall.com/cards/"
               + urllib.parse.quote(str(entry["set_code"])) + "/"
               + urllib.parse.quote(str(entry["collector_number"])))
    else:
        return None
    c = get(url)
    usd = (c.get("prices") or {}).get("usd")
    return (float(usd), c.get("set_name")) if usd else None


def price_ygo(entry):
    code = entry.get("set_code") or entry.get("collector_number")
    if not code:
        return None
    card = get("https://db.ygoprodeck.com/api/v7/cardsetsinfo.php?setcode=" + urllib.parse.quote(str(code)))
    value = card.get("set_price")
    return (float(value), card.get("set_name")) if value and float(value) > 0 else None


def current_price(entry):
    game = (entry.get("game") or "").lower()
    name = entry["card"]
    try:
        if game == "pokemon":
            return price_pokemon(entry)
        if game == "mtg":
            return price_mtg(entry)
        if game == "yugioh":
            return price_ygo(entry)
    except Exception as exc:  # noqa: BLE001
        print(f"    ! {name}: {exc}")
    return None


def load_baseline():
    if not os.path.exists(BASELINE):
        sys.exit(f"No baseline at {BASELINE}. Run `snapshot` first.")
    with open(BASELINE, encoding="utf-8") as f:
        return json.load(f)


def has_exact_identity(entry):
    game = (entry.get("game") or "").lower()
    if game in {"pokemon", "mtg"}:
        return bool(entry.get("catalog_id") or (entry.get("set_id") or entry.get("set_code")) and entry.get("collector_number"))
    if game == "yugioh":
        return bool(entry.get("set_code") or entry.get("collector_number"))
    return False


def valid_score(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def build_rows(data, price_lookup=current_price):
    rows = []
    skipped = []
    for entry in data.get("cards", []):
        if not entry.get("baseline_price"):
            skipped.append((entry.get("card", "?"), "no baseline price"))
            continue
        if not has_exact_identity(entry):
            skipped.append((entry.get("card", "?"), "no exact printing id"))
            continue
        got = price_lookup(entry)
        if not got:
            skipped.append((entry.get("card", "?"), "current exact price unavailable"))
            continue
        move = (got[0] - entry["baseline_price"]) / entry["baseline_price"] * 100
        rows.append({
            "score": entry.get("score"), "card": entry["card"], "then": entry["baseline_price"],
            "now": got[0], "move": move, "new_set": bool(entry.get("new_set")),
        })
    return rows, skipped


def split_performance(rows):
    eligible = [row for row in rows if valid_score(row.get("score")) and not row.get("new_set")]
    if len(eligible) < 2:
        return None
    mid = sum(row["score"] for row in eligible) / len(eligible)
    high = [row["move"] for row in eligible if row["score"] >= mid]
    low = [row["move"] for row in eligible if row["score"] < mid]
    if not high or not low:
        return None
    return {"mid": mid, "high": high, "low": low}


def cmd_snapshot(replace=False):
    """Freeze today's price next to each recorded score."""
    data = load_baseline()
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    for e in data["cards"]:
        if not has_exact_identity(e):
            print(f"  {e['card']:<48} skipped: no exact printing id")
            continue
        if e.get("baseline_price") and not replace:
            print(f"  {e['card']:<48} kept existing baseline (use --replace to overwrite)")
            continue
        got = current_price(e)
        if got:
            e["baseline_price"] = round(got[0], 2)
            e["baseline_source"] = got[1]
            e["baseline_date"] = stamp
            print(f"  {e['card']:<48} ${got[0]:>9,.2f}  [{got[1]}]")
        else:
            e["baseline_price"] = None
            print(f"  {e['card']:<48} no price available")
    if not data.get("snapshot_date") or replace:
        data["snapshot_date"] = stamp
    with open(BASELINE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")
    print(f"\nBaseline written: {BASELINE}")


def cmd_check():
    """Re-price and report movement since the baseline, grouped by score."""
    data = load_baseline()
    base_date = data.get("snapshot_date", "?")
    rows, skipped = build_rows(data)

    if not rows:
        sys.exit("No comparable rows — every lookup failed or the baseline is empty.")

    print(f"\nBaseline {base_date} → today. {len(rows)} exact-print cards; {len(skipped)} skipped.\n")
    print(f"{'SCORE':>5}  {'CARD':<44}{'THEN':>10}{'NOW':>10}{'MOVE':>9}")
    print("-" * 80)
    for row in sorted(rows, key=lambda item: item["score"] if valid_score(item["score"]) else -1, reverse=True):
        score = f'{row["score"]:g}' if valid_score(row["score"]) else "—"
        flag = "  (new set; excluded from verdict)" if row["new_set"] else ""
        print(f"{score:>5}  {row['card'][:43]:<44}{row['then']:>10,.2f}{row['now']:>10,.2f}{row['move']:>8.1f}%{flag}")

    # The whole question in one number: do high scores outperform low ones?
    split = split_performance(rows)
    print("-" * 80)
    if split:
        mid, hi, lo = split["mid"], split["high"], split["low"]
        hi_avg, lo_avg = sum(hi) / len(hi), sum(lo) / len(lo)
        print(f"above {mid:.0f}: {hi_avg:+.1f}% avg   ({len(hi)} cards)")
        print(f"below {mid:.0f}: {lo_avg:+.1f}% avg   ({len(lo)} cards)")
        verdict = "high scores outperformed" if hi_avg > lo_avg else "high scores did NOT outperform"
        print(f"\n{verdict}  (spread {hi_avg - lo_avg:+.1f} points)")
        print("\nSmall sample. Treat as a smoke test, not proof.")
    else:
        print("Not enough exact, scored, mature-set rows to test the score yet.")

    if skipped:
        print("\nSkipped:")
        for card, reason in skipped:
            print(f"  - {card}: {reason}")


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "check"
    if cmd == "snapshot":
        cmd_snapshot(replace="--replace" in sys.argv[2:])
    else:
        cmd_check()
