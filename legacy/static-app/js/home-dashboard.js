/**
 * Dashboard charts + metrics — adapted from legacy/static-flask/dashboard.js.
 * Data: GET /generate1 (see expense_loader.generate_dashboard) via fetchSecureAPI remap.
 */
function generate_trendChart(data) {
    var el = document.getElementById('trendChart');
    if (!el || !window.Chart || !data.main_trend_chart) return;
    var trendCtx = el.getContext('2d');
    new Chart(trendCtx, {
        type: 'line',
        data: {
            labels: data.main_trend_chart.labels,
            datasets: [
                {
                    label: 'Income',
                    data: data.main_trend_chart.income_series,
                    borderColor: '#00ff9d',
                    backgroundColor: 'rgba(0, 255, 157, 0.1)',
                    tension: 0.4,
                    fill: true
                },
                {
                    label: 'Expenses',
                    data: data.main_trend_chart.expense_series,
                    borderColor: '#ff4757',
                    backgroundColor: 'rgba(255, 71, 87, 0.1)',
                    tension: 0.4,
                    fill: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'top' } },
            scales: {
                y: { beginAtZero: true, grid: { color: '#222' } },
                x: { grid: { display: false } }
            }
        }
    });
}

function generate_doughnut_chart(data) {
    var el = document.getElementById('breakdownChart');
    if (!el || !window.Chart || !data.expense_breakdown) return;
    var breakdownCtx = el.getContext('2d');
    new Chart(breakdownCtx, {
        type: 'doughnut',
        data: {
            labels: data.expense_breakdown.labels,
            datasets: [
                {
                    data: data.expense_breakdown.data,
                    backgroundColor: ['#2f80ed', '#00ff9d', '#f1c40f', '#bb6bd9', '#ff4757'],
                    borderWidth: 0
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'right' } },
            cutout: '70%'
        }
    });
}

function generate_forecast(data) {
    var el = document.getElementById('aiForecastChart');
    if (!el || !window.Chart || !data.forecast || !data.forecast.yearly_projection) return;
    var aiCtx = el.getContext('2d');
    var projectionData = data.forecast.yearly_projection.data_points;
    var eoy = document.getElementById('eoy_projection');
    if (eoy) eoy.innerText = '$' + data.forecast.yearly_projection.end_of_year_value;

    new Chart(aiCtx, {
        type: 'line',
        data: {
            labels: ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'],
            datasets: [
                {
                    label: 'Projected Net Worth',
                    data: projectionData,
                    borderColor: '#bb6bd9',
                    borderWidth: 3,
                    pointBackgroundColor: '#bb6bd9',
                    tension: 0.3
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { display: false },
                x: { grid: { display: false } }
            }
        }
    });
}

function generate_dashboard(data) {
    if (!data.metrics) return;
    var inc = document.getElementById('current_income');
    var exp = document.getElementById('current_expense');
    var sav = document.getElementById('current_savings');
    var inv = document.getElementById('current_investments');
    if (inc) inc.innerText = '$' + data.metrics.income.current;
    if (exp) exp.innerText = '$' + data.metrics.expenses.current;
    if (sav) sav.innerText = '$' + data.metrics.savings.current;
    if (inv) inv.innerText = '$' + data.metrics.investments.current;

    if (data.ai_status === 'Online' && data.forecast && data.forecast.next_month) {
        var ei = document.getElementById('est_income');
        var ee = document.getElementById('est_expenses');
        if (ei) ei.innerText = '$' + data.forecast.next_month.est_income;
        if (ee) ee.innerText = '$' + data.forecast.next_month.est_expense;
    }
}

function generate_recommendations(data) {
    var list = document.getElementById('recommendationList');
    if (!list) return;
    list.innerHTML = '';
    (data.recommendations || []).forEach(function (rec) {
        var color = 'var(--accent-green)';
        var bg = 'rgba(16, 185, 129, 0.1)';
        if (rec.severity === 'High') {
            color = 'var(--accent-red)';
            bg = 'rgba(239, 68, 68, 0.1)';
        } else if (rec.severity === 'Medium') {
            color = 'var(--accent-blue)';
            bg = 'rgba(47, 128, 237, 0.1)';
        }
        var li = document.createElement('li');
        li.innerHTML =
            '<div class="rec-icon" style="color:' +
            color +
            ';background-color:' +
            bg +
            '"><i class="fas ' +
            (rec.icon || 'fa-lightbulb') +
            '"></i></div><div><strong>' +
            rec.title +
            '</strong><p style="font-size:0.9rem;color:var(--text-secondary)">' +
            rec.description +
            '</p></div>';
        list.appendChild(li);
    });
}

function generate_high_expense_alert(data) {
    var expAlert = document.getElementById('high_expense_id');
    if (!expAlert) return;
    expAlert.innerHTML = '';
    (data.high_expense_alert || []).forEach(function (al) {
        var color = 'var(--accent-green)';
        if (al.severity === 'High') color = 'var(--accent-red)';
        else if (al.severity === 'Medium') color = 'var(--accent-blue)';
        var li = document.createElement('li');
        li.style.listStyle = 'none';
        li.innerHTML =
            '<p style="margin:12px 0;color:' +
            color +
            '">You spent <strong>' +
            al.amount +
            '</strong> on "' +
            al.category +
            '" — over budget by ' +
            al.breach +
            '%.</p>';
        expAlert.appendChild(li);
    });
}

function showNinjaWarning(msg) {
    var alert = document.createElement('div');
    alert.style.cssText =
        'position:fixed;top:20px;right:20px;background:rgba(255,0,0,0.1);border:1px solid var(--accent-red);color:white;padding:15px;z-index:10001;border-radius:8px;';
    alert.innerHTML = '<i class="fas fa-user-ninja"></i> ' + msg;
    document.body.appendChild(alert);
    setTimeout(function () {
        alert.remove();
    }, 5000);
}

document.addEventListener('DOMContentLoaded', function () {
    if (window.Chart) {
        Chart.defaults.color = '#a0a0a0';
        Chart.defaults.borderColor = '#333';
    }

    var financedata = { start_date: '', end_date: '' };
    var date = new Date();
    var firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
    var lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    var fmt = function (d) {
        return (
            d.getFullYear() +
            '-' +
            String(d.getMonth() + 1).padStart(2, '0') +
            '-' +
            String(d.getDate()).padStart(2, '0')
        );
    };
    financedata.start_date = fmt(firstDay);
    financedata.end_date = fmt(lastDay);

    window
        .fetchSecureAPI('/api/generate', 'POST', financedata)
        .then(function (data) {
            if (!data) return;
            if (data.ai_status === 'DATA_MISSING') {
                var grid = document.querySelector('.grid-container');
                if (grid) {
                    grid.innerHTML =
                        '<div class="empty-state-card"><i class="fas fa-file-invoice-dollar" style="font-size:3rem;color:var(--accent-purple);margin-bottom:16px;"></i>' +
                        '<h3>Awaken your AI Advisor</h3><p style="color:var(--text-secondary);max-width:420px;margin:12px auto;">No transactions for this month. Upload statements or receipts.</p>' +
                        '<a class="btn-primary" href="upload.html"><i class="fas fa-cloud-upload-alt"></i> Upload CSV</a></div>';
                }
                return;
            }
            generate_dashboard(data);
            generate_trendChart(data);
            generate_doughnut_chart(data);
            if (data.ai_status === 'Offline') {
                showNinjaWarning('AI forecasting offline. Showing historical data only.');
            } else {
                generate_forecast(data);
                generate_recommendations(data);
            }
            generate_high_expense_alert(data);
        })
        .catch(function (err) {
            console.error(err);
            var grid = document.querySelector('.grid-container');
            if (grid) {
                grid.innerHTML =
                    '<div class="card grid-span-4" style="text-align:center;padding:40px;">' +
                    '<i class="fas fa-plug fa-3x" style="color:var(--accent-red)"></i>' +
                    '<h3 style="margin-top:16px">Could not load dashboard</h3>' +
                    '<p style="color:var(--text-secondary);margin-top:8px">Start Flask on <code style="color:var(--accent-purple)">' +
                    ((window.getLegacyFlaskBase && window.getLegacyFlaskBase()) || 'http://127.0.0.1:5000') +
                    '</code> and sign in so the session cookie is sent.</p>' +
                    '<p style="color:var(--text-secondary);font-size:0.9rem;margin-top:12px">' +
                    String(err.message || err) +
                    '</p></div>';
            }
        });
});
