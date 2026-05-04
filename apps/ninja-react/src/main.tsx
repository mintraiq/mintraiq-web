import { createRoot } from 'react-dom/client';
import { BudgetPlannerApp } from './BudgetPlannerApp';
import { ForecastApp } from './ForecastApp';
import { WeeklyPlannerApp } from './WeeklyPlannerApp';

const mount = document.getElementById('ninja-react-root');
const page = mount?.dataset.ninjaPage || 'budget-planner';

function Root() {
    if (page === 'forecast') return <ForecastApp />;
    if (page === 'weekly-planner') return <WeeklyPlannerApp />;
    return <BudgetPlannerApp />;
}

if (mount) {
    createRoot(mount).render(<Root />);
}
