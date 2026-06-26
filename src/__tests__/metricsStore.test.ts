import { createMetricsStore } from '../core/metricsStore';
import { NetworkRequestEvent } from '../core/types';

function event(
  id: string,
  route: string,
  durationMs: number,
  success: boolean,
  status?: number,
  errorType?: NetworkRequestEvent['errorType'],
  timedOut?: boolean,
  aborted?: boolean
): NetworkRequestEvent {
  return {
    requestId: id,
    source: 'fetch',
    method: 'GET',
    route: route,
    normalizedRoute: route,
    startedAt: 0,
    finishedAt: durationMs,
    durationMs: durationMs,
    status: status,
    success: success,
    errorType: errorType,
    timedOut: !!timedOut,
    aborted: !!aborted,
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
      clientErrorRate: 0,
      serverErrorRate: 0,
      networkErrorRate: 1 / 3,
      timeoutRate: 0,
      abortedRate: 0,
      slowRequestRate: 2 / 3,
      medianDurationMs: 1200,
      p95DurationMs: 2000,
      affectedEndpointRatio: 1,
    });
  });

  it('separates client, server, network, timeout, and aborted rates', function () {
    var store = createMetricsStore({ maxSamples: 10, slowRequestThresholdMs: 1000 });

    store.add(event('1', '/client', 100, false, 404, 'http-client'));
    store.add(event('2', '/server', 100, false, 500, 'http-server'));
    store.add(event('3', '/network', 100, false, undefined, 'network'));
    store.add(event('4', '/timeout', 5000, false, undefined, 'timeout', true));
    store.add(event('5', '/aborted', 100, false, undefined, 'aborted', false, true));

    expect(store.getSummary()).toEqual({
      requestCount: 5,
      errorRate: 4 / 5,
      clientErrorRate: 1 / 5,
      serverErrorRate: 1 / 5,
      networkErrorRate: 1 / 5,
      timeoutRate: 1 / 5,
      abortedRate: 1 / 5,
      slowRequestRate: 1 / 5,
      medianDurationMs: 100,
      p95DurationMs: 5000,
      affectedEndpointRatio: 1,
    });
  });
});
