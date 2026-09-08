# Card identification benchmark — 2026-09-07

## Test

Twelve images already on George's phone were run through the same full image,
lower-half code crop, and Signal prompt. The set contains seven Yu-Gi-Oh cards
with foil glare and tiny codes, three real Magic cards, and two Pokémon cards.
Ground truth came from the physical cards, the saved Collection, Scryfall,
Pokémon TCG data, and YGOPRODeck.

Exact means name, game, set, printed number, rarity, and Yu-Gi-Oh passcode all
matched when applicable.

| Reader | Exact | Correct name | Set | Number | YGO passcode | Field points | Mean cost | Median time |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Haiku 4.5 | 0/12 | 10/12 | 1/12 | 1/12 | 1/7 | 27/67 | $0.00270 | 5.8 s |
| Sonnet 4.6 | 3/12 | 12/12 | 7/12 | 4/12 | 3/7 | 43/67 | $0.00845 | 10.9 s |
| Gemini 2.5 Flash | 0/12 | 11/12 | 2/12 | 4/12 | 2/7 | 32/67 | $0.00056 | 1.5 s |
| Gemini 2.5 Pro | 0/12 | 12/12 | 2/12 | 4/12 | 4/7 | 40/67 | $0.00320 | 3.3 s |
| Gemini 3.5 Flash-Lite | 2/12 | 11/12 | 7/12 | 5/12 | 6/7 | 44/67 | $0.00106 | 1.9 s |
| Gemini 3.7 Flash | 2/12 | 11/12 | 6/12 | 6/12 | 6/7 | 45/67 | $0.00377 | 5.8 s |

## Real Signal result

Raw model JSON is not the product. Each answer was passed through Signal's
actual catalog resolver.

| Reader | Correct printing among choices | With safe exact-name fallback | Correct choice first |
|---|---:|---:|---:|
| Haiku 4.5 | 7/12 | 7/12 | 3/12 |
| Sonnet 4.6 | 8/12 | 12/12 | 5/12 |
| Gemini 3.5 Flash-Lite | 10/12 | 12/12 | 8/12 |
| Gemini 3.7 Flash | 10/12 | 11/12 | 7/12 |

The safe fallback never chooses a card. When a tiny code finds nothing but the
name is readable, it shows exact-name catalog rows and makes the owner choose
the visible rarity or finish.

## Decision

1. Gemini 3.5 Flash-Lite reads the image.
2. Signal's catalogs prove the identity and supply every real variation.
3. A code conflict opens exact-name choices; it never silently picks one.
4. Sonnet 4.6 runs only when Gemini plus the catalogs produce zero choices.
5. Haiku runs Full Signal only after the exact printing is locked.

This route was both cheaper and more accurate than Haiku vision. It also beat
Sonnet-every-time on cost, speed, passcode reading, and correct-first choices.
