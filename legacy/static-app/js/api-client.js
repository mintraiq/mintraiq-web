/**
 * Browser client for Flask expense_loader (session cookie: ninja_access_token).
 * Base URL: config/runtime-env.js → legacyFlaskBase (or optional window.__APP_API_BASE__).
 */
(function () {
    'use strict';

    function base() {
        var e = window.__MINTRAIQ_ENV__ || {};
        return (e.legacyFlaskBase || window.__APP_API_BASE__ || 'http://127.0.0.1:5000').replace(/\/$/, '');
    }

    window.getLegacyFlaskBase = base;

    function joinUrl(endpoint) {
        if (!endpoint) return base();
        if (/^https?:\/\//i.test(endpoint)) return endpoint;
        const path = endpoint.startsWith('/') ? endpoint : '/' + endpoint;
        return base() + path;
    }

    /**
     * Remap legacy virtual paths (from Jinja layout / static-flask) to expense_loader routes.
     */
    function remapRequest(endpoint, method, body) {
        var m = method || 'GET';
        var ep = endpoint;
        var b = body;

        if (ep === '/api/generate' && m === 'POST') {
            return { url: joinUrl('/generate1'), method: 'GET', body: null };
        }
        if (ep === '/api/transactions') {
            return {
                url: joinUrl('/list/monthly_expenses') + '?draw=1&start=0&length=2000',
                method: 'GET',
                body: null
            };
        }
        if (ep === '/api/financial-score' && m === 'POST') {
            return { url: joinUrl('/financial-score'), method: 'POST', body: b };
        }

        return { url: joinUrl(ep), method: m, body: b };
    }

    window.fetchSecureAPI = async function (endpoint, method, body, isRetry) {
        var mapped = remapRequest(endpoint, method, body);
        var headers = { Accept: 'application/json' };
        if (mapped.method !== 'GET' && mapped.method !== 'HEAD') {
            headers['Content-Type'] = 'application/json';
        }
        var options = {
            method: mapped.method,
            headers: headers,
            credentials: 'include'
        };

        if (mapped.body != null && (mapped.method === 'POST' || mapped.method === 'PUT' || mapped.method === 'PATCH')) {
            options.body = JSON.stringify(mapped.body);
        }

        try {
            var response = await fetch(mapped.url, options);

            if (response.status === 401 && !isRetry) {
                var refreshResponse = await fetch(joinUrl('/auth/refresh'), {
                    method: 'POST',
                    credentials: 'include'
                });
                if (refreshResponse.ok) {
                    return await window.fetchSecureAPI(endpoint, method, body, true);
                }
                window.location.href = joinUrl('/login');
                return null;
            }

            if (response.status === 403) {
                try {
                    await response.json();
                } catch (e) { /* ignore */ }
                window.location.href = joinUrl('/profile?upgrade_required=true');
                return null;
            }

            var ct = response.headers.get('content-type') || '';
            if (!ct.includes('application/json')) {
                var text = await response.text();
                if (!response.ok) {
                    throw new Error(text.slice(0, 200) || response.statusText);
                }
                try {
                    return JSON.parse(text);
                } catch (e) {
                    throw new Error('Expected JSON from ' + mapped.url + ' — got: ' + text.slice(0, 80));
                }
            }

            if (!response.ok) {
                var errJson = await response.json().catch(function () {
                    return {};
                });
                throw new Error(errJson.message || errJson.detail || 'API Error: ' + response.status);
            }

            return await response.json();
        } catch (err) {
            console.error('fetchSecureAPI', mapped.url, err);
            throw err;
        }
    };

    /** Plain JSON fetch (no remaps). Path is relative to __APP_API_BASE__. */
    window.appFetchJson = async function (path, opts) {
        opts = opts || {};
        var url = joinUrl(path);
        var headers = Object.assign({ Accept: 'application/json' }, opts.headers || {});
        if (opts.body && typeof opts.body === 'object' && !(opts.body instanceof FormData)) {
            headers['Content-Type'] = 'application/json';
            opts = Object.assign({}, opts, { body: JSON.stringify(opts.body) });
        }
        var res = await fetch(url, Object.assign({ credentials: 'include' }, opts, { headers: headers }));
        if (!res.ok) throw new Error((await res.text()).slice(0, 200));
        var ct = res.headers.get('content-type') || '';
        if (ct.includes('application/json')) return res.json();
        return res.text();
    };
})();
