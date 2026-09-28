export async function prepareCardPhoto(file, { signal, timeoutMs = 5000 } = {}) {
  if (signal?.aborted) throw new DOMException('Image scan cancelled.', 'AbortError');
  // Keep decoding failures on the existing image-reader path, which has the
  // right JPEG/HEIC error message. Workers keep detection off the UI thread.
  if (!file || file.size > 25 * 1024 * 1024 || typeof Worker === 'undefined'
    || typeof OffscreenCanvas === 'undefined') return { file, cropped: false };
  return new Promise((resolve, reject) => {
    let worker;
    let timer;
    const finish = (result, error) => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      worker?.terminate();
      if (error) reject(error); else resolve(result);
    };
    const abort = () => finish(null, new DOMException('Image scan cancelled.', 'AbortError'));
    try {
      worker = new Worker(new URL('./cardPhoto.worker.js', import.meta.url), { type: 'module' });
      signal?.addEventListener('abort', abort, { once: true });
      timer = setTimeout(() => finish({ file, cropped: false }), timeoutMs);
      worker.onerror = () => finish({ file, cropped: false });
      worker.onmessage = ({ data }) => finish(data.cropped && data.blob
        ? { ...data, file: new File([data.blob], 'signal-card-crop.jpg', { type: 'image/jpeg' }) }
        : { file, cropped: false });
      worker.postMessage({ file });
    } catch { finish({ file, cropped: false }); }
  });
}
