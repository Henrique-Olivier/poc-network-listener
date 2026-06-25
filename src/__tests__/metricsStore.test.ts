import { createMetricsStore } from '../core/metricsStore';
import { NetworkRequestEvent } from '../core/types';

function event(id: string, route: string, durationMs: number, success: boolean): NetworkRequestEvent {
  return {
    requestId: id,
    source: 'fetch',
    method: 'GET',
    route: route,
    normalizedRoute: route,
    startedAt: 0,
    finishedAt: durationMs,
    durationMs: durationMs,
    success: success,
    timedOut: false,
    aborted: false,
  };
}

describe('createMetricsStore', function () {
  it('keeps only the configured sample window', function () {
    var store = createMetricsStore({ maxSamples: 2, slowRequestThresholdMs: 1000 });

    store.add(event('1', '/a', 100, true));
    store.add(event('2', '/b', 200, true));
    store.add(event('3', '/c', 300, true));

    expect(store.getEvents().map(function (item) { return item.requestId; })).toEqual(['2', '3']);
  });

  it('calculates basic rates and percentiles', function () {
    var store = createMetricsStore({ maxSamples: 10, slowRequestThresholdMs: 1000 });

    store.add(event('1', '/a', 100, true));
    store.add(event('2', '/a', 1200, true));
    store.add(event('3', '/b', 2000, false));

    expect(store.getSummary()).toEqual({
      requestCount: 3,
      errorRate: 1 / 3,
      timeoutRate: 0,
      slowRequestRate: 2 / 3,
      medianDurationMs: 1200,
      p95DurationMs: 2000,
      affectedEndpointRatio: 1,
    });
  });
});
