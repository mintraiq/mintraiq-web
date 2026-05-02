/**
 * Injects MintrAIQ shell sidebar + mobile menu. Requires <aside id="app-sidebar"> and
 * <div id="sidebar-overlay">, <button id="nav-toggle">, body[data-active-nav="home"].
 */
(function () {
    var LINKS = [
        { id: 'home', href: 'home.html', icon: 'fa-chart-line', label: 'Dashboard' },
        { id: 'transactions', href: 'transactions.html', icon: 'fa-wallet', label: 'Transactions' },
        { id: 'search', href: 'search-by-date.html', icon: 'fa-calendar-alt', label: 'By date' },
        { id: 'monthly', href: 'expenses-monthly.html', icon: 'fa-table', label: 'Monthly list' },
        { id: 'forecast', href: 'forecast.html', icon: 'fa-chart-area', label: 'Forecast' },
        { id: 'budget', href: 'budget-planner.html', icon: 'fa-columns', label: 'Budget' },
        { id: 'weekly', href: 'weekly-planner.html', icon: 'fa-calendar-week', label: 'Weekly' },
        { id: 'score', href: 'financial-score.html', icon: 'fa-gauge-high', label: 'Discipline' },
        { id: 'cpi', href: 'cpi-guru.html', icon: 'fa-percent', label: 'CPI Guru' },
        { id: 'goals', href: 'goals.html', icon: 'fa-bullseye', label: 'Goals' },
        { id: 'upload', href: 'upload.html', icon: 'fa-file-csv', label: 'Upload CSV' },
        { id: 'account', href: 'account-profile.html', icon: 'fa-user', label: 'Profile' }
    ];

    function render() {
        var active = document.body.getAttribute('data-active-nav') || 'home';
        var aside = document.getElementById('app-sidebar');
        if (!aside) return;

        var navHtml = LINKS.map(function (l) {
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
        }).join('');

        aside.innerHTML =
            '<div class="brand"><i class="fas fa-brain"></i> MintrAIQ</div>' +
            '<div class="menu-section">App</div>' +
            navHtml +
            '<div style="flex-grow:1"></div>' +
            '<div class="menu-section">Site</div>' +
            '<a href="../../intro.html" class="menu-item"><i class="fas fa-arrow-left"></i> Marketing site</a>' +
            '<a href="../../portal/index.html" class="menu-item"><i class="fas fa-right-to-bracket"></i> Portal login</a>';

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
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', render);
    } else {
        render();
    }
})();
