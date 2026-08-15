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
import re
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


def strip_suffix(name):
    return re.sub(r"\s+(ex|EX|V|VMAX|VSTAR|GX)\s*$", "", name).strip()


def price_pokemon(name, hint=None):
    """Highest TCGPlayer market price across printings, preferring a set hint."""
    url = ("https://api.pokemontcg.io/v2/cards?q="
           + urllib.parse.quote(f'name:"{strip_suffix(name)}"')
           + "&pageSize=25&orderBy=-set.releaseDate")
    cards = get(url).get("data", [])
    if hint:
        cards = [c for c in cards if hint.lower() in (c.get("set") or {}).get("name", "").lower()] or cards
    best = None
    for c in cards:
        for variant in ((c.get("tcgplayer") or {}).get("prices") or {}).values():
            v = variant.get("market") or variant.get("mid")
            if v and (best is None or v > best[0]):
                best = (v, (c.get("set") or {}).get("name"))
    return best


def price_mtg(name):
    c = get("https://api.scryfall.com/cards/named?fuzzy=" + urllib.parse.quote(name))
    usd = (c.get("prices") or {}).get("usd")
    return (float(usd), c.get("set_name")) if usd else None


def price_ygo(name):
    d = get("https://db.ygoprodeck.com/api/v7/cardinfo.php?name=" + urllib.parse.quote(name))["data"][0]
    v = (d.get("card_prices") or [{}])[0].get("tcgplayer_price")
    return (float(v), "base printing") if v and float(v) > 0 else None


def current_price(entry):
    game = (entry.get("game") or "").lower()
    name = entry["card"]
    try:
        if game == "pokemon":
            return price_pokemon(name, entry.get("set_hint"))
        if game == "mtg":
            return price_mtg(name)
        if game == "yugioh":
            return price_ygo(name)
    except Exception as exc:  # noqa: BLE001
        print(f"    ! {name}: {exc}")
    return None


def load_baseline():
    if not os.path.exists(BASELINE):
        sys.exit(f"No baseline at {BASELINE}. Run `snapshot` first.")
    with open(BASELINE, encoding="utf-8") as f:
        return json.load(f)


def cmd_snapshot():
    """Freeze today's price next to each recorded score."""
    data = load_baseline()
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    for e in data["cards"]:
        got = current_price(e)
        if got:
            e["baseline_price"] = round(got[0], 2)
            e["baseline_source"] = got[1]
            e["baseline_date"] = stamp
            print(f"  {e['card']:<48} ${got[0]:>9,.2f}  [{got[1]}]")
        else:
            e["baseline_price"] = None
            print(f"  {e['card']:<48} no price available")
    data["snapshot_date"] = stamp
    with open(BASELINE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")
    print(f"\nBaseline written: {BASELINE}")


def cmd_check():
    """Re-price and report movement since the baseline, grouped by score."""
    data = load_baseline()
    base_date = data.get("snapshot_date", "?")
    rows = []
    for e in data["cards"]:
        if not e.get("baseline_price"):
            continue
        got = current_price(e)
        if not got:
            continue
        move = (got[0] - e["baseline_price"]) / e["baseline_price"] * 100
        rows.append((e["score"], e["card"], e["baseline_price"], got[0], move, e.get("new_set")))

    if not rows:
        sys.exit("No comparable rows — every lookup failed or the baseline is empty.")

    print(f"\nBaseline {base_date} → today. {len(rows)} cards.\n")
    print(f"{'SCORE':>5}  {'CARD':<44}{'THEN':>10}{'NOW':>10}{'MOVE':>9}")
    print("-" * 80)
    for score, card, then, now, move, new_set in sorted(rows, reverse=True):
        flag = "  (new set)" if new_set else ""
        print(f"{score:>5}  {card[:43]:<44}{then:>10,.2f}{now:>10,.2f}{move:>8.1f}%{flag}")

    # The whole question in one number: do high scores outperform low ones?
    mid = sum(r[0] for r in rows) / len(rows)
    hi = [r[4] for r in rows if r[0] >= mid]
    lo = [r[4] for r in rows if r[0] < mid]
    print("-" * 80)
    if hi and lo:
        hi_avg, lo_avg = sum(hi) / len(hi), sum(lo) / len(lo)
        print(f"above {mid:.0f}: {hi_avg:+.1f}% avg   ({len(hi)} cards)")
        print(f"below {mid:.0f}: {lo_avg:+.1f}% avg   ({len(lo)} cards)")
        verdict = "high scores outperformed" if hi_avg > lo_avg else "high scores did NOT outperform"
        print(f"\n{verdict}  (spread {hi_avg - lo_avg:+.1f} points)")
        print("\nSmall sample. Treat as a smoke test, not proof.")
    else:
        print("Not enough spread in scores to split the set.")


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "check"
    {"snapshot": cmd_snapshot, "check": cmd_check}.get(cmd, cmd_check)()
