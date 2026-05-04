import { useEffect, useState } from 'react';
import { fetchSampleJson } from './sample';

type CutRow = {
    original: number;
    suggested: number;
    cut_amount: number;
    cut_pct: number;
    impact_score: number;
};

type BudgetPayload = {
    meta?: { currency?: string; period?: string; generated_at?: string; engine_version?: string };
    summary?: {
        monthly_income?: number;
        current_savings?: number;
        savings_goal?: number;
        gap_to_close?: number;
        status?: string;
        total_savings_after_cuts?: number;
    };
    cuts?: Record<string, CutRow>;
    coach_advice?: string;
};

function fmtMoney(n: number | undefined, currency = 'NZD') {
    if (n == null || Number.isNaN(n)) return '—';
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(n);
}

export function BudgetPlannerApp() {
    const [data, setData] = useState<BudgetPayload | null>(null);
    const [err, setErr] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const j = (await fetchSampleJson('budget_plan.json')) as BudgetPayload;
                if (!cancelled) setData(j);
            } catch (e) {
                if (!cancelled) setErr(String((e as Error).message));
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    if (err) {
        return (
            <div className="card" style={{ padding: 20, borderColor: 'rgba(255,71,87,0.45)' }}>
                <strong>Could not load sample</strong>
                <p style={{ color: 'var(--text-secondary)', marginTop: 8 }}>{err}</p>
            </div>
        );
    }
    if (!data) {
        return <p style={{ color: 'var(--text-secondary)' }}>Loading budget planner…</p>;
    }

    const currency = data.meta?.currency || 'NZD';
    const cuts = data.cuts ? Object.entries(data.cuts).sort((a, b) => b[1].cut_amount - a[1].cut_amount) : [];

    return (
        <div className="ninja-react-budget">
            <p className="api-hint" style={{ marginBottom: 16 }}>
                Sample payload from <code>docs/samples/budget_plan.json</code>. Wire to FastAPI when ready (same shape as{' '}
                <code>legacy/templates/budgetplanner.html</code>).
            </p>

            {data.summary && (
                <div className="grid-container" style={{ marginBottom: 24 }}>
                    <div className="card metric-card income">
                        <div className="card-header">
                            <span className="card-title">Monthly income</span>
                        </div>
                        <div className="value">{fmtMoney(data.summary.monthly_income, currency)}</div>
                    </div>
                    <div className="card metric-card savings">
                        <div className="card-header">
                            <span className="card-title">Current savings</span>
                        </div>
                        <div className="value">{fmtMoney(data.summary.current_savings, currency)}</div>
                    </div>
                    <div className="card metric-card expense">
                        <div className="card-header">
                            <span className="card-title">Savings goal</span>
                        </div>
                        <div className="value">{fmtMoney(data.summary.savings_goal, currency)}</div>
                    </div>
                    <div className="card alert-card">
                        <div className="card-header">
                            <span className="card-title" style={{ color: 'var(--accent-red)' }}>
                                Gap to close
                            </span>
                        </div>
                        <div className="value" style={{ color: 'var(--accent-red)' }}>
                            {fmtMoney(data.summary.gap_to_close, currency)}
                        </div>
                        <small style={{ color: 'var(--text-secondary)' }}>{data.summary.status}</small>
                    </div>
                </div>
            )}

            <div className="card" style={{ marginBottom: 20 }}>
                <div className="card-header">
                    <span className="card-title">Suggested cuts by category</span>
                </div>
                <div style={{ overflowX: 'auto', maxHeight: 480, overflowY: 'auto' }}>
                    <table className="ninja-table">
                        <thead>
                            <tr>
                                <th>Category</th>
                                <th className="align-right">Was</th>
                                <th className="align-right">Suggested</th>
                                <th className="align-right">Cut</th>
                                <th className="align-right">%</th>
                            </tr>
                        </thead>
                        <tbody>
                            {cuts.map(([name, row]) => (
                                <tr key={name}>
                                    <td>{name}</td>
                                    <td className="align-right">{fmtMoney(row.original, currency)}</td>
                                    <td className="align-right">{fmtMoney(row.suggested, currency)}</td>
                                    <td className="align-right">{fmtMoney(row.cut_amount, currency)}</td>
                                    <td className="align-right">{row.cut_pct.toFixed(1)}%</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {data.coach_advice && (
                <div className="card ai-card">
                    <div className="card-header" style={{ color: 'var(--accent-purple)' }}>
                        <span className="card-title" style={{ color: 'inherit' }}>
                            <i className="fas fa-robot" aria-hidden /> Coach advice
                        </span>
                    </div>
                    <div style={{ color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>{data.coach_advice}</div>
                </div>
            )}
        </div>
    );
}
