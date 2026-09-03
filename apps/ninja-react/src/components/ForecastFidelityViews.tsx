import type { DashboardSample } from '../schemas/samples';

type Props = { data: DashboardSample };

/**
 * There is no bank aggregation (founder decision 13 Aug 2026), so no string
 * rendered here may offer or imply one — Fair Trading Act 1986 ss 9/10/13.
 *
 * The canonical wording lives in `portal/js/bank-sync-copy.js` and, across
 * repos, in `finance-ai-mobile/lib/bankSyncCopy.ts`. This embed cannot import
 * either (it bundles from `apps/ninja-react/src` only), so the strings are
 * restated here and `scripts/bank-sync-copy.test.mjs` asserts this file carries
 * no claim phrase.
 *
 * The API is the live source of the offending copy, not this file: it still
 * sends bank-feed wording for both the unlock CTA and the expansion prompt, so
 * server values are checked rather than painted.
 */
const BANK_SYNC_CLAIMS = [
    'connect your bank',
    'connect a bank',
    'connect my bank',
    'connect bank',
    'link your bank',
    'bank sync',
    'auto-sync',
    'akahu',
    'lifting a finger',
    // Sent by the API, not by mobile — see API_BANK_SYNC_CLAIMS in the portal
    // module. "Pair receipts with your bank feed" trips none of the above.
    'bank feed',
    'banking portal',
    'linked banking',
    'bank connection'
];

const BANK_SYNC_HREF = /settings-banks|bank[-_]?sync|akahu/i;

/** A server string, or the local fallback when it claims a bank connection. */
function safeCopy(value: string | undefined, fallback: string): string {
    if (!value || !value.trim()) return fallback;
    const haystack = value.toLowerCase();
    return BANK_SYNC_CLAIMS.some((claim) => haystack.includes(claim)) ? fallback : value;
}

/** A server href, or the local fallback when it points at a bank-connect page. */
function safeHref(value: string | undefined, fallback: string): string {
    if (!value || !value.trim()) return fallback;
    return BANK_SYNC_HREF.test(value) ? fallback : value;
}

function formatMoney(value?: number) {
    if (value == null || !Number.isFinite(value)) return '—';
    return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

export function LiteMinimumView({ data }: Props) {
    const hooks = data.influence_hooks;
    const monthly = data.monthly;
    const pct = hooks?.unlock_percentage ?? 0;

    return (
        <div className="card" style={{ marginBottom: 20, position: 'relative', overflow: 'hidden' }}>
            <div
                aria-hidden
                style={{
                    position: 'absolute',
                    inset: 0,
                    background:
                        'linear-gradient(135deg, rgba(30,30,36,.95), rgba(18,18,22,.98))',
                    filter: 'blur(0px)'
                }}
            />
            <div
                style={{
                    position: 'relative',
                    zIndex: 1,
                    padding: 24,
                    textAlign: 'center',
                    background: 'rgba(255,255,255,0.06)',
                    borderRadius: 16,
                    border: '1px solid rgba(0,255,157,0.25)'
                }}
            >
                <p style={{ color: 'var(--text-secondary)', marginBottom: 8 }}>
                    {hooks?.message ??
                        `Unlock your 12-month forecast. You have completed ${pct}% of your profile history tracker.`}
                </p>
                <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--accent-green)' }}>{pct}%</div>
                <a
                    className="btn-primary"
                    href={safeHref(hooks?.cta_href, './upload-statement.html')}
                    style={{ marginTop: 16, display: 'inline-block' }}
                >
                    {safeCopy(hooks?.cta_label, 'Upload a bank statement')}
                </a>
            </div>
            <div className="grid-container" style={{ marginTop: 16, position: 'relative', zIndex: 1 }}>
                <div className="card metric-card expense">
                    <div className="card-header"><span className="card-title">Avg. expense</span></div>
                    <div className="value">{formatMoney(monthly?.historical_avg_expense)}</div>
                </div>
                <div className="card metric-card income">
                    <div className="card-header"><span className="card-title">Avg. income</span></div>
                    <div className="value">{formatMoney(monthly?.historical_avg_income)}</div>
                </div>
            </div>
        </div>
    );
}

export function ReceiptOnlyView({ data }: Props) {
    const summary = data.receipt_summary;
    const prompt = data.expansion_prompt;

    return (
        <>
            <div className="grid-container" style={{ marginBottom: 20 }}>
                <div className="card metric-card">
                    <div className="card-header"><span className="card-title">Scanned (prev month)</span></div>
                    <div className="value">{summary?.scanned_count_previous_month ?? '—'}</div>
                </div>
                <div className="card metric-card expense">
                    <div className="card-header"><span className="card-title">Receipt spend</span></div>
                    <div className="value">{formatMoney(summary?.total_receipt_spend)}</div>
                </div>
                <div className="card metric-card savings">
                    <div className="card-header"><span className="card-title">Tax deductions</span></div>
                    <div className="value">{formatMoney(summary?.projected_tax_deductions)}</div>
                </div>
            </div>
            <div
                className="card"
                style={{
                    marginBottom: 20,
                    borderColor: 'rgba(47,128,237,0.45)',
                    background: 'rgba(47,128,237,0.08)'
                }}
            >
                <strong>{safeCopy(prompt?.title, 'Add a statement to unlock forecasts')}</strong>
                <p style={{ color: 'var(--text-secondary)', margin: '8px 0 12px' }}>
                    {safeCopy(prompt?.message, 'Import a bank statement or scan a receipt to start tracking spending.')}
                </p>
                <a className="btn-primary" href={safeHref(prompt?.cta_href, './upload-statement.html')}>
                    {safeCopy(prompt?.cta_label, 'Upload a bank statement')}
                </a>
            </div>
        </>
    );
}

const COLD_START_ACTIONS = [
    {
        id: 'upload_statement',
        title: 'Upload statement',
        description: 'Import a PDF or CSV bank statement.',
        cta_href: './upload-statement.html'
    },
    {
        id: 'scan_receipt',
        title: 'Scan a receipt',
        description: 'Snap a receipt photo for line-item detail.',
        cta_href: './receipt-scanner.html'
    }
] as const;

export function ColdStartView({ data }: Props) {
    const blocked = /settings-banks|connect.?bank/i;
    const fromApi = (data.onboarding_flows ?? []).filter(
        (f) => f.id !== 'connect_bank' && !blocked.test(String(f.cta_href ?? '')) && !blocked.test(String(f.title ?? ''))
    );
    const flows = fromApi.length >= 2 ? fromApi.slice(0, 2) : COLD_START_ACTIONS;
    return (
        <div className="card" style={{ marginBottom: 20 }}>
            <div className="card-header"><span className="card-title">Get started</span></div>
            <p style={{ color: 'var(--text-secondary)' }}>
                Add your first transactions to unlock charts, alerts, and AI insights.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginTop: 12 }}>
                {flows.map((flow) => (
                    <a
                        key={flow.id}
                        className="btn-primary"
                        href={flow.cta_href ?? './upload-statement.html'}
                        style={{ display: 'block', textAlign: 'left', padding: '16px 18px', lineHeight: 1.45 }}
                    >
                        <strong style={{ display: 'block', marginBottom: 6 }}>{flow.title}</strong>
                        <span style={{ fontSize: '0.88rem', opacity: 0.85, fontWeight: 400 }}>{flow.description}</span>
                    </a>
                ))}
            </div>
        </div>
    );
}
