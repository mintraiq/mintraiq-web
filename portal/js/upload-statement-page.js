import { guardSession } from './guard-session.js';
import { createLogtoClient } from './logto-client.js';
import { financeApiFetch } from './api.js';
import { claimPageScript } from './page-script-guard.js';
import { resolveDisplayName } from './user-display.js';

function readBootstrap() {
    const raw = sessionStorage.getItem('mintraiq_bootstrap');
    if (!raw) return null;
    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

const STATEMENT_ALLOWED_EXT = new Set(['csv', 'ofx', 'pdf']);

function statementFileExt(name) {
    const n = String(name || '');
    const dot = n.lastIndexOf('.');
    if (dot < 0) return '';
    return n.slice(dot + 1).toLowerCase();
}

function isAllowedStatementFile(file) {
    return Boolean(file && STATEMENT_ALLOWED_EXT.has(statementFileExt(file.name)));
}

function formatApiError(data, status) {
    const d = data?.detail;
    if (typeof d === 'string') return d;
    if (Array.isArray(d)) return d.map((x) => (typeof x?.msg === 'string' ? x.msg : JSON.stringify(x))).join('; ');
    if (data?.message) return String(data.message);
    return `Request failed (${status})`;
}

/**
 * @param {{ signal?: AbortSignal }} [opts]
 */
export async function bootUploadStatementPage(opts = {}) {
    const { signal } = opts;
    if (signal?.aborted) return;

    const sessionOk = await guardSession();
    if (!sessionOk) return;
    if (!claimPageScript('upload-statement-page')) return;

    const greetEl = document.getElementById('statementUploadGreet');
    const form = document.getElementById('statementUploadForm');
    const bankSelect = document.getElementById('statementBankSelect');
    const dropZone = document.getElementById('statementDropZone');
    const fileInput = document.getElementById('statementFileInput');
    const preview = document.getElementById('statementFilePreview');
    const fileNameEl = document.getElementById('statementFileName');
    const errEl = document.getElementById('statementUploadError');
    const submitBtn = document.getElementById('statementUploadSubmit');
    const resultWrap = document.getElementById('statementUploadResult');
    const resultMsg = document.getElementById('statementResultMessage');
    const resBank = document.getElementById('statementResBank');
    const resFormat = document.getElementById('statementResFormat');
    const resCount = document.getElementById('statementResCount');
    const resId = document.getElementById('statementResId');
    const insightBox = document.getElementById('statementQuickInsight');
    const insTarget = document.getElementById('statementInsightTarget');
    const insValue = document.getElementById('statementInsightValue');
    const insAction = document.getElementById('statementInsightAction');

    if (
        !(
            greetEl &&
            form instanceof HTMLFormElement &&
            bankSelect instanceof HTMLSelectElement &&
            dropZone &&
            fileInput instanceof HTMLInputElement &&
            preview &&
            fileNameEl &&
            errEl &&
            submitBtn instanceof HTMLButtonElement &&
            resultWrap &&
            resultMsg &&
            resBank &&
            resFormat &&
            resCount &&
            resId &&
            insightBox &&
            insTarget &&
            insValue &&
            insAction
        )
    ) {
        return;
    }

    const client = createLogtoClient();
    const bootstrap = readBootstrap();
    const claims = await client.getIdTokenClaims();
    const profile = bootstrap && bootstrap.profile;
    const name = resolveDisplayName(profile, claims);
    greetEl.textContent = name ? `Welcome back! ${name}.` : 'Welcome back!';

    function showError(msg) {
        errEl.textContent = msg;
        errEl.hidden = !msg;
    }

    function syncFileUi() {
        const f = fileInput.files && fileInput.files[0];
        if (f && !isAllowedStatementFile(f)) {
            showError('Only .csv, .ofx, and .pdf files are supported.');
            fileInput.value = '';
            preview.hidden = true;
            submitBtn.hidden = true;
            dropZone.classList.remove('statement-upload-dropzone--has-file');
            resultWrap.hidden = true;
            return;
        }
        if (f) {
            fileNameEl.textContent = f.name;
            preview.hidden = false;
            submitBtn.hidden = false;
            dropZone.classList.add('statement-upload-dropzone--has-file');
            showError('');
        } else {
            preview.hidden = true;
            submitBtn.hidden = true;
            dropZone.classList.remove('statement-upload-dropzone--has-file');
        }
        resultWrap.hidden = true;
    }

    fileInput.addEventListener('change', syncFileUi);

    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            fileInput.click();
        }
    });

    ['dragenter', 'dragover'].forEach((ev) => {
        dropZone.addEventListener(ev, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.add('statement-upload-dropzone--dragover');
        });
    });
    ['dragleave', 'drop'].forEach((ev) => {
        dropZone.addEventListener(ev, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.remove('statement-upload-dropzone--dragover');
        });
    });
    dropZone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const file = dt?.files?.[0];
        if (!file) return;
        if (!isAllowedStatementFile(file)) {
            showError('Only .csv, .ofx, and .pdf files are supported.');
            return;
        }
        try {
            const buffer = new DataTransfer();
            buffer.items.add(file);
            fileInput.files = buffer.files;
        } catch {
            return;
        }
        fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        showError('');
        resultWrap.hidden = true;
        insightBox.hidden = true;

        const file = fileInput.files && fileInput.files[0];
        if (!file) {
            showError('Please choose a statement file.');
            return;
        }
        if (!isAllowedStatementFile(file)) {
            showError('Only .csv, .ofx, and .pdf files are supported.');
            return;
        }
        if (!bankSelect.value) {
            showError('Please select your bank.');
            return;
        }

        const payloadJson = JSON.stringify({ bank: bankSelect.value });
        const fd = new FormData();
        fd.append('file', file, file.name);
        fd.append('payload', payloadJson);

        const prevLabel = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Processing…';

        try {
            const res = await financeApiFetch(client, '/upload-statement', {
                method: 'POST',
                body: fd,
                signal
            });
            const text = await res.text();
            let data = {};
            try {
                data = text ? JSON.parse(text) : {};
            } catch {
                throw new Error(`Unexpected response (${res.status}).`);
            }
            if (!res.ok) {
                throw new Error(formatApiError(data, res.status));
            }
            if (!data.success) {
                throw new Error(data.message || 'Upload did not complete successfully.');
            }

            resultMsg.textContent = data.message || 'Statement processed.';
            resBank.textContent = data.bank ?? '—';
            resFormat.textContent = (data.format && String(data.format).toUpperCase()) || '—';
            resCount.textContent = data.count != null ? String(data.count) : '—';
            resId.textContent = data.statement_id ?? '—';

            const qi = data.quick_insight;
            if (qi && typeof qi === 'object' && (qi.insightTarget || qi.insightAction)) {
                insTarget.textContent = qi.insightTarget ? String(qi.insightTarget) : '';
                insValue.textContent = qi.insightValue ? ` ${String(qi.insightValue)}` : '';
                insAction.textContent = qi.insightAction ? String(qi.insightAction) : '';
                insightBox.hidden = false;
            }

            resultWrap.hidden = false;
            fileInput.value = '';
            syncFileUi();
        } catch (err) {
            if (err?.name === 'AbortError') return;
            showError(err instanceof Error ? err.message : 'Upload failed.');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = prevLabel;
        }
    });

    syncFileUi();
}
