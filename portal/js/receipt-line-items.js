/** Shared receipt line-item + agent highlight rendering (portal + E2E harness). */

export function escapeHtml(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/"/g, '&quot;');
}

/**
 * @param {{ receipt_id?: string, merchant?: string, transaction_date?: string, line_item_count?: number, line_items?: Array<{ item_name?: string, item_quantity?: number, item_price?: number, line_total?: number }> }} detail
 */
export function renderReceiptLineItemsPanel(detail) {
    if (!detail) {
        return '<p class="tx-receipt-hint">No linked receipt found.</p>';
    }
    const items = Array.isArray(detail.line_items) ? detail.line_items : [];
    const rows = items
        .map((item) => {
            const qty = Number(item.item_quantity ?? 1);
            const price = Number(item.item_price ?? 0);
            const total = Number(item.line_total ?? qty * price);
            return (
                `<div class="tx-receipt-row" data-testid="receipt-line-item">` +
                `<div class="tx-receipt-row-body">` +
                `<span class="tx-receipt-item-name">${escapeHtml(item.item_name || 'Item')}</span>` +
                `<span class="tx-receipt-item-meta">qty ${qty} @ $${price.toFixed(2)}</span>` +
                `</div>` +
                `<span class="tx-receipt-line-total">$${total.toFixed(2)}</span>` +
                `</div>`
            );
        })
        .join('');

    return (
        `<div class="tx-receipt-panel" data-testid="receipt-breakdown-panel">` +
        `<div class="tx-receipt-panel-head">` +
        `<i class="fas fa-receipt" aria-hidden="true"></i>` +
        `<span>Receipt breakdown</span>` +
        `</div>` +
        `<p class="tx-receipt-meta">${escapeHtml(detail.merchant || 'Merchant')} · ${escapeHtml(detail.transaction_date || '—')} · ${detail.line_item_count ?? items.length} items</p>` +
        `<div class="tx-receipt-items">${rows || '<p class="tx-receipt-hint">No line items on this receipt.</p>'}</div>` +
        `</div>`
    );
}

/**
 * @param {string[]} [serverHighlights]
 * @param {string} [reply]
 */
export function parseAgentReceiptHighlights(serverHighlights, reply = '') {
    const source = [...(serverHighlights || []), reply];
    const results = [];
    const pattern =
        /['"]?([^'"]+?)['"]?\s+at\s+([^:]+):\s*\$([0-9]+(?:\.[0-9]{1,2})?)\s+on\s+(\d{4}-\d{2}-\d{2})/gi;

    for (const block of source) {
        let match;
        const re = new RegExp(pattern);
        while ((match = re.exec(block)) !== null) {
            results.push({
                label: match[1].trim(),
                merchant: match[2].trim(),
                amount: Number.parseFloat(match[3]),
                date: match[4]
            });
        }
    }
    return results;
}

/**
 * @param {string[]} [serverHighlights]
 * @param {string} [reply]
 */
export function renderAgentItemHighlightsPanel(serverHighlights, reply = '') {
    const parsed = parseAgentReceiptHighlights(serverHighlights, reply);
    if (!parsed.length) {
        return '<p class="tx-agent-hint" data-testid="agent-highlights-empty">No item matches to highlight.</p>';
    }
    const rows = parsed
        .map(
            (h) =>
                `<div class="tx-agent-highlight-row" data-testid="agent-highlight-row">` +
                `<span class="tx-agent-highlight-label">${escapeHtml(h.label)}</span>` +
                `<span class="tx-agent-highlight-amount">${h.amount != null ? `$${h.amount.toFixed(2)}` : '—'}</span>` +
                (h.merchant
                    ? `<span class="tx-agent-highlight-meta">${escapeHtml(h.merchant)}${h.date ? ` · ${escapeHtml(h.date)}` : ''}</span>`
                    : '') +
                `</div>`
        )
        .join('');
    return (
        `<div class="tx-agent-highlights" data-testid="agent-highlights-panel">` +
        `<div class="tx-agent-highlights-head"><i class="fas fa-tag" aria-hidden="true"></i><span>Item matches</span></div>` +
        rows +
        `</div>`
    );
}
