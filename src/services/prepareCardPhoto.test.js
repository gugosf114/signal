import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prepareCardPhoto } from './prepareCardPhoto.js';

async function withWorker(run, callback) {
  const originals = { Worker: globalThis.Worker, OffscreenCanvas: globalThis.OffscreenCanvas };
  let stopped = false;
  globalThis.OffscreenCanvas = class {};
  globalThis.Worker = class {
    postMessage(message) { queueMicrotask(() => run(this, message)); }
    terminate() { stopped = true; }
  };
  try { await callback(() => stopped); }
  finally {
    for (const [key, value] of Object.entries(originals)) {
      if (value === undefined) delete globalThis[key]; else globalThis[key] = value;
    }
  }
}

test('uses a detected crop as the actual file sent to the reader', async () => {
  const input = new File(['whole photo'], 'photo.jpg', { type: 'image/jpeg' });
  await withWorker(worker => worker.onmessage({ data: { cropped: true, blob: new Blob(['only the card']), width: 700, height: 980 } }), async stopped => {
    const result = await prepareCardPhoto(input);
    assert.equal(result.cropped, true);
    assert.equal(await result.file.text(), 'only the card');
    assert.equal(result.file.type, 'image/jpeg');
    assert.equal(result.width, 700);
    assert.equal(stopped(), true);
  });
});

test('uncertain edges and worker failure preserve the exact original file', async () => {
  const input = new File(['whole photo'], 'photo.jpg');
  for (const run of [worker => worker.onmessage({ data: { cropped: false } }), worker => worker.onerror(new Error('decoder'))]) {
    await withWorker(run, async stopped => {
      const result = await prepareCardPhoto(input);
      assert.equal(result.file, input);
      assert.equal(result.cropped, false);
      assert.equal(stopped(), true);
    });
  }
});

test('slow crop falls back without keeping a worker alive', async () => {
  const input = new File(['photo'], 'photo.jpg');
  await withWorker(() => {}, async stopped => {
    const result = await prepareCardPhoto(input, { timeoutMs: 5 });
    assert.equal(result.file, input);
    assert.equal(result.cropped, false);
    assert.equal(stopped(), true);
  });
});

test('cancel stops processing and does not fall through to a paid read', async () => {
  const controller = new AbortController();
  await withWorker(() => controller.abort(), async stopped => {
    await assert.rejects(prepareCardPhoto(new File(['photo'], 'photo.jpg'), { signal: controller.signal }), { name: 'AbortError' });
    assert.equal(stopped(), true);
  });
  await assert.rejects(prepareCardPhoto(null, { signal: controller.signal }), { name: 'AbortError' });
});

test('older browsers can still send the original photo', async () => {
  const input = new File(['photo'], 'photo.jpg');
  const result = await prepareCardPhoto(input);
  assert.equal(result.file, input);
  assert.equal(result.cropped, false);
});
