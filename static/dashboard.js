/**
 * MintrAIQ dashboard front-end.
 * Set MINTRAIQ_USE_MOCK_DATA to false when your API routes are ready — until then,
 * the UI fills with polished demo numbers for screenshots, walkthroughs, and landing traffic.
 */
(function () {
    'use strict';

    var MINTRAIQ_USE_MOCK_DATA = true;

    function formatMoney(n) {
        var sign = n < 0 ? '-' : '';
        var v = Math.abs(Math.round(n));
        return sign + '$' + v.toLocaleString('en-US');
    }

    function text(id, value) {
        var el = document.getElementById(id);
        if (el) el.textContent = value;
    }

    function injectDemoBanner() {
        var grid = document.querySelector('.grid-container');
        if (!grid || grid.querySelector('.mintraiq-demo-banner')) return;
        var bar = document.createElement('div');
        bar.className = 'mintraiq-demo-banner';
        bar.setAttribute('role', 'status');
        bar.innerHTML =
            '<span><i class="fas fa-wand-magic-sparkles" aria-hidden="true"></i> Demo mode</span>' +
            '<span>Figures below are sample data to showcase the product. Connect your accounts for real insights.</span>';
        bar.style.cssText =
            'grid-column: 1 / -1;' +
            'display: flex; flex-wrap: wrap; align-items: center; gap: 12px 20px;' +
            'padding: 12px 18px; margin-bottom: 8px; border-radius: 12px;' +
            'background: linear-gradient(90deg, rgba(0,255,157,0.12), rgba(47,128,237,0.12));' +
            'border: 1px solid rgba(0,255,157,0.25); font-size: 0.82rem; color: #e0e0e0;';
        var first = bar.querySelector('span');
        if (first) {
            first.style.fontWeight = '800';
            first.style.color = '#00ff9d';
            first.style.letterSpacing = '0.04em';
        }
        grid.parentNode.insertBefore(bar, grid);
    }

    function fillHighExpenseAlerts() {
        var ul = document.getElementById('high_expense_id');
        if (!ul) return;
        var items = [
            { cat: 'Dining & delivery', detail: '32% above your 8-week average — easy wins if you cook 2 more nights / week.', amt: '$486' },
            { cat: 'Subscriptions', detail: 'Three services had price hikes this quarter; review in Settings → Recurring.', amt: '$64/mo' },
            { cat: 'Shopping', detail: 'Weekend spend spiked after travel — consider a soft cap for the next 14 days.', amt: '$312' }
        ];
        ul.innerHTML = items
            .map(function (row) {
                return (
                    '<li style="margin-bottom:12px;padding-left:8px;border-left:3px solid #ff4757;line-height:1.45;">' +
                    '<strong style="color:#fff;">' +
                    row.cat +
                    '</strong> ' +
                    '<span style="color:#ff4757;font-weight:700;float:right;">' +
                    row.amt +
                    '</span><br><span style="color:#a0a0a0;font-size:0.85rem;">' +
                    row.detail +
                    '</span></li>'
                );
            })
            .join('');
    }

    function fillRecommendations() {
        var list = document.getElementById('recommendationList');
        if (!list) return;
        var recs = [
            { icon: 'fa-piggy-bank', title: 'Sweep $175 to your emergency bucket', text: 'Your income buffer can absorb it without touching fun money — aligns with your 6-month goal.' },
            { icon: 'fa-bolt', title: 'Move a recurring charge to annual billing', text: 'One streaming plan offers ~18% savings on yearly prepay; we modeled the cash-flow impact.' },
            { icon: 'fa-chart-line', title: 'Rebalance discretionary after CPI tick', text: 'Groceries are tracking +4% vs your plan; we nudged dining down slightly to stay green.' },
            { icon: 'fa-shield-halved', title: 'Lock in next month’s “no-spend” weekend', text: 'Historical data shows you save ~$220 when you skip impulse retail on long weekends.' }
        ];
        list.innerHTML = recs
            .map(function (r) {
                return (
                    '<li>' +
                    '<div class="rec-icon"><i class="fas ' +
                    r.icon +
                    '"></i></div>' +
                    '<div><div style="font-weight:700;color:#fff;margin-bottom:4px;">' +
                    r.title +
                    '</div><div style="color:#a0a0a0;font-size:0.88rem;line-height:1.45;">' +
                    r.text +
                    '</div></div></li>'
                );
            })
            .join('');
    }

    function renderCharts() {
        if (typeof Chart === 'undefined') return;

        var months = ['Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov'];
        var income = [11800, 12100, 11950, 12400, 12650, 12880];
        var expense = [10200, 10800, 11100, 10450, 10900, 10650];

        var trendEl = document.getElementById('trendChart');
        if (trendEl) {
            new Chart(trendEl, {
                type: 'line',
                data: {
                    labels: months,
                    datasets: [
                        {
                            label: 'Income',
                            data: income,
                            borderColor: '#00ff9d',
                            backgroundColor: 'rgba(0,255,157,0.08)',
                            fill: true,
                            tension: 0.35,
                            borderWidth: 2
                        },
                        {
                            label: 'Expenses',
                            data: expense,
                            borderColor: '#ff4757',
                            backgroundColor: 'rgba(255,71,87,0.06)',
                            fill: true,
                            tension: 0.35,
                            borderWidth: 2
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'bottom' } },
                    scales: {
                        y: {
                            ticks: {
                                callback: function (v) {
                                    return '$' + (v / 1000).toFixed(1) + 'k';
                                }
                            },
                            grid: { color: '#333' }
                        },
                        x: { grid: { display: false } }
                    }
                }
            });
        }

        var breakEl = document.getElementById('breakdownChart');
        if (breakEl) {
            new Chart(breakEl, {
                type: 'doughnut',
                data: {
                    labels: ['Housing', 'Dining', 'Transport', 'Shopping', 'Other'],
                    datasets: [
                        {
                            data: [38, 18, 14, 12, 18],
                            backgroundColor: ['#2f80ed', '#ff4757', '#00ff9d', '#bb6bd9', '#f1c40f'],
                            borderWidth: 0
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '58%',
                    plugins: { legend: { position: 'right' } }
                }
            });
        }

        var forecastEl = document.getElementById('aiForecastChart');
        if (forecastEl) {
            var proj = [42, 43.2, 44.1, 45.8, 47.2, 49.0, 50.8, 52.4, 54.1, 56.0, 57.8, 59.5];
            new Chart(forecastEl, {
                type: 'line',
                data: {
                    labels: ['Now', '+1m', '+2m', '+3m', '+4m', '+5m', '+6m', '+7m', '+8m', '+9m', '+10m', '+11m'],
                    datasets: [
                        {
                            label: 'Projected net (index)',
                            data: proj,
                            borderColor: '#bb6bd9',
                            backgroundColor: 'rgba(187,107,217,0.15)',
                            fill: true,
                            tension: 0.4,
                            borderWidth: 2
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        y: { grid: { color: '#333' } },
                        x: { grid: { display: false } }
                    }
                }
            });
        }
    }

    function applyMockMetrics() {
        text('current_income', formatMoney(16238));
        text('current_expense', formatMoney(9342));
        text('current_investments', formatMoney(45900));
        text('current_savings', formatMoney(4280));

        text('est_income', formatMoney(15800));
        text('est_expenses', formatMoney(9120));
        text('est_savings', formatMoney(6680));

        text('eoy_projection', formatMoney(62400));

        var fill = document.getElementById('savings_progress_fill');
        if (fill) fill.style.width = '72%';
    }

    function runMockDashboard() {
        injectDemoBanner();
        applyMockMetrics();
        fillHighExpenseAlerts();
        fillRecommendations();
        renderCharts();
    }

    function tryLiveApi() {
        if (typeof window.fetchSecureAPI !== 'function') return;
        window
            .fetchSecureAPI('/api/dashboard/summary', 'GET', null)
            .then(function (data) {
                if (data && !MINTRAIQ_USE_MOCK_DATA) {
                    /* Wire real fields when your backend shape is stable */
                }
            })
            .catch(function () {
                runMockDashboard();
            });
    }

    document.addEventListener('DOMContentLoaded', function () {
        if (MINTRAIQ_USE_MOCK_DATA) {
            runMockDashboard();
        } else {
            tryLiveApi();
        }
    });
})();
