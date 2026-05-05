/**
 * Turbo Drive re-executes body scripts on each visit. Use this so idempotent boot runs once per body.
 */
const G = '__mintPageScriptBoot';

export function claimPageScript(key) {
    const w = /** @type {Record<string, { bodies: WeakMap<object, Set<string>> }>} */ (window);
    const buckets = (w[G] ??= { bodies: new WeakMap() });
    const b = document.body;
    let set = buckets.bodies.get(b);
    if (!set) {
        set = new Set();
        buckets.bodies.set(b, set);
    }
    if (set.has(key)) return false;
    set.add(key);
    return true;
}
