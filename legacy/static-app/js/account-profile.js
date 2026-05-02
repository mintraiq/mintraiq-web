(function () {
    function base() {
        return (window.getLegacyFlaskBase && window.getLegacyFlaskBase()) || 'http://127.0.0.1:5000';
    }

    document.addEventListener('DOMContentLoaded', function () {
        var form = document.getElementById('profileForm');
        if (!form) return;
        form.addEventListener('submit', async function (e) {
            e.preventDefault();
            var msg = document.getElementById('profileStatus');
            var payload = {
                name: document.getElementById('profileName').value,
                email: document.getElementById('profileEmail').value,
                mobile_number: document.getElementById('profilePhone').value || undefined,
                currency: document.getElementById('profileCurrency').value || 'USD'
            };
            try {
                var res = await fetch(base() + '/users/me1', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify(payload)
                });
                var data = await res.json().catch(function () {
                    return {};
                });
                if (msg) {
                    msg.style.display = 'block';
                    if (res.ok) {
                        msg.className = 'status-msg status-success';
                        msg.innerText = data.message || 'Profile updated.';
                    } else {
                        msg.className = 'status-msg status-error';
                        msg.innerText = data.detail || data.message || 'Update failed.';
                    }
                }
            } catch (err) {
                if (msg) {
                    msg.style.display = 'block';
                    msg.className = 'status-msg status-error';
                    msg.innerText = String(err.message || err);
                }
            }
        });
    });
})();
