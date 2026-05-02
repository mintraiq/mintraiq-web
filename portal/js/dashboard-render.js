/**
 * Renders FastAPI POST /generate JSON (same shape as dataprocessor.generate_dashboard_data).
 */

export function renderTrendChart(data) {
    const el = document.getElementById('trendChart');
    if (!el || !window.Chart || !data.main_trend_chart) return;
    new Chart(el.getContext('2d'), {
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

export function renderBreakdownChart(data) {
    const el = document.getElementById('breakdownChart');
    if (!el || !window.Chart || !data.expense_breakdown) return;
    new Chart(el.getContext('2d'), {
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

export function renderForecastChart(data) {
    const el = document.getElementById('aiForecastChart');
    if (!el || !window.Chart || !data.forecast || !data.forecast.yearly_projection) return;
    const projectionData = data.forecast.yearly_projection.data_points;
    const eoy = document.getElementById('eoy_projection');
    if (eoy) eoy.innerText = '$' + data.forecast.yearly_projection.end_of_year_value;

    new Chart(el.getContext('2d'), {
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

export function renderMetrics(data) {
    if (!data.metrics) return;
    const set = (id, v) => {
        const el = document.getElementById(id);
        if (el) el.textContent = '$' + v;
    };
    set('current_income', data.metrics.income.current);
    set('current_expense', data.metrics.expenses.current);
    set('current_savings', data.metrics.savings.current);
    set('current_investments', data.metrics.investments.current);

    if (data.ai_status === 'Online' && data.forecast && data.forecast.next_month) {
        const nm = data.forecast.next_month;
        const ei = document.getElementById('est_income');
        const ee = document.getElementById('est_expenses');
        const es = document.getElementById('est_savings');
        if (ei) ei.textContent = '$' + nm.est_income;
        if (ee) ee.textContent = '$' + nm.est_expense;
        if (es && nm.est_income != null && nm.est_expense != null) {
            const inc = Number(String(nm.est_income).replace(/[^0-9.-]/g, '')) || 0;
            const exp = Number(String(nm.est_expense).replace(/[^0-9.-]/g, '')) || 0;
            es.textContent = '$' + Math.round(inc - exp).toLocaleString('en-US');
        }
    }
}

export function renderRecommendations(data) {
    const list = document.getElementById('recommendationList');
    if (!list) return;
    list.innerHTML = '';
    (data.recommendations || []).forEach((rec) => {
        let color = 'var(--accent-green)';
        let bg = 'rgba(16, 185, 129, 0.1)';
        if (rec.severity === 'High') {
            color = 'var(--accent-red)';
            bg = 'rgba(239, 68, 68, 0.1)';
        } else if (rec.severity === 'Medium') {
            color = 'var(--accent-blue)';
            bg = 'rgba(47, 128, 237, 0.1)';
        }
        const li = document.createElement('li');
        li.innerHTML = `
            <div class="rec-icon" style="color:${color};background-color:${bg}">
                <i class="fas ${rec.icon || 'fa-lightbulb'}"></i>
            </div>
            <div>
                <strong>${rec.title}</strong>
                <p style="font-size:0.9rem;color:var(--text-secondary)">${rec.description}</p>
            </div>`;
        list.appendChild(li);
    });
}

export function renderHighExpenseAlerts(data) {
    const expAlert = document.getElementById('high_expense_id');
    if (!expAlert) return;
    expAlert.innerHTML = '';
    (data.high_expense_alert || []).forEach((al) => {
        let color = 'var(--accent-green)';
        if (al.severity === 'High') color = 'var(--accent-red)';
        else if (al.severity === 'Medium') color = 'var(--accent-blue)';
        const li = document.createElement('li');
        li.style.listStyle = 'none';
        li.innerHTML = `<p style="margin:12px 0;color:${color}">
            You spent <strong>${al.amount}</strong> on "${al.category}" — over budget by ${al.breach}%.</p>`;
        expAlert.appendChild(li);
    });
}

export function showDataMissingState() {
    const grid = document.querySelector('.grid-container');
    if (!grid) return;
    grid.innerHTML = `
        <div class="empty-state-card" style="grid-column:1/-1">
            <i class="fas fa-file-invoice-dollar" style="font-size:3rem;color:var(--accent-purple);margin-bottom:16px;"></i>
            <h3>Connect your data</h3>
            <p style="color:var(--text-secondary);max-width:420px;margin:12px auto;line-height:1.5">
                No transactions found for this period. Add bank data in your backend or try another month.
            </p>
            <a class="btn-primary" href="../intro.html" style="text-decoration:none;display:inline-block;margin-top:8px">
                <i class="fas fa-arrow-left"></i> Back to site
            </a>
        </div>`;
}

export function showLoadError(message) {
    const grid = document.querySelector('.grid-container');
    if (!grid) return;
    grid.innerHTML = `
        <div class="card" style="grid-column:1/-1;text-align:center;padding:40px;">
            <i class="fas fa-plug fa-3x" style="color:var(--accent-red)"></i>
            <h3 style="margin-top:16px">Could not load dashboard</h3>
            <p style="color:var(--text-secondary);margin-top:8px;font-size:0.9rem">${escapeHtml(String(message || 'Unknown error'))}</p>
        </div>`;
}

function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function showOfflineBanner(msg) {
    const alert = document.createElement('div');
    alert.style.cssText =
        'position:fixed;top:20px;right:20px;max-width:320px;background:rgba(255,71,87,0.12);border:1px solid var(--accent-red);color:#fff;padding:14px;z-index:10001;border-radius:10px;font-size:0.9rem;';
    alert.textContent = msg;
    document.body.appendChild(alert);
    setTimeout(() => alert.remove(), 6000);
}
