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

function now(): number {
  return new Date().getTime();
}

export function createNetworkListener(options?: NetworkListenerOptions): NetworkListener {
  var resolvedOptions = options || {};
  var slowRequestThresholdMs = resolvedOptions.slowRequestThresholdMs || DEFAULT_SLOW_REQUEST_THRESHOLD_MS;
  var maxSamples = resolvedOptions.maxSamples || DEFAULT_MAX_SAMPLES;
  var minimumSamplesToDiagnose =
    resolvedOptions.minimumSamplesToDiagnose || DEFAULT_MINIMUM_SAMPLES_TO_DIAGNOSE;
  var timeoutThresholdMs = resolvedOptions.timeoutThresholdMs || DEFAULT_TIMEOUT_THRESHOLD_MS;
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
