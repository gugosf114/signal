export function reportMarketPrice(value) {
  if (value == null || value === '') return null;
  const text = String(value).trim().replace(/^USD\s*/i, '').replace(/[$,\s]/g, '');
  if (!/^\d+(?:\.\d+)?$/.test(text)) return null;
  const amount = Number(text);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

export function reportHistoryMoves(data) {
  const history = data?.history;
  if (!history) return [];
  return [['30-day move', history.change30], ['90-day move', history.change90]]
    .filter(([, value]) => typeof value === 'number' && Number.isFinite(value))
    .map(([label, value]) => ({ label, value }));
}
