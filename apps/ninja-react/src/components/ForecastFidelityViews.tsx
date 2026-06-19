import type { DashboardSample } from '../schemas/samples';

type Props = { data: DashboardSample };

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
                <a className="btn-primary" href={hooks?.cta_href ?? './upload-statement.html'} style={{ marginTop: 16, display: 'inline-block' }}>
                    {hooks?.cta_label ?? 'Drop Statement PDF or Connect Akahu Feed.'}
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
                <strong>{prompt?.title ?? 'Pair receipts with your bank feed'}</strong>
                <p style={{ color: 'var(--text-secondary)', margin: '8px 0 12px' }}>{prompt?.message}</p>
                <a className="btn-primary" href={prompt?.cta_href ?? './settings-banks.html'}>
                    {prompt?.cta_label ?? 'Connect bank account'}
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
