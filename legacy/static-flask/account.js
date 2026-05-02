// Wait for the HTML to fully render before looking for forms
document.addEventListener('DOMContentLoaded', () => {

    // Centralized Configuration
    const API_BASE_URL = "http://localhost:5000";

    // ==========================================
    // REUSABLE API HELPER
    // Centralizes the fetch logic, headers, and error handling
    // ==========================================
    async function sendApiRequest(endpoint, method, payload) {
        try {
            const response = await fetch(`${API_BASE_URL}${endpoint}`, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include', // Ensures your secure cookie is sent!
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.detail || "An unexpected error occurred");
            }

            return await response.json();
        } catch (error) {
            alert("Error: " + error.message);
            return null; // Return null so the form knows it failed
        }
    }

    // ==========================================
    // 1. PROFILE TAB LOGIC
    // ==========================================
    const profileForm = document.getElementById('profileForm');
    if (profileForm) {
        profileForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const payload = {
                name: document.getElementById('profileName').value,
                mobileNumber: document.getElementById('profileMobile').value,
                currency: document.getElementById('profileCurrency').value
            };

            const data = await sendApiRequest('/api/users/me', 'PUT', payload);

            if (data) {
                // Success UI update
                const statusText = document.getElementById('profileStatus');
                statusText.style.display = 'inline';
                setTimeout(() => statusText.style.display = 'none', 3000);
            }
        });
    }

    // ==========================================
    // 2. SECURITY TAB LOGIC
    // ==========================================
    const securityForm = document.getElementById('securityForm');
    if (securityForm) {
        securityForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const currentPass = document.getElementById('currentPassword').value;
            const newPass = document.getElementById('newPassword').value;
            const confirmPass = document.getElementById('confirmPassword').value;

            if (newPass !== confirmPass) {
                alert("New passwords do not match!");
                return;
            }

            const payload = {
                currentPassword: currentPass,
                newPassword: newPass
            };

            const data = await sendApiRequest('/api/users/security', 'PUT', payload);

            if (data) {
                const statusText = document.getElementById('securityStatus');
                statusText.style.display = 'inline';
                securityForm.reset(); // Clear the sensitive inputs!
                setTimeout(() => statusText.style.display = 'none', 3000);
            }
        });
    }

    // ==========================================
    // 3. BILLING TAB LOGIC (Global Functions)
    // ==========================================
    // Because the billing buttons use onclick="startCheckout('tier')",
    // we need to attach these to the global window object.

    window.startCheckout = async function(tierName) {
        const payload = { tier: tierName };
        const data = await sendApiRequest('/api/create-checkout-session', 'POST', payload);

        if (data && data.url) {
            window.location.href = data.url; // Redirect to Stripe/Mock
        }
    };

    window.applyPromo = async function() {
        const promoCode = document.getElementById('promoCode').value;
        if (!promoCode) {
            alert("Please enter a code");
            return;
        }

        const payload = { tier: "premium", promoCode: promoCode };
        const data = await sendApiRequest('/create-checkout-session', 'POST', payload);

        if (data) {
            alert(data.message);
            window.location.reload(); // Reload the page to reflect the new tier
        }
    };
});