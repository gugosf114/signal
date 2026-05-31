// PDF export of a scan result. Captures a DOM element by id, renders it to
// canvas via html2canvas (under the hood of html2pdf.js), and triggers a
// browser-level download.
//
// Future: paywall + emailed PDF (server-rendered) would go here too. For
// now this is a client-side capture so it works fully offline once the
// scan result is on screen.

import html2pdf from 'html2pdf.js';

function baseOpts(el, filename) {
  return {
    margin:      [10, 10, 10, 10],
    filename,
    image:       { type: 'jpeg', quality: 0.95 },
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

export async function exportReportToPdf({
  elementId = 'signal-report-capture',
  filename,
} = {}) {
  const el = document.getElementById(elementId);
  if (!el) throw new Error(`Report capture element #${elementId} not found.`);
  await html2pdf().set(baseOpts(el, safe(filename))).from(el).save();
}

// Share-as-PDF: generates a PDF Blob and hands it to the native share sheet
// (Web Share API on Android/Chromium WebView). The user picks Gmail, Outlook,
// Messages, etc., and the PDF lands as an attachment / sendable file.
// Falls back to download if sharing files isn't supported.
export async function shareReportAsPdf({
  elementId = 'signal-report-capture',
  filename,
  title = 'Signal scan report',
  text  = 'Trading card scan from Signal',
} = {}) {
  const el = document.getElementById(elementId);
  if (!el) throw new Error(`Report capture element #${elementId} not found.`);

  const filenameSafe = safe(filename);
  const pdfBlob = await html2pdf()
    .set(baseOpts(el, filenameSafe))
    .from(el)
    .outputPdf('blob');

  const file = new File([pdfBlob], filenameSafe, { type: 'application/pdf' });

  // navigator.canShare may not exist on older Chromium — guard everywhere.
  if (
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [file] })
  ) {
    await navigator.share({ files: [file], title, text });
    return { method: 'share' };
  }

  // Fallback: trigger a download — same end result, user can attach manually.
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
