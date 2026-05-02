

    // --- 1. Income vs Expense Trend Chart ---
    function generate_trendChart(data){
    const trendCtx = document.getElementById('trendChart').getContext('2d');
    new Chart(trendCtx, {
        type: 'line',
        data: {
            labels: data.main_trend_chart.labels,
            datasets: [{
                label: 'Income',
                data: data.main_trend_chart.income_series,
                borderColor: '#00ff9d',
                backgroundColor: 'rgba(0, 255, 157, 0.1)',
                tension: 0.4,
                fill: true
            }, {
                label: 'Expenses',
                data: data.main_trend_chart.expense_series,
                borderColor: '#ff4757',
                backgroundColor: 'rgba(255, 71, 87, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top' }
            },
            scales: {
                y: { beginAtZero: true, grid: { color: '#222' } },
                x: { grid: { display: false } }
            }
        }
    });
    }
    // --- 2. Expense Breakdown Doughnut Chart ---
    function generate_doughnut_chart(data){
    const breakdownCtx = document.getElementById('breakdownChart').getContext('2d');
    new Chart(breakdownCtx, {
        type: 'doughnut',
        data: {
            labels: data.expense_breakdown.labels,
            datasets: [{
                data: data.expense_breakdown.data,
                backgroundColor: [
                    '#2f80ed', '#00ff9d', '#f1c40f', '#bb6bd9', '#ff4757'
                ],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'right' }
            },
            cutout: '70%'
        }
    });
    }

    // --- 3. AI Forecast Line Chart ---
    function generate_forecast(data){
    const aiCtx = document.getElementById('aiForecastChart').getContext('2d');
    // Generate some dummy projection data
    let currentValue = 76000;
    const projectionData = data.forecast.yearly_projection.data_points;
    document.getElementById("eoy_projection").innerText =
      "$" + data.forecast.yearly_projection.end_of_year_value;

    new Chart(aiCtx, {
        type: 'line',
        data: {
            labels: ['J','F','M','A','M','J','J','A','S','O','N','D'],
            datasets: [{
                label: 'Projected Net Worth',
                data: projectionData,
                borderColor: '#bb6bd9',
                borderWidth: 3,
                pointBackgroundColor: '#bb6bd9',
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { display: false }, // Hide Y axis for cleaner look in small card
                x: { grid: { display: false } }
            }
        }
    });
    }
   //4. Generate dashboard data
   function generate_dashboard(data)
   {

    console.log(data)

    document.getElementById("current_income").innerText =
      "$" + data.metrics.income.current;
    document.getElementById("current_expense").innerText =
      "$" + data.metrics.expenses.current;
    document.getElementById("current_savings").innerText =
      "$" + data.metrics.savings.current;
    document.getElementById("current_investments").innerText =
      "$" + data.metrics.investments.current;

    document.getElementById("current_investments").innerText =
      "$" + data.metrics.investments.current;
    if (data.ai_status === 'Online') {
    document.getElementById("est_income").innerText =
      "$" + data.forecast.next_month.est_income;

    document.getElementById("est_expenses").innerText =
      "$" + data.forecast.next_month.est_expense;
      }

   }
   //5. Generate recommendatios
   function generate_recommendations    (data)
   {


    const list = document.getElementById("recommendationList");
    list.innerHTML = "";

    (data.recommendations || []).forEach(rec => {
        const li = document.createElement("li");

        // Severity-based styling
        let color = "var(--accent-green)";
        let bg = "rgba(16, 185, 129, 0.1)";

        if (rec.severity === "High") {
            color = "var(--accent-red)";
            bg = "rgba(239, 68, 68, 0.1)";
        } else if (rec.severity === "Medium") {
            color = "var(--accent-blue)";
            bg = "rgba(47, 128, 237, 0.1)";
        }

        li.innerHTML = `
            <div class="rec-icon" style="color:${color}; background-color:${bg}">
                <i class="fas ${rec.icon || "fa-lightbulb"}"></i>
            </div>
            <div>
                <strong>${rec.title}</strong>
                <p style="font-size: 0.9rem; color: var(--text-secondary);">
                    ${rec.description}
                </p>
            </div>
        `;

        list.appendChild(li);
    });
    }


  //6.Generate High Expense Alert
  function generate_high_expense_alert(data)
  {
    const amount = 450;
    const category = "Dining Out";
    const breach = 30;

    const exp_alert = document.getElementById("high_expense_id");

    exp_alert.innerHTML = "";

    //exp_alert.innerHTML = `
    //  <p style="margin: 15px 0;">
    //    You've spent <strong>${amount}</strong> on "${category}" this week,
     //   exceeding your weekly budget by ${breach}%.
    //  </p>
    //`;

    (data.high_expense_alert || []).forEach(al => {
        const li = document.createElement("li");

        // Severity-based styling
        let color = "var(--accent-green)";
        let bg = "rgba(16, 185, 129, 0.1)";

        if (al.severity === "High") {
            color = "var(--accent-red)";
            bg = "rgba(239, 68, 68, 0.1)";
        } else if (al.severity === "Medium") {
            color = "var(--accent-blue)";
            bg = "rgba(47, 128, 237, 0.1)";
        }

        li.innerHTML = `
            <p style="margin: 15px 0;color:${color}">
             You've spent <strong>${al.amount}</strong> on "${al.category}" this week,
             exceeding your weekly budget by ${al.breach}%.
            </p>

        `;

        exp_alert.appendChild(li);
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
   var date = new Date();

   var firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
   var lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);
      // 4. Helper function to safely format to YYYY-MM-DD in LOCAL time
    const formatLocalDate = (date) => {
        const year = date.getFullYear();
        // Months are 0-indexed, so we add 1. padStart ensures "3" becomes "03"
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');

        return `${year}-${month}-${day}`;
    };

    // 5. Generate the final strings
    const startDateString = formatLocalDate(firstDay);
    const endDateString = formatLocalDate(lastDay);
    const financedata = {

        // 1. Sending just a start Date: "2026-03-21"
        start_date: startDateString,

        // 2. Sending a end date as str: "2026-03-21"
        end_date: endDateString
    };

   //if (!typeof isLoggedIn !== 'undefined' && !isLoggedIn) {
   //     console.log("User is not authenticated. Dashboard scripts halted.");
   //     return;
   // }

    console.log("Fetching secure financial data...");

    // 2. Fetch all required data concurrently using Promise.all
    // This allows both API calls to happen at the exact same time
    Promise.all([
        window.fetchSecureAPI('/api/generate','POST',financedata),
        //window.fetchSecureAPI('/api/recent-alerts') // Example second endpoint
    ])
    .then(([data]) => {

        // 3. Safety check: fetchSecureAPI returns null if it hits a 401 Unauthorized
        if (!data) return;
        // 1. Catch the Empty State
        if (data.ai_status === 'DATA_MISSING') {
             document.querySelector('.grid-container').innerHTML =  `
                <div class="empty-state-card">
                    <i class="fas fa-file-invoice-dollar empty-state-icon"></i>
                    <h3>Awaken Your AI Advisor</h3>
                    <p>We couldn't find any transactions for this month. Upload your latest bank statements or scan your receipts to unlock your financial forecast.</p>
                    <a href="/upload" class="btn-save" style="text-decoration: none; display: inline-block;">
                        <i class="fas fa-cloud-upload-alt"></i> Upload Statement
                    </a>
                </div>
            `;
            return; // Stop rendering the rest of the charts
        }
        // 4. FIRE YOUR BUNCH OF METHODS HERE!
        generate_dashboard(data)
        generate_trendChart(data)
        generate_doughnut_chart(data)
        // Compensation Logic
        if (data.ai_status === 'Offline') {
           showNinjaWarning("AI Forecasting is currently offline. Viewing historical data only.");
        }else{
          generate_forecast(data)
          generate_recommendations(data)
        }
        generate_high_expense_alert(data)
     })

    .catch(err => {
      console.error("Fetch failed:", err);
      // Stop the flicker by showing a static error card
      document.querySelector('.grid-container').innerHTML = `
        <div class="card grid-span-4" style="text-align:center; padding:50px;">
            <i class="fas fa-exclamation-triangle fa-3x" style="color:var(--accent-red)"></i>
            <h3>Ninja Connection Interrupted</h3>
            <p>We couldn't retrieve your scrolls. Please refresh the page.</p>
        </div>`;
    });
});

function showNinjaWarning(msg) {
    const alert = document.createElement('div');
    alert.style = "position:fixed; top:20px; right:20px; background:rgba(255,0,0,0.1); border:1px solid var(--accent-red); color:white; padding:15px; z-index:10001; border-radius:8px;";
    alert.innerHTML = `<i class="fas fa-user-ninja"></i> ${msg}`;
    document.body.appendChild(alert);
    setTimeout(() => alert.remove(), 5000);
}

// Function to toggle the expanded card visibility
function toggleNudgeCard() {
    const card = document.getElementById('aiNudgeCard');
    card.classList.toggle('active');
}

// Function to fetch and display the ML predictions
async function loadAINudges() {
    if (typeof isLoggedIn !== 'undefined' && !isLoggedIn) return;

    try {
        // Call the FastAPI endpoint we created in the previous step
        const response = await window.fetchSecureAPI('/api/ai-reserves','GET');

        if (!response || !response.alerts || response.alerts.length === 0) {
            // No upcoming bills? Leave the widget hidden entirely.
            return;
        }

        const container = document.getElementById('aiNudgeContainer');
        const contentArea = document.getElementById('aiNudgeContent');

        // Clear a loading state if you have one
        contentArea.innerHTML = "";

        // Build the HTML for each alert
        response.alerts.forEach(alert => {
            const div = document.createElement('div');
            div.className = 'nudge-item';

            // Format the date nicely (e.g., "April 15, 2026")
            const dateObj = new Date(alert.expected_next_date);
            const dateString = dateObj.toLocaleDateString('en-NZ', { month: 'short', day: 'numeric' });

            div.innerHTML = `
                <div class="nudge-merchant">
                    ${alert.merchant}
                    <span class="nudge-amount">$${alert.recommended_reserve_amount.toFixed(2)}</span>
                </div>
                <div class="nudge-details">
                    <i class="far fa-calendar-alt"></i> Due ~${dateString} (${alert.frequency})
                </div>
            `;
            contentArea.appendChild(div);
        });

        // Data is ready. Unhide the pulsing radar button!
        container.style.display = 'flex';

    } catch (error) {
        console.error("Failed to load AI nudges:", error);
    }
}

// Ensure this runs when the dashboard loads
document.addEventListener('DOMContentLoaded', loadAINudges);
