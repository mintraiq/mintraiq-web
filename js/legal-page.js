import { renderLegalFormatted } from '../portal/js/legal-format.js';

let legalJsonCache = null;
let legalJsonPromise = null;

function getDocKey() {
    return document.body?.dataset?.legalDoc || '';
}

function setStatus(message) {
    const statusEl = document.getElementById('legal-status');
    if (statusEl) statusEl.textContent = message || '';
}

async function fetchLegalJson() {
    if (legalJsonCache) return legalJsonCache;
    if (!legalJsonPromise) {
        legalJsonPromise = fetch('legal.json', {
            headers: { Accept: 'application/json' },
            cache: 'force-cache'
        })
            .then((res) => {
                if (!res.ok) throw new Error(`Failed to load legal content (${res.status}).`);
                return res.json();
            })
            .then((data) => {
                legalJsonCache = data;
                return data;
            })
            .finally(() => {
                legalJsonPromise = null;
            });
    }
    return legalJsonPromise;
}

async function loadLegalPage() {
    const docKey = getDocKey();
    const titleEl = document.getElementById('legal-title');
    const bodyEl = document.getElementById('legal-body');

    if (!docKey) {
        setStatus('Legal document type is not configured.');
        renderLegalFormatted(bodyEl, '', 'Content is not available.');
        return;
    }

    setStatus('Loading…');

    try {
        const data = await fetchLegalJson();
        const doc = data?.documents?.[docKey];
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

function bootLegalPage() {
    if (!getDocKey()) return;
    void loadLegalPage();
}

bootLegalPage();
if (!window.__mintLegalPageTurboLoad) {
    window.__mintLegalPageTurboLoad = true;
    document.addEventListener('turbo:load', bootLegalPage);
}
