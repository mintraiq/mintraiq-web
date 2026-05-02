(function () {
    function base() {
        return (window.getLegacyFlaskBase && window.getLegacyFlaskBase()) || 'http://127.0.0.1:5000';
    }

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

    function load() {
        var start = document.getElementById('startDate').value;
        var end = document.getElementById('endDate').value;
        var status = document.getElementById('searchStatus');
        var tbody = document.querySelector('#dateTable tbody');
        if (!start || !end) {
            if (status) status.textContent = 'Pick start and end dates.';
            return;
        }
        var url =
            base() +
            '/list/expenses?draw=1&start=0&length=2000&startDate=' +
            encodeURIComponent(start) +
            '&endDate=' +
            encodeURIComponent(end);
        if (status) status.textContent = 'Loading…';
        fetch(url, { credentials: 'include', headers: { Accept: 'application/json' } })
            .then(function (r) {
                if (!r.ok) throw new Error(r.statusText);
                return r.json();
            })
            .then(function (data) {
                var rows = data.data || [];
                tbody.innerHTML = '';
                rows.forEach(function (raw) {
                    var row = normalizeRow(raw);
                    var tr = document.createElement('tr');
                    tr.innerHTML =
                        '<td>' +
                        row.date +
                        '</td><td>' +
                        row.expenses +
                        '</td><td>' +
                        (row.Description || '') +
                        '</td><td>' +
                        (row.Category || '') +
                        '</td>';
                    tbody.appendChild(tr);
                });
                if (status) status.textContent = 'Showing ' + rows.length + ' row(s).';
            })
            .catch(function (e) {
                console.error(e);
                if (status) status.textContent = 'Error: ' + (e.message || e);
            });
    }

    document.addEventListener('DOMContentLoaded', function () {
        var start = document.getElementById('startDate');
        var end = document.getElementById('endDate');
        if (start && end && !start.value) {
            var t = new Date();
            var first = new Date(t.getFullYear(), t.getMonth(), 1);
            var last = new Date(t.getFullYear(), t.getMonth() + 1, 0);
            var f = function (d) {
                return d.toISOString().slice(0, 10);
            };
            start.value = f(first);
            end.value = f(last);
        }
        var btn = document.getElementById('runSearch');
        if (btn) btn.addEventListener('click', load);
    });
})();
