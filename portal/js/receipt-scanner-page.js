import { isFeatureReceiptScannerEnabled } from './config.js';
import { guardSession } from './guard-session.js';
import { createLogtoClient } from './logto-client.js';
import { ocrScannerFetch } from './api.js';

/** @type {MediaStream | null} */
let mediaStream = null;
/** @type {Blob | File | null} */
let pendingImage = null;

/**
 * Browser multipart equivalent of Python:
 *   files = {"file": (file.filename, file.stream, file.mimetype)}
 * One form field named `file`; filename + Content-Type on the part map to filename + mimetype.
 * @param {Blob | File} blob
 * @returns {FormData}
 */
function guessMimeFromFilename(filename) {
    const n = String(filename || '').toLowerCase();
    if (n.endsWith('.png')) return 'image/png';
    if (n.endsWith('.webp')) return 'image/webp';
    if (n.endsWith('.jpg') || n.endsWith('.jpeg')) return 'image/jpeg';
    return 'image/jpeg';
}

function buildReceiptScannerFormData(blob) {
    const fd = new FormData();
    const isFile = blob instanceof File;
    const filename = isFile && blob.name ? blob.name : 'receipt.jpg';
    const mimetype =
        blob.type && blob.type !== '' ? blob.type : guessMimeFromFilename(filename);
    const file = new File([blob], filename, { type: mimetype });
    fd.append('file', file, filename);
    return fd;
}

function formatApiError(data, status) {
    const d = data?.detail;
    if (typeof d === 'string') return d;
    if (Array.isArray(d)) return d.map((x) => (typeof x?.msg === 'string' ? x.msg : JSON.stringify(x))).join('; ');
    if (data?.message) return String(data.message);
    return `Request failed (${status})`;
}

function firstDefined(obj, keys) {
    if (!obj || typeof obj !== 'object') return '';
    for (const k of keys) {
        const v = obj[k];
        if (v !== undefined && v !== null && v !== '') return v;
    }
    return '';
}

function formatCurrencyNzd(value) {
    if (value === '' || value == null) return '—';
    const n = Number(value);
    if (Number.isNaN(n)) return String(value);
    return n.toLocaleString('en-NZ', { style: 'currency', currency: 'NZD' });
}

/**
 * Renders summary + line-items tables into `host` (textContent only). Returns false if nothing to show.
 * @param {HTMLElement | null} host
 * @param {unknown} scanned
 * @returns {boolean}
 */
function renderReceiptScanTables(host, scanned) {
    if (!host || typeof scanned !== 'object' || scanned === null || Array.isArray(scanned)) return false;

    const merchant = firstDefined(scanned, ['merchant_name', 'merchantName']);
    const address = firstDefined(scanned, ['merchant_address', 'merchantAddress']);
    const date = firstDefined(scanned, ['transaction_date', 'transactionDate']);
    const time = firstDefined(scanned, ['transaction_time', 'transactionTime']);
    const totalRaw = scanned.total_amount ?? scanned.totalAmount;
    const lines = scanned.line_items ?? scanned.lineItems;

    const hasSummary = [merchant, address, date, time, totalRaw].some((v) => v !== '' && v != null);
    const hasLines = Array.isArray(lines) && lines.length > 0;
    if (!hasSummary && !hasLines) return false;

    host.replaceChildren();

    function appendSummaryTable() {
        const title = document.createElement('h3');
        title.className = 'rs-result-section-title';
        title.textContent = 'Receipt summary';
        host.appendChild(title);

        const table = document.createElement('table');
        table.className = 'rs-result-table rs-result-table--summary';
        const tbody = document.createElement('tbody');

        function row(label, value, formatMoney) {
            const tr = document.createElement('tr');
            const th = document.createElement('th');
            th.textContent = label;
            const td = document.createElement('td');
            if (value === '' || value == null) td.textContent = '—';
            else td.textContent = formatMoney ? formatCurrencyNzd(value) : String(value);
            tr.append(th, td);
            tbody.appendChild(tr);
        }

        row('Merchant', merchant, false);
        row('Address', address, false);
        row('Date', date, false);
        row('Time', time, false);
        row('Total', totalRaw, true);

        table.appendChild(tbody);
        host.appendChild(table);
    }

    function appendLineItemsTable() {
        const title = document.createElement('h3');
        title.className = 'rs-result-section-title';
        title.textContent = 'Line items';
        host.appendChild(title);

        const table = document.createElement('table');
        table.className = 'rs-result-table rs-result-table--lines';
        const thead = document.createElement('thead');
        const trh = document.createElement('tr');
        for (const h of ['Item', 'Qty', 'Price']) {
            const th = document.createElement('th');
            th.textContent = h;
            trh.appendChild(th);
        }
        thead.appendChild(trh);
        const tbody = document.createElement('tbody');

        for (const item of lines) {
            if (!item || typeof item !== 'object') continue;
            const tr = document.createElement('tr');
            const name = firstDefined(item, ['item_name', 'itemName', 'description', 'name']);
            const qty = item.item_quantity ?? item.itemQuantity ?? item.quantity;
            const price = item.item_price ?? item.itemPrice ?? item.price;

            const tdName = document.createElement('td');
            tdName.textContent = name !== '' && name != null ? String(name) : '—';

            const tdQty = document.createElement('td');
            tdQty.textContent = qty === '' || qty == null ? '—' : String(qty);

            const tdPrice = document.createElement('td');
            tdPrice.textContent = formatCurrencyNzd(price);

            tr.append(tdName, tdQty, tdPrice);
            tbody.appendChild(tr);
        }

        table.appendChild(thead);
        table.appendChild(tbody);
        host.appendChild(table);
    }

    if (hasSummary) appendSummaryTable();
    if (hasLines) appendLineItemsTable();
    return true;
}

function stopCamera(video) {
    if (mediaStream) {
        mediaStream.getTracks().forEach((t) => t.stop());
        mediaStream = null;
    }
    if (video) {
        video.srcObject = null;
    }
}

/**
 * @param {{ signal?: AbortSignal }} [opts]
 */
export async function bootReceiptScannerPage(opts = {}) {
    const { signal } = opts;
    if (signal?.aborted) return;

    const sessionOk = await guardSession();
    if (!sessionOk) return;
    if (signal?.aborted) return;

    const disabledPanel = document.getElementById('rsDisabledPanel');
    const activePanel = document.getElementById('rsActivePanel');
    if (!isFeatureReceiptScannerEnabled()) {
        if (disabledPanel) disabledPanel.hidden = false;
        if (activePanel) activePanel.hidden = true;
        return;
    }
    if (disabledPanel) disabledPanel.hidden = true;
    if (activePanel) activePanel.hidden = false;

    const video = document.getElementById('rsVideo');
    const canvas = document.getElementById('rsCanvas');
    const placeholder = document.getElementById('rsVideoPlaceholder');
    const liveBadge = document.getElementById('rsLiveBadge');
    const btnCapture = document.getElementById('rsCapture');
    const btnProcess = document.getElementById('rsProcess');
    const fileFallback = document.getElementById('rsFileFallback');
    const btnRetry = document.getElementById('rsRetryCamera');
    const statusEl = document.getElementById('rsStatus');
    const errEl = document.getElementById('rsError');
    const resultWrap = document.getElementById('rsResult');
    const resultTableHost = document.getElementById('rsResultTableHost');
    const resultPre = document.getElementById('rsResultJson');
    const resultMeta = document.getElementById('rsResultMeta');
    const scanningOverlay = document.getElementById('rsScanningOverlay');
    const scanningSub = document.getElementById('rsScanningSub');

    /** @type {ReturnType<typeof setInterval> | null} */
    let scanPhaseTimer = null;
    const SCAN_PHASES = [
        'Sending your receipt securely to the scanner…',
        'Pulling out amounts, dates, and merchant names…',
        'Sharp photos can take a moment — your scan agent is still on it.',
        'Almost there — finishing the extract…'
    ];

    function startScanningUI() {
        if (scanningSub) scanningSub.textContent = SCAN_PHASES[0];
        if (scanningOverlay) {
            scanningOverlay.hidden = false;
            scanningOverlay.setAttribute('aria-busy', 'true');
        }
        if (scanPhaseTimer != null) clearInterval(scanPhaseTimer);
        let i = 0;
        scanPhaseTimer = window.setInterval(() => {
            i = (i + 1) % SCAN_PHASES.length;
            if (scanningSub) scanningSub.textContent = SCAN_PHASES[i];
        }, 2800);
    }

    function stopScanningUI() {
        if (scanPhaseTimer != null) {
            clearInterval(scanPhaseTimer);
            scanPhaseTimer = null;
        }
        if (scanningOverlay) {
            scanningOverlay.hidden = true;
            scanningOverlay.setAttribute('aria-busy', 'false');
        }
        if (scanningSub) scanningSub.textContent = '';
    }

    stopScanningUI();

    if (
        !(
            video instanceof HTMLVideoElement &&
            canvas instanceof HTMLCanvasElement &&
            placeholder &&
            liveBadge &&
            btnCapture instanceof HTMLButtonElement &&
            btnProcess instanceof HTMLButtonElement &&
            fileFallback instanceof HTMLInputElement &&
            btnRetry instanceof HTMLButtonElement &&
            statusEl &&
            errEl &&
            resultWrap &&
            resultTableHost &&
            resultPre &&
            resultMeta
        )
    ) {
        return;
    }

    function showError(msg) {
        errEl.textContent = msg;
        errEl.hidden = !msg;
    }

    function setPending(blob, label) {
        pendingImage = blob;
        const ok = Boolean(blob);
        btnProcess.disabled = !ok;
        if (ok && statusEl) {
            statusEl.textContent = label || 'Ready to send — tap Process AI.';
        }
        if (ok) {
            resultWrap.hidden = true;
            showError('');
        }
    }

    async function startCamera() {
        showError('');
        stopCamera(video);
        if (placeholder) {
            placeholder.hidden = false;
            placeholder.textContent = 'Starting camera…';
        }
        liveBadge.hidden = true;
        btnCapture.disabled = true;

        if (!navigator.mediaDevices?.getUserMedia) {
            if (placeholder) placeholder.textContent = 'Camera not supported in this browser. Use “Choose image”.';
            if (statusEl) statusEl.textContent = '';
            return;
        }

        try {
            mediaStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } },
                audio: false
            });
            if (signal?.aborted) {
                stopCamera(video);
                return;
            }
            video.srcObject = mediaStream;
            await video.play();
            if (placeholder) placeholder.hidden = true;
            liveBadge.hidden = false;
            btnCapture.disabled = false;
            if (statusEl) statusEl.textContent = 'Camera active — align the receipt, then Capture.';
        } catch {
            if (placeholder) {
                placeholder.hidden = false;
                placeholder.textContent = 'Could not access camera. Allow permission or use “Choose image”.';
            }
            if (statusEl) statusEl.textContent = '';
        }
    }

    signal?.addEventListener('abort', () => {
        stopScanningUI();
        stopCamera(video);
    });

    document.addEventListener(
        'turbo:before-cache',
        () => {
            if (document.body?.getAttribute('data-portal-nav') !== 'receipt-scanner') return;
            stopScanningUI();
            stopCamera(video);
        },
        { signal }
    );

    btnRetry.addEventListener('click', () => void startCamera(), { signal });

    btnCapture.addEventListener(
        'click',
        () => {
            showError('');
            if (!video.videoWidth || !video.videoHeight) {
                showError('Wait for the camera preview, or choose an image file.');
                return;
            }
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                showError('Could not read video frame.');
                return;
            }
            ctx.drawImage(video, 0, 0);
            canvas.toBlob(
                (blob) => {
                    if (!blob) {
                        showError('Capture failed — try again.');
                        return;
                    }
                    setPending(blob, 'Frame captured — tap Process AI to extract.');
                },
                'image/jpeg',
                0.92
            );
        },
        { signal }
    );

    fileFallback.addEventListener(
        'change',
        () => {
            const f = fileFallback.files && fileFallback.files[0];
            if (!f) return;
            pendingImage = f;
            btnProcess.disabled = false;
            showError('');
            resultWrap.hidden = true;
            if (statusEl) statusEl.textContent = `Selected: ${f.name}. Tap Process AI.`;
            if (placeholder) {
                placeholder.hidden = false;
                placeholder.textContent = `Using file: ${f.name}`;
            }
        },
        { signal }
    );

    btnProcess.addEventListener(
        'click',
        async () => {
            const blob = pendingImage;
            if (!blob) {
                showError('Capture a frame or choose an image first.');
                return;
            }

            const client = createLogtoClient();
            const fd = buildReceiptScannerFormData(blob);

            showError('');
            btnProcess.disabled = true;
            btnCapture.disabled = true;
            if (statusEl) statusEl.textContent = 'Connecting…';

            try {
                const res = await ocrScannerFetch(client, {
                    method: 'POST',
                    body: fd,
                    signal,
                    /** Full “scan agent” overlay only once the HTTP request is about to run (after token). */
                    onBeforeFetch: () => {
                        if (statusEl) statusEl.textContent = '';
                        startScanningUI();
                    }
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
                if (typeof data.success === 'boolean' && data.success === false) {
                    throw new Error(data.message || data.detail || 'Scan did not complete successfully.');
                }

                const scanned =
                    data.scanned != null
                        ? data.scanned
                        : data.result != null
                          ? data.result
                          : data.data != null
                            ? data.data
                            : data;

                const ins = data.inserted_id != null ? String(data.inserted_id) : '';
                resultMeta.textContent = ins
                    ? `Stored with id ${ins}. AI-extracted fields below.`
                    : 'AI-extracted receipt details below.';

                const tableShown = renderReceiptScanTables(resultTableHost, scanned);
                let pretty = '';
                try {
                    pretty = JSON.stringify(scanned, null, 2);
                } catch {
                    pretty = String(scanned);
                }

                if (tableShown) {
                    resultTableHost.hidden = false;
                    resultPre.hidden = true;
                    resultPre.textContent = '';
                    resultTableHost.focus();
                } else {
                    resultTableHost.hidden = true;
                    resultTableHost.replaceChildren();
                    resultPre.hidden = false;
                    resultPre.textContent = pretty;
                    resultPre.focus();
                }
                resultWrap.hidden = false;
                if (statusEl) statusEl.textContent = 'Scan complete.';
            } catch (err) {
                if (err?.name === 'AbortError') {
                    if (statusEl) statusEl.textContent = '';
                    return;
                }
                showError(err instanceof Error ? err.message : 'Scan failed.');
                if (statusEl) statusEl.textContent = '';
            } finally {
                stopScanningUI();
                btnProcess.disabled = !pendingImage;
                btnCapture.disabled = !mediaStream;
            }
        },
        { signal }
    );

    pendingImage = null;
    btnProcess.disabled = true;
    resultWrap.hidden = true;
    resultTableHost.replaceChildren();
    resultTableHost.hidden = true;
    resultPre.hidden = true;
    resultPre.textContent = '';
    resultMeta.textContent = '';
    showError('');

    void startCamera();
}
