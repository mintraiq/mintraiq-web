import { useQuery } from '@tanstack/react-query';
import { fetchWeeklyPlanSample } from './api/samples';
import { queryKeys } from './queryKeys';

export function WeeklyPlannerApp(): JSX.Element {
    const {
        data,
        error,
        isPending
    } = useQuery({
        queryKey: queryKeys.samples.weeklyPlan(),
        queryFn: fetchWeeklyPlanSample,
    });

    if (error) {
        return (
            <div className="card" style={{ padding: 20, borderColor: 'rgba(255,71,87,0.45)' }}>
                <strong>Could not load sample</strong>
                <p style={{ color: 'var(--text-secondary)', marginTop: 8 }}>{String((error as Error).message)}</p>
            </div>
        );
    }
    if (isPending || !data) {
        return <p style={{ color: 'var(--text-secondary)' }}>Loading weekly planner…</p>;
    }

    const summaryEntries = data.summary ? Object.values(data.summary) : [];

    return (
        <div className="ninja-react-weekly">
            <p className="api-hint" style={{ marginBottom: 16 }}>
                Sample from <code>docs/samples/weekly_plan.json</code> (aligned with <code>legacy/templates/weeklyplanner.html</code> metrics).
            </p>

            {data.meta?.week_label && (
                <h3 style={{ margin: '0 0 16px', fontSize: '1.1rem', color: 'var(--text-secondary)' }}>{data.meta.week_label}</h3>
            )}

            {summaryEntries.length > 0 && (
                <div className="grid-container" style={{ marginBottom: 24 }}>
                    {summaryEntries.map((card, i) => (
                        <div key={i} className="card metric-card income">
                            <div className="card-header">
                                <span className="card-title">{card.label}</span>
                            </div>
                            <div className="value" style={{ fontSize: '1.35rem' }}>
                                {card.value}
                            </div>
                            {card.sublabel && <small style={{ color: 'var(--text-secondary)' }}>{card.sublabel}</small>}
                        </div>
                    ))}
                </div>
            )}

            {data.goal_progress && (
                <div className="card" style={{ marginBottom: 20 }}>
                    <div className="card-header">
                        <span className="card-title">Goal progress</span>
                    </div>
                    <p style={{ color: 'var(--text-secondary)', margin: '0 0 8px' }}>
                        {data.goal_progress.status_label} · Target {data.goal_progress.target_monthly} / achieved{' '}
                        {data.goal_progress.achieved_monthly?.toFixed?.(2) ?? data.goal_progress.achieved_monthly}
                    </p>
                    <div style={{ height: 8, borderRadius: 4, background: '#333', overflow: 'hidden' }}>
                        <div
                            style={{
                                width: `${Math.min(100, data.goal_progress.percentage ?? 0)}%`,
                                height: '100%',
                                background: 'var(--accent-green)',
                                transition: 'width 0.3s ease'
                            }}
                        />
                    </div>
                </div>
            )}

            {data.categories && data.categories.length > 0 && (
                <div className="card">
                    <div className="card-header">
                        <span className="card-title">Categories this week</span>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                        <table className="ninja-table">
                            <thead>
                                <tr>
                                    <th>Category</th>
                                    <th>Weekly</th>
                                    <th>Daily</th>
                                    <th>Badge</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.categories.map((c) => (
                                    <tr key={c.id}>
                                        <td>
                                            {c.emoji} {c.name}
                                        </td>
                                        <td>{c.weekly_budget}</td>
                                        <td>{c.daily_allowance}</td>
                                        <td>{c.badge?.label}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
