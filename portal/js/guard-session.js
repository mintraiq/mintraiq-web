import { createLogtoClient } from './logto-client.js';

/** Redirect to sign-in if not authenticated. Call at top of each protected page module. */
export async function guardSession() {
    const client = createLogtoClient();
    if (!(await client.isAuthenticated())) {
        window.location.replace(new URL('../index.html', import.meta.url).href);
        return false;
    }
    return true;
}
