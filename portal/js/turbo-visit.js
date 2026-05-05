/**
 * Same-origin navigations prefer Turbo Drive (no full document reload).
 * Use after sign-in / callback instead of location.replace when Turbo is present.
 */
export function visitWithTurbo(url, { replace = false } = {}) {
    let abs;
    try {
        abs = new URL(String(url), window.location.href);
    } catch {
        window.location.replace(String(url));
        return;
    }
    if (abs.origin !== window.location.origin) {
        if (replace) window.location.replace(abs.href);
        else window.location.href = abs.href;
        return;
    }
    const turbo = /** @type {{ visit?: (loc: string, opts?: { action?: string }) => void }} */ (window).Turbo;
    if (turbo && typeof turbo.visit === 'function') {
        turbo.visit(abs.href, { action: replace ? 'replace' : 'advance' });
        return;
    }
    if (replace) window.location.replace(abs.href);
    else window.location.href = abs.href;
}
