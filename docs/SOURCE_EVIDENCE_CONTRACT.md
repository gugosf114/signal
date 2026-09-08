# Source evidence contract

Every source shown by Signal must be a record the app actually retrieved.
The model is never a source database.

## Trust boundary

The model may return only:

- the exact URL it selected from supplied evidence;
- `up`, `down`, or `neutral` as its reading of that evidence.

The model may not supply the publisher, title, date, summary, audience, reach,
source type, listing title, listing price, seller, or bid count shown in the
app. Those fields come from the web-search result or the API response itself.

`normalizeAnalysis` strips model-owned source metadata. `extractSearchEvidence`
and `collectPrefetchEvidence` build the locked registry. `lockSourcesToEvidence`
joins a selected URL to that registry and reconstructs the visible source.

## No-evidence behavior

If a selected URL is absent from the registry, Signal rejects it. If an area
has no locked source, Signal:

- sets that area to level 0;
- gives it a neutral score contribution;
- replaces model prose with `No verified evidence was retrieved for this area.`;
- shows no source card.

The report summary is built in code from the exact price, exact price history,
and locked source counts. Model-written summary prose is discarded.

The score header reports sourced areas and unique sources. It never calls eight
filled schema slots `8/8 signals`.

## Cache boundary

Reports made before this contract use different local cache and active-session
keys. The shared gateway key uses pre-fetch version 3. An app update therefore
cannot reopen or download an older report whose source metadata came from the
model.

## Required regression proof

`src/services/citations.test.js` contains the real Shedinja failure shape. It
must prove that six unsupported areas lose their claims, the two supported
areas count as one unique source, and every model-invented source field is
replaced. The old path-prefix and YouTube-ID holes must remain closed.
