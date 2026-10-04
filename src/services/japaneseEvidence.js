// Language and printing checks shared by discovery and final citation locking.
export function normalizedEvidenceText(value) {
  return String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').normalize('NFKC').toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ').replace(/\s+/g, ' ').trim();
}
export function isJapaneseSource(source) {
  const language = String(source?.language || source?.defaultAudioLanguage || '').toLowerCase();
  if (language) return /^ja(?:-|$)/.test(language);
  return /[\u3040-\u30ff]/u.test([source?.title, source?.description, source?.summary].filter(Boolean).join(' '));
}
function escaped(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
export function nameInText(text, name) {
  const haystack = normalizedEvidenceText(text), needle = normalizedEvidenceText(name);
  if (!needle) return false;
  if (!/[\u3040-\u30ff\u3400-\u9fff]/u.test(needle)) return ` ${haystack} `.includes(` ${needle} `);
  for (const match of haystack.matchAll(new RegExp(escaped(needle), 'gu'))) {
    const before = haystack.slice(0, match.index), after = haystack.slice(match.index + needle.length);
    if (/[\p{Script=Katakana}]$/u.test(before) || /^[\p{Script=Katakana}]/u.test(after)) continue;
    if (/(?:アローラ|ガラル|ヒスイ|パルデア|ロケット団の|メガ)\s*$/u.test(before)) continue;
    if (/^\s*(?:ex|gx|vmax|vstar|v)(?:\s|$)/i.test(after)) continue;
    return true;
  }
  return false;
}
export function matchesJapanesePrinting(source, cardName, pin) {
  if (!pin || !isJapaneseSource(source)) return false;
  const text = [source?.title, source?.description, source?.summary].filter(Boolean).join(' ');
  const jp = pin.japaneseIdentity || {};
  const names = [...(jp.aliases || []), cardName, pin.name].filter(Boolean);
  if (!names.some(name => nameInText(text, String(name).split('//')[0].trim()))) return false;
  const normalized = normalizedEvidenceText(text);
  const ids = [pin.game === 'yugioh' ? pin.number : null, pin.sourceCode && pin.number ? `${pin.sourceCode}-${pin.number}` : null,
    pin.printedTotal && pin.number ? `${pin.number}/${pin.printedTotal}` : null, ...(jp.printingCodes || [])].filter(Boolean);
  if (ids.some(id => new RegExp(`(?:^|[^a-z0-9])${escaped(normalizedEvidenceText(id))}(?:$|[^a-z0-9])`, 'u').test(normalized))) return true;
  const sets = [pin.setName, ...(jp.setNames || [])].filter(Boolean);
  const numbers = [pin.number, ...(jp.numbers || [])].filter(Boolean).map(n => String(n).replace(/^0+/, '') || '0');
  const number = numbers.some(n => new RegExp(`(?:#|no\\.?\\s*|番号\\s*)0*${escaped(n)}(?!\\d)`, 'iu').test(text));
  const set = sets.some(name => normalized.includes(normalizedEvidenceText(name)));
  const code = pin.setId && new RegExp(`(?:^| )${escaped(String(pin.setId).toLowerCase())}(?: |$)`).test(normalized);
  return Boolean(number || (set || code) && numbers.some(n => new RegExp(`(?:^|[^0-9])0*${escaped(n)}(?:[^0-9]|$)`).test(text)));
}
