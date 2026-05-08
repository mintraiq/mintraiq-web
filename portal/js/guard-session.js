import { createLogtoClient } from './logto-client.js';
import { loadLegalContent } from './legal-store.js';

/** Redirect to sign-in if not authenticated. Call at top of each protected page module. */
export async function guardSession() {
    const client = createLogtoClient();
    if (!(await client.isAuthenticated())) {
        window.location.replace(new URL('../index.html', import.meta.url).href);
        return false;
    }
    loadLegalContent(client).catch(() => {
        // Avoid blocking page UX on legal-content fetch issues.
    });
    return true;
}
