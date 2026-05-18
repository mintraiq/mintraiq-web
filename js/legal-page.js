import { renderLegalFormatted } from '../portal/js/legal-format.js';

const DOC_KEY = document.body.dataset.legalDoc;
const titleEl = document.getElementById('legal-title');
const bodyEl = document.getElementById('legal-body');
const statusEl = document.getElementById('legal-status');

function setStatus(message) {
    if (statusEl) statusEl.textContent = message || '';
}

async function loadLegalPage() {
    if (!DOC_KEY) {
        setStatus('Legal document type is not configured.');
        renderLegalFormatted(bodyEl, '', 'Content is not available.');
        return;
    }

    try {
        const res = await fetch('legal.json', { headers: { Accept: 'application/json' } });
        if (!res.ok) throw new Error(`Failed to load legal content (${res.status}).`);
        const data = await res.json();
        const doc = data?.documents?.[DOC_KEY];
        if (!doc?.content) throw new Error('This document is not available yet.');

        const pageTitle = doc.title || 'Legal';
        document.title = `MintrAIQ — ${pageTitle}`;
        if (titleEl) titleEl.textContent = pageTitle;

        const metaDesc = document.querySelector('meta[name="description"]');
        if (metaDesc) {
            metaDesc.setAttribute('content', `${pageTitle} for MintrAIQ — AI Financial Mentor (New Zealand).`);
        }

        renderLegalFormatted(bodyEl, doc.content);
        setStatus('');
    } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unable to load legal content.';
        setStatus(msg);
        renderLegalFormatted(bodyEl, '', 'Content is temporarily unavailable. Please try again later.');
    }
}

loadLegalPage();
