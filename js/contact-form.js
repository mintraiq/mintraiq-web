/**
 * Contact form → lead-capture API POST /contact.
 *
 * The submit button is never disabled. Disabling it until a background security
 * check is ready leaves a user staring at a dead control with no stated reason,
 * which is the most common keyboard and screen-reader trap in a form. Instead we
 * validate on submit and say what is wrong in words.
 */

const env = (typeof window !== 'undefined' && window.__MINTRAIQ_ENV__) || {};
const LEAD_API_BASE = (env.leadApiBase || '').replace(/\/+$/, '');
const TURNSTILE_SITE_KEY = env.turnstileSiteKey || '';
const MESSAGE_MAX = 2000;

const form = document.getElementById('contact-form');
const statusEl = document.getElementById('contact-status');
const successEl = document.getElementById('contact-success');
const submitButton = document.getElementById('contact-submit');
const messageField = document.getElementById('contact-message');
const counterEl = document.getElementById('message-counter');

let widgetId = null;
let hasAttemptedSubmit = false;
let pendingResolve = null;
let pendingReject = null;

const FIELDS = [
    { id: 'contact-reason', errorId: 'reason-error', message: 'Please choose what your message is about.' },
    { id: 'contact-name', errorId: 'name-error', message: 'Please tell us what to call you.' },
    { id: 'contact-email', errorId: 'email-error', message: 'Please enter your email address.' },
    { id: 'contact-message', errorId: 'message-error', message: 'Please tell us what happened.' }
];

function setStatus(text, isError) {
    if (!statusEl) return;
    statusEl.textContent = text || '';
    statusEl.classList.toggle('is-error', Boolean(isError));
}

function setFieldError(field, text) {
    const input = document.getElementById(field.id);
    const errorEl = document.getElementById(field.errorId);
    if (errorEl) errorEl.textContent = text || '';
    if (input) {
        if (text) {
            input.setAttribute('aria-invalid', 'true');
        } else {
            input.removeAttribute('aria-invalid');
        }
    }
}

function validate() {
    let firstInvalid = null;

    for (const field of FIELDS) {
        const input = document.getElementById(field.id);
        const value = (input?.value || '').trim();
        let error = '';

        if (!value) {
            error = field.message;
        } else if (field.id === 'contact-email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
            error = "That doesn't look like an email address. Check for a typo.";
        } else if (field.id === 'contact-message' && value.length > MESSAGE_MAX) {
            error = `That's over ${MESSAGE_MAX} characters. Please shorten it, or email ram@mintraiq.com.`;
        }

        setFieldError(field, error);
        if (error && !firstInvalid) firstInvalid = input;
    }

    if (firstInvalid) firstInvalid.focus();
    return !firstInvalid;
}

function requestCaptchaToken() {
    // Invisible Turnstile resolves through its callback, so execute() is wrapped
    // in a promise with a timeout — a challenge that never resolves must produce
    // words, not a spinner that runs forever.
    return new Promise((resolve, reject) => {
        if (!window.turnstile || widgetId === null) {
            reject(new Error('captcha-unavailable'));
            return;
        }
        const timer = setTimeout(() => reject(new Error('captcha-timeout')), 20000);
        window.turnstile.reset(widgetId);
        window.turnstile.execute(widgetId);
        pendingResolve = (token) => {
            clearTimeout(timer);
            resolve(token);
        };
        pendingReject = (reason) => {
            clearTimeout(timer);
            reject(new Error(reason));
        };
    });
}

function renderTurnstile() {
    if (!window.turnstile || !TURNSTILE_SITE_KEY) return;
    widgetId = window.turnstile.render('#turnstile-container', {
        sitekey: TURNSTILE_SITE_KEY,
        size: 'invisible',
        theme: 'dark',
        callback: (token) => pendingResolve && pendingResolve(token),
        'error-callback': () => pendingReject && pendingReject('captcha-failed'),
        'timeout-callback': () => pendingReject && pendingReject('captcha-timeout')
    });
}

function showSuccess(reference) {
    const referenceEl = document.getElementById('contact-reference-value');
    if (referenceEl) referenceEl.textContent = reference;
    form.hidden = true;
    successEl.hidden = false;
    successEl.setAttribute('tabindex', '-1');
    successEl.focus();
}

async function handleSubmit(event) {
    event.preventDefault();
    hasAttemptedSubmit = true;
    setStatus('');

    if (!validate()) return;

    if (!LEAD_API_BASE) {
        setStatus('The contact form is not available right now. Email ram@mintraiq.com and we will pick it up.', true);
        return;
    }

    submitButton.textContent = 'Sending…';
    setStatus('Sending your message…');

    let captchaToken;
    try {
        captchaToken = await requestCaptchaToken();
    } catch (error) {
        submitButton.textContent = 'Send message';
        setStatus(
            'We could not complete the security check. Refresh the page and try again, or email ram@mintraiq.com.',
            true
        );
        return;
    }

    try {
        const response = await fetch(`${LEAD_API_BASE}/contact`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                reason: document.getElementById('contact-reason').value,
                name: document.getElementById('contact-name').value.trim(),
                email: document.getElementById('contact-email').value.trim(),
                screen: document.getElementById('contact-screen').value.trim(),
                message: document.getElementById('contact-message').value.trim(),
                captcha_token: captchaToken,
                website: document.getElementById('contact-website').value
            })
        });

        if (response.status === 429) {
            setStatus(
                'That is a lot of messages in a short time. Please wait a little, or email ram@mintraiq.com.',
                true
            );
        } else if (response.status === 403) {
            setStatus(
                'The security check did not pass. Refresh the page and try again, or email ram@mintraiq.com.',
                true
            );
        } else if (!response.ok) {
            setStatus(
                'Something went wrong sending your message. Please try again, or email ram@mintraiq.com.',
                true
            );
        } else {
            const body = await response.json();
            showSuccess(body.reference);
            return;
        }
    } catch (error) {
        setStatus(
            'We could not reach MintrAIQ — check your connection and try again, or email ram@mintraiq.com.',
            true
        );
    }

    submitButton.textContent = 'Send message';
}

function wireCounter() {
    if (!messageField || !counterEl) return;
    const update = () => {
        counterEl.textContent = `${messageField.value.length}/${MESSAGE_MAX}`;
    };
    messageField.addEventListener('input', update);
    update();
}

function wireBlurValidation() {
    // Only after the first submit attempt: validating a field the moment someone
    // tabs out of it shouts at people who are still filling the form in.
    for (const field of FIELDS) {
        const input = document.getElementById(field.id);
        input?.addEventListener('blur', () => {
            if (hasAttemptedSubmit) validate();
        });
    }
}

if (form) {
    form.addEventListener('submit', handleSubmit);
    wireCounter();
    wireBlurValidation();

    if (window.turnstile) {
        renderTurnstile();
    } else {
        window.addEventListener('load', renderTurnstile, { once: true });
    }
}
