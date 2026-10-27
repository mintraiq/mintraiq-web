/**
 * Frame template v1: a pure function from (frame, chip, versions) to HTML.
 *
 * No clock, no randomness, no network, no external assets: fonts are the
 * system stack, the mark is text. The only words ever drawn are the frame's
 * own headline and body (already checked by the claims gate), the brand name
 * and, when `illustrative_chip` is true, the chip. Nothing here may add copy.
 *
 * Bump TEMPLATE_VERSION when the markup or CSS changes.
 */

import { TOKENS, TOKENS_VERSION } from './tokens.mjs';

export const TEMPLATE_VERSION = 'template-1';

export const PRESETS = Object.freeze({
  square: { width: 1080, height: 1080 },
  feed: { width: 1080, height: 1350 },
});
export const DEFAULT_PRESET = 'square';

export const BRAND_TEXT = 'MintrAIQ';
export const CHIP_TEXT = 'Illustrative example';

/** Schema maxima for a social frame (marketing_draft). Outer bound only. */
export const MAX_HEADLINE_CHARS = 80;
export const MAX_BODY_CHARS = 240;

// Type size steps by length so the maxima fit the safe area without a
// measure-and-shrink loop. The HTML stays a pure function of its inputs; the
// renderer asserts no overflow after layout and fails loudly if one occurs.
const HEADLINE_SIZES = [[20, 128], [40, 100], [60, 80], [Infinity, 52]];
const BODY_SIZES = [[60, 44], [120, 38], [Infinity, 32]];

function sizeFor(steps, length) {
  return steps.find(([max]) => length <= max)[1];
}

export function escapeHtml(text) {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function renderFrameHtml({ frame, illustrativeChip, preset = DEFAULT_PRESET }) {
  const size = PRESETS[preset];
  if (!size) throw new Error(`unknown preset "${preset}"`);
  const t = TOKENS;
  const headlineSize = sizeFor(HEADLINE_SIZES, frame.headline.length);
  const bodySize = sizeFor(BODY_SIZES, frame.body.length);
  const chip = illustrativeChip
    ? `<div class="chip" data-testid="illustrative-chip">${escapeHtml(CHIP_TEXT)}</div>`
    : '';
  const body = frame.body
    ? `<p class="body" data-testid="body" style="font-size:${bodySize}px">${escapeHtml(frame.body)}</p>`
    : '';

  return `<!doctype html>
<html lang="en" data-template-version="${TEMPLATE_VERSION}" data-tokens-version="${TOKENS_VERSION}">
<head>
<meta charset="utf-8">
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: ${size.width}px; height: ${size.height}px; }
body {
  background: ${t.canvas}; color: ${t.textPrimary}; overflow: hidden; position: relative;
  font-family: system-ui, -apple-system, "SF Pro Text", "Helvetica Neue", Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
}
body::before {
  content: ""; position: absolute; inset: 0;
  background:
    radial-gradient(700px 700px at 12% 8%, ${t.ambientGreen}, transparent 70%),
    radial-gradient(700px 700px at 92% 92%, ${t.ambientBlue}, transparent 70%);
}
.frame {
  position: relative; width: ${size.width}px; height: ${size.height}px;
  padding: 88px 88px 80px; display: flex; flex-direction: column;
}
.top { height: 56px; flex: none; display: flex; align-items: center; justify-content: space-between; }
.chip {
  padding: 10px 22px; border-radius: ${t.radiusFull};
  background: rgba(255,255,255,0.10); border: 2px solid rgba(255,255,255,0.28);
  font-size: 26px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase;
}
.main { flex: 1; min-height: 0; display: flex; flex-direction: column; justify-content: center; gap: 32px; }
.headline {
  font-size: ${headlineSize}px; font-weight: 800; letter-spacing: -.02em; line-height: 1.06;
  overflow-wrap: anywhere;
}
.body { font-weight: 500; line-height: 1.3; color: ${t.textSecondary}; overflow-wrap: anywhere; }
.brand { flex: none; font-size: 34px; font-weight: 800; letter-spacing: -.01em; color: ${t.accentGreen}; }
</style>
</head>
<body>
<div class="frame" data-testid="frame">
  <div class="top">${chip}</div>
  <div class="main">
    <h1 class="headline" data-testid="headline">${escapeHtml(frame.headline)}</h1>
    ${body}
  </div>
  <div class="brand" data-testid="brand">${BRAND_TEXT}</div>
</div>
</body>
</html>
`;
}
