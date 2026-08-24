function isCapacitor() {
  return typeof window !== 'undefined'
    && !!window.Capacitor
    && typeof window.Capacitor.isNativePlatform === 'function'
    && window.Capacitor.isNativePlatform();
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = String(reader.result || '');
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error || new Error('Sample PDF could not be read.'));
    reader.readAsDataURL(blob);
  });
}

export async function downloadSampleDossier({ url, filename }) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Sample PDF could not be loaded (${response.status}).`);
  const blob = await response.blob();

  if (isCapacitor()) {
    const data = await blobToBase64(blob);
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    const saved = await Filesystem.writeFile({
      path: filename,
      data,
      directory: Directory.Documents,
      recursive: true,
    });
    return { method: 'native', filename, path: saved.uri };
  }

  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
  return { method: 'web', filename };
}
