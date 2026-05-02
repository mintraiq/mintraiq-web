/** Same as transactions but explicit label for monthly route. */
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

    document.addEventListener('DOMContentLoaded', function () {
        var tbody = document.querySelector('#monthlyTable tbody');
        var status = document.getElementById('monthlyStatus');
        window
            .fetchSecureAPI('/api/transactions')
            .then(function (data) {
                if (!data) return;
                var rows = data.data || [];
                tbody.innerHTML = '';
                rows.forEach(function (raw) {
                    var r = normalizeRow(raw);
                    var tr = document.createElement('tr');
                    tr.innerHTML =
                        '<td>' +
                        r.date +
                        '</td><td>' +
                        r.expenses +
                        '</td><td>' +
                        (r.Description || '') +
                        '</td><td>' +
                        (r.Category || '') +
                        '</td>';
                    tbody.appendChild(tr);
                });
                if (status) status.textContent = rows.length + ' row(s).';
            })
            .catch(function (e) {
                if (status) status.textContent = String(e.message || e);
            });
    });
})();
