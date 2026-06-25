"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.installFetchAdapter = void 0;
var MARKER = '__networkListenerFetchInstalled';
var ORIGINAL = '__networkListenerOriginalFetch';
function getDefaultTarget() {
    if (typeof window !== 'undefined') {
        return window;
    }
    return undefined;
}
function getFetchUrl(input) {
    if (typeof input === 'string') {
        return input;
    }
    if (input && typeof input.url === 'string') {
        return input.url;
    }
    return '';
}
function getFetchMethod(input, init) {
    if (init && init.method) {
        return String(init.method).toUpperCase();
    }
    if (input && input.method) {
        return String(input.method).toUpperCase();
    }
    return 'GET';
}
function classifyError(error, durationMs, timeoutThresholdMs) {
    var name = error && error.name ? String(error.name) : '';
    var message = error && error.message ? String(error.message) : '';
    var aborted = name === 'AbortError';
    var timedOut = durationMs >= timeoutThresholdMs || /timeout/i.test(message);
    return {
        errorType: timedOut ? 'timeout' : aborted ? 'aborted' : 'network',
        timedOut: timedOut,
        aborted: aborted,
    };
}
function installFetchAdapter(options) {
    var target = options.target || getDefaultTarget();
    var currentFetch;
    var originalFetch;
    if (!target || !target.fetch) {
        return function noop() { };
    }
    currentFetch = target.fetch;
    if (currentFetch[MARKER]) {
        return function noop() { };
    }
    originalFetch = currentFetch;
    function wrappedFetch() {
        var args = arguments;
        var input = args[0];
        var init = args[1];
        var url = getFetchUrl(input);
        var route = options.routeNormalizer(url);
        var method = getFetchMethod(input, init);
        var requestId = options.nextRequestId();
        var startedAt = options.now();
        return originalFetch.apply(this, args).then(function onResponse(response) {
            var finishedAt = options.now();
            var status = response && typeof response.status === 'number' ? response.status : undefined;
            var success = typeof status === 'number' ? status < 400 : true;
            var durationMs = finishedAt - startedAt;
            if (options.isStarted()) {
                options.onEvent({
                    requestId: requestId,
                    source: 'fetch',
                    method: method,
                    url: url,
                    route: route,
                    normalizedRoute: route,
                    startedAt: startedAt,
                    finishedAt: finishedAt,
                    durationMs: durationMs,
                    status: status,
                    success: success,
                    errorType: success ? undefined : status && status >= 500 ? 'http-server' : 'http-client',
                    timedOut: durationMs >= options.timeoutThresholdMs,
                    aborted: false,
                });
            }
            return response;
        }, function onError(error) {
            var finishedAt = options.now();
            var durationMs = finishedAt - startedAt;
            var errorInfo = classifyError(error, durationMs, options.timeoutThresholdMs);
            if (options.isStarted()) {
                options.onEvent({
                    requestId: requestId,
                    source: 'fetch',
                    method: method,
                    url: url,
                    route: route,
                    normalizedRoute: route,
                    startedAt: startedAt,
                    finishedAt: finishedAt,
                    durationMs: durationMs,
                    success: false,
                    errorType: errorInfo.errorType,
                    timedOut: errorInfo.timedOut,
                    aborted: errorInfo.aborted,
                });
            }
            throw error;
        });
    }
    wrappedFetch[MARKER] = true;
    wrappedFetch[ORIGINAL] = originalFetch;
    target.fetch = wrappedFetch;
    return function uninstallFetchAdapter() {
        if (target && target.fetch === wrappedFetch) {
            target.fetch = originalFetch;
        }
    };
}
exports.installFetchAdapter = installFetchAdapter;
