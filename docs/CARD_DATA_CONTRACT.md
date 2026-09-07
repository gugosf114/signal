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

## Removed field

Signal does not claim a fixed 30-day price field. Direction comes from the
verified Signal sources and scorecard.

## Completion gate

The route-contract test must cover every input and screen above. The full test
suite, production build, GitHub CI, clean Android build, and real-phone checks
must pass before this contract is called complete.
