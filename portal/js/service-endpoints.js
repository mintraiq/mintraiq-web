/**
 * Canonical MintrAIQ service URLs — Firebase Hosting custom domains + fallbacks.
 * Custom domains are the production/staging targets; *.web.app URLs remain valid
 * until DNS is verified.
 */

/** @typedef {'production' | 'staging'} DeployEnv */

export const CUSTOM_DOMAINS = {
    production: {
        app: 'https://app.mintraiq.com',
        appApi: 'https://app.mintraiq.com/api',
        appDocs: 'https://app.mintraiq.com/api/docs',
        forecasting: 'https://forecasting.mintraiq.com',
        scanner: 'https://scanner.mintraiq.com',
        scannerOcr: 'https://scanner.mintraiq.com/ocr/scanner',
        agent: 'https://agent.mintraiq.com',
        survey: 'https://survey.mintraiq.com',
    },
    staging: {
        app: 'https://staging-app.mintraiq.com',
        appApi: 'https://staging-app.mintraiq.com/api',
        appDocs: 'https://staging-app.mintraiq.com/api/docs',
        forecasting: 'https://staging-forecasting.mintraiq.com',
        scanner: 'https://staging-scanner.mintraiq.com',
        scannerOcr: 'https://staging-scanner.mintraiq.com/ocr/scanner',
        agent: 'https://staging-agent.mintraiq.com',
        survey: 'https://staging-survey.mintraiq.com',
    },
};

/** Firebase Hosting site IDs and default URLs (GCP project mintraiq-production / mintraiq-staging). */
export const FIREBASE_HOSTING = {
    production: [
        {
            siteId: 'mintraiq-app-prod',
            webApp: 'https://mintraiq-app-prod.web.app',
            customDomain: CUSTOM_DOMAINS.production.app,
            backend: 'finance-ai-dashboard (Cloud Run)',
        },
        {
            siteId: 'mintraiq-forecasting-prod',
            webApp: 'https://mintraiq-forecasting-prod.web.app',
            customDomain: CUSTOM_DOMAINS.production.forecasting,
            backend: 'ai-forecasting-api (Cloud Run)',
        },
        {
            siteId: 'mintraiq-scanner-prod',
            webApp: 'https://mintraiq-scanner-prod.web.app',
            customDomain: CUSTOM_DOMAINS.production.scanner,
            backend: 'receipt-scanner-prod (Cloud Run)',
        },
        {
            siteId: 'mintraiq-agent-prod',
            webApp: 'https://mintraiq-agent-prod.web.app',
            customDomain: CUSTOM_DOMAINS.production.agent,
            backend: 'mintraiq-agent-service-api (Cloud Run)',
        },
        {
            siteId: 'mintraiq-survey-prod',
            webApp: 'https://mintraiq-survey-prod.web.app',
            customDomain: CUSTOM_DOMAINS.production.survey,
            backend: 'Survey SPA (mintraiq_lead_agent CD)',
        },
    ],
    staging: [
        {
            siteId: 'mintraiq-app-staging',
            webApp: 'https://mintraiq-app-staging.web.app',
            customDomain: CUSTOM_DOMAINS.staging.app,
            backend: 'finance-ai-dashboard (Cloud Run)',
        },
        {
            siteId: 'mintraiq-forecasting-staging',
            webApp: 'https://mintraiq-forecasting-staging.web.app',
            customDomain: CUSTOM_DOMAINS.staging.forecasting,
            backend: 'ai-forecasting-api (Cloud Run)',
        },
        {
            siteId: 'mintraiq-scanner-staging',
            webApp: 'https://mintraiq-scanner-staging.web.app',
            customDomain: CUSTOM_DOMAINS.staging.scanner,
            backend: 'receipt-scanner (Cloud Run)',
        },
        {
            siteId: 'mintraiq-agent-staging',
            webApp: 'https://mintraiq-agent-staging.web.app',
            customDomain: CUSTOM_DOMAINS.staging.agent,
            backend: 'mintraiq-agent-service-api (Cloud Run)',
        },
        {
            siteId: 'mintraiq-survey-staging',
            webApp: 'https://mintraiq-survey-staging.web.app',
            customDomain: CUSTOM_DOMAINS.staging.survey,
            backend: 'Survey SPA (mintraiq_lead_agent CD)',
        },
    ],
};

/**
 * @param {DeployEnv} env
 * @returns {typeof CUSTOM_DOMAINS.production}
 */
export function customDomainsFor(env) {
    return env === 'production' ? CUSTOM_DOMAINS.production : CUSTOM_DOMAINS.staging;
}
