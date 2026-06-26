import { installAxiosAdapter } from '../adapters/axiosAdapter';
import { installFetchAdapter } from '../adapters/fetchAdapter';
import { createMetricsStore } from './metricsStore';
import { defaultRouteNormalizer } from './routeNormalizer';
import { diagnoseNetwork } from './ruleEngine';
import {
  AxiosLike,
  FetchTarget,
  NetworkDiagnosis,
  NetworkDiagnosisSubscriber,
  NetworkListener,
  NetworkListenerOptions,
  NetworkRequestEvent,
  Uninstall,
} from './types';

var DEFAULT_SLOW_REQUEST_THRESHOLD_MS = 1500;
var DEFAULT_MAX_SAMPLES = 20;
var DEFAULT_MINIMUM_SAMPLES_TO_DIAGNOSE = 5;
var DEFAULT_TIMEOUT_THRESHOLD_MS = 30000;
var DEFAULT_WIDESPREAD_AFFECTED_ENDPOINT_RATIO = 0.6;
var DEFAULT_SPECIFIC_ENDPOINT_RATIO_THRESHOLD = 0.3;
var DEFAULT_HIGH_SERVER_ERROR_RATE = 0.2;
var DEFAULT_HIGH_CLIENT_ERROR_RATE = 0.3;
var DEFAULT_HIGH_NETWORK_ERROR_RATE = 0.15;
var DEFAULT_HIGH_TIMEOUT_RATE = 0.15;
var DEFAULT_HEALTHY_ERROR_RATE_THRESHOLD = 0.05;
var DEFAULT_HEALTHY_SLOW_REQUEST_RATE_THRESHOLD = 0.2;

function now(): number {
  return new Date().getTime();
}

function numberOrDefault(value: number | undefined, fallback: number): number {
  return typeof value === 'number' ? value : fallback;
}

export function createNetworkListener(options?: NetworkListenerOptions): NetworkListener {
  var resolvedOptions = options || {};
  var slowRequestThresholdMs = numberOrDefault(
    resolvedOptions.slowRequestThresholdMs,
    DEFAULT_SLOW_REQUEST_THRESHOLD_MS
  );
  var maxSamples = numberOrDefault(resolvedOptions.maxSamples, DEFAULT_MAX_SAMPLES);
  var minimumSamplesToDiagnose = numberOrDefault(
    resolvedOptions.minimumSamplesToDiagnose,
    DEFAULT_MINIMUM_SAMPLES_TO_DIAGNOSE
  );
  var timeoutThresholdMs = numberOrDefault(resolvedOptions.timeoutThresholdMs, DEFAULT_TIMEOUT_THRESHOLD_MS);
  var widespreadAffectedEndpointRatio = numberOrDefault(
    resolvedOptions.widespreadAffectedEndpointRatio,
    DEFAULT_WIDESPREAD_AFFECTED_ENDPOINT_RATIO
  );
  var specificEndpointRatioThreshold = numberOrDefault(
    resolvedOptions.specificEndpointRatioThreshold,
    DEFAULT_SPECIFIC_ENDPOINT_RATIO_THRESHOLD
  );
  var highServerErrorRate = numberOrDefault(resolvedOptions.highServerErrorRate, DEFAULT_HIGH_SERVER_ERROR_RATE);
  var highClientErrorRate = numberOrDefault(resolvedOptions.highClientErrorRate, DEFAULT_HIGH_CLIENT_ERROR_RATE);
  var highNetworkErrorRate = numberOrDefault(resolvedOptions.highNetworkErrorRate, DEFAULT_HIGH_NETWORK_ERROR_RATE);
  var highTimeoutRate = numberOrDefault(resolvedOptions.highTimeoutRate, DEFAULT_HIGH_TIMEOUT_RATE);
  var healthyErrorRateThreshold = numberOrDefault(
    resolvedOptions.healthyErrorRateThreshold,
    DEFAULT_HEALTHY_ERROR_RATE_THRESHOLD
  );
  var healthySlowRequestRateThreshold =
    numberOrDefault(
      resolvedOptions.healthySlowRequestRateThreshold,
      DEFAULT_HEALTHY_SLOW_REQUEST_RATE_THRESHOLD
    );
  var routeNormalizer = resolvedOptions.routeNormalizer || defaultRouteNormalizer;
  var store = createMetricsStore({
    maxSamples: maxSamples,
    slowRequestThresholdMs: slowRequestThresholdMs,
  });
  var subscribers: NetworkDiagnosisSubscriber[] = [];
  var started = false;
  var requestSequence = 0;
  var fetchUninstall: Uninstall | undefined;
  var axiosUninstalls: Uninstall[] = [];

  function nextRequestId(): string {
    requestSequence += 1;
    return 'nl_' + now() + '_' + requestSequence;
  }

  function getSnapshot(): NetworkDiagnosis {
    return diagnoseNetwork(store.getEvents(), {
      minimumSamplesToDiagnose: minimumSamplesToDiagnose,
      slowRequestThresholdMs: slowRequestThresholdMs,
      widespreadAffectedEndpointRatio: widespreadAffectedEndpointRatio,
      specificEndpointRatioThreshold: specificEndpointRatioThreshold,
      highServerErrorRate: highServerErrorRate,
      highClientErrorRate: highClientErrorRate,
      highNetworkErrorRate: highNetworkErrorRate,
      highTimeoutRate: highTimeoutRate,
      healthyErrorRateThreshold: healthyErrorRateThreshold,
      healthySlowRequestRateThreshold: healthySlowRequestRateThreshold,
    });
  }

  function notify(): void {
    var snapshot = getSnapshot();
    var copy = subscribers.slice();
    var i: number;

    for (i = 0; i < copy.length; i += 1) {
      copy[i](snapshot);
    }
  }

  function record(event: NetworkRequestEvent): void {
    store.add(event);
    notify();
  }

  return {
    start: function start(): void {
      started = true;
    },

    stop: function stop(): void {
      started = false;
    },

    subscribe: function subscribe(subscriber: NetworkDiagnosisSubscriber): () => void {
      subscribers.push(subscriber);

      return function unsubscribe(): void {
        var index = subscribers.indexOf(subscriber);
        if (index >= 0) {
          subscribers.splice(index, 1);
        }
      };
    },

    getSnapshot: getSnapshot,

    record: record,

    installFetch: function installFetch(target?: FetchTarget): Uninstall {
      if (fetchUninstall) {
        return fetchUninstall;
      }

      fetchUninstall = installFetchAdapter({
        target: target,
        isStarted: function isStarted(): boolean {
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

    installAxios: function installAxios(axiosInstance: AxiosLike): Uninstall {
      var uninstall = installAxiosAdapter({
        axiosInstance: axiosInstance,
        isStarted: function isStarted(): boolean {
          return started;
        },
        onEvent: record,
        routeNormalizer: routeNormalizer,
        timeoutThresholdMs: timeoutThresholdMs,
        now: now,
        nextRequestId: nextRequestId,
      });

      axiosUninstalls.push(uninstall);

      return function uninstallAxios(): void {
        var index = axiosUninstalls.indexOf(uninstall);
        if (index >= 0) {
          axiosUninstalls.splice(index, 1);
        }
        uninstall();
      };
    },
  };
}
