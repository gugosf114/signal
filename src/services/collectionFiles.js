function csvCell(value) {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

export function collectionToCsv(cards) {
  const headers = [
    'Name', 'Game', 'Set', 'Number', 'Form', 'Condition', 'Quantity',
    'Market Price', 'Paid Per Card', 'Added At', 'Catalog ID', 'Printing ID', 'Image URL',
  ];
  const rows = (Array.isArray(cards) ? cards : []).map((card) => [
    card.name, card.game, card.setName, card.number, card.form, card.condition,
    card.qty, card.marketPrice, card.paidPerCard, card.addedAt,
    card.id, card.printingId, card.imageLarge || card.imageUrl,
  ]);
  return [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
}

export function collectionBackupText(cards, exportedAt = new Date().toISOString()) {
  return JSON.stringify({
    kind: 'signal-collection-backup',
    version: 1,
    exportedAt,
    cards: Array.isArray(cards) ? cards : [],
  }, null, 2);
}

export function parseCollectionBackup(text) {
  const parsed = JSON.parse(String(text || ''));
  const cards = Array.isArray(parsed) ? parsed : parsed?.cards;
  if (!Array.isArray(cards)) throw new Error('This is not a Signal collection backup.');
  return cards.filter((card) => card && typeof card === 'object' && String(card.name || '').trim());
}

function isCapacitor() {
  return typeof window !== 'undefined'
    && !!window.Capacitor
    && typeof window.Capacitor.isNativePlatform === 'function'
    && window.Capacitor.isNativePlatform();
}

function textToBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

async function saveTextFile(text, filename, mime) {
  if (isCapacitor()) {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    const saved = await Filesystem.writeFile({
      path: filename,
      data: textToBase64(text),
      directory: Directory.Documents,
      recursive: true,
    });
    return { method: 'native', filename, path: saved.uri };
  }

  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  return { method: 'web', filename };
}

function dateStamp(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

export function saveCollectionBackup(cards, now = new Date()) {
  return saveTextFile(
    collectionBackupText(cards, now.toISOString()),
    `signal-collection-backup-${dateStamp(now)}.json`,
    'application/json'
  );
}

export function saveCollectionCsv(cards, now = new Date()) {
  return saveTextFile(
    collectionToCsv(cards),
    `signal-collection-${dateStamp(now)}.csv`,
    'text/csv'
  );
}
