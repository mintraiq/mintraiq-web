(function () {
    function base() {
        return (window.getLegacyFlaskBase && window.getLegacyFlaskBase()) || 'http://127.0.0.1:5000';
    }

    document.addEventListener('DOMContentLoaded', function () {
        var form = document.getElementById('goalsForm');
        if (!form) return;
        form.addEventListener('submit', async function (e) {
            e.preventDefault();
            var btn = form.querySelector('button');
            var statusMsg = document.getElementById('statusMsg');
            var payload = {
                goal_amount: parseFloat(document.getElementById('goalAmount').value),
                interval: document.getElementById('interval').value
            };
            btn.disabled = true;
            btn.innerText = 'Saving...';
            if (statusMsg) statusMsg.style.display = 'none';
            try {
                var res = await fetch(base() + '/account/goals', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify(payload)
                });
                var result = await res.json();
                if (statusMsg) {
                    statusMsg.style.display = 'block';
                    if (result.status === 'success') {
                        statusMsg.className = 'status-msg status-success';
                        statusMsg.innerText = result.message;
                    } else {
                        statusMsg.className = 'status-msg status-error';
                        statusMsg.innerText = result.detail || 'Failed to save goal.';
                    }
                }
            } catch (err) {
                if (statusMsg) {
                    statusMsg.style.display = 'block';
                    statusMsg.className = 'status-msg status-error';
                    statusMsg.innerText = 'Network error. Please try again.';
                }
            } finally {
                btn.disabled = false;
                btn.innerText = 'Save Goal';
            }
        });
    });
})();
