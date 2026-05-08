import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';
import { fetchDashboardSample } from './api/samples';
import { queryKeys } from './queryKeys';

Chart.register(...registerables);

export function ForecastApp(): JSX.Element {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const chartRef = useRef<Chart | null>(null);

    const {
        data,
        error,
        isPending
    } = useQuery({
        queryKey: queryKeys.samples.dashboard(),
        queryFn: fetchDashboardSample,
    });

    useEffect(() => {
        if (!data?.forecast?.future_dates || !data.forecast.future || !canvasRef.current) return;
        chartRef.current?.destroy();
        const ctx = canvasRef.current.getContext('2d');
        if (!ctx) return;
        chartRef.current = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.forecast.future_dates,
                datasets: [
                    {
                        label: 'Projected spend',
                        data: data.forecast.future,
                        borderColor: '#00ff9d',
                        backgroundColor: 'rgba(0,255,157,0.12)',
                        tension: 0.25,
                        fill: true
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { labels: { color: '#a0a0a0' } } },
                scales: {
                    x: { ticks: { color: '#a0a0a0' }, grid: { color: '#333' } },
                    y: { ticks: { color: '#a0a0a0' }, grid: { color: '#333' } }
                }
            }
        });
        return () => {
            chartRef.current?.destroy();
            chartRef.current = null;
        };
    }, [data]);

    if (error) {
        return (
            <div className="card" style={{ padding: 20, borderColor: 'rgba(255,71,87,0.45)' }}>
                <strong>Could not load sample</strong>
                <p style={{ color: 'var(--text-secondary)', marginTop: 8 }}>{String((error as Error).message)}</p>
            </div>
        );
    }
    if (isPending || !data) {
        return <p style={{ color: 'var(--text-secondary)' }}>Loading forecast…</p>;
    }

    const m = data.monthly;

    return (
        <div className="ninja-react-forecast">
            <p className="api-hint" style={{ marginBottom: 16 }}>
                Chart + metrics from <code>docs/samples/dashboard.json</code> (replaces Plotly iframe from{' '}
                <code>legacy/templates/forecast.html</code>).
            </p>

            <div className="grid-container" style={{ marginBottom: 20 }}>
                <div className="card metric-card expense">
                    <div className="card-header">
                        <span className="card-title">Predicted expense</span>
                    </div>
                    <div className="value">{m?.predicted_expense?.toLocaleString() ?? '—'}</div>
                </div>
                <div className="card metric-card income">
                    <div className="card-header">
                        <span className="card-title">Predicted income</span>
                    </div>
                    <div className="value">{m?.predicted_income?.toLocaleString() ?? '—'}</div>
                </div>
                <div className="card metric-card savings">
                    <div className="card-header">
                        <span className="card-title">Predicted savings</span>
                    </div>
                    <div className="value">{m?.predicted_savings?.toLocaleString() ?? '—'}</div>
                </div>
                <div className="card">
                    <div className="card-header">
                        <span className="card-title">Risk</span>
                    </div>
                    <div className="value" style={{ fontSize: '1.2rem' }}>
                        {data.risk?.level ?? '—'}
                    </div>
                    <small style={{ color: 'var(--text-secondary)' }}>Score: {data.risk?.score ?? '—'}</small>
                </div>
            </div>

            <div className="card" style={{ marginBottom: 20 }}>
                <div className="card-header">
                    <span className="card-title">Spending trajectory</span>
                </div>
                <div className="chart-container" style={{ height: 280 }}>
                    <canvas ref={canvasRef} />
                </div>
            </div>

            {data.explanations && data.explanations.length > 0 && (
                <div className="card" style={{ marginBottom: 16 }}>
                    <div className="card-header">
                        <span className="card-title">Explanations</span>
                    </div>
                    <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                        {data.explanations.map((t, i) => (
                            <li key={i}>{t}</li>
                        ))}
                    </ul>
                </div>
            )}

            {data.recommendations && data.recommendations.length > 0 && (
                <div className="card">
                    <div className="card-header">
                        <span className="card-title">Recommendations</span>
                    </div>
                    <ul className="recommendation-list" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                        {data.recommendations.map((r, i) => (
                            <li key={i} className="rec-item" style={{ marginBottom: 12 }}>
                                <strong style={{ color: 'var(--accent-purple)' }}>{r.title}</strong>
                                <span style={{ marginLeft: 8, fontSize: '0.8rem', color: 'var(--accent-red)' }}>{r.severity}</span>
                                <p style={{ color: 'var(--text-secondary)', margin: '6px 0 0', fontSize: '0.92rem' }}>{r.description}</p>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}
