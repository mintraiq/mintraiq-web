/**
 * Cross-state harness for error cards and user interaction modals.
 * URL: modal-states-harness.html?state=error-modal|load-error|review-modal|enquire-modal
 */

const MODAL_COPY = {
    'error-modal': {
        title: 'Review could not be saved',
        body: 'Category update failed (422). Check your session and try again.',
        showError: false
    },
    'load-error': {
        title: '',
        body: '',
        showError: true,
        errorText: 'Request failed (503): dashboard temporarily unavailable'
    },
    'review-modal': {
        title: 'Review transaction',
        body: 'Assign a category to improve future tracking.',
        showError: false
    },
    'enquire-modal': {
        title: 'Transaction enrichment',
        body: 'Fetching merchant details from Akahu…',
        showError: false
    }
};

const params = new URLSearchParams(window.location.search);
const state = params.get('state') || 'full';
const modeEl = document.getElementById('harnessMode');
const errEl = document.getElementById('harnessError');
const errorCard = document.getElementById('stateErrorCard');
const modal = document.getElementById('stateModal');
const modalTitle = document.getElementById('stateModalTitle');
const modalBody = document.getElementById('stateModalBody');

function hideModal() {
    if (modal) modal.hidden = true;
}

document.getElementById('stateModalDismiss')?.addEventListener('click', hideModal);
document.getElementById('stateModalConfirm')?.addEventListener('click', hideModal);

try {
    if (modeEl) modeEl.textContent = `state=${state}`;

    const modalSpec = MODAL_COPY[state];
    if (!modalSpec) {
        throw new Error(`Unknown state: ${state}`);
    }
    if (modalSpec.showError && errorCard) {
        errorCard.hidden = false;
        errorCard.textContent = modalSpec.errorText;
    }
    if (modalSpec.title && modal) {
        modal.hidden = false;
        if (modalTitle) modalTitle.textContent = modalSpec.title;
        if (modalBody) modalBody.textContent = modalSpec.body;
    }
    document.body.dataset.harnessReady = 'true';
} catch (err) {
    if (errEl) {
        errEl.hidden = false;
        errEl.textContent = String(err?.message || err);
    }
    document.body.dataset.harnessReady = 'error';
    throw err;
}
