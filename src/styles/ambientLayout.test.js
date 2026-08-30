import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('./animations.css', import.meta.url), 'utf8');

test('ambient art cannot widen the page horizontally', () => {
  const dashboard = css.match(/\.signal-dashboard\s*\{([^}]*)\}/)?.[1] || '';
  const ambient = css.match(/\.signal-ambient\s*\{([^}]*)\}/)?.[1] || '';
  assert.match(dashboard, /overflow-x:\s*clip/);
  assert.match(dashboard, /overscroll-behavior-x:\s*none/);
  assert.match(ambient, /left:\s*0;/);
  assert.match(ambient, /right:\s*0;/);
});
