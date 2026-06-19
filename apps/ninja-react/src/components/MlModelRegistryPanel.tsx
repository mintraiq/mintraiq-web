import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { fetchMlRegistry, triggerMlEvaluation, triggerMlTraining } from '../api/mlAdmin';
import type { MlModelStatus, MlTrainResponse } from '../schemas/mlAdmin';

const TRAIN_POLL_MS = 4000;
const TRAIN_POLL_DURATION_MS = 120_000;
const REGISTRY_POLL_MS = 60_000;

function formatMetricValue(key: string, value: unknown): string {
    if (value == null || value === '') return '—';
    if (typeof value === 'number') {
        if (key.includes('mae') || key.includes('rmse') || key === 'MAE' || key === 'RMSE') {
            return value.toFixed(2);
        }
        if (
            key.includes('accuracy') ||
            key.includes('confidence') ||
            key.includes('pct') ||
            key.includes('precision') ||
            key.includes('recall') ||
            key.includes('rate') ||
            key.includes('f1')
        ) {
            return value <= 1 ? `${(value * 100).toFixed(1)}%` : value.toFixed(2);
        }
        return String(value);
    }
    return String(value);
}

function labelizeMetric(key: string): string {
    return key.replace(/_/g, ' ');
}

function StatusBadge({ model }: { model: MlModelStatus }): JSX.Element {
    const tone =
        model.status === 'needs_training'
            ? 'rgba(255, 165, 0, 0.2)'
            : model.status === 'active'
              ? 'rgba(46, 213, 115, 0.18)'
              : 'rgba(148, 163, 184, 0.15)';
    const color =
        model.status === 'needs_training'
            ? '#fbbf24'
            : model.status === 'active'
              ? '#2ed573'
              : 'var(--text-secondary)';

    return (
        <span
            style={{
                display: 'inline-block',
                padding: '4px 10px',
                borderRadius: 999,
                background: tone,
                color,
                fontSize: '0.78rem',
                fontWeight: 600,
                textTransform: 'capitalize'
            }}
        >
            {model.status.replace(/_/g, ' ')}
        </span>
    );
}

function HealthBadge({ status }: { status?: MlModelStatus['health_status'] }): JSX.Element | null {
    if (!status) return null;

    const styles =
        status === 'HEALTHY'
            ? { background: 'rgba(46, 213, 115, 0.18)', color: '#2ed573' }
            : status === 'DEGRADED'
              ? { background: 'rgba(251, 191, 36, 0.18)', color: '#fbbf24' }
              : { background: 'rgba(148, 163, 184, 0.15)', color: 'var(--text-secondary)' };

    return (
        <span
            style={{
                display: 'inline-block',
                padding: '4px 10px',
                borderRadius: 999,
                fontSize: '0.78rem',
                fontWeight: 600,
                ...styles
            }}
        >
            {status === 'HEALTHY' ? 'Healthy' : status === 'DEGRADED' ? 'Needs attention' : 'Unknown health'}
        </span>
    );
}

function EvaluationMetricsGrid({ model }: { model: MlModelStatus }): JSX.Element {
    const metaKeys = new Set(['source', 'evaluated_at', 'status', 'per_category', 'problem_categories', 'eval_error']);
    const entries = model.evaluation_metrics.map((key) => ({
        key,
        value: model.evaluation[key]
    }));

    return (
        <div
            style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                gap: 10
            }}
        >
            {entries.map(({ key, value }) => (
                <Metric key={key} label={labelizeMetric(key)} value={formatMetricValue(key, value)} />
            ))}
            {!metaKeys.has('source') && model.evaluation.source ? (
                <Metric label="eval source" value={String(model.evaluation.source)} />
            ) : null}
        </div>
    );
}

function RecentRunsList({ model }: { model: MlModelStatus }): JSX.Element | null {
    const runs = model.recent_runs || [];
    if (!runs.length) return null;

    return (
        <details>
            <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Recent evaluation runs ({runs.length})</summary>
            <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
                {runs.map((run, index) => {
                    const primary = model.evaluation_metrics[0];
                    const value = primary ? run.metrics?.[primary] : null;
                    return (
                        <div
                            key={`${run.run_date || 'run'}-${index}`}
                            style={{
                                padding: '10px 12px',
                                borderRadius: 12,
                                background: 'rgba(255,255,255,0.03)',
                                border: '1px solid rgba(255,255,255,0.06)',
                                fontSize: '0.88rem'
                            }}
                        >
                            <strong>{run.run_date ? new Date(run.run_date).toLocaleString() : 'Unknown time'}</strong>
                            <span style={{ color: 'var(--text-secondary)' }}>
                                {' '}
                                · {run.status || 'UNKNOWN'} · {run.source || 'unknown source'}
                            </span>
                            {primary ? (
                                <div style={{ marginTop: 4, color: 'var(--text-secondary)' }}>
                                    {labelizeMetric(primary)}: {formatMetricValue(primary, value)}
                                </div>
                            ) : null}
                        </div>
                    );
                })}
            </div>
        </details>
    );
}

function trainSuccessMessage(data: MlTrainResponse): string {
    if (data.status === 'queued' || data.async) {
        return data.message || 'Training queued — refreshing registry until the job finishes.';
    }
    return `Training finished: ${data.trained ? 'published' : 'skipped'} — ${data.reason || 'done'}`;
}

function ModelCard({
    model,
    onTrainingQueued
}: {
    model: MlModelStatus;
    onTrainingQueued: () => void;
}): JSX.Element {
    const queryClient = useQueryClient();
    const train = useMutation({
        mutationFn: (force: boolean) => triggerMlTraining(model.model_id, force),
        onSuccess: (data) => {
            if (data.status === 'queued' || data.async) {
                onTrainingQueued();
            }
            void queryClient.invalidateQueries({ queryKey: ['ml-registry'] });
        }
    });
    const evaluate = useMutation({
        mutationFn: () => triggerMlEvaluation(model.model_id),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: ['ml-registry'] });
        }
    });

    const primaryMetric = model.evaluation_metrics[0];
    const primaryValue = primaryMetric ? model.evaluation[primaryMetric] : null;

    return (
        <article
            className="card"
            style={{
                padding: 20,
                display: 'grid',
                gap: 14,
                borderColor: model.needs_training ? 'rgba(251, 191, 36, 0.35)' : undefined
            }}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div>
                    <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{model.display_name}</h3>
                    <p style={{ margin: '6px 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                        {model.service} · {model.algorithm}
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <HealthBadge status={model.health_status} />
                    <StatusBadge model={model} />
                </div>
            </div>

            <p style={{ margin: 0, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{model.purpose}</p>

            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                    gap: 10
                }}
            >
                <Metric label="Scope" value={model.scope.replace(/_/g, ' ')} />
                <Metric label="Needs training" value={model.needs_training ? 'Yes' : 'No'} />
                <Metric
                    label={primaryMetric ? labelizeMetric(primaryMetric) : 'Primary metric'}
                    value={formatMetricValue(primaryMetric || '', primaryValue)}
                />
                <Metric
                    label="Dataset rows"
                    value={
                        model.dataset.labeled_rows != null
                            ? String(model.dataset.labeled_rows)
                            : model.min_training_samples != null
                              ? `min ${model.min_training_samples}`
                              : '—'
                    }
                />
                <Metric label="Registry version" value={model.registry.version || '—'} />
                <Metric label="Eval source" value={String(model.evaluation.source || '—')} />
            </div>

            <div>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>Evaluation metrics</div>
                <EvaluationMetricsGrid model={model} />
            </div>

            <RecentRunsList model={model} />

            <details>
                <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Training details</summary>
                <div style={{ marginTop: 12, display: 'grid', gap: 8, fontSize: '0.9rem' }}>
                    <Row label="Dataset" value={model.dataset_description} />
                    <Row
                        label="Training range"
                        value={`${model.min_training_samples ?? '—'} – ${model.max_training_samples ?? '∞'} samples`}
                    />
                    <Row label="Retrain policy" value={model.retrain_policy} />
                    <Row label="Decision" value={model.training_decision_reason} />
                    {model.dataset.unique_needs_review != null ? (
                        <Row
                            label="Review backlog"
                            value={`${model.dataset.unique_needs_review} unique (threshold ${model.dataset.retrain_review_threshold})`}
                        />
                    ) : null}
                    {model.last_training?.timestamp ? (
                        <Row
                            label="Last training"
                            value={`${model.last_training.timestamp} — ${model.last_training.reason || model.last_training.status}`}
                        />
                    ) : null}
                    {model.notes ? <Row label="Notes" value={model.notes} /> : null}
                </div>
            </details>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={evaluate.isPending}
                    onClick={() => evaluate.mutate()}
                >
                    {evaluate.isPending ? 'Evaluating…' : 'Refresh metrics'}
                </button>

                {model.trainable ? (
                    <>
                        <button
                            type="button"
                            className="btn btn-primary"
                            disabled={train.isPending || !(model.can_train_gated ?? model.needs_training)}
                            onClick={() => train.mutate(false)}
                        >
                            {train.isPending ? 'Queueing…' : 'Train if gated'}
                        </button>
                        <button
                            type="button"
                            className="btn btn-secondary"
                            disabled={train.isPending || !(model.can_force_train ?? model.trainable)}
                            onClick={() => {
                                if (window.confirm(`Force retrain ${model.display_name}?`)) {
                                    train.mutate(true);
                                }
                            }}
                        >
                            Force retrain
                        </button>
                    </>
                ) : (
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', alignSelf: 'center' }}>
                        Training not available for this model yet.
                    </span>
                )}
            </div>

            {evaluate.isError ? (
                <p style={{ margin: 0, color: '#ff6b6b' }}>{(evaluate.error as Error).message}</p>
            ) : null}
            {model.evaluation.eval_error ? (
                <p style={{ margin: 0, color: '#fbbf24', fontSize: '0.85rem' }}>
                    Eval note: {String(model.evaluation.eval_error)}
                </p>
            ) : null}
            {train.isError ? (
                <p style={{ margin: 0, color: '#ff6b6b' }}>{(train.error as Error).message}</p>
            ) : null}
            {train.isSuccess ? (
                <p style={{ margin: 0, color: '#2ed573' }}>{trainSuccessMessage(train.data)}</p>
            ) : null}
        </article>
    );
}

function Metric({ label, value }: { label: string; value: string }): JSX.Element {
    return (
        <div
            style={{
                padding: '10px 12px',
                borderRadius: 12,
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)'
            }}
        >
            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                {label}
            </div>
            <div style={{ marginTop: 4, fontWeight: 600 }}>{value}</div>
        </div>
    );
}

function Row({ label, value }: { label: string; value: string }): JSX.Element {
    return (
        <div>
            <strong>{label}: </strong>
            <span style={{ color: 'var(--text-secondary)' }}>{value}</span>
        </div>
    );
}

export function MlModelRegistryPanel(): JSX.Element {
    const [fastPollUntil, setFastPollUntil] = useState(0);
    const registry = useQuery({
        queryKey: ['ml-registry'],
        queryFn: fetchMlRegistry,
        refetchInterval: () => (Date.now() < fastPollUntil ? TRAIN_POLL_MS : REGISTRY_POLL_MS)
    });

    useEffect(() => {
        if (!fastPollUntil) return undefined;
        const timer = window.setTimeout(() => setFastPollUntil(0), Math.max(0, fastPollUntil - Date.now()));
        return () => window.clearTimeout(timer);
    }, [fastPollUntil]);

    const queueTrainingPoll = () => {
        setFastPollUntil(Date.now() + TRAIN_POLL_DURATION_MS);
    };

    if (registry.isPending) {
        return <div className="card" style={{ padding: 24 }}>Loading ML registry…</div>;
    }

    if (registry.isError) {
        return (
            <div className="card" style={{ padding: 24, borderColor: 'rgba(255,71,87,0.45)' }}>
                <strong>Could not load ML registry</strong>
                <p style={{ color: 'var(--text-secondary)', marginTop: 8 }}>{registry.error.message}</p>
            </div>
        );
    }

    const models = registry.data.models;
    const needsCount = models.filter((m) => m.needs_training).length;
    const degradedCount = models.filter((m) => m.health_status === 'DEGRADED').length;
    const isFastPolling = Date.now() < fastPollUntil;

    return (
        <div style={{ display: 'grid', gap: 16 }}>
            <div className="card" style={{ padding: 20 }}>
                <h2 style={{ margin: 0 }}>ML model registry</h2>
                <p style={{ margin: '8px 0 0', color: 'var(--text-secondary)' }}>
                    {models.length} models tracked · {needsCount} need training · {degradedCount} degraded · updated{' '}
                    {new Date(registry.data.generated_at).toLocaleString()}
                </p>
                {isFastPolling ? (
                    <p style={{ margin: '8px 0 0', color: '#2ed573', fontSize: '0.88rem' }}>
                        Refreshing every few seconds while background training runs…
                    </p>
                ) : null}
            </div>
            {models.map((model) => (
                <ModelCard key={model.model_id} model={model} onTrainingQueued={queueTrainingPoll} />
            ))}
        </div>
    );
}
