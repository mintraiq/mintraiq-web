// portal/js/logto-client.js
//
// Auth client wrapper. Migrated from the Logto Browser SDK to Supabase Auth.
// The file name and all exported function names are preserved so the existing
// call sites (index.js, join.js, callback.js, shell.js, profile.js,
// settings-profile.js, bootstrap.js) keep working with minimal changes.
//
// `createLogtoClient()` now returns a small adapter object that exposes the same
// methods the call sites used on the Logto client (isAuthenticated, signIn,
// handleSignInCallback, getAccessToken, getIdTokenClaims, signOut). On the web
// we let supabase-js own the session (localStorage + auto-refresh) — unlike
// mobile, where the tokenManager owns it.
//
// --- Logto (legacy — retained for rollback) ---
// import { LogtoClient } from '../auth.js';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { CONFIG } from './config.js';
import { getSignInRedirectUri } from './config.js';
import { clearLegalContentState } from './legal-store.js';

let supabase = null;
let sharedClient = null;
const SENSITIVE_SESSION_PREFIXES = ['mintraiq_settings_workflow_draft_v1', 'mintraiq_settings_workflow_mode_v1'];

/** Lazily create the singleton supabase-js client. */
function getSupabase() {
    if (supabase) return supabase;
    supabase = createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey, {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: false, // callback.js calls handleSignInCallback() explicitly
            flowType: 'pkce',
        },
    });
    return supabase;
}

export function resetLogtoClient() {
    sharedClient = null;
}

/**
 * Remove the Supabase session + PKCE artifacts from local/session storage.
 * Required after an invalid refresh token or before a clean re-login; otherwise
 * isAuthenticated() can stay true on a dead session and the app loops.
 * (supabase-js persists under `sb-<ref>-auth-token` and related `sb-*` keys.)
 */
export function clearLogtoBrowserStorage() {
    if (typeof window === 'undefined') return;
    for (const store of [localStorage, sessionStorage]) {
        for (let i = store.length - 1; i >= 0; i -= 1) {
            const k = store.key(i);
            if (k && k.startsWith('sb-')) store.removeItem(k);
        }
    }
}

/**
 * Clears only the in-flight OAuth/PKCE artifacts (the code verifier). Stale
 * values here can break a retried sign-in; clearing them lets a fresh flow start.
 */
export function clearPendingLogtoOAuthSession() {
    if (typeof window === 'undefined') return;
    for (const store of [localStorage, sessionStorage]) {
        for (let i = store.length - 1; i >= 0; i -= 1) {
            const k = store.key(i);
            if (k && k.startsWith('sb-') && k.includes('code-verifier')) store.removeItem(k);
        }
    }
}

/** Full client-side auth wipe for re-login / recovery (Supabase keys + MintrAIQ session + singleton). */
export function purgeAuthForRelogin() {
    clearLogtoBrowserStorage();
    resetLogtoClient();
    clearClientSessionArtifacts();
}

/**
 * Returns the auth adapter (Logto-compatible surface, backed by Supabase).
 * Singleton per page load.
 */
export function createLogtoClient() {
    if (sharedClient) return sharedClient;
    const sb = getSupabase();

    sharedClient = {
        /** True when a Supabase session exists (supabase-js auto-refreshes it). */
        async isAuthenticated() {
            const { data } = await sb.auth.getSession();
            return Boolean(data?.session);
        },

        /**
         * Start OAuth sign-in. Accepts either a redirect URI string (legacy Logto
         * call shape) or an options object. Supabase requires an explicit provider
         * (no unified hosted page) — defaults to 'google'; pass { provider: 'apple' }.
         */
        async signIn(opts) {
            const redirectTo =
                (typeof opts === 'string' ? opts : opts && opts.redirectUri) || getSignInRedirectUri();
            const provider = (opts && typeof opts === 'object' && opts.provider) || 'google';
            const { data, error } = await sb.auth.signInWithOAuth({
                provider,
                options: { redirectTo, skipBrowserRedirect: true },
            });
            if (error) throw error;
            if (data && data.url) window.location.assign(data.url);
        },

        /** Email/password sign-in (feature-flagged). Returns the supabase data on success. */
        async signInWithPassword(email, password) {
            const { data, error } = await sb.auth.signInWithPassword({ email, password });
            if (error) throw error;
            return data;
        },

        /** Email/password sign-up (feature-flagged). `data.session` is null when email confirmation is required. */
        async signUpWithPassword(email, password) {
            const { data, error } = await sb.auth.signUp({ email, password });
            if (error) throw error;
            return data;
        },

        /** Passwordless: email the user a one-time code / magic link. Creates the user if new. */
        async signInWithOtp(email) {
            const { error } = await sb.auth.signInWithOtp({
                email,
                options: { shouldCreateUser: true },
            });
            if (error) throw error;
        },

        /** Passwordless: verify the emailed 6-digit code and establish the session. */
        async verifyOtp(email, token) {
            const { data, error } = await sb.auth.verifyOtp({ email, token, type: 'email' });
            if (error) throw error;
            return data;
        },

        /** Complete the PKCE flow from the callback URL (?code=...). */
        async handleSignInCallback(url) {
            const code = new URL(url).searchParams.get('code');
            if (!code) throw new Error('Sign-in callback is missing the authorization code.');
            const { error } = await sb.auth.exchangeCodeForSession(code);
            if (error) throw error;
        },

        /** Current access token (Supabase JWT). `resource` is ignored — Supabase tokens are not resource-scoped. */
        async getAccessToken(_resource) {
            const { data, error } = await sb.auth.getSession();
            if (error || !data?.session?.access_token) {
                throw new Error('No active session.');
            }
            return data.session.access_token;
        },

        /** Identity claims used by bootstrap.js (email + display name). */
        async getIdTokenClaims() {
            const { data, error } = await sb.auth.getUser();
            const user = data?.user;
            if (error || !user) throw new Error('No authenticated user.');
            const m = user.user_metadata || {};
            return {
                sub: user.id,
                email: user.email ?? m.email ?? '',
                name: m.full_name ?? m.name ?? '',
                username: m.user_name ?? m.preferred_username ?? '',
                preferred_username: m.preferred_username ?? '',
            };
        },

        /** Sign out and redirect to the post-logout URL. */
        async signOut(postLogout) {
            try {
                await sb.auth.signOut();
            } finally {
                clearClientSessionArtifacts();
                if (postLogout) window.location.replace(postLogout);
            }
        },
    };
    return sharedClient;
}

/** Recognise a dead-session / bad-refresh-token error so callers can force re-login. */
export function isInvalidGrantError(error) {
    const s = String((error && (error.message || error.error || error.code)) || '').toLowerCase();
    return (
        s.includes('invalid grant') ||
        s.includes('invalid_grant') ||
        s.includes('refresh token') ||
        s.includes('refresh_token') ||
        s.includes('jwt expired') ||
        s.includes('session') && s.includes('missing')
    );
}

export function redirectToSignIn(reason = 'invalid-grant') {
    purgeAuthForRelogin();
    const url = new URL('../index.html', import.meta.url);
    url.searchParams.set('reauth', '1');
    url.searchParams.set('reason', reason);
    window.location.replace(url.href);
}

export function clearClientSessionArtifacts() {
    sessionStorage.removeItem('mintraiq_bootstrap');
    clearLegalContentState();
    for (let i = sessionStorage.length - 1; i >= 0; i -= 1) {
        const key = sessionStorage.key(i);
        if (!key) continue;
        if (SENSITIVE_SESSION_PREFIXES.some((prefix) => key.startsWith(prefix))) {
            sessionStorage.removeItem(key);
        }
    }
}

export async function getAccessTokenOrReauth(authClient, resource) {
    try {
        return await authClient.getAccessToken(resource);
    } catch (e) {
        if (isInvalidGrantError(e)) {
            redirectToSignIn('invalid-grant');
        }
        throw e;
    }
}
