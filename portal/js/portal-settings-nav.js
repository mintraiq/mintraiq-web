/**
 * Settings section nav — horizontal tabs under a compact dashboard link.
 * Mounts into #settings-nav-root inside #portal-settings-nav-region (data-turbo-permanent on settings pages).
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

const GROUPS = [
    {
        title: 'ACCOUNT',
        items: [
            { id: 'profile', href: './settings-profile.html', icon: 'fa-user', label: 'Personal profile' },
            { id: 'billing', href: './settings-billing.html', icon: 'fa-bolt', label: 'Billing & plan' },
            { id: 'security', href: './settings-security.html', icon: 'fa-shield-alt', label: 'Security' }
        ]
    },
    {
        title: 'PREFERENCES',
        items: [
            { id: 'goals', href: './settings-goals.html', icon: 'fa-bullseye', label: 'Savings goals' },
            { id: 'banks', href: './settings-banks.html', icon: 'fa-university', label: 'Banks & income' },
            { id: 'categories', href: './settings-categories.html', icon: 'fa-tag', label: 'Custom categories' },
            { id: 'notifications', href: './settings-notifications.html', icon: 'fa-bell', label: 'Alerts & nudges' },
            { id: 'ai', href: './settings-ai.html', icon: 'fa-robot', label: 'AI advisor settings' },
            { id: 'legal', href: './settings-legal.html', icon: 'fa-scroll', label: 'Legal & Terms' }
        ]
    }
];

function syncSettingsNavActive() {
    const root = document.getElementById('settings-nav-root');
    if (!root) return;
    const active = document.body.getAttribute('data-settings-nav') || 'profile';
    root.querySelectorAll('a.settings-tab[data-settings-nav-id]').forEach((a) => {
        const id = a.getAttribute('data-settings-nav-id');
        const on = id === active;
        a.classList.toggle('active', on);
        a.setAttribute('aria-current', on ? 'page' : 'false');
    });
}

export function mountSettingsNav() {
    const root = document.getElementById('settings-nav-root');
    if (!root) return;

    if (!root.dataset.settingsNavBuilt) {
        const tabs = [];
        GROUPS.forEach((g, gi) => {
            if (gi > 0) {
                tabs.push('<span class="settings-tabs-divider" aria-hidden="true"></span>');
            }
            for (const item of g.items) {
                tabs.push(
                    `<a class="settings-tab" href="${escapeAttr(item.href)}" data-settings-nav-id="${escapeAttr(item.id)}" title="${escapeAttr(g.title + ' · ' + item.label)}">` +
                        `<i class="fas ${item.icon}" aria-hidden="true"></i>` +
                        `<span>${escapeHtml(item.label)}</span>` +
                        `</a>`
                );
            }
        });

        root.innerHTML =
            '<div class="settings-nav-head">' +
            '<a class="settings-back-link" href="./dashboard.html"><i class="fas fa-arrow-left" aria-hidden="true"></i> Dashboard</a>' +
            '<span class="settings-context-label">Settings</span>' +
            '</div>' +
            '<nav class="settings-tabs" aria-label="Settings sections">' +
            tabs.join('') +
            '</nav>';

        root.dataset.settingsNavBuilt = '1';
    }

    syncSettingsNavActive();
}

mountSettingsNav();
if (!window.__mintSettingsNavTurboLoad) {
    window.__mintSettingsNavTurboLoad = true;
    document.addEventListener('turbo:load', mountSettingsNav);
}
