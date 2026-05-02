/**
 * Ninja Finance shell — mirrors legacy/templates/layout.html sidebar (Flask routes as static .html).
 * Requires: #app-sidebar, #sidebar-overlay, #nav-toggle, body[data-active-nav="<id>"].
 * API origin: window.__MINTRAIQ_ENV__.legacyFlaskBase (see config/runtime-env.defaults.js + env.public.example).
 */
(function () {
    'use strict';

    var LINKS = [
        { id: 'home', href: 'home.html', icon: 'fa-chart-line', label: 'Dashboard' },
        { id: 'transactions', href: 'transactions.html', icon: 'fa-wallet', label: 'Transactions' },
        { id: 'investments', href: 'investments.html', icon: 'fa-piggy-bank', label: 'Investments' },
        { id: 'goals', href: 'goals.html', icon: 'fa-bullseye', label: 'Goals' },
        { id: 'cpi', href: 'cpi-guru.html', icon: 'fa-chart-pie', label: 'Personal CPI Chart' },
        { id: 'budget', href: 'budget-planner.html', icon: 'fa-robot', label: 'AI Advisor' },
        { id: 'weekly', href: 'weekly-planner.html', icon: 'fa-calendar-week', label: 'Weekly Budget Planner' },
        { id: 'score', href: 'financial-score.html', icon: 'fa-gauge-high', label: 'Financial Discipline' },
        { id: 'search', href: 'search-by-date.html', icon: 'fa-calendar-alt', label: 'Search by date' },
        { id: 'monthly', href: 'expenses-monthly.html', icon: 'fa-table', label: 'Monthly expenses' },
        { id: 'forecast', href: 'forecast.html', icon: 'fa-chart-area', label: 'Forecast' }
    ];

    var BOTTOM = [
        { id: 'scan', href: 'scan-receipts.html', icon: 'fa-file-invoice-dollar', label: 'Scan Receipts' },
        { id: 'receipts', href: 'upload-receipts.html', icon: 'fa-cloud-upload-alt', label: 'Upload Receipts' },
        { id: 'upload', href: 'upload.html', icon: 'fa-file-import', label: 'Bank Statements' },
        { id: 'settings', href: 'settings.html', icon: 'fa-cog', label: 'Settings' },
        { id: 'account', href: 'account-profile.html', icon: 'fa-user', label: 'Account profile' }
    ];

    function apiHint() {
        var e = window.__MINTRAIQ_ENV__ || {};
        var b = e.legacyFlaskBase || 'http://127.0.0.1:5000';
        var docs = e.fastApiDocsUrl || '';
        var u = e.financeApiBase || '';
        var bits =
            '<div style="font-size:0.68rem;line-height:1.35;color:rgba(255,255,255,0.45);padding:4px 2px 10px;border-bottom:1px solid rgba(255,255,255,0.08);margin-bottom:8px">';
        bits += '<strong style="color:rgba(0,255,157,0.85)">Flask UI</strong><br><code style="word-break:break-all">' + escapeHtml(b) + '</code>';
        if (u) bits += '<br><strong style="color:rgba(127,232,255,0.9)">FastAPI</strong><br><code style="word-break:break-all">' + escapeHtml(u) + '</code>';
        if (docs) bits += '<br><a href="' + escapeAttr(docs) + '" style="color:#7ee8ff" target="_blank" rel="noopener">OpenAPI docs</a>';
        bits += '</div>';
        return bits;
    }

    function escapeHtml(s) {
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    function escapeAttr(s) {
        return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    }

    function render() {
        var active = document.body.getAttribute('data-active-nav') || 'home';
        var aside = document.getElementById('app-sidebar');
        if (!aside) return;

        function linkRow(l) {
            var cls = 'menu-item' + (l.id === active ? ' active' : '');
            return (
                '<a href="' +
                l.href +
                '" class="' +
                cls +
                '"><i class="fas ' +
                l.icon +
                '"></i> ' +
                l.label +
                '</a>'
            );
        }

        var top = LINKS.map(linkRow).join('');
        var bottom = BOTTOM.map(linkRow).join('');

        aside.innerHTML =
            '<div class="brand"><i class="fas fa-user-ninja"></i> Ninja Finance</div>' +
            apiHint() +
            '<div class="menu-section" style="font-size:0.7rem;text-transform:uppercase;letter-spacing:0.08em;color:rgba(255,255,255,0.35);margin:6px 0 4px 10px">Menu</div>' +
            top +
            '<div style="flex-grow:1"></div>' +
            '<div class="menu-section" style="font-size:0.7rem;text-transform:uppercase;letter-spacing:0.08em;color:rgba(255,255,255,0.35);margin:12px 0 4px 10px">Capture</div>' +
            bottom +
            '<div style="margin-top:14px;padding-top:12px;border-top:1px solid rgba(255,255,255,0.08)"></div>' +
            '<a href="../intro.html" class="menu-item"><i class="fas fa-arrow-left"></i> Marketing site</a>' +
            '<a href="../portal/index.html" class="menu-item"><i class="fas fa-right-to-bracket"></i> Logto portal</a>';

        var toggle = document.getElementById('nav-toggle');
        var overlay = document.getElementById('sidebar-overlay');
        function close() {
            aside.classList.remove('is-open');
            if (overlay) overlay.classList.remove('visible');
        }
        function open() {
            aside.classList.add('is-open');
            if (overlay) overlay.classList.add('visible');
        }
        if (toggle) {
            toggle.addEventListener('click', function () {
                if (aside.classList.contains('is-open')) close();
                else open();
            });
        }
        if (overlay) overlay.addEventListener('click', close);
        aside.querySelectorAll('a.menu-item').forEach(function (a) {
            a.addEventListener('click', close);
        });

        var mobileLabel = document.querySelector('.mobile-bar span[style*="accent-green"]');
        if (mobileLabel) mobileLabel.textContent = 'Ninja Finance';
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', render);
    } else {
        render();
    }
})();
