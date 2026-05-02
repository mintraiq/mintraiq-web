/**
 * Inner settings nav (ACCOUNT / PREFERENCES). Mounts into #settings-nav-root.
 * body[data-settings-nav] = profile | billing | security | goals | banks | categories | notifications | ai
 */
function escapeAttr(s) {
    return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
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
            { id: 'ai', href: './settings-ai.html', icon: 'fa-robot', label: 'AI advisor settings' }
        ]
    }
];

export function mountSettingsNav() {
    const root = document.getElementById('settings-nav-root');
    if (!root) return;

    const active = document.body.getAttribute('data-settings-nav') || 'profile';

    const parts = [
        '<a class="back-dash" href="./dashboard.html"><i class="fas fa-arrow-left"></i> Back to dashboard</a>'
    ];

    for (const g of GROUPS) {
        parts.push(`<div class="nav-group-title">${escapeAttr(g.title)}</div>`);
        parts.push('<nav class="settings-nav">');
        for (const item of g.items) {
            const cls = item.id === active ? 'active' : '';
            parts.push(
                `<a href="${escapeAttr(item.href)}" class="${cls}"><i class="fas ${item.icon}"></i> ${escapeAttr(item.label)}</a>`
            );
        }
        parts.push('</nav>');
    }

    root.innerHTML = parts.join('');
}

mountSettingsNav();
