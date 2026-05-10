import { isBootstrapOnboardingComplete } from './config.js';
import './settings-workflow.js';

/**
 * Settings nav — grouped chapter stepper + section sub-tabs + Legal in footer.
 * body[data-settings-nav] = profile | billing | security | goals | banks | categories | notifications | ai | legal
 */
function escapeAttr(s) {
    return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

function escapeHtml(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function readBootstrap() {
    const raw = sessionStorage.getItem('mintraiq_bootstrap');
    if (!raw) return null;
    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

/** Three chapters: Essentials → Data → Game plan (Legal sits outside the flow). */
const CHAPTERS = [
    {
        id: 'essentials',
        label: 'The Essentials',
        summary: 'Profile, plan & security (matches server onboarding order)',
        items: [
            { id: 'profile', href: './settings-profile.html', icon: 'fa-user', label: 'Personal profile' },
            { id: 'billing', href: './settings-billing.html', icon: 'fa-bolt', label: 'Plan & billing' },
            { id: 'security', href: './settings-security.html', icon: 'fa-shield-alt', label: 'Security' }
        ]
    },
    {
        id: 'data',
        label: 'The Data',
        summary: 'Bank link or statements — your call',
        items: [{ id: 'banks', href: './settings-banks.html', icon: 'fa-university', label: 'Banks & income' }]
    },
    {
        id: 'gameplan',
        label: 'The Game Plan',
        summary: 'Goals, categories, AI tone & nudges',
        items: [
            { id: 'goals', href: './settings-goals.html', icon: 'fa-bullseye', label: 'Savings goals' },
            { id: 'categories', href: './settings-categories.html', icon: 'fa-tag', label: 'Custom categories' },
            { id: 'ai', href: './settings-ai.html', icon: 'fa-robot', label: 'AI tuning' },
            { id: 'notifications', href: './settings-notifications.html', icon: 'fa-bell', label: 'Notifications' }
        ]
    }
];

function findChapterForStep(stepId) {
    for (let i = 0; i < CHAPTERS.length; i++) {
        const ch = CHAPTERS[i];
        if (ch.items.some((it) => it.id === stepId)) {
            return { chapter: ch, chapterIndex: i };
        }
    }
    return null;
}

export function mountSettingsNav() {
    const root = document.getElementById('settings-nav-root');
    if (!root) return;

    const active = document.body.getAttribute('data-settings-nav') || 'profile';
    const loc = findChapterForStep(active);
    const bootstrap = readBootstrap();
    /** Finished users (`onboarding_complete` or all steps done): show every settings tab, not one chapter at a time. */
    const isCompleted = isBootstrapOnboardingComplete(bootstrap);

    const trackParts = CHAPTERS.map((ch, i) => {
        const isCurrent = loc?.chapter?.id === ch.id;
        const cls = ['settings-chapter-pill', isCurrent ? 'is-current' : ''].filter(Boolean).join(' ');
        return (
            `<li class="${cls}" title="${escapeAttr(ch.summary)}">` +
            `<span class="settings-chapter-num" aria-hidden="true">${i + 1}</span>` +
            `<span class="settings-chapter-name">${escapeHtml(ch.label)}</span>` +
            `</li>`
        );
    });

    let subnavHtml = '';
    if (active === 'legal') {
        subnavHtml =
            '<p class="settings-legal-inline">' +
            '<span class="settings-legal-inline-note">Outside the setup checklist — fine print &amp; privacy.</span>' +
            ' <a class="settings-legal-inline-back" href="./settings-profile.html">Back to settings</a>' +
            '</p>';
    } else if (loc) {
        const subs = [];
        const items = isCompleted ? CHAPTERS.flatMap((c) => c.items) : loc.chapter.items;
        for (const item of items) {
            const on = item.id === active;
            subs.push(
                `<a class="settings-subtab${on ? ' active' : ''}" href="${escapeAttr(item.href)}" data-settings-nav-id="${escapeAttr(
                    item.id
                )}" title="${escapeAttr(item.label)}" aria-current="${on ? 'page' : 'false'}">` +
                    `<i class="fas ${item.icon}" aria-hidden="true"></i>` +
                    `<span>${escapeHtml(item.label)}</span>` +
                    `</a>`
            );
        }
        subnavHtml = `<nav class="settings-subtabs" aria-label="${isCompleted ? 'All settings steps' : 'Steps in this chapter'}">${subs.join('')}</nav>`;
    } else {
        subnavHtml =
            '<p class="settings-legal-inline">' +
            '<a class="settings-legal-inline-back" href="./settings-profile.html">Personal profile</a>' +
            '</p>';
    }

    const legalActive = active === 'legal';

    root.innerHTML =
        '<div class="settings-nav-head">' +
        '<a class="settings-back-link" href="./dashboard.html"><i class="fas fa-arrow-left" aria-hidden="true"></i> Dashboard</a>' +
        '<span class="settings-context-label">Settings</span>' +
        '</div>' +
        '<ol class="settings-chapter-track" aria-label="High-level areas">' +
        trackParts.join('') +
        '</ol>' +
        subnavHtml +
        '<div class="settings-nav-footer">' +
        `<a class="settings-legal-foot${legalActive ? ' active' : ''}" href="./settings-legal.html" data-settings-nav-id="legal">Legal &amp; Terms</a>` +
        '</div>';
}

mountSettingsNav();
if (!window.__mintSettingsNavTurboLoad) {
    window.__mintSettingsNavTurboLoad = true;
    document.addEventListener('turbo:load', mountSettingsNav);
}
if (!window.__mintSettingsNavBootstrapReady) {
    window.__mintSettingsNavBootstrapReady = true;
    document.addEventListener('mint:bootstrap-ready', () => {
        if (document.getElementById('settings-nav-root')) mountSettingsNav();
    });
}
