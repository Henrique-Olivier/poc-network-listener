"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createNetworkListener = void 0;
var axiosAdapter_1 = require("../adapters/axiosAdapter");
var fetchAdapter_1 = require("../adapters/fetchAdapter");
var metricsStore_1 = require("./metricsStore");
var routeNormalizer_1 = require("./routeNormalizer");
var ruleEngine_1 = require("./ruleEngine");
var DEFAULT_SLOW_REQUEST_THRESHOLD_MS = 1500;
var DEFAULT_MAX_SAMPLES = 20;
var DEFAULT_MINIMUM_SAMPLES_TO_DIAGNOSE = 5;
var DEFAULT_TIMEOUT_THRESHOLD_MS = 30000;
function now() {
    return new Date().getTime();
}
function createNetworkListener(options) {
    var resolvedOptions = options || {};
    var slowRequestThresholdMs = resolvedOptions.slowRequestThresholdMs || DEFAULT_SLOW_REQUEST_THRESHOLD_MS;
    var maxSamples = resolvedOptions.maxSamples || DEFAULT_MAX_SAMPLES;
    var minimumSamplesToDiagnose = resolvedOptions.minimumSamplesToDiagnose || DEFAULT_MINIMUM_SAMPLES_TO_DIAGNOSE;
    var timeoutThresholdMs = resolvedOptions.timeoutThresholdMs || DEFAULT_TIMEOUT_THRESHOLD_MS;
    var routeNormalizer = resolvedOptions.routeNormalizer || routeNormalizer_1.defaultRouteNormalizer;
    var store = (0, metricsStore_1.createMetricsStore)({
        maxSamples: maxSamples,
        slowRequestThresholdMs: slowRequestThresholdMs,
    });
    var subscribers = [];
    var started = false;
    var requestSequence = 0;
    var fetchUninstall;
    var axiosUninstalls = [];
    function nextRequestId() {
        requestSequence += 1;
        return 'nl_' + now() + '_' + requestSequence;
    }
    function getSnapshot() {
        return (0, ruleEngine_1.diagnoseNetwork)(store.getEvents(), {
            minimumSamplesToDiagnose: minimumSamplesToDiagnose,
            slowRequestThresholdMs: slowRequestThresholdMs,
        });
    }
    function notify() {
        var snapshot = getSnapshot();
        var copy = subscribers.slice();
        var i;
        for (i = 0; i < copy.length; i += 1) {
            copy[i](snapshot);
        }
    }
    function record(event) {
        store.add(event);
        notify();
    }
    return {
        start: function start() {
            started = true;
        },
        stop: function stop() {
            started = false;
        },
        subscribe: function subscribe(subscriber) {
            subscribers.push(subscriber);
            return function unsubscribe() {
                var index = subscribers.indexOf(subscriber);
                if (index >= 0) {
                    subscribers.splice(index, 1);
                }
            };
        },
        getSnapshot: getSnapshot,
        record: record,
        installFetch: function installFetch(target) {
            if (fetchUninstall) {
                return fetchUninstall;
            }
            fetchUninstall = (0, fetchAdapter_1.installFetchAdapter)({
                target: target,
                isStarted: function isStarted() {
                    return started;
                },
                onEvent: record,
                routeNormalizer: routeNormalizer,
                timeoutThresholdMs: timeoutThresholdMs,
                now: now,
                nextRequestId: nextRequestId,
            });
            return fetchUninstall;
        },
        installAxios: function installAxios(axiosInstance) {
            var uninstall = (0, axiosAdapter_1.installAxiosAdapter)({
                axiosInstance: axiosInstance,
                isStarted: function isStarted() {
                    return started;
                },
                onEvent: record,
                routeNormalizer: routeNormalizer,
                timeoutThresholdMs: timeoutThresholdMs,
                now: now,
                nextRequestId: nextRequestId,
            });
            axiosUninstalls.push(uninstall);
            return function uninstallAxios() {
                var index = axiosUninstalls.indexOf(uninstall);
                if (index >= 0) {
                    axiosUninstalls.splice(index, 1);
                }
                uninstall();
            };
        },
    };
}
exports.createNetworkListener = createNetworkListener;
