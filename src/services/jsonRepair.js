// ─── Structured-output recovery ──────────────────────────────────────────────
// The model emits one large JSON object. When it runs out of output budget the
// tail is simply missing, and a naive JSON.parse throws away a response that is
// 95% usable. These helpers pull the object out of whatever wrapping the model
// produced (fences, prose) and, if it was cut off mid-write, trim back to the
// last complete member and re-balance the brackets.
//
// Callers mark a repaired result with `_truncated` so the UI can show the
// PARTIAL chip instead of pretending the scan was complete.
//
// Import-free by design so it runs under plain `node --test`.

export function tryParse(s) {
  try {
    const data = JSON.parse(s);
    if (data && (data.signals || data.card_name)) return data;
  } catch {}
  return null;
}

export function extractJsonObject(text) {
  const start = text.indexOf('{');
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (escape) { escape = false; continue; }
    if (c === '\\') { escape = true; continue; }
    if (c === '"' && !inString) { inString = true; continue; }
    if (c === '"' && inString) { inString = false; continue; }
    if (inString) continue;
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return text.substring(start, i + 1);
    }
  }
  // Unbalanced — return what we got, repair will handle
  return text.substring(start);
}

export function repairTruncatedJson(s) {
  let braceDepth = 0;
  let bracketDepth = 0;
  let inString = false;
  let escape = false;
  let lastSafe = -1;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (escape) { escape = false; continue; }
    if (c === '\\') { escape = true; continue; }
    if (c === '"' && !inString) { inString = true; continue; }
    if (c === '"' && inString) { inString = false; continue; }
    if (inString) continue;
    if (c === '{') braceDepth++;
    else if (c === '}') braceDepth--;
    else if (c === '[') bracketDepth++;
    else if (c === ']') bracketDepth--;
    // Mark a safe truncation point right after a complete member terminator
    if (!inString && (c === '}' || c === ']')) {
      lastSafe = i;
    }
  }

  if (braceDepth === 0 && bracketDepth === 0 && !inString) return s;

  // No safe truncation point ever found — bail rather than emit a guaranteed-
  // broken string. (`> 0` was wrong: it conflated "no safe point" with
  // "safe at index 0".)
  if (lastSafe < 0) return null;

  // Trim to last safe close, then re-balance
  let trimmed = s.substring(0, lastSafe + 1);
  trimmed = trimmed.replace(/,\s*$/, '');

  // Recount on the trimmed string
  let bd = 0, kd = 0, inS = false, esc = false;
  for (let i = 0; i < trimmed.length; i++) {
    const c = trimmed[i];
    if (esc) { esc = false; continue; }
    if (c === '\\') { esc = true; continue; }
    if (c === '"' && !inS) { inS = true; continue; }
    if (c === '"' && inS) { inS = false; continue; }
    if (inS) continue;
    if (c === '{') bd++;
    else if (c === '}') bd--;
    else if (c === '[') kd++;
    else if (c === ']') kd--;
  }
  while (kd > 0) { trimmed += ']'; kd--; }
  while (bd > 0) { trimmed += '}'; bd--; }
  return trimmed;
}

// Full recovery chain: strip fences → parse → extract the object → repair.
export function tryParseSignalJSON(text) {
  if (!text) return null;

  // Strip markdown code fences if present
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const cleaned = fenceMatch ? fenceMatch[1].trim() : text.trim();

  // Fast path
  const direct = tryParse(cleaned);
  if (direct) return direct;

  // Find the largest JSON object in the text, balanced or not
  const extracted = extractJsonObject(cleaned);
  if (!extracted) return null;

  const fromExtracted = tryParse(extracted);
  if (fromExtracted) return fromExtracted;

  // Repair attempt: balance braces, drop trailing partial member.
  // If repair succeeds, mark the result so the UI can surface "partial".
  const repaired = repairTruncatedJson(extracted);
  if (repaired && repaired !== extracted) {
    const fromRepaired = tryParse(repaired);
    if (fromRepaired) {
      // eslint-disable-next-line no-console
      console.warn(
        `[signal] truncated JSON repaired: ${extracted.length} → ${repaired.length} chars`
      );
      fromRepaired._truncated = true;
      return fromRepaired;
    }
  }

  return null;
}
