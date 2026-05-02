document.addEventListener('DOMContentLoaded', function () {
    var slider = document.getElementById('savingsSlider');
    var targetValue = document.getElementById('targetValue');
    var btn = document.getElementById('generateBtn');
    var loading = document.getElementById('loadingState');
    var results = document.getElementById('resultsContainer');

    if (slider && targetValue) {
        slider.addEventListener('input', function (e) {
            requestAnimationFrame(function () {
                targetValue.innerText = parseInt(e.target.value, 10).toLocaleString();
            });
        });
    }

    if (!btn) return;

    btn.addEventListener('click', async function () {
        btn.disabled = true;
        if (results) results.style.display = 'none';
        if (loading) loading.style.display = 'block';

        var date = new Date();
        var formatLocalDate = function (d) {
            return (
                d.getFullYear() +
                '-' +
                String(d.getMonth() + 1).padStart(2, '0') +
                '-' +
                String(d.getDate()).padStart(2, '0')
            );
        };
        var firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
        var lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);

        var payload = {
            start_date: formatLocalDate(firstDay),
            end_date: formatLocalDate(lastDay),
            savings_goal: parseFloat(document.getElementById('savingsSlider').value)
        };

        try {
            var data = await window.fetchSecureAPI('/api/financial-score', 'POST', payload);
            renderResults(data);
        } catch (error) {
            console.error(error);
            alert('The AI encountered an error generating your diagnostics.');
        } finally {
            btn.disabled = false;
            if (loading) loading.style.display = 'none';
        }
    });

    function renderResults(data) {
        var emptyState = document.getElementById('aiEmptyState');

        if (!data || data.status === 'DATA_MISSING' || data.transactionCount === 0) {
            if (emptyState) emptyState.style.display = 'block';
            if (results) results.style.display = 'none';
            return;
        }

        if (emptyState) emptyState.style.display = 'none';
        if (results) results.style.display = 'grid';

        var scoreCircle = document.getElementById('resScoreCircle');
        var score = data.score || 0;
        if (scoreCircle) scoreCircle.innerText = score;

        if (scoreCircle) {
            if (score >= 70) {
                scoreCircle.style.background = 'rgba(0, 255, 157, 0.1)';
                scoreCircle.style.color = 'var(--accent-green)';
                scoreCircle.style.border = '3px solid var(--accent-green)';
            } else if (score >= 40) {
                scoreCircle.style.background = 'rgba(241, 196, 15, 0.1)';
                scoreCircle.style.color = 'var(--accent-yellow)';
                scoreCircle.style.border = '3px solid var(--accent-yellow)';
            } else {
                scoreCircle.style.background = 'rgba(255, 71, 87, 0.1)';
                scoreCircle.style.color = 'var(--accent-red)';
                scoreCircle.style.border = '3px solid var(--accent-red)';
            }
        }

        var opt = data.optimization || {};
        var gapEl = document.getElementById('resGap');
        if (gapEl)
            gapEl.innerText =
                '$' +
                (opt.gap_to_close || 0).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                });
        var resTarget = document.getElementById('resTarget');
        if (resTarget) resTarget.innerText = opt.target_savings || 0;
        var resBudget = document.getElementById('resBudget');
        if (resBudget)
            resBudget.innerText =
                '$' +
                (data.predicted_budget_used || 0).toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                });

        var nudgesList = document.getElementById('nudgesList');
        if (nudgesList) {
            nudgesList.innerHTML = '';
            if (data.nudges && data.nudges.length > 0) {
                data.nudges.forEach(function (nudge) {
                    nudgesList.innerHTML += `
                    <li>
                        <div style="margin-top: 5px;"><i class="fas fa-arrow-trend-up fa-2x" style="color: var(--accent-red)"></i></div>
                        <div>
                            <strong style="font-size: 1.1rem;">${nudge.category} Spike</strong>
                            <p style="font-size: 0.95rem; color: var(--text-secondary); margin-top: 5px; line-height: 1.4;">${nudge.message}</p>
                        </div>
                    </li>`;
                });
            } else {
                nudgesList.innerHTML =
                    '<li style="background: transparent; border: none; color: var(--text-secondary);">No major spending spikes detected recently!</li>';
            }
        }

        var leaksList = document.getElementById('leaksList');
        if (leaksList) {
            leaksList.innerHTML = '';
            if (data.leaks && data.leaks.length > 0) {
                data.leaks.forEach(function (leak) {
                    leaksList.innerHTML += `
                    <li>
                        <div style="margin-top: 5px;"><i class="fas fa-tint fa-2x" style="color: var(--accent-yellow)"></i></div>
                        <div>
                            <strong style="font-size: 1.1rem;">${leak.category}</strong>
                            <p style="font-size: 0.95rem; color: var(--text-secondary); margin-top: 5px; line-height: 1.4;">Averaging $${leak.average_monthly.toFixed(2)} / month in micro-transactions.</p>
                        </div>
                    </li>`;
                });
            } else {
                leaksList.innerHTML =
                    '<li style="background: transparent; border: none; color: var(--text-secondary);">No hidden micro-leaks detected!</li>';
            }
        }

        var tbody = document.getElementById('cutsTableBody');
        if (tbody) {
            tbody.innerHTML = '';
            var cuts = opt.recommended_cuts || [];
            if (cuts.length === 0) {
                tbody.innerHTML =
                    '<tr><td colspan="4" style="text-align: center; padding: 30px; color: var(--text-secondary);">You are on track to hit your goal without extra cuts!</td></tr>';
            } else {
                cuts.forEach(function (cut) {
                    tbody.innerHTML += `
                    <tr>
                        <td><strong>${cut.category}</strong></td>
                        <td>$${cut.current_avg_spend.toFixed(2)}</td>
                        <td class="cut-amount">-$${cut.suggested_cut.toFixed(2)}</td>
                        <td class="target-amount">$${cut.new_target.toFixed(2)}</td>
                    </tr>`;
                });
            }
        }
    }
});
