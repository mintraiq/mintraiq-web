/**
 * Render legal copy as readable blocks (paragraphs + lists). Uses DOM APIs only (no innerHTML).
 * Handles multi-line text and single-line numbered clauses like "1. Foo 2. Bar".
 */

/** Append text to el, rendering **bold** spans as <strong> (DOM APIs only). */
function appendInlineText(el, text) {
    const parts = String(text).split(/\*\*([^*]+)\*\*/);
    for (let i = 0; i < parts.length; i += 1) {
        if (!parts[i]) continue;
        if (i % 2 === 1) {
            const strong = document.createElement('strong');
            strong.textContent = parts[i];
            el.appendChild(strong);
        } else {
            el.appendChild(document.createTextNode(parts[i]));
        }
    }
}

function appendParagraph(container, text) {
    const p = document.createElement('p');
    p.className = 'legal-tos-para';
    appendInlineText(p, text);
    container.appendChild(p);
}

function appendHeading(container, level, text) {
    // Body headings sit under the page <h1>, so "#" maps to <h2> and deeper levels to <h3>.
    const h = document.createElement(level <= 1 ? 'h2' : 'h3');
    h.className = 'legal-tos-heading';
    appendInlineText(h, text);
    container.appendChild(h);
}

function appendList(container, ordered, items) {
    const list = document.createElement(ordered ? 'ol' : 'ul');
    list.className = ordered ? 'legal-tos-list legal-tos-list--ordered' : 'legal-tos-list';
    for (const item of items) {
        const li = document.createElement('li');
        if (item && typeof item === 'object') {
            appendInlineText(li, item.text);
            // Preserve the source number so isolated "N." headings don't reset to 1.
            if (item.value != null) li.value = item.value;
        } else {
            appendInlineText(li, item);
        }
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

        const heading = /^(#{1,6})\s+(.+)$/.exec(line);
        if (heading) {
            appendHeading(container, heading[1].length, heading[2].trim());
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
            const items = [{ value: Number(numLine[1]), text: numLine[2].trim() }];
            i += 1;
            while (i < lines.length) {
                const t = lines[i].trim();
                const n = /^(\d+)[\.)]\s+(.+)$/.exec(t);
                if (!n) break;
                items.push({ value: Number(n[1]), text: n[2].trim() });
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
