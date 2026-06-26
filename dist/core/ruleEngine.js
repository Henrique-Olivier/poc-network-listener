"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.diagnoseNetwork = void 0;
var metricsStore_1 = require("./metricsStore");
var DEFAULT_WIDESPREAD_AFFECTED_ENDPOINT_RATIO = 0.6;
var DEFAULT_SPECIFIC_ENDPOINT_RATIO_THRESHOLD = 0.3;
var DEFAULT_HIGH_SERVER_ERROR_RATE = 0.2;
var DEFAULT_HIGH_CLIENT_ERROR_RATE = 0.3;
var DEFAULT_HIGH_NETWORK_ERROR_RATE = 0.15;
var DEFAULT_HIGH_TIMEOUT_RATE = 0.15;
var DEFAULT_HEALTHY_ERROR_RATE_THRESHOLD = 0.05;
var DEFAULT_HEALTHY_SLOW_REQUEST_RATE_THRESHOLD = 0.2;
function resolveOptions(options) {
    return {
        minimumSamplesToDiagnose: options.minimumSamplesToDiagnose,
        slowRequestThresholdMs: options.slowRequestThresholdMs,
        widespreadAffectedEndpointRatio: typeof options.widespreadAffectedEndpointRatio === 'number'
            ? options.widespreadAffectedEndpointRatio
            : DEFAULT_WIDESPREAD_AFFECTED_ENDPOINT_RATIO,
        specificEndpointRatioThreshold: typeof options.specificEndpointRatioThreshold === 'number'
            ? options.specificEndpointRatioThreshold
            : DEFAULT_SPECIFIC_ENDPOINT_RATIO_THRESHOLD,
        highServerErrorRate: typeof options.highServerErrorRate === 'number' ? options.highServerErrorRate : DEFAULT_HIGH_SERVER_ERROR_RATE,
        highClientErrorRate: typeof options.highClientErrorRate === 'number' ? options.highClientErrorRate : DEFAULT_HIGH_CLIENT_ERROR_RATE,
        highNetworkErrorRate: typeof options.highNetworkErrorRate === 'number' ? options.highNetworkErrorRate : DEFAULT_HIGH_NETWORK_ERROR_RATE,
        highTimeoutRate: typeof options.highTimeoutRate === 'number' ? options.highTimeoutRate : DEFAULT_HIGH_TIMEOUT_RATE,
        healthyErrorRateThreshold: typeof options.healthyErrorRateThreshold === 'number'
            ? options.healthyErrorRateThreshold
            : DEFAULT_HEALTHY_ERROR_RATE_THRESHOLD,
        healthySlowRequestRateThreshold: typeof options.healthySlowRequestRateThreshold === 'number'
            ? options.healthySlowRequestRateThreshold
            : DEFAULT_HEALTHY_SLOW_REQUEST_RATE_THRESHOLD,
    };
}
function percentile(sortedValues, percentileValue) {
    var index;
    if (sortedValues.length === 0) {
        return 0;
    }
    index = Math.ceil((percentileValue / 100) * sortedValues.length) - 1;
    if (index < 0) {
        index = 0;
    }
    return sortedValues[index];
}
function pushUniqueString(values, value) {
    if (values.indexOf(value) < 0) {
        values.push(value);
    }
}
function pushUniqueNumber(values, value) {
    if (values.indexOf(value) < 0) {
        values.push(value);
    }
}
function getEndpointIssueType(event, slowRequestThresholdMs) {
    if (event.timedOut) {
        return 'timeout';
    }
    if (event.durationMs >= slowRequestThresholdMs) {
        return 'slow';
    }
    if (event.errorType) {
        return event.errorType;
    }
    if (typeof event.status === 'number' && event.status >= 500) {
        return 'http-server';
    }
    if (typeof event.status === 'number' && event.status >= 400) {
        return 'http-client';
    }
    return undefined;
}
function buildAffectedEndpoints(events, slowRequestThresholdMs) {
    var grouped = {};
    var result = [];
    var i;
    var event;
    var route;
    var item;
    var issueType;
    for (i = 0; i < events.length; i += 1) {
        event = events[i];
        route = event.normalizedRoute;
        if (!grouped[route]) {
            grouped[route] = {
                normalizedRoute: route,
                requestCount: 0,
                errors: 0,
                timeouts: 0,
                slowRequests: 0,
                durations: [],
                statusCodes: [],
                issueTypes: [],
            };
        }
        item = grouped[route];
        item.requestCount += 1;
        item.durations.push(event.durationMs);
        if (!event.success) {
            item.errors += 1;
        }
        if (event.timedOut) {
            item.timeouts += 1;
        }
        if (event.durationMs >= slowRequestThresholdMs) {
            item.slowRequests += 1;
        }
        if (typeof event.status === 'number' && event.status >= 400) {
            pushUniqueNumber(item.statusCodes, event.status);
        }
        issueType = getEndpointIssueType(event, slowRequestThresholdMs);
        if (issueType) {
            pushUniqueString(item.issueTypes, issueType);
        }
    }
    for (route in grouped) {
        if (Object.prototype.hasOwnProperty.call(grouped, route)) {
            item = grouped[route];
            if (item.issueTypes.length > 0) {
                item.durations.sort(function (a, b) {
                    return a - b;
                });
                result.push({
                    normalizedRoute: item.normalizedRoute,
                    requestCount: item.requestCount,
                    errorRate: item.errors / item.requestCount,
                    timeoutRate: item.timeouts / item.requestCount,
                    slowRequestRate: item.slowRequests / item.requestCount,
                    medianDurationMs: percentile(item.durations, 50),
                    p95DurationMs: percentile(item.durations, 95),
                    statusCodes: item.statusCodes.sort(function (a, b) {
                        return a - b;
                    }),
                    issueTypes: item.issueTypes,
                });
            }
        }
    }
    result.sort(function (a, b) {
        var aScore = a.errorRate + a.timeoutRate + a.slowRequestRate;
        var bScore = b.errorRate + b.timeoutRate + b.slowRequestRate;
        return bScore - aScore;
    });
    return result;
}
function buildDiagnosis(status, probableCause, confidenceLevel, reasons, events, slowRequestThresholdMs, affectedEndpoints) {
    return {
        status: status,
        probableCause: probableCause,
        confidenceLevel: confidenceLevel,
        reasons: reasons,
        summary: (0, metricsStore_1.calculateSummary)(events, slowRequestThresholdMs),
        affectedEndpoints: affectedEndpoints || buildAffectedEndpoints(events, slowRequestThresholdMs),
    };
}
function diagnoseNetwork(events, options) {
    var config = resolveOptions(options);
    var summary = (0, metricsStore_1.calculateSummary)(events, config.slowRequestThresholdMs);
    var affectedEndpoints = buildAffectedEndpoints(events, config.slowRequestThresholdMs);
    var affectedEndpointCount = affectedEndpoints.length;
    var isWidespread = summary.affectedEndpointRatio >= config.widespreadAffectedEndpointRatio && affectedEndpointCount > 1;
    var isSpecificEndpoint = affectedEndpointCount === 1 ||
        (affectedEndpointCount > 0 && summary.affectedEndpointRatio <= config.specificEndpointRatioThreshold);
    var hasHighServerErrors = summary.serverErrorRate >= config.highServerErrorRate;
    var hasHighClientErrors = summary.clientErrorRate >= config.highClientErrorRate;
    var hasHighNetworkErrors = summary.networkErrorRate >= config.highNetworkErrorRate;
    var hasHighTimeouts = summary.timeoutRate >= config.highTimeoutRate;
    var hasMeaningfulSlowRequests = summary.slowRequestRate > config.healthySlowRequestRateThreshold;
    var confidenceForSampleSize = summary.requestCount >= config.minimumSamplesToDiagnose * 2 ? 'high' : 'medium';
    if (summary.requestCount < config.minimumSamplesToDiagnose) {
        return buildDiagnosis('unknown', 'unknown', 'low', ['Not enough samples to diagnose network communication.'], events, config.slowRequestThresholdMs, affectedEndpoints);
    }
    if (isWidespread && hasMeaningfulSlowRequests && hasHighServerErrors) {
        return buildDiagnosis('poor', 'infrastructure', confidenceForSampleSize, [
            'Several endpoints are degraded.',
            'A significant server error rate was detected.',
            'The pattern indicates a probable backend or infrastructure issue.',
        ], events, config.slowRequestThresholdMs, affectedEndpoints);
    }
    if (isWidespread && (hasHighTimeouts || hasHighNetworkErrors) && !hasHighServerErrors) {
        return buildDiagnosis('poor', 'client-network-or-infrastructure', 'medium', [
            'Several endpoints are affected.',
            'A significant timeout or network error rate was detected.',
            'The available data is not sufficient to distinguish client network from infrastructure.',
        ], events, config.slowRequestThresholdMs, affectedEndpoints);
    }
    if (isSpecificEndpoint) {
        return buildDiagnosis(hasHighTimeouts || hasHighNetworkErrors || hasHighServerErrors || hasHighClientErrors ? 'poor' : 'degraded', 'specific-endpoint', 'medium', ['The degradation is concentrated in a small set of endpoints.'], events, config.slowRequestThresholdMs, affectedEndpoints);
    }
    if (isWidespread &&
        hasMeaningfulSlowRequests &&
        !hasHighServerErrors &&
        !hasHighTimeouts &&
        !hasHighNetworkErrors) {
        return buildDiagnosis('degraded', 'client-network', 'medium', [
            'Several different endpoints are slow in the current sample window.',
            'Most requests completed successfully.',
            'No significant server error rate was detected.',
            'The pattern is compatible with a slow or limited client connection.',
        ], events, config.slowRequestThresholdMs, affectedEndpoints);
    }
    if (hasHighClientErrors && !hasMeaningfulSlowRequests) {
        return buildDiagnosis('degraded', 'client-request', 'medium', [
            'A significant client error rate was detected.',
            'HTTP 4xx responses usually indicate request, authorization, validation, or routing issues.',
        ], events, config.slowRequestThresholdMs, affectedEndpoints);
    }
    if (hasHighServerErrors) {
        return buildDiagnosis('poor', 'backend', confidenceForSampleSize, ['Many requests are failing with 5xx server errors.'], events, config.slowRequestThresholdMs, affectedEndpoints);
    }
    if (summary.slowRequestRate <= config.healthySlowRequestRateThreshold &&
        summary.errorRate <= config.healthyErrorRateThreshold &&
        summary.timeoutRate < config.highTimeoutRate &&
        summary.networkErrorRate < config.highNetworkErrorRate) {
        return buildDiagnosis('good', 'unknown', confidenceForSampleSize, ['Most requests in the current sample window are healthy.'], events, config.slowRequestThresholdMs, affectedEndpoints);
    }
    return buildDiagnosis('unknown', 'unknown', 'low', ['The current sample window does not match a confident diagnosis rule.'], events, config.slowRequestThresholdMs, affectedEndpoints);
}
exports.diagnoseNetwork = diagnoseNetwork;
