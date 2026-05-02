(function () {
    document.addEventListener('DOMContentLoaded', function () {
        var b = (window.getLegacyFlaskBase && window.getLegacyFlaskBase()) || 'http://127.0.0.1:5000';
        document.querySelectorAll('iframe[data-flask-path]').forEach(function (el) {
            el.src = b + el.getAttribute('data-flask-path');
        });
    });
})();
