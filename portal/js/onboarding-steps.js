/**
 * Single source of truth for onboarding step PRESENTATION on web.
 *
 * Order and chapter grouping are the server's job — they come from
 * bootstrap.onboarding.chapters (finance_api ONBOARDING_CHAPTERS) and are read
 * by deriveFlowSteps() in settings-workflow.js. This table only answers
 * "given a step id, what page and label does it get?".
 *
 * Before this existed the same step ids were hardcoded in three places
 * (settings-workflow.js DEFAULT_FLOW_STEPS, portal-settings-nav.js CHAPTERS,
 * onboarding.js STEP_TO_PAGE) plus five copy maps, so every server-side step
 * change was a multi-file edit with silent fallbacks when one was missed.
 */

/**
 * Steps retired from the flow but still returned in legacy completed_steps.
 * Mirrors finance_api ONBOARDING_LEGACY_STEP_ALIASES.
 */
export const LEGACY_STEP_ALIASES = { banks: 'connect' };

export function canonicalStepId(stepId) {
    const id = String(stepId ?? '').trim();
    return LEGACY_STEP_ALIASES[id] || id;
}

/**
 * Per-step presentation. `href` is explicit rather than derived by convention
 * (`./settings-${id}.html`) because the onboarding-native steps live on their
 * own pages, not on a settings page.
 */
export const STEP_PRESENTATION = {
    legal: { href: './onboarding.html', label: 'Welcome & legal' },
    profile: { href: './settings-profile.html', label: 'Personal profile' },
    intake: { href: './onboarding-intake.html', label: 'A few quick questions' },
    connect: { href: './onboarding-connect.html', label: 'Connect your money' },
    billing: { href: './settings-billing.html', label: 'Plan & billing' },
    security: { href: './settings-security.html', label: 'Security' },
    goals: { href: './settings-goals.html', label: 'Savings goals' },
    categories: { href: './settings-categories.html', label: 'Custom categories' },
    ai: { href: './settings-ai.html', label: 'AI advisor settings' },
    notifications: { href: './settings-notifications.html', label: 'Alerts & nudges' }
};

/** Steps a user may skip and still reach a dashboard. Mirrors the server's optional set. */
export const OPTIONAL_STEP_IDS = new Set([
    'intake',
    'billing',
    'security',
    'goals',
    'categories',
    'ai',
    'notifications'
]);

export function isKnownStep(stepId) {
    return Object.prototype.hasOwnProperty.call(STEP_PRESENTATION, canonicalStepId(stepId));
}

export function labelForStep(stepId) {
    const id = canonicalStepId(stepId);
    return STEP_PRESENTATION[id]?.label || id;
}

/**
 * Page for a step. Returns null for an unknown step so callers can fail loudly
 * rather than silently redirecting somewhere plausible — a server that starts
 * emitting a step this build has no page for is a deploy-order bug, and it
 * needs to be visible, not absorbed.
 */
export function hrefForStep(stepId, { setup = false } = {}) {
    const entry = STEP_PRESENTATION[canonicalStepId(stepId)];
    if (!entry) return null;
    return setup ? `${entry.href}?setup=1` : entry.href;
}

/** Fallback flow used only when the server sends no chapters. */
export const DEFAULT_FLOW_STEP_IDS = [
    'legal',
    'profile',
    'intake',
    'connect',
    'billing',
    'security',
    'goals',
    'categories',
    'ai',
    'notifications'
];
