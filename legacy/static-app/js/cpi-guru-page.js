document.addEventListener('DOMContentLoaded', async function () {
    var loading = document.getElementById('loadingState');
    var results = document.getElementById('resultsContainer');

    try {
        var data = await window.fetchSecureAPI('/cpi-guru', 'POST');
        if (data && data.status === 'SUCCESS') {
            renderResults(data);
        } else {
            throw new Error('Not enough data to calculate inflation.');
        }
    } catch (error) {
        console.error('CPI Guru failed:', error);
        if (loading) {
            loading.innerHTML =
                '<i class="fas fa-exclamation-triangle fa-3x" style="color: var(--accent-red); margin-bottom: 20px;"></i>' +
                '<h2>Not Enough Historical Data</h2>' +
                '<p style="color: var(--text-secondary);">We need a few more months of transaction history to establish your baseline.</p>';
        }
    }

    function renderResults(data) {
        if (loading) loading.style.display = 'none';
        if (results) results.style.display = 'grid';

        document.getElementById('resTax').innerText = '$' + data.metrics.monthly_inflation_tax.toFixed(2);
        document.getElementById('resRate').innerText = data.metrics.personal_inflation_rate.toFixed(1) + '%';
        document.getElementById('resBase').innerText =
            '$' +
            data.metrics.total_baseline_spend.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });

        var compText = document.getElementById('resComparison');
        if (data.metrics.personal_inflation_rate > 4.0) {
            compText.innerHTML =
                '<i class="fas fa-arrow-up" style="color: var(--accent-red)"></i> Tracking higher than national average';
        } else {
            compText.innerHTML =
                '<i class="fas fa-arrow-down" style="color: var(--accent-green)"></i> Beating the national inflation average';
        }

        var list = document.getElementById('breakdownList');
        var sim = document.getElementById('simulatorContainer');
        list.innerHTML = '';
        sim.innerHTML = '';

        var topCategories = data.breakdown.slice(0, 4);

        data.breakdown.forEach(function (item) {
            var infClass = item.inflation_rate > 0 ? 'positive-inf' : 'negative-inf';
            var infSign = item.inflation_rate > 0 ? '+' : '';
            list.innerHTML +=
                '<div class="breakdown-row">' +
                '<div><strong style="font-size: 1.1rem;">' +
                item.category +
                '</strong>' +
                '<div style="font-size: 0.9rem; color: var(--text-secondary); margin-top: 5px;">Avg Spend: $' +
                item.baseline_spend.toFixed(0) +
                '/mo</div></div>' +
                '<div style="text-align: right;">' +
                '<span class="' +
                infClass +
                '" style="font-size: 1.1rem;">' +
                infSign +
                item.inflation_rate +
                '% YoY</span>' +
                '<div style="font-size: 0.95rem; font-weight: bold; color: var(--text-primary); margin-top: 5px;">+$' +
                item.inflation_tax.toFixed(2) +
                ' Tax</div></div></div>';
        });

        topCategories.forEach(function (item) {
            sim.innerHTML +=
                '<div class="sim-row">' +
                '<label style="font-weight: bold; font-size: 1.05rem;">' +
                item.category +
                '</label>' +
                '<input type="range" class="sim-slider" data-rate="' +
                item.inflation_rate +
                '" min="0" max="' +
                Math.round(item.baseline_spend * 1.5) +
                '" value="' +
                item.baseline_spend +
                '">' +
                '<span class="sim-val" style="text-align: right; color: var(--accent-blue); font-weight: bold; font-size: 1.1rem;">$' +
                item.baseline_spend.toFixed(0) +
                '</span></div>';
        });

        var sliders = document.querySelectorAll('.sim-slider');
        var simTaxDisplay = document.getElementById('simulatedTax');

        function updateSimulator() {
            var newTotalTax = 0;
            sliders.forEach(function (slider) {
                var currentSpend = parseFloat(slider.value);
                var rate = parseFloat(slider.getAttribute('data-rate'));
                slider.nextElementSibling.innerText = '$' + currentSpend.toFixed(0);
                newTotalTax += currentSpend * (rate / 100);
            });
            var staticTax = data.breakdown.slice(4).reduce(function (sum, item) {
                return sum + item.inflation_tax;
            }, 0);
            simTaxDisplay.innerText = '$' + (newTotalTax + staticTax).toFixed(2);
        }

        var confBadge = document.getElementById('confidenceBadge');
        var confText = data.meta.confidence_level;
        confBadge.innerHTML = '<i class="fas fa-shield-alt"></i> Data Confidence: ' + confText;
        confBadge.className = 'confidence-badge';
        if (confText === 'High') confBadge.classList.add('conf-high');
        else if (confText === 'Medium') confBadge.classList.add('conf-medium');
        else confBadge.classList.add('conf-low');

        document.getElementById('confidenceDisclaimer').innerText = data.meta.disclaimer;

        var mathDetails = document.getElementById('mathDetails');
        mathDetails.innerHTML = '';
        data.breakdown.slice(0, 3).forEach(function (item) {
            mathDetails.innerHTML +=
                '<div style="display: flex; justify-content: space-between;">' +
                '<span>' +
                item.category +
                ': $' +
                item.baseline_spend.toFixed(0) +
                ' × ' +
                item.inflation_rate +
                '%</span>' +
                '<span style="color: var(--accent-red);">+$' +
                item.inflation_tax.toFixed(2) +
                '</span></div>';
        });
        mathDetails.innerHTML +=
            '<div style="border-top: 1px solid #444; margin-top: 5px; padding-top: 5px; color: var(--text-secondary);">...plus other categories.</div>';

        document.getElementById('showMathBtn').addEventListener('click', function () {
            var mathBox = document.getElementById('mathBox');
            mathBox.classList.toggle('active');
            if (mathBox.classList.contains('active')) {
                this.innerHTML = '<i class="fas fa-times"></i> Hide Math';
            } else {
                this.innerHTML = '<i class="fas fa-calculator"></i> See the Math';
            }
        });

        updateSimulator();
        sliders.forEach(function (slider) {
            slider.addEventListener('input', function () {
                requestAnimationFrame(updateSimulator);
            });
        });
    }
});
