import { z } from 'zod';

const mlEvalRunSchema = z.object({
    run_date: z.string().nullable().optional(),
    metrics: z.record(z.unknown()).nullish(),
    status: z.string().nullable().optional(),
    source: z.string().nullable().optional()
});

const mlHealthStatusSchema = z.preprocess(
    (value) =>
        value === 'HEALTHY' || value === 'DEGRADED' || value === 'UNKNOWN' ? value : 'UNKNOWN',
    z.enum(['HEALTHY', 'DEGRADED', 'UNKNOWN'])
);

export const mlModelStatusSchema = z.object({
    model_id: z.string(),
    display_name: z.string(),
    service: z.string(),
    algorithm: z.string(),
    purpose: z.string(),
    scope: z.enum(['global', 'per_user', 'on_demand']),
    trainable: z.boolean(),
    evaluation_metrics: z.array(z.string()),
    dataset_description: z.string(),
    min_training_samples: z.number().nullable(),
    max_training_samples: z.number().nullable(),
    retrain_policy: z.string(),
    confidence_field: z.string().nullable().optional(),
    notes: z.string().optional(),
    status: z.string(),
    needs_training: z.boolean(),
    training_decision_reason: z.string(),
    health_status: mlHealthStatusSchema.optional(),
    dataset: z.object({
        labeled_rows: z.number().nullable(),
        unique_labeled_descriptions: z.number().nullable(),
        unique_needs_review: z.number().nullable(),
        min_required: z.number().nullable(),
        bootstrap_min_unique: z.number().nullable(),
        retrain_review_threshold: z.number().nullable()
    }),
    registry: z.object({
        version: z.string().nullable().optional(),
        published_at: z.string().nullable().optional(),
        blob_path: z.string().nullable().optional()
    }),
    evaluation: z.record(z.unknown()),
    recent_runs: z.array(mlEvalRunSchema).optional(),
    mongo_config: z
        .object({
            created_at: z.string().nullable().optional(),
            updated_at: z.string().nullable().optional(),
            trainable_via_admin: z.boolean().optional()
        })
        .optional(),
    can_train_gated: z.boolean().optional(),
    can_force_train: z.boolean().optional(),
    last_training: z
        .object({
            timestamp: z.string().nullable().optional(),
            status: z.string().nullable().optional(),
            trained: z.boolean().nullable().optional(),
            reason: z.string().nullable().optional(),
            metrics: z.record(z.unknown()).nullish()
        })
        .nullable()
        .optional()
});

export const mlRegistryResponseSchema = z.object({
    generated_at: z.string(),
    models: z.array(mlModelStatusSchema)
});

export const mlAccessSchema = z.object({
    allowed: z.boolean(),
    required_roles: z.array(z.string())
});

export const mlTrainResponseSchema = z.object({
    model_id: z.string(),
    status: z.string().optional(),
    async: z.boolean().optional(),
    force: z.boolean().optional(),
    triggered_by: z.string().nullable().optional(),
    message: z.string().optional(),
    trained: z.boolean().optional(),
    reason: z.string().optional()
});

export type MlModelStatus = z.infer<typeof mlModelStatusSchema>;
export type MlRegistryResponse = z.infer<typeof mlRegistryResponseSchema>;
export type MlTrainResponse = z.infer<typeof mlTrainResponseSchema>;
