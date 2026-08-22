export async function fetchWithTimeout(input, init = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const parent = init.signal;
  const abortFromParent = () => controller.abort(parent?.reason);
  if (parent?.aborted) abortFromParent();
  else parent?.addEventListener?.('abort', abortFromParent, { once: true });
  const timer = setTimeout(() => controller.abort(new DOMException('Request timed out.', 'TimeoutError')), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
    parent?.removeEventListener?.('abort', abortFromParent);
  }
}
