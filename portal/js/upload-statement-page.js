import { guardSession } from './guard-session.js';
import { createLogtoClient } from './logto-client.js';
import { financeApiFetch } from './api.js';
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

const STATEMENT_ALLOWED_EXT = new Set(['csv', 'ofx', 'qfx', 'pdf']);
const STATEMENT_OFX_MIMES = new Set([
    'application/x-ofx',
    'application/vnd.ofx',
    'application/ofx',
    'text/x-ofx',
    'application/vnd.intu.qfx'
]);

function statementFileExt(name) {
    const n = String(name || '');
    const dot = n.lastIndexOf('.');
    if (dot < 0) return '';
    return n.slice(dot + 1).toLowerCase();
}

function isAllowedStatementFile(file) {
    if (!file) return false;
    const ext = statementFileExt(file.name);
    if (STATEMENT_ALLOWED_EXT.has(ext)) return true;
    const t = String(file.type || '').toLowerCase();
    if (!ext) {
        if (t === 'application/pdf') return true;
        if (t === 'text/csv' || t === 'application/csv') return true;
        if (STATEMENT_OFX_MIMES.has(t)) return true;
    }
    return false;
}

function allowedTypesHint() {
    return 'Only .csv, .ofx, .qfx, and .pdf files are supported.';
}

function formatApiError(data, status) {
    const d = data?.detail;
    if (typeof d === 'string') return d;
    if (Array.isArray(d)) return d.map((x) => (typeof x?.msg === 'string' ? x.msg : JSON.stringify(x))).join('; ');
    if (data?.message) return String(data.message);
    return `Request failed (${status})`;
}

/** Matches finance_api `generate_quick_insight` payload (camelCase JSON; tolerate snake_case). */
function normalizeQuickInsight(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const target = raw.insightTarget ?? raw.insight_target;
    const value = raw.insightValue ?? raw.insight_value;
    const action = raw.insightAction ?? raw.insight_action;
    const t = target != null && String(target).trim() ? String(target).trim() : '';
    const v = value != null && String(value).trim() ? String(value).trim() : '';
    const a = action != null && String(action).trim() ? String(action).trim() : '';
    if (!t && !v && !a) return null;
    return { target: t, value: v, action: a };
}

/**
 * @param {{ signal?: AbortSignal }} [opts]
 */
export async function bootUploadStatementPage(opts = {}) {
    const { signal } = opts;
    if (signal?.aborted) return;

    const sessionOk = await guardSession();
    if (!sessionOk) return;
    if (signal?.aborted) return;

    const greetEl = document.getElementById('statementUploadGreet');
    const form = document.getElementById('statementUploadForm');
    const bankSelect = document.getElementById('statementBankSelect');
    const dropZone = document.getElementById('statementDropZone');
    const fileInput = document.getElementById('statementFileInput');
    const preview = document.getElementById('statementFilePreview');
    const fileNameEl = document.getElementById('statementFileName');
    const fileRemoveBtn = document.getElementById('statementFileRemove');
    const errEl = document.getElementById('statementUploadError');
    const submitBtn = document.getElementById('statementUploadSubmit');
    const resultWrap = document.getElementById('statementUploadResult');
    const resultMsg = document.getElementById('statementResultMessage');
    const resBank = document.getElementById('statementResBank');
    const resFormat = document.getElementById('statementResFormat');
    const resCount = document.getElementById('statementResCount');
    const resId = document.getElementById('statementResId');
    const insightBalloon = document.getElementById('statementInsightBalloon');
    const insightTitleEl = document.getElementById('statementInsightBalloonTitle');
    const insightValueEl = document.getElementById('statementInsightBalloonValue');
    const insightActionEl = document.getElementById('statementInsightBalloonAction');
    const insightCloseBtn = document.getElementById('statementInsightBalloonClose');
    const insightDismissBtn = document.getElementById('statementInsightBalloonDismiss');

    if (
        !(
            greetEl &&
            form instanceof HTMLFormElement &&
            bankSelect instanceof HTMLSelectElement &&
            dropZone instanceof HTMLLabelElement &&
            fileInput instanceof HTMLInputElement &&
            preview &&
            fileNameEl &&
            fileRemoveBtn instanceof HTMLButtonElement &&
            errEl &&
            submitBtn instanceof HTMLButtonElement &&
            resultWrap &&
            resultMsg &&
            resBank &&
            resFormat &&
            resCount &&
            resId &&
            insightBalloon &&
            insightTitleEl &&
            insightValueEl &&
            insightActionEl &&
            insightCloseBtn instanceof HTMLButtonElement &&
            insightDismissBtn instanceof HTMLButtonElement
        )
    ) {
        return;
    }

    /**
     * Turbo keeps the same `document.body` across visits; `claimPageScript` would skip re-boot and
     * leave new markup unwired. Bfcache/Turbo snapshots can also show a file row with an empty input.
     */
    function resetStaleFileRow() {
        const hasFile = Boolean(fileInput.files && fileInput.files[0]);
        if (hasFile) return;
        fileInput.value = '';
        fileNameEl.textContent = '';
        preview.hidden = true;
        submitBtn.hidden = true;
        dropZone.classList.remove('statement-upload-dropzone--has-file');
    }

    const client = createLogtoClient();
    const bootstrap = readBootstrap();
    const claims = await client.getIdTokenClaims();
    const profile = bootstrap && bootstrap.profile;
    const name = resolveDisplayName(profile, claims);
    greetEl.textContent = name ? `Welcome back! ${name}.` : 'Welcome back!';

    resetStaleFileRow();

    function hideInsightBalloon() {
        insightBalloon.hidden = true;
        insightBalloon.classList.remove('statement-insight-balloon--visible');
    }

    function showInsightBalloon(qi) {
        const n = normalizeQuickInsight(qi);
        if (!n) {
            hideInsightBalloon();
            return;
        }
        insightTitleEl.textContent = n.target || 'Insight';
        if (n.value) {
            insightValueEl.textContent = n.value;
            insightValueEl.hidden = false;
        } else {
            insightValueEl.textContent = '';
            insightValueEl.hidden = true;
        }
        if (n.action) {
            insightActionEl.textContent = n.action;
            insightActionEl.hidden = false;
        } else {
            insightActionEl.textContent = '';
            insightActionEl.hidden = true;
        }
        insightBalloon.hidden = false;
        requestAnimationFrame(() => {
            insightBalloon.classList.add('statement-insight-balloon--visible');
        });
        insightDismissBtn.focus();
    }

    function showError(msg) {
        errEl.textContent = msg;
        errEl.hidden = !msg;
    }

    function syncFileUi() {
        const f = fileInput.files && fileInput.files[0];
        if (f && !isAllowedStatementFile(f)) {
            showError(allowedTypesHint());
            fileInput.value = '';
            preview.hidden = true;
            submitBtn.hidden = true;
            dropZone.classList.remove('statement-upload-dropzone--has-file');
            resultWrap.hidden = true;
            return;
        }
        if (f) {
            const label = f.name && String(f.name).trim() ? f.name : '(selected file)';
            fileNameEl.textContent = label;
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

    /**
     * Do not call fileInput.click() from a bubbling parent handler: the file input covers the
     * dropzone (absolute inset 0), so the click already targets the input — a second click() loops
     * the picker and can prevent change/name UI from settling.
     */
    fileInput.addEventListener('change', syncFileUi, { signal });

    fileRemoveBtn.addEventListener(
        'click',
        (e) => {
            e.preventDefault();
            e.stopPropagation();
            fileInput.value = '';
            showError('');
            syncFileUi();
        },
        { signal }
    );

    ['dragenter', 'dragover'].forEach((ev) => {
        dropZone.addEventListener(
            ev,
            (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropZone.classList.add('statement-upload-dropzone--dragover');
            },
            { signal }
        );
    });
    dropZone.addEventListener(
        'dragleave',
        (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.remove('statement-upload-dropzone--dragover');
        },
        { signal }
    );
    dropZone.addEventListener(
        'drop',
        (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropZone.classList.remove('statement-upload-dropzone--dragover');
            const dt = e.dataTransfer;
            const file = dt?.files?.[0];
            if (!file) return;
            if (!isAllowedStatementFile(file)) {
                showError(allowedTypesHint());
                return;
            }
            try {
                const buffer = new DataTransfer();
                buffer.items.add(file);
                fileInput.files = buffer.files;
            } catch {
                return;
            }
            syncFileUi();
        },
        { signal }
    );

    const onInsightBalloonKeydown = (e) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            hideInsightBalloon();
        }
    };

    insightCloseBtn.addEventListener('click', hideInsightBalloon, { signal });
    insightDismissBtn.addEventListener('click', hideInsightBalloon, { signal });
    document.addEventListener('keydown', onInsightBalloonKeydown, { signal });

    /** Avoid caching a half-state row (empty file input + visible strip) when leaving via Turbo. */
    document.addEventListener(
        'turbo:before-cache',
        () => {
            if (document.body?.getAttribute('data-portal-nav') !== 'upload-statement') return;
            resetStaleFileRow();
            resultWrap.hidden = true;
            hideInsightBalloon();
        },
        { signal }
    );

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        showError('');
        resultWrap.hidden = true;
        hideInsightBalloon();

        const file = fileInput.files && fileInput.files[0];
        if (!file) {
            showError('Please choose a statement file.');
            return;
        }
        if (!isAllowedStatementFile(file)) {
            showError(allowedTypesHint());
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

            const qi = normalizeQuickInsight(data.quick_insight);
            if (qi) {
                showInsightBalloon(data.quick_insight);
            } else {
                hideInsightBalloon();
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
    }, { signal });

    syncFileUi();
}
