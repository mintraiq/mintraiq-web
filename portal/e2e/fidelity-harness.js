/**
 * Playwright E2E harness — loads sample JSON and runs the production fidelity renderer.
 * URL: fidelity-harness.html?fixture=lite|receipt|full|cold
 */
import { renderFidelityDashboard } from '../js/dashboard-fidelity.js';
import * as render from '../js/dashboard-render.js';

const FIXTURES = {
    lite: '../../docs/samples/dashboard-lite.json',
    receipt: '../../docs/samples/dashboard-receipt.json',
    full: '../../docs/samples/dashboard-full-portal.json',
    cold: '../../docs/samples/dashboard-cold.json'
};

const params = new URLSearchParams(window.location.search);
const fixture = params.get('fixture') || 'lite';
const url = FIXTURES[fixture];

const modeEl = document.getElementById('harnessMode');
const errEl = document.getElementById('harnessError');

try {
    if (!url) {
        throw new Error(`Unknown fixture: ${fixture}`);
    }
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`Failed to load ${url} (${res.status})`);
    }
    const data = await res.json();
    document.body.dataset.fixture = fixture;
    document.body.dataset.fidelityMode = data.fidelity_mode || '';
    if (modeEl) {
        modeEl.textContent = `fixture=${fixture} · fidelity_mode=${data.fidelity_mode || '—'}`;
    }
    renderFidelityDashboard(data, render);
    document.body.dataset.harnessReady = 'true';
} catch (err) {
    if (errEl) {
        errEl.hidden = false;
        errEl.textContent = String(err?.message || err);
    }
    document.body.dataset.harnessReady = 'error';
    throw err;
}
