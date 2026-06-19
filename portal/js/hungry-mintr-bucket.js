import { dataLevelForBucket, hungryMintrMessage } from './data-level-progress.js';

/**
 * @param {'hero' | 'compact' | 'inline'} [variant]
 */
export function hungryMintrBucketHtml(fillPercent, variant = 'hero', txnMonths = 0) {
    const pct = Math.min(100, Math.max(0, Math.round(fillPercent)));
    const msg = hungryMintrMessage(txnMonths);
    const hungry = pct < 100;
    return (
        `<div class="hungry-mintr hungry-mintr--${variant}${hungry ? ' hungry-mintr--thirsty' : ' hungry-mintr--full'}" data-testid="hungry-mintr-bucket" data-fill="${pct}">` +
        `<div class="hungry-mintr__mascot" aria-hidden="true">` +
        `<span class="hungry-mintr__mark"><i class="fas fa-brain"></i></span>` +
        `</div>` +
        `<div class="hungry-mintr__bucket" aria-hidden="true">` +
        `<svg class="hungry-mintr__bucket-svg" viewBox="0 0 120 140" role="presentation">` +
        `<defs>` +
        `<clipPath id="hungryMintrWaterClip"><rect class="hungry-mintr__water-rect" x="0" y="0" width="120" height="140"/></clipPath>` +
        `</defs>` +
        `<path class="hungry-mintr__bucket-body" d="M18 42 L30 128 Q60 138 90 128 L102 42 Z" fill="rgba(255,255,255,0.04)" stroke="rgba(0,255,157,0.35)" stroke-width="2"/>` +
        `<g clip-path="url(#hungryMintrWaterClip)">` +
        `<rect class="hungry-mintr__water-fill" x="0" y="0" width="120" height="140" fill="url(#hungryMintrWaterGrad)"/>` +
        `<path class="hungry-mintr__wave" d="M0 80 Q30 70 60 80 T120 80 L120 140 L0 140 Z" fill="rgba(0,255,157,0.25)"/>` +
        `</g>` +
        `<defs>` +
        `<linearGradient id="hungryMintrWaterGrad" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0%" stop-color="#00ff9d" stop-opacity="0.95"/>` +
        `<stop offset="100%" stop-color="#2f80ed" stop-opacity="0.75"/>` +
        `</linearGradient>` +
        `</defs>` +
        `</svg>` +
        `<span class="hungry-mintr__pct-label">${pct}%</span>` +
        `</div>` +
        `<div class="hungry-mintr__copy">` +
        `<p class="hungry-mintr__title">${hungry ? 'Hungry Mintr' : 'Hybrid unlocked'}</p>` +
        `<p class="hungry-mintr__message" data-testid="hungry-mintr-message">${msg}</p>` +
        `</div>` +
        `</div>`
    );
}

/**
 * @param {HTMLElement} root
 * @param {number} fillPercent
 */
export function applyHungryMintrFill(root, fillPercent) {
    const pct = Math.min(100, Math.max(0, fillPercent));
    const waterRect = root.querySelector('.hungry-mintr__water-rect');
    const waterFill = root.querySelector('.hungry-mintr__water-fill');
    const wave = root.querySelector('.hungry-mintr__wave');
    const pctLabel = root.querySelector('.hungry-mintr__pct-label');
    const msgEl = root.querySelector('.hungry-mintr__message');
    const bucketH = 140;
    const surfaceY = bucketH - (pct / 100) * bucketH;
    if (waterRect instanceof SVGRectElement) {
        waterRect.setAttribute('y', String(surfaceY));
        waterRect.setAttribute('height', String(bucketH - surfaceY));
    }
    if (waterFill instanceof SVGRectElement) {
        waterFill.setAttribute('y', String(surfaceY));
        waterFill.setAttribute('height', String(bucketH - surfaceY));
    }
    if (wave instanceof SVGPathElement) {
        wave.setAttribute('transform', `translate(0 ${surfaceY - 80})`);
    }
    if (pctLabel) pctLabel.textContent = `${Math.round(pct)}%`;
    const txnMonths = Number(root.dataset.txnMonths || 0);
    if (msgEl) msgEl.textContent = hungryMintrMessage(txnMonths);
    root.dataset.fill = String(Math.round(pct));
    root.classList.toggle('hungry-mintr--thirsty', pct < 100);
    root.classList.toggle('hungry-mintr--full', pct >= 100);
}

/**
 * @param {HTMLElement} container
 * @param {{ fillPercent?: number, variant?: 'hero' | 'compact' | 'inline', txnMonths?: number }} [opts]
 */
export function mountHungryMintrBucket(container, opts = {}) {
    const txnMonths = opts.txnMonths ?? 0;
    const level =
        opts.fillPercent != null
            ? { fillPercent: opts.fillPercent, txnMonths }
            : dataLevelForBucket(txnMonths);
    const variant = opts.variant ?? 'hero';
    container.innerHTML = hungryMintrBucketHtml(level.fillPercent, variant, level.txnMonths);
    const root = container.querySelector('.hungry-mintr');
    if (root instanceof HTMLElement) {
        root.dataset.txnMonths = String(level.txnMonths);
        applyHungryMintrFill(root, level.fillPercent);
    }
    return root;
}

/**
 * @param {HTMLElement} root
 * @param {number} fromPct
 * @param {number} toPct
 * @param {number} [durationMs]
 */
export function animateHungryMintrFill(root, fromPct, toPct, durationMs = 1400) {
    const start = performance.now();
    const from = Math.min(100, Math.max(0, fromPct));
    const to = Math.min(100, Math.max(0, toPct));

    return new Promise((resolve) => {
        function frame(now) {
            const t = Math.min(1, (now - start) / durationMs);
            const eased = 1 - Math.pow(1 - t, 3);
            const current = from + (to - from) * eased;
            applyHungryMintrFill(root, current);
            if (t < 1) {
                requestAnimationFrame(frame);
            } else {
                if (to > from) root.classList.add('hungry-mintr--splash');
                window.setTimeout(() => root.classList.remove('hungry-mintr--splash'), 700);
                resolve(undefined);
            }
        }
        requestAnimationFrame(frame);
    });
}
