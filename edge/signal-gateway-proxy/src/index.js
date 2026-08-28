export const UPSTREAM_URL = 'https://signal-gateway-v1-qfv7mm5hva-uc.a.run.app';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, X-Signal-Install-Id',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export async function handleRequest(request, fetcher = fetch) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (request.method !== 'POST') {
    return Response.json({ error: 'POST required.' }, { status: 405, headers: CORS });
  }

  const headers = new Headers();
  headers.set('Content-Type', request.headers.get('Content-Type') || 'application/json');
  const installId = request.headers.get('X-Signal-Install-Id');
  if (installId) headers.set('X-Signal-Install-Id', installId);

  const upstream = await fetcher(UPSTREAM_URL, {
    method: 'POST',
    headers,
    body: request.body,
    redirect: 'manual',
  });
  const responseHeaders = new Headers(upstream.headers);
  for (const [name, value] of Object.entries(CORS)) responseHeaders.set(name, value);
  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}

export default {
  fetch(request) {
    return handleRequest(request);
  },
};
