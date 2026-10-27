#!/usr/bin/env node
/**
 * Render the frames of a marketing_draft (kind social) to PNG.
 *
 *   node marketing/render/render-frames.mjs <draft.json> <outdir> [--preset square|feed]
 *
 * Writes <outdir>/frame-<n>-<role>.png (n from 1) and prints a JSON manifest
 * to stdout. Any failure exits non-zero with the reason on stderr; nothing is
 * written to stdout on failure, so a caller never mistakes a partial render
 * for a manifest.
 *
 * The HTML is a pure function of (frame, illustrative_chip, template_version,
 * tokens_version). The PNG is derived, never hashed: the approval hash stays
 * over the draft JSON. Text overflow is a render error, not a silent clip.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

import { TOKENS_VERSION } from './tokens.mjs';
import {
  DEFAULT_PRESET, MAX_BODY_CHARS, MAX_HEADLINE_CHARS, PRESETS, TEMPLATE_VERSION, renderFrameHtml,
} from './template.mjs';

export { TEMPLATE_VERSION, TOKENS_VERSION, renderFrameHtml };

export const FRAME_ROLES = Object.freeze(['hook', 'ache', 'reveal', 'proof', 'close']);

export class RenderError extends Error {}

export function validateDraft(draft) {
  const fail = (msg) => { throw new RenderError(`invalid draft: ${msg}`); };
  if (draft === null || typeof draft !== 'object' || Array.isArray(draft)) fail('not an object');
  if (draft.kind !== undefined && draft.kind !== 'social') fail(`kind must be "social", got ${JSON.stringify(draft.kind)}`);
  if (!Array.isArray(draft.frames) || draft.frames.length === 0) fail('frames must be a non-empty array');
  if (typeof draft.illustrative_chip !== 'boolean') fail('illustrative_chip must be a boolean');
  draft.frames.forEach((frame, i) => {
    const at = `frames[${i}]`;
    if (frame === null || typeof frame !== 'object') fail(`${at} is not an object`);
    if (!FRAME_ROLES.includes(frame.role)) fail(`${at}.role must be one of ${FRAME_ROLES.join('|')}`);
    if (typeof frame.headline !== 'string' || frame.headline.trim() === '') fail(`${at}.headline must be a non-empty string`);
    if (frame.headline.length > MAX_HEADLINE_CHARS) fail(`${at}.headline exceeds ${MAX_HEADLINE_CHARS} chars`);
    if (typeof frame.body !== 'string') fail(`${at}.body must be a string (may be empty)`);
    if (frame.body.length > MAX_BODY_CHARS) fail(`${at}.body exceeds ${MAX_BODY_CHARS} chars`);
  });
}

/** True when text spills outside the content area on either axis. */
export async function overflows(page) {
  return page.evaluate(() => {
    const main = document.querySelector('.main');
    const frame = document.querySelector('.frame');
    return main.scrollHeight > main.clientHeight
      || document.body.scrollWidth > frame.clientWidth
      || document.body.scrollHeight > frame.clientHeight;
  });
}

export async function renderDraft(draft, outdir, { preset = DEFAULT_PRESET } = {}) {
  validateDraft(draft);
  const size = PRESETS[preset];
  if (!size) throw new RenderError(`unknown preset "${preset}" (have: ${Object.keys(PRESETS).join(', ')})`);
  mkdirSync(outdir, { recursive: true });

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: size, deviceScaleFactor: 1 });
    const frames = [];
    for (const [i, frame] of draft.frames.entries()) {
      const html = renderFrameHtml({ frame, illustrativeChip: draft.illustrative_chip, preset });
      await page.setContent(html, { waitUntil: 'load' });
      if (await overflows(page)) throw new RenderError(`frames[${i}] (${frame.role}): text overflows the ${preset} frame`);
      const file = `frame-${i + 1}-${frame.role}.png`;
      writeFileSync(join(outdir, file), await page.screenshot({ type: 'png', clip: { x: 0, y: 0, ...size } }));
      frames.push({ file, role: frame.role, width: size.width, height: size.height });
    }
    return { template_version: TEMPLATE_VERSION, tokens_version: TOKENS_VERSION, preset, frames };
  } finally {
    await browser.close();
  }
}

async function main(argv) {
  const args = argv.slice();
  let preset = DEFAULT_PRESET;
  const presetAt = args.indexOf('--preset');
  if (presetAt !== -1) preset = args.splice(presetAt, 2)[1];
  const [draftPath, outdir, ...extra] = args;
  if (!draftPath || !outdir || extra.length) {
    throw new RenderError('usage: render-frames.mjs <draft.json> <outdir> [--preset square|feed]');
  }
  let draft;
  try {
    draft = JSON.parse(readFileSync(draftPath, 'utf8'));
  } catch (err) {
    throw new RenderError(`cannot read draft ${draftPath}: ${err.message}`);
  }
  const manifest = await renderDraft(draft, resolve(outdir), { preset });
  process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch((err) => {
    process.stderr.write(`render-frames: ${err.message}\n`);
    process.exit(err instanceof RenderError ? 2 : 1);
  });
}
