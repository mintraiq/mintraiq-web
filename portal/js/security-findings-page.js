/**
 * Security Findings console (portal/security-findings.html).
 *
 * Security model:
 *   1. portal-page-boot.js -> guardSession() enforces an authenticated session.
 *   2. GET /v1/security/findings/access — MintrSecurityAgent role gate (nav + page).
 *      Non-members see "access denied"; the data endpoint enforces 403 server-side.
 *
 * Read-only view of the assessment report with client-side severity filtering and
 * authenticated JSON/CSV export (download only — no public share link).
 */
import { CONFIG } from './config.js';
import { createLogtoClient, getAccessTokenOrReauth } from './logto-client.js';
import { claimPageScript } from './page-script-guard.js';

const NAV_ID = 'security-findings';
const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low', 'info'];

let activeSeverity = 'all';
let lastReport = null;

function escapeHtml(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function apiBase() {
    return CONFIG.financeApiBase.replace(/\/$/, '');
}

async function authHeaders(extra) {
    const client = createLogtoClient();
    const token = await getAccessTokenOrReauth(client, CONFIG.financeApiResource);
    return {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        ...(extra || {}),
    };
}

async function apiRequest(path) {
    const res = await fetch(`${apiBase()}${path}`, { headers: await authHeaders() });
    if (!res.ok) {
        const err = new Error(`Request failed (${res.status})`);
        err.status = res.status;
        throw err;
    }
    return res.json();
}

async function fetchAccess() {
    try {
        return await apiRequest('/v1/security/findings/access');
    } catch {
        return { allowed: false, required_roles: [] };
    }
}

/* ------------------------------ views -------------------------------- */

function renderAccessDenied(roles) {
    const roleText = roles && roles.length ? roles.join(', ') : 'MintrSecurityAgent';
    return `
        <div class="sf-denied">
            <strong>Access denied</strong>
            <p style="margin-top:8px">
                This console is restricted to the security team. It requires the role
                <code>${escapeHtml(roleText)}</code>. Assign it to your user in the auth console,
                then sign out and back in.
            </p>
        </div>`;
}

function renderSummary(report, summary) {
    const bySev = summary.by_severity || {};
    const chips = SEVERITY_ORDER
        .filter((sev) => bySev[sev])
        .map(
            (sev) =>
                `<span class="sf-chip sf-sev-${sev}">${bySev[sev]} ${escapeHtml(sev)}</span>`,
        )
        .join('');
    return `
        <div class="sf-summary">
            <div class="sf-summary-meta">
                <div class="sf-total">${summary.total} findings</div>
                <div class="sf-framework">${escapeHtml(report.framework || '')}</div>
                <div class="sf-generated">Generated ${escapeHtml(report.generated_at || '')}</div>
            </div>
            <div class="sf-chips">${chips}</div>
            <div class="sf-actions">
                <button type="button" class="sf-btn" data-sf-export="json"><i class="fas fa-download"></i> JSON</button>
                <button type="button" class="sf-btn" data-sf-export="csv"><i class="fas fa-file-csv"></i> CSV</button>
            </div>
        </div>`;
}

function renderFilters(summary) {
    const bySev = summary.by_severity || {};
    const buttons = ['all', ...SEVERITY_ORDER.filter((sev) => bySev[sev])]
        .map((sev) => {
            const label = sev === 'all' ? 'All' : sev;
            const cls = sev === activeSeverity ? 'sf-filter is-active' : 'sf-filter';
            return `<button type="button" class="${cls}" data-sf-filter="${sev}">${escapeHtml(label)}</button>`;
        })
        .join('');
    return `<div class="sf-filters">${buttons}</div>`;
}

function renderRows(findings) {
    const rows = findings
        .filter((f) => activeSeverity === 'all' || f.severity === activeSeverity)
        .map(
            (f) => `
            <tr>
                <td class="sf-id">${escapeHtml(f.id)}</td>
                <td><span class="sf-tag sf-sev-${escapeHtml(f.severity)}">${escapeHtml(f.severity)}</span></td>
                <td class="sf-status">${escapeHtml(f.status)}</td>
                <td>
                    <div class="sf-title">${escapeHtml(f.title)}</div>
                    <div class="sf-desc">${escapeHtml(f.description)}</div>
                    <div class="sf-rec"><strong>Fix:</strong> ${escapeHtml(f.recommendation)}</div>
                </td>
                <td class="sf-loc">
                    <div>${escapeHtml(f.repo)}</div>
                    <code>${escapeHtml(f.location)}</code>
                </td>
                <td class="sf-asvs">${escapeHtml(f.asvs)}</td>
            </tr>`,
        )
        .join('');
    return `
        <div class="sf-table-wrap">
            <table class="sf-table">
                <thead>
                    <tr><th>ID</th><th>Severity</th><th>Status</th><th>Finding</th><th>Location</th><th>ASVS</th></tr>
                </thead>
                <tbody>${rows || '<tr><td colspan="6" class="sf-empty">No findings for this filter.</td></tr>'}</tbody>
            </table>
        </div>`;
}

function renderReport(report, summary, findings) {
    return renderSummary(report, summary) + renderFilters(summary) + renderRows(findings);
}

function repaintBody() {
    const body = document.getElementById('sfBody');
    if (!body || !lastReport) return;
    body.innerHTML = renderReport(lastReport.report, lastReport.summary, lastReport.findings);
}

/* --------------------------- interactions ---------------------------- */

async function downloadExport(format) {
    try {
        const res = await fetch(`${apiBase()}/v1/security/findings/export?format=${format}`, {
            headers: await authHeaders(),
        });
        if (!res.ok) throw new Error(`Export failed (${res.status})`);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `mintraiq-security-findings.${format}`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);
    } catch (err) {
        console.error('security-findings export', err);
    }
}

function ensureDelegation() {
    if (window.__mintSecurityFindingsDelegation) return;
    window.__mintSecurityFindingsDelegation = true;
    document.addEventListener('click', (e) => {
        const t = e.target;
        if (!(t instanceof Element)) return;
        if (!isSecurityFindingsPage()) return;

        const filterBtn = t.closest('[data-sf-filter]');
        if (filterBtn) {
            activeSeverity = filterBtn.getAttribute('data-sf-filter') || 'all';
            repaintBody();
            return;
        }

        const exportBtn = t.closest('[data-sf-export]');
        if (exportBtn) {
            void downloadExport(exportBtn.getAttribute('data-sf-export'));
        }
    });
}

async function render() {
    const root = document.getElementById('securityFindingsRoot');
    if (!root) return;

    root.innerHTML = '<div class="sf-loading"><i class="fas fa-spinner fa-spin"></i> Checking security access…</div>';

    const access = await fetchAccess();
    if (!access || !access.allowed) {
        root.innerHTML = renderAccessDenied(access && access.required_roles);
        return;
    }

    try {
        lastReport = await apiRequest('/v1/security/findings');
    } catch (err) {
        root.innerHTML = `<div class="sf-denied"><strong>Could not load findings</strong><p style="margin-top:8px">${escapeHtml(err.message)}</p></div>`;
        return;
    }

    root.innerHTML = '<div id="sfBody"></div>';
    repaintBody();
}

function isSecurityFindingsPage() {
    return document.body?.getAttribute('data-portal-nav') === NAV_ID;
}

export async function bootSecurityFindingsPage() {
    ensureDelegation();
    await render();
}

if (claimPageScript('security-findings-boot')) {
    if (!window.__mintSecurityFindingsTurboLoad) {
        window.__mintSecurityFindingsTurboLoad = true;
        document.addEventListener('turbo:load', () => {
            if (isSecurityFindingsPage()) void bootSecurityFindingsPage();
        });
    }
    if (isSecurityFindingsPage()) void bootSecurityFindingsPage();
}
