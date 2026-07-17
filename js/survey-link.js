/**
 * Points survey links at this deploy's survey site.
 *
 * Marketing markup hardcodes the production survey URL, so the links work without
 * JavaScript and production needs no env var. When `config/runtime-env.js` supplies a
 * different `surveyUrl` (e.g. staging-survey.mintraiq.com on preview deploys), the
 * `[data-survey-link]` anchors are repointed.
 */
(function (w, d) {
    'use strict';

    var LINK_SELECTOR = '[data-survey-link]';

    function readSurveyUrl() {
        var env = w.__MINTRAIQ_ENV__;
        if (!env || typeof env !== 'object') return '';
        return String(env.surveyUrl || '').trim();
    }

    function apply() {
        var url = readSurveyUrl();
        if (!url) return;
        var links = d.querySelectorAll(LINK_SELECTOR);
        for (var i = 0; i < links.length; i++) {
            links[i].href = url;
        }
    }

    if (d.readyState === 'loading') {
        d.addEventListener('DOMContentLoaded', apply);
    } else {
        apply();
    }
})(window, document);
