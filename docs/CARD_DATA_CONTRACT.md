# Exact card data contract

Every card door must produce one `card` record before it can save data or run
Full Signal. A card name alone is never a record.

## Required identity

- Game
- Stable catalogue printing ID
- Set name and printed number
- Rarity when the catalogue supplies it
- Physical finish for Pokémon and Magic
- `pinned: true`

Pokémon printing ids are compared in pokemontcg.io shape. TCGdex's
`sv08.5-161` and pokemontcg.io's `sv8pt5-161` are one card and one identity
(`pokemonIds.js`); every TCGdex fallback translates the id before asking.

## Carried facts

The same record carries the exact catalogue image, current exact-print price,
price source, price-check time, and provider links. A full report adds Signal
data beside that record. It does not create another card identity.

## Every input door

- Typed name
- Typed set or card number
- Live camera
- Uploaded photo
- Batch scan
- Top Trending
- Card browser
- Recent scans
- Watched cards
- Collection cards
- Retry and restored sessions

Every door ends at `normalizeCardRecord` and `isExactScanTarget`. If the exact
printing or finish is unknown, the app asks for a choice. It does not guess.

## Every relevant screen

Search choices, scanner confirmation, price-only result, Trending, Recent,
Watched, browser viewer, loading, full result, Latest Signal, Collection,
add-to-Collection, and PDF all read the same record. Compact screens may show
fewer lines, but they keep the full record when opened.

## Price rule

Only a price tied to that record may appear. Saved Collection, Recent, and
Watched cards refresh from the exact record after 24 hours. Missing exact
prices say so plainly. Broad card-level prices never fill an exact-print gap.

Pokémon and Yu-Gi-Oh! saved cards ask TCGplayer for the exact product before
using their catalogue fallback. Magic asks Scryfall for the exact card and
finish. A price miss from an older lookup version is checked again once after
the exact route changes.

For Yu-Gi-Oh!, a known TCGplayer product ID is the canonical printing ID because
one printed set code can cover several real rarities and artworks. Old
card-id/set-code records migrate to that product ID. Two old ID shapes for the
same product collapse into one saved row without inventing another copy.

## Price history

The 30-day and 90-day change, the sparkline, and the copies-sold count come
only from TCGplayer's price history for the exact product SKU: English, Near
Mint, in the chosen finish. A card without a TCGplayer product id shows no
history. Nothing here is estimated by a model. Alignment (`signal_vs_market`)
is computed from the score and the real 30-day move, never guessed.

## Completion gate

The route-contract test must cover every input and screen above. The full test
suite, production build, GitHub CI, clean Android build, and real-phone checks
must pass before this contract is called complete.
