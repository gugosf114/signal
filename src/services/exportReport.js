// PDF export of a scan result. Captures a DOM element by id, renders it to
// canvas via html2canvas (under the hood of html2pdf.js), and either:
//   - Native (Capacitor / Android WebView): writes the PDF blob to the
//     Documents directory via @capacitor/filesystem. A direct <a download>
//     does nothing in WebView, so the old path silently failed.
//   - Web (regular browser): triggers a normal browser download.
//
// shareReportAsPdf still routes through navigator.share — that path works in
// the WebView fine because it hands the PDF off to the system share sheet.

async function loadHtml2Pdf() {
  const module = await import('html2pdf.js');
  return module.default;
}

function isCapacitor() {
  return typeof window !== 'undefined'
    && !!window.Capacitor
    && typeof window.Capacitor.isNativePlatform === 'function'
    && window.Capacitor.isNativePlatform();
}

function baseOpts(el, filename) {
  return {
    margin:      [10, 10, 10, 10],
    filename,
    image:       { type: 'jpeg', quality: 0.95 },
    enableLinks: true,
    html2canvas: {
      scale: 2,
      backgroundColor: '#08090A',
      useCORS: true,
      allowTaint: true,
      windowWidth: el.scrollWidth,
    },
    jsPDF:       { unit: 'mm', format: 'a4', orientation: 'portrait', compress: true },
    pagebreak:   { mode: ['css', 'legacy'] },
  };
}

function safe(filename) {
  return (filename || `signal-report-${Date.now()}.pdf`).replace(/[^a-zA-Z0-9._-]+/g, '_');
}

async function generatePdfBlob(el, filename) {
  const html2pdf = await loadHtml2Pdf();
  return html2pdf().set(baseOpts(el, filename)).from(el).outputPdf('blob');
}

async function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result || '';
      const idx = result.indexOf(',');
      resolve(idx >= 0 ? result.slice(idx + 1) : result);
    };
    reader.onerror = () => reject(reader.error || new Error('FileReader failed'));
    reader.readAsDataURL(blob);
  });
}

export async function imageUrlToDataUrl(url) {
  if (!url) return null;
  if (String(url).startsWith('data:')) return url;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Card image fetch failed (${response.status}).`);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Card image conversion failed.'));
    reader.readAsDataURL(blob);
  });
}

export async function exportReportToPdf({
  elementId = 'signal-report-capture',
  filename,
} = {}) {
  const el = document.getElementById(elementId);
  if (!el) throw new Error(`Report capture element #${elementId} not found.`);
  const filenameSafe = safe(filename);

  if (isCapacitor()) {
    // Write to the native filesystem so the user can actually find the PDF.
    // Documents directory maps to /storage/emulated/0/Documents on most
    // Android devices, visible from the Files app under "Documents".
    const blob = await generatePdfBlob(el, filenameSafe);
    const data = await blobToBase64(blob);
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    const res = await Filesystem.writeFile({
      path: filenameSafe,
      data,
      directory: Directory.Documents,
      recursive: true,
    });
    return { method: 'native', path: res.uri, filename: filenameSafe };
  }

  // Web fallback: regular browser download via <a download>.
  const html2pdf = await loadHtml2Pdf();
  await html2pdf().set(baseOpts(el, filenameSafe)).from(el).save();
  return { method: 'web', filename: filenameSafe };
}

// Share-as-PDF: hands the PDF off to the native share sheet (Web Share API
// on Android WebView). User picks Gmail / Messages / Save to Files / etc.
// Falls back to download if sharing files isn't supported (desktop Firefox).
export async function shareReportAsPdf({
  elementId = 'signal-report-capture',
  filename,
  title = 'Signal scan report',
  text  = 'Trading card scan from Signal',
} = {}) {
  const el = document.getElementById(elementId);
  if (!el) throw new Error(`Report capture element #${elementId} not found.`);
  const filenameSafe = safe(filename);
  const pdfBlob = await generatePdfBlob(el, filenameSafe);

  if (isCapacitor()) {
    const data = await blobToBase64(pdfBlob);
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    const saved = await Filesystem.writeFile({
      path: filenameSafe,
      data,
      directory: Directory.Cache,
      recursive: true,
    });
    const { Share } = await import('@capacitor/share');
    await Share.share({
      files: [saved.uri],
      title,
      text,
      dialogTitle: 'Share Signal report',
    });
    return { method: 'native-share' };
  }

  const file = new File([pdfBlob], filenameSafe, { type: 'application/pdf' });

  if (
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [file] })
  ) {
    await navigator.share({ files: [file], title, text });
    return { method: 'share' };
  }

  // Last-ditch: trigger download. User attaches manually.
  const url = URL.createObjectURL(pdfBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filenameSafe;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return { method: 'download' };
}
