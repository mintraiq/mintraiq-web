/**
 * Renders /list/monthly_expenses (DataTables JSON) into #transactionsTable.
 */
(function () {
    function normalizeRow(row) {
        if (!row) return null;
        if (Array.isArray(row)) {
            return {
                date: row[0],
                expenses: row[1],
                Description: row[2],
                Category: row[3]
            };
        }
        return row;
    }

    function render(rows) {
        var tbody = document.querySelector('#transactionsTable tbody');
        if (!tbody) return;
        tbody.innerHTML = '';
        if (!rows.length) {
            tbody.innerHTML =
                '<tr><td colspan="4" style="text-align:center;padding:24px;color:var(--text-secondary)">No rows returned.</td></tr>';
            return;
        }
        rows.forEach(function (raw) {
            var r = normalizeRow(raw);
            var tr = document.createElement('tr');
            tr.innerHTML =
                '<td>' +
                (r.date != null ? r.date : '') +
                '</td><td class="align-right">' +
                (r.expenses != null ? r.expenses : '') +
                '</td><td>' +
                (r.Description != null ? r.Description : r.description || '') +
                '</td><td>' +
                (r.Category != null ? r.Category : r.category || '') +
                '</td>';
            tbody.appendChild(tr);
        });
    }

    document.addEventListener('DOMContentLoaded', function () {
        var status = document.getElementById('tableStatus');
        window
            .fetchSecureAPI('/api/transactions')
            .then(function (data) {
                if (!data) return;
                var rows = data.data || data.aaData || [];
                if (status) status.textContent = 'Loaded ' + rows.length + ' row(s).';
                render(Array.isArray(rows) ? rows : []);
            })
            .catch(function (e) {
                console.error(e);
                if (status) {
                    status.textContent = 'Failed: ' + (e.message || e) + ' — ensure Flask is running and you are logged in.';
                }
            });
    });
})();
