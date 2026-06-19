import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRoot } from 'react-dom/client';
import './styles/tailwind.css';
import { AiDisclaimer } from './AiDisclaimer';
import { BudgetPlannerApp } from './BudgetPlannerApp';
import { ForecastAnalyticsApp } from './ForecastAnalyticsApp';
import { ForecastApp } from './ForecastApp';
import { MlAdminApp } from './MlAdminApp';
import { WeeklyPlannerApp } from './WeeklyPlannerApp';
import { WidgetErrorBoundary } from './WidgetErrorBoundary';

const mount = document.getElementById('ninja-react-root');
const page = mount?.dataset.ninjaPage || 'budget-planner';

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 60_000,
            retry: 1
        }
    }
});

function Root(): JSX.Element {
    if (page === 'forecast') return <ForecastApp />;
    if (page === 'dashboard-analytics') return <ForecastAnalyticsApp />;
    if (page === 'ml-admin') return <MlAdminApp />;
    if (page === 'weekly-planner') return <WeeklyPlannerApp />;
    return <BudgetPlannerApp />;
}

function App(): JSX.Element {
    return (
        <QueryClientProvider client={queryClient}>
            <WidgetErrorBoundary>
                <Root />
                <AiDisclaimer />
            </WidgetErrorBoundary>
        </QueryClientProvider>
    );
}

if (mount && mount.dataset.ninjaReactMounted !== '1') {
    mount.dataset.ninjaReactMounted = '1';
    createRoot(mount).render(<App />);
}
