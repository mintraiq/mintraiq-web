/**
 * Reads a marketing package directory the way the claims gate must: every text
 * surface, not just captions.md. Also owns the approval hash, so the publish
 * script and the tests share one definition of "exactly what was approved".
 *
 * Hash form follows marketing-agent design 01-design section 6.3 adapted to
 * step 1: the approved object is {schema_version, surfaces: {<path>: <text>}},
 * serialised as RFC 8785 (JCS) and hashed with SHA-256. Package files are text
 * on disk, so CRLF is folded to LF and text is NFC-normalised rather than
 * rejected; a lone surrogate is still refused (it has no UTF-8 form).
 */

import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { CONFIG, findCoverageGaps, findSocialViolations } from './social-copy-rules.mjs';

export const HASH_SCHEMA_VERSION = 1;

const NAMED_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', ndash: '–', mdash: '—', hellip: '…' };

const decodeEntities = (html) =>
    html
        .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
        .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
        .replace(/&([a-z]+);/gi, (whole, name) => NAMED_ENTITIES[name.toLowerCase()] ?? whole);

/** What a viewer reads in a frame, plus alt/title text a screen reader reads. */
export function visibleHtmlText(html) {
    const attributes = [...html.matchAll(/\b(?:alt|title|aria-label)="([^"]*)"/gi)].map((m) => m[1]);
    const body = html
        .replace(/<!--[\s\S]*?-->/g, ' ')
        .replace(/<(style|script|head)\b[\s\S]*?<\/\1>/gi, ' ')
        .replace(/<[^>]*>/g, ' ');
    return decodeEntities([body, ...attributes].join(' '));
}

/** captions.md minus the human-only preamble and the notes sections named in rules.json. */
export function captionsScannedText(markdown) {
    return markdown
        .split(/^(?=##\s)/m)
        .filter((section) => section.startsWith('##'))
        .filter((section) => {
            const heading = section.split('\n')[0].replace(/^##\s*/, '').trim().toLowerCase();
            return !CONFIG.package.captions_unscanned_sections.includes(heading);
        })
        .join('\n');
}

function listFiles(dir, prefix = '') {
    return readdirSync(join(dir, prefix), { withFileTypes: true }).flatMap((entry) => {
        const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
        return entry.isDirectory() ? listFiles(dir, relative) : [relative];
    });
}

/**
 * Every text surface of a package: {name, raw, scanned}. `raw` is the whole file
 * (what the hash pins); `scanned` is the part the gate reads.
 */
export function readSurfaces(dir) {
    const pkg = CONFIG.package;
    const files = listFiles(dir);
    const isFrame = (f) => f.startsWith(`${pkg.required_frames_dir}/`) && f.endsWith('.html');
    return files
        .filter((file) => pkg.text_files.includes(file) || isFrame(file))
        .sort()
        .map((name) => {
            const raw = readFileSync(join(dir, name), 'utf8');
            const scanned = name === 'captions.md' ? captionsScannedText(raw) : isFrame(name) ? visibleHtmlText(raw) : raw;
            return { name, raw, scanned };
        });
}

/** The gate over a whole package: coverage gaps plus rule violations per surface. */
export function scanPackage(dir, { today } = {}) {
    const coverageGaps = findCoverageGaps(listFiles(dir));
    const violations = readSurfaces(dir).flatMap((surface) =>
        findSocialViolations(surface.scanned, undefined, { surface: surface.name, today }).map((v) => ({ surface: surface.name, id: v.id, reason: v.detail ? `${v.reason} (${v.detail})` : v.reason }))
    );
    return { coverageGaps, violations };
}

/** RFC 8785 serialisation for the value types a package hash uses (strings, ints, arrays, objects). */
export function canonicalJson(value) {
    if (typeof value === 'string') {
        if (/[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/.test(value)) {
            throw new Error('canonicalJson: lone surrogate in string');
        }
        return JSON.stringify(value);
    }
    if (Number.isInteger(value)) return String(value);
    if (typeof value === 'boolean') return String(value);
    if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
    if (value && typeof value === 'object') {
        const keys = Object.keys(value).sort();
        return `{${keys.map((k) => `${canonicalJson(k)}:${canonicalJson(value[k])}`).join(',')}}`;
    }
    throw new Error(`canonicalJson: unsupported value ${String(value)}`);
}

export const sha256Hex = (text) => createHash('sha256').update(text, 'utf8').digest('hex');

/** The hash a human pins with --approve-sha: SHA-256 of the canonical text surfaces. */
export function packageHash(surfaces) {
    const texts = Object.fromEntries(
        surfaces.map((s) => [s.name, s.raw.replace(/\r\n/g, '\n').normalize('NFC')])
    );
    return sha256Hex(canonicalJson({ schema_version: HASH_SCHEMA_VERSION, surfaces: texts }));
}
