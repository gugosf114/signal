import { marketPriceFor } from './collection.js';
import { scannerMatchDetails } from './scannerMatch.js';

// A failed or ambiguous photo is still part of the batch. Only an exact
// printing gets a price; the user can resolve the others in the results.
export async function readScannerBatch(files, { prepare, identify, signal, onEntry, onProgress }) {
  const entries = [];
  for (let index = 0; index < files.length; index += 1) {
    signal?.throwIfAborted();
    onProgress?.({ current: index + 1, total: files.length });
    let file = files[index];
    let match = null;
    let error = null;
    try {
      const prepared = await prepare(file, { signal });
      file = prepared.file;
      signal?.throwIfAborted();
      match = await identify(file, { framed: prepared.cropped, signal });
    } catch (failure) {
      if (signal?.aborted || failure?.name === 'AbortError') throw failure;
      error = failure?.message || 'Card could not be read. Try this photo again.';
    }
    signal?.throwIfAborted();
    const entry = {
      match: { ...match, file },
      quantity: 1,
      condition: 'near_mint',
      form: match?.pin?.form || 'normal',
      error,
    };
    entries.push(entry);
    onEntry?.(entry, index);
  }
  return entries;
}

export function scannerBatchDetails(entry) {
  const pin = entry.match?.pin;
  return scannerMatchDetails({
    ...entry.match,
    pin: pin ? { ...pin, form: entry.form, price: marketPriceFor(pin, entry.form) } : null,
  });
}
