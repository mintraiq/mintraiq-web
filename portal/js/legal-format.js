/**
 * Render legal copy as readable blocks (paragraphs + lists). Uses DOM APIs only (no innerHTML).
 * Handles multi-line text and single-line numbered clauses like "1. Foo 2. Bar".
 */

function appendParagraph(container, text) {
    const p = document.createElement('p');
    p.className = 'legal-tos-para';
    p.textContent = text;
    container.appendChild(p);
}

function appendList(container, ordered, items) {
    const list = document.createElement(ordered ? 'ol' : 'ul');
    list.className = ordered ? 'legal-tos-list legal-tos-list--ordered' : 'legal-tos-list';
    for (const item of items) {
        const li = document.createElement('li');
        li.textContent = item;
        list.appendChild(li);
    }
    container.appendChild(list);
}

/** Split a single line that uses "1. ... 2. ..." style numbering. */
function splitInlineNumberedClauses(s) {
    const trimmed = s.trim();
    const parts = trimmed.split(/(?=\s+\d+[\.)]\s+)/).map((p) => p.trim()).filter(Boolean);
    if (parts.length <= 1) return null;
    const items = [];
    for (const p of parts) {
        const m = /^(\d+[\.)])\s*(.+)$/.exec(p);
        if (!m) return null;
        items.push(m[2].trim());
    }
    return items.length ? items : null;
}

export function renderLegalFormatted(container, text, emptyMessage) {
    if (!container) return;
    container.textContent = '';
    const msg = emptyMessage || 'Terms are not available yet.';
    if (text == null || !String(text).trim()) {
        appendParagraph(container, msg);
        return;
    }

    const s = String(text).trim();
    const inlineNumbered = splitInlineNumberedClauses(s);
    if (inlineNumbered) {
        appendList(container, true, inlineNumbered);
        return;
    }

    const lines = s.split(/\n+/);
    let i = 0;
    while (i < lines.length) {
        const line = lines[i].trim();
        if (!line) {
            i += 1;
            continue;
        }

        const bullet = /^[-*•]\s+(.+)$/.exec(line);
        const numLine = /^(\d+)[\.)]\s+(.+)$/.exec(line);
        if (bullet) {
            const items = [bullet[1]];
            i += 1;
            while (i < lines.length) {
                const t = lines[i].trim();
                const b = /^[-*•]\s+(.+)$/.exec(t);
                if (!b) break;
                items.push(b[1]);
                i += 1;
            }
            appendList(container, false, items);
            continue;
        }
        if (numLine) {
            const items = [numLine[2].trim()];
            i += 1;
            while (i < lines.length) {
                const t = lines[i].trim();
                const n = /^(\d+)[\.)]\s+(.+)$/.exec(t);
                if (!n) break;
                items.push(n[2].trim());
                i += 1;
            }
            appendList(container, true, items);
            continue;
        }

        appendParagraph(container, line);
        i += 1;
    }

    if (!container.childNodes.length) {
        appendParagraph(container, s);
    }
}
