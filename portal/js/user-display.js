/**
 * Display name + email resolution for workspace shell (dashboard, profile).
 * Prefer API bootstrap profile; fall back to Logto OIDC id-token claims.
 */

/**
 * @param {unknown} profile — `bootstrap.profile`
 * @param {unknown} claims — `getIdTokenClaims()` result
 * @returns {string} trimmed display string or empty
 */
export function resolveDisplayName(profile, claims) {
    const p = profile && typeof profile === 'object' ? profile : null;
    const c = claims && typeof claims === 'object' ? claims : {};
    const from =
        (p && p.name != null && String(p.name).trim()) ||
        (c.name != null && String(c.name).trim()) ||
        (c.username != null && String(c.username).trim()) ||
        (c.preferred_username != null && String(c.preferred_username).trim()) ||
        '';
    if (from) return from;
    const email = resolveEmail(profile, claims);
    if (email && email.includes('@')) return email.split('@')[0];
    return '';
}

/**
 * @param {unknown} profile
 * @param {unknown} claims
 * @returns {string}
 */
export function resolveEmail(profile, claims) {
    const p = profile && typeof profile === 'object' ? profile : null;
    const c = claims && typeof claims === 'object' ? claims : {};
    return (p && p.email != null && String(p.email).trim()) || (c.email != null && String(c.email).trim()) || '';
}
