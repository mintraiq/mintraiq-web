/**
 * Mintr dollar-leaf mascot — tier brightness + animation hooks.
 */

export const MASCOT_IMG_SRC = './images/mintr-mascot-dollar-leaf.png';

const TIER_CLASS_PREFIX = 'plan-billing-mascot-frame--tier-';

/** Map API effective_tier_id or legacy tier string → compare/plan key. */
export function mascotTierKeyFromProfile(profile) {
    const effective = String(profile?.effective_tier_id || '').toUpperCase();
    if (effective === 'BASIC') return 'basic';
    if (effective === 'PRO') return 'premium';
    if (effective === 'PILOT_3MONTH') return 'pilot';
    const legacy = String(profile?.tier || 'free').toLowerCase();
    if (legacy === 'basic') return 'basic';
    if (['premium', 'pro', 'pro_trial', 'advanced', 'business'].includes(legacy)) return 'premium';
    return 'free';
}

export function applyMascotTier(frameEl, tierKey) {
    if (!frameEl) return;
    const key = tierKey || 'free';
    frameEl.classList.remove(
        `${TIER_CLASS_PREFIX}free`,
        `${TIER_CLASS_PREFIX}basic`,
        `${TIER_CLASS_PREFIX}premium`,
        `${TIER_CLASS_PREFIX}pilot`,
    );
    frameEl.classList.add(`${TIER_CLASS_PREFIX}${key}`);
}

export function pulseMascot(frameEl) {
    if (!frameEl) return;
    frameEl.classList.remove('plan-billing-mascot-frame--anim');
    void frameEl.offsetWidth;
    frameEl.classList.add('plan-billing-mascot-frame--anim');
    frameEl.addEventListener(
        'animationend',
        () => frameEl.classList.remove('plan-billing-mascot-frame--anim'),
        { once: true },
    );
}

export function ensureMascotImg(frameEl, imgEl) {
    if (!imgEl || !frameEl) return;
    if (!imgEl.getAttribute('src') || imgEl.getAttribute('src').includes('mintr-mint-mascot.svg')) {
        imgEl.src = MASCOT_IMG_SRC;
    }
    imgEl.classList.add('plan-billing-mascot__img');
    frameEl.classList.add('plan-billing-mascot-frame--idle');
}
