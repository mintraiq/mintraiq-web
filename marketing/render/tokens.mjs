/**
 * Design tokens for the deterministic frame renderer.
 *
 * Copied from finance-ai-mobile/constants/mintrTheme.ts (darkPalette, `radius`),
 * commit 978b1af on 27 Oct 2026. NOT from the stale marketing-reel brand.md /
 * frame.css, which still carry the retired emerald-on-slate palette.
 *
 * Bump TOKENS_VERSION whenever any value below changes: the version is recorded
 * in the render manifest so a re-render with different tokens is detectable.
 */

export const TOKENS_VERSION = 'tokens-1';

export const TOKENS = Object.freeze({
  canvas: '#060F20', // brandNavy
  textPrimary: '#FFFFFF',
  textSecondary: '#94A3B8',
  accentGreen: '#43D67A', // leafGreen
  accentBlue: '#2098EE', // aiBlue
  accentYellow: '#F1C40F',
  // withAlpha(leafGreen, 0.20) and withAlpha(aiBlue, 0.22): the ambient mesh
  ambientGreen: 'rgba(67, 214, 122, 0.2)',
  ambientBlue: 'rgba(32, 152, 238, 0.22)',
  radiusFull: '999px',
});
