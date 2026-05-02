(function () {
    document.addEventListener('DOMContentLoaded', function () {
        var form = document.getElementById('csvUploadForm');
        if (!form) return;
        var b = (window.getLegacyFlaskBase && window.getLegacyFlaskBase()) || 'http://127.0.0.1:5000';
        form.action = b + '/upload';
        form.method = 'post';
        form.enctype = 'multipart/form-data';
    });
})();
