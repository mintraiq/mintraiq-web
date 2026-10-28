/**
 * Tests for the deterministic frame renderer (template-1 / tokens-1).
 * Run: npm run test:render-frames
 *
 * Assertions on the chip, brand and overflow read the rendered DOM in a real
 * browser (and the HTML string for determinism), so they cannot pass on an
 * empty output directory.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { chromium } from 'playwright';

import { FRAME_ROLES, overflows, TEMPLATE_VERSION, TOKENS_VERSION, renderDraft, renderFrameHtml, validateDraft } from './render-frames.mjs';
import { BRAND_TEXT, CHIP_TEXT, MAX_BODY_CHARS, MAX_HEADLINE_CHARS, PRESETS } from './template.mjs';

const CLI = join(import.meta.dirname, 'render-frames.mjs');
const tmp = () => mkdtempSync(join(tmpdir(), 'render-frames-'));
const draft = (over = {}) => ({
  kind: 'social',
  illustrative_chip: false,
  frames: [
    { role: 'hook', headline: 'Where did it go?', body: 'Find out in one place.' },
    { role: 'close', headline: 'Know your month', body: '' },
  ],
  ...over,
});
const maxFrame = { role: 'proof', headline: 'W'.repeat(MAX_HEADLINE_CHARS), body: 'W'.repeat(MAX_BODY_CHARS) };

function pngSize(path) {
  const b = readFileSync(path);
  assert.equal(b.subarray(1, 4).toString(), 'PNG');
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
}

async function withPage(html, fn) {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: PRESETS.square });
    await page.setContent(html);
    return await fn(page);
  } finally {
    await browser.close();
  }
}

test('writes one PNG per frame at the preset dimensions and a manifest', async () => {
  const out = tmp();
  const manifest = await renderDraft(draft(), out);
  assert.equal(manifest.frames.length, 2);
  assert.equal(manifest.template_version, TEMPLATE_VERSION);
  assert.equal(manifest.tokens_version, TOKENS_VERSION);
  assert.deepEqual(manifest.frames.map((f) => f.file), ['frame-1-hook.png', 'frame-2-close.png']);
  for (const f of manifest.frames) {
    assert.deepEqual(pngSize(join(out, f.file)), PRESETS.square);
    assert.deepEqual({ width: f.width, height: f.height }, PRESETS.square);
  }
});

test('feed preset renders 1080x1350', async () => {
  const out = tmp();
  const manifest = await renderDraft(draft(), out, { preset: 'feed' });
  assert.deepEqual(pngSize(join(out, manifest.frames[0].file)), PRESETS.feed);
});

test('chip is in the rendered DOM when illustrative_chip is true, absent when false', async () => {
  const frame = draft().frames[0];
  const on = await withPage(renderFrameHtml({ frame, illustrativeChip: true }), (p) =>
    p.locator('[data-testid=illustrative-chip]').allTextContents());
  assert.deepEqual(on, [CHIP_TEXT]);
  const off = await withPage(renderFrameHtml({ frame, illustrativeChip: false }), (p) =>
    p.locator('[data-testid=illustrative-chip]').count());
  assert.equal(off, 0);
  assert.ok(!renderFrameHtml({ frame, illustrativeChip: false }).includes(CHIP_TEXT));
});

test('brand text is exactly MintrAIQ and nothing else is drawn', async () => {
  assert.equal(BRAND_TEXT, 'MintrAIQ');
  const frame = { role: 'hook', headline: 'Hello', body: 'World' };
  const text = await withPage(renderFrameHtml({ frame, illustrativeChip: true }), async (p) => ({
    brand: await p.locator('[data-testid=brand]').textContent(),
    all: await p.locator('body').innerText(),
  }));
  assert.equal(text.brand, 'MintrAIQ');
  const words = text.all.split(/\s+/).filter(Boolean).join(' ').toLowerCase();
  // Only the frame's words, the chip and the brand: the template adds no copy of its own.
  assert.equal(words, `${CHIP_TEXT} hello world mintraiq`.toLowerCase());
  assert.doesNotMatch(renderFrameHtml({ frame, illustrativeChip: true }), /Mintr(?!AIQ)/);
});

for (const preset of Object.keys(PRESETS)) {
  test(`schema-maximum text does not overflow (${preset}); worst-case glyphs, with and without chip`, async () => {
    for (const illustrativeChip of [true, false]) {
      const html = renderFrameHtml({ frame: maxFrame, illustrativeChip, preset });
      const result = await withPage(html, (p) => p.evaluate(() => {
        const rect = (sel) => document.querySelector(sel).getBoundingClientRect();
        const main = rect('.main');
        const h = rect('[data-testid=headline]');
        const b = rect('[data-testid=body]');
        const brand = rect('[data-testid=brand]');
        return {
          mainFits: document.querySelector('.main').scrollHeight <= document.querySelector('.main').clientHeight,
          inside: h.top >= main.top && b.bottom <= main.bottom,
          clearOfBrand: b.bottom <= brand.top,
          noHScroll: document.body.scrollWidth <= document.querySelector('.frame').clientWidth,
          headlineLines: Math.round(h.height / parseFloat(getComputedStyle(document.querySelector('[data-testid=headline]')).lineHeight)),
        };
      }));
      assert.ok(result.mainFits && result.inside && result.clearOfBrand && result.noHScroll, JSON.stringify(result));
      assert.ok(result.headlineLines >= 2, 'max headline must actually wrap, or this test proves nothing');
    }
  });
}

test('overflow is detected: the render-time check flags a frame that cannot fit', async () => {
  const fits = renderFrameHtml({ frame: maxFrame, illustrativeChip: true });
  assert.equal(await withPage(fits, (p) => overflows(p)), false);
  // Same markup in a frame far too short for it: the check that makes renderDraft throw must fire.
  const cramped = fits.replaceAll('height: 1080px', 'height: 300px');
  assert.notEqual(cramped, fits, 'the cramped variant must actually differ');
  assert.equal(await withPage(cramped, (p) => overflows(p)), true);
});

test('determinism: identical HTML and identical decoded dimensions across two renders', async () => {
  const d = draft({ illustrative_chip: true });
  for (const frame of d.frames) {
    assert.equal(renderFrameHtml({ frame, illustrativeChip: true }), renderFrameHtml({ frame, illustrativeChip: true }));
  }
  const a = tmp(); const b = tmp();
  const [ma, mb] = [await renderDraft(d, a), await renderDraft(d, b)];
  assert.deepEqual(ma, mb);
  for (const f of ma.frames) assert.deepEqual(pngSize(join(a, f.file)), pngSize(join(b, f.file)));
});

test('headline text is escaped, not interpreted as markup', async () => {
  const frame = { role: 'hook', headline: '<img src=x onerror=alert(1)> & co', body: '' };
  const html = renderFrameHtml({ frame, illustrativeChip: false });
  assert.ok(!html.includes('<img'));
  const text = await withPage(html, (p) => p.locator('[data-testid=headline]').textContent());
  assert.equal(text, frame.headline);
});

test('validateDraft rejects bad input', () => {
  const bad = [
    null,
    draft({ frames: [] }),
    draft({ illustrative_chip: 'yes' }),
    draft({ kind: 'email' }),
    draft({ frames: [{ role: '../x', headline: 'a', body: '' }] }),
    draft({ frames: [{ role: 'hook', headline: '', body: '' }] }),
    draft({ frames: [{ role: 'hook', headline: 'a'.repeat(MAX_HEADLINE_CHARS + 1), body: '' }] }),
    draft({ frames: [{ role: 'hook', headline: 'a', body: 'b'.repeat(MAX_BODY_CHARS + 1) }] }),
    draft({ frames: [{ role: 'hook', headline: 'a' }] }),
  ];
  for (const d of bad) assert.throws(() => validateDraft(d), /invalid draft/);
  assert.ok(FRAME_ROLES.length > 0);
});

test('CLI: success prints the manifest as JSON on stdout and exits 0', () => {
  const dir = tmp();
  const draftPath = join(dir, 'draft.json');
  writeFileSync(draftPath, JSON.stringify(draft({ illustrative_chip: true })));
  const r = spawnSync('node', [CLI, draftPath, join(dir, 'out')], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const manifest = JSON.parse(r.stdout);
  assert.equal(manifest.frames.length, 2);
  assert.deepEqual(Object.keys(manifest.frames[0]), ['file', 'role', 'width', 'height']);
});

test('CLI: failing input exits non-zero, explains on stderr and prints no manifest', () => {
  const dir = tmp();
  const cases = {
    'missing file': [join(dir, 'nope.json'), join(dir, 'o1')],
    'not json': (() => { const p = join(dir, 'bad.json'); writeFileSync(p, '{'); return [p, join(dir, 'o2')]; })(),
    'invalid draft': (() => { const p = join(dir, 'inv.json'); writeFileSync(p, JSON.stringify(draft({ frames: [] }))); return [p, join(dir, 'o3')]; })(),
    'no args': [],
  };
  for (const [name, args] of Object.entries(cases)) {
    const r = spawnSync('node', [CLI, ...args], { encoding: 'utf8' });
    assert.notEqual(r.status, 0, name);
    assert.equal(r.stdout, '', name);
    assert.match(r.stderr, /render-frames:/, name);
  }
});
