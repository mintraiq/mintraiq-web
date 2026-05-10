import { guardSession } from './guard-session.js';
import { createLogtoClient } from './logto-client.js';
import { financeApiFetch } from './api.js';

/** @type {MediaStream | null} */
let mediaStream = null;
/** @type {Blob | File | null} */
let pendingImage = null;

function formatApiError(data, status) {
    const d = data?.detail;
    if (typeof d === 'string') return d;
    if (Array.isArray(d)) return d.map((x) => (typeof x?.msg === 'string' ? x.msg : JSON.stringify(x))).join('; ');
    if (data?.message) return String(data.message);
    return `Request failed (${status})`;
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
    const resultPre = document.getElementById('rsResultJson');
    const resultMeta = document.getElementById('rsResultMeta');

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

    signal?.addEventListener('abort', () => stopCamera(video));

    document.addEventListener(
        'turbo:before-cache',
        () => {
            if (document.body?.getAttribute('data-portal-nav') !== 'receipt-scanner') return;
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
            const fd = new FormData();
            const name = blob instanceof File && blob.name ? blob.name : 'receipt-capture.jpg';
            fd.append('file', blob, name);

            showError('');
            btnProcess.disabled = true;
            btnCapture.disabled = true;
            if (statusEl) statusEl.textContent = 'Sending to AI…';

            try {
                const res = await financeApiFetch(client, '/receipt-scanner', {
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
                    throw new Error(data.message || 'Scan did not complete successfully.');
                }

                const scanned = data.scanned != null ? data.scanned : data;
                let pretty;
                try {
                    pretty = JSON.stringify(scanned, null, 2);
                } catch {
                    pretty = String(scanned);
                }
                resultPre.textContent = pretty;
                const ins = data.inserted_id != null ? String(data.inserted_id) : '';
                resultMeta.textContent = ins
                    ? `Stored with id ${ins}. Raw OCR payload below.`
                    : 'Extracted payload below.';
                resultWrap.hidden = false;
                resultPre.focus();
                if (statusEl) statusEl.textContent = 'Scan complete.';
            } catch (err) {
                if (err?.name === 'AbortError') return;
                showError(err instanceof Error ? err.message : 'Scan failed.');
                if (statusEl) statusEl.textContent = '';
            } finally {
                btnProcess.disabled = !pendingImage;
                btnCapture.disabled = !mediaStream;
            }
        },
        { signal }
    );

    pendingImage = null;
    btnProcess.disabled = true;
    resultWrap.hidden = true;
    resultPre.textContent = '';
    resultMeta.textContent = '';
    showError('');

    void startCamera();
}
