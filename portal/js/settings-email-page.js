import { createLogtoClient } from './logto-client.js';
import { guardSession } from './guard-session.js';
import { financeApiFetch } from './api.js';

async function loadConnector(client) {
    const res = await financeApiFetch(client, '/email-connector', { method: 'GET' });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.detail || 'Could not load connector');
    document.getElementById('ecEmail').value = data.email_address || '';
    document.getElementById('ecProvider').value = data.provider || 'gmail';
    document.getElementById('ecEnabled').checked = Boolean(data.enabled);
    const status = document.getElementById('ecStatus');
    if (status) {
        status.textContent = data.enabled
            ? `Connected · ${data.signal_count || 0} email signal(s) on file`
            : 'Disconnected — enable to search bill emails';
    }
}

async function saveConnector(client, event) {
    event.preventDefault();
    const payload = {
        enabled: document.getElementById('ecEnabled').checked,
        email_address: document.getElementById('ecEmail').value.trim(),
        provider: document.getElementById('ecProvider').value,
        scan_bills: true,
        scan_subscriptions: true,
    };
    const res = await financeApiFetch(client, '/email-connector', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.detail || 'Save failed');
    await loadConnector(client);
}

async function disconnect(client) {
    const res = await financeApiFetch(client, '/email-connector', { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.detail || 'Disconnect failed');
    await loadConnector(client);
}

async function scanSample(client) {
    const subject = document.getElementById('ecScanSubject').value.trim();
    const body = document.getElementById('ecScanBody').value.trim();
    const res = await financeApiFetch(client, '/email-connector/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ subject, body, sample_text: body }),
    });
    const data = await res.json();
    const out = document.getElementById('ecScanResult');
    if (!res.ok) {
        if (out) out.textContent = data?.detail || 'Scan failed';
        return;
    }
    if (out) {
        out.textContent = `Found ${data.found} payment signal(s).\n` +
            (data.signals || []).map((s) => `${s.merchant}: $${s.recommended_reserve_amount} due ${s.expected_next_date}`).join('\n');
    }
    await loadConnector(client);
}

export async function bootSettingsEmailPage() {
    if (!(await guardSession())) return;
    const client = createLogtoClient();
    try {
        await loadConnector(client);
    } catch (e) {
        console.error('email-connector load', e);
    }
    document.getElementById('emailConnectorForm')?.addEventListener('submit', (ev) => {
        saveConnector(client, ev).catch((err) => console.error(err));
    });
    document.getElementById('ecDisconnect')?.addEventListener('click', () => {
        disconnect(client).catch((err) => console.error(err));
    });
    document.getElementById('ecScanBtn')?.addEventListener('click', () => {
        scanSample(client).catch((err) => console.error(err));
    });
}

bootSettingsEmailPage();
