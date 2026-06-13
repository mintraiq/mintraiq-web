/**
 * Playwright harness — agent NL query item highlight panels.
 * URL: agent-highlights-harness.html?fixture=milk|empty|error
 */
import { renderAgentItemHighlightsPanel } from '../js/receipt-line-items.js';

const FIXTURES = {
    milk: '../../docs/samples/agent-highlights-milk.json',
    empty: { reply: 'No matching receipt items in the last 7 days.', item_highlights: [] },
    error: null
};

const params = new URLSearchParams(window.location.search);
const fixture = params.get('fixture') || 'milk';
const modeEl = document.getElementById('harnessMode');
const errEl = document.getElementById('harnessError');
const replyEl = document.getElementById('agentReply');
const mount = document.getElementById('agentHighlightsMount');

try {
    if (fixture === 'error') {
        throw new Error('Simulated chat service failure');
    }
    let data;
    const spec = FIXTURES[fixture];
    if (!spec) {
        throw new Error(`Unknown fixture: ${fixture}`);
    }
    if (typeof spec === 'string') {
        const res = await fetch(spec);
        if (!res.ok) throw new Error(`Failed to load ${spec}`);
        data = await res.json();
    } else {
        data = spec;
    }
    if (modeEl) modeEl.textContent = `fixture=${fixture} · highlights=${(data.item_highlights || []).length}`;
    if (replyEl) replyEl.textContent = data.reply || '';
    if (mount) {
        mount.innerHTML = renderAgentItemHighlightsPanel(data.item_highlights, data.reply);
    }
    document.body.dataset.harnessReady = 'true';
} catch (err) {
    if (errEl) {
        errEl.hidden = false;
        errEl.textContent = String(err?.message || err);
    }
    document.body.dataset.harnessReady = 'error';
    throw err;
}
