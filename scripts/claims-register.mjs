/**
 * The claims register (marketing-agent design 01-design section 4.3): every
 * figure or capability a social post may state, with its source and a shelf life.
 * The data is marketing/claims/register.json; this module loads it, answers
 * "is this entry still fresh?", and checks that a capability entry's assert
 * still holds in the repo.
 *
 * Deterministic on purpose: freshness takes `today` as an argument, and the
 * assert check takes the file reader as an argument, so the tests need neither
 * a clock nor a git remote. The caller decides what "the repo" means (production:
 * `git show origin/main:<path>`).
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const REGISTER_PATH = join(import.meta.dirname, '..', 'marketing', 'claims', 'register.json');

export const REGISTER = JSON.parse(readFileSync(REGISTER_PATH, 'utf8'));

export const ENTRY_TYPES = ['published_stat', 'capability', 'illustrative', 'name'];

/** {{fig:cpi-food-annual}}. A model writes this; the renderer swaps in the entry's text. */
export const PLACEHOLDER = /\{\{fig:([a-z0-9-]+)\}\}/g;

const MS_PER_DAY = 86_400_000;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const todayIso = () => new Date().toISOString().slice(0, 10);

export const findEntry = (id, register = REGISTER) => register.figures.find((entry) => entry.id === id);

export const isStale = (entry, today) => Date.parse(today) - Date.parse(entry.verified_at) > entry.max_age_days * MS_PER_DAY;

/** Entries whose literal text can trip the numbers rule. */
export const numericEntries = (register = REGISTER) => register.figures.filter((entry) => ['published_stat', 'illustrative'].includes(entry.type));

/**
 * Where an entry's literal text appears in copy: not glued to a longer number
 * ("11.9%", "$1.9%") and, for an unsigned figure, not carrying a sign the entry
 * does not have ("-1.9%" is not the registered "1.9%").
 */
export const literalPattern = (text) => new RegExp(`(?<![\\d.,$+-])${escapeRegex(text)}(?!\\d)`, 'g');

/** Structural problems with a register file; [] when it is well formed. */
export function validateRegister(register) {
    const problems = [];
    const seen = new Set();
    for (const entry of register.figures) {
        const where = `entry ${entry.id}`;
        if (!/^[a-z0-9-]+$/.test(entry.id ?? '')) problems.push(`${where}: id must be lowercase letters, digits and hyphens`);
        if (seen.has(entry.id)) problems.push(`${where}: duplicate id`);
        seen.add(entry.id);
        if (!ENTRY_TYPES.includes(entry.type)) problems.push(`${where}: unknown type ${entry.type}`);
        if (!entry.text) problems.push(`${where}: no text`);
        if (!ISO_DAY.test(entry.verified_at ?? '')) problems.push(`${where}: verified_at must be YYYY-MM-DD`);
        if (!(entry.max_age_days > 0)) problems.push(`${where}: max_age_days must be positive`);
        if (entry.type === 'published_stat' && !(entry.source?.url && ISO_DAY.test(entry.source?.retrieved ?? ''))) {
            problems.push(`${where}: a published_stat needs source.url and source.retrieved`);
        }
        if (['capability', 'name'].includes(entry.type) && !(entry.assert?.repo && entry.assert?.ref && entry.assert?.path && entry.assert?.contains)) {
            problems.push(`${where}: a ${entry.type} needs assert {repo, ref, path, contains}`);
        }
    }
    return problems;
}

/**
 * Re-check every entry that carries an assert. `readFile(repo, ref, path)` returns
 * the file's text; one that throws or returns nothing is a failure, never a skip.
 * Returns [{id, reason}] (empty means every assert holds).
 */
export function checkRegisterAsserts(register, readFile) {
    return register.figures
        .filter((entry) => entry.assert)
        .flatMap((entry) => {
            const { repo, ref, path, contains } = entry.assert;
            let text;
            try {
                text = readFile(repo, ref, path);
            } catch (error) {
                return [{ id: entry.id, reason: `cannot read ${repo}:${ref}:${path} (${error.message})` }];
            }
            if (typeof text !== 'string') return [{ id: entry.id, reason: `cannot read ${repo}:${ref}:${path}` }];
            return text.includes(contains) ? [] : [{ id: entry.id, reason: `${path} no longer contains ${JSON.stringify(contains)}` }];
        });
}
