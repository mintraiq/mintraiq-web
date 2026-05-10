/**
 * Turbo Drive caches ES modules — top-level `main()` in page modules does not re-run on in-app navigation.
 * Re-dispatch workspace data loads on every `turbo:load` based on `body[data-portal-nav]`.
 */
import './portal-nav.js';

let workspaceAbort = null;
let scheduleTimer = 0;

async function runWorkspacePage() {
    workspaceAbort?.abort();
    const ac = new AbortController();
    workspaceAbort = ac;
    const signal = ac.signal;
    const nav = document.body?.getAttribute('data-portal-nav');

    try {
        if (nav === 'dashboard') {
            const m = await import('./dashboard-page.js');
            await m.bootDashboardPage({ signal });
        } else if (nav === 'budget-planner') {
            const m = await import('./budget-planner-page.js');
            await m.bootBudgetPlannerPage({ signal });
        } else if (nav === 'weekly-planner') {
            const m = await import('./weekly-planner-page.js');
            await m.bootWeeklyPlannerPage({ signal });
        } else if (nav === 'transactions') {
            const m = await import('./transactions-page.js');
            await m.bootTransactionsPage({ signal });
        } else if (nav === 'upload-statement') {
            const m = await import('./upload-statement-page.js');
            await m.bootUploadStatementPage({ signal });
        } else if (nav === 'receipt-scanner') {
            const m = await import('./receipt-scanner-page.js');
            await m.bootReceiptScannerPage({ signal });
        }
    } catch (e) {
        if (e?.name === 'AbortError') return;
        throw e;
    }
}

function scheduleWorkspaceBoot() {
    clearTimeout(scheduleTimer);
    scheduleTimer = window.setTimeout(() => {
        void runWorkspacePage();
    }, 10);
}

if (!window.__mintTurboWorkspaceBoot) {
    window.__mintTurboWorkspaceBoot = true;
    document.addEventListener('turbo:load', scheduleWorkspaceBoot);
    scheduleWorkspaceBoot();
}
