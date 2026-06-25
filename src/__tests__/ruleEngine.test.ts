import { diagnoseNetwork } from '../core/ruleEngine';
import { NetworkRequestEvent } from '../core/types';

function event(id: string, route: string, durationMs: number, status: number): NetworkRequestEvent {
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
    success: status < 400,
    errorType: status >= 500 ? 'http-server' : status >= 400 ? 'http-client' : undefined,
    timedOut: false,
    aborted: false,
  };
}

describe('diagnoseNetwork', function () {
  it('returns unknown with low confidence when there are too few samples', function () {
    var diagnosis = diagnoseNetwork([event('1', '/a', 100, 200)], {
      minimumSamplesToDiagnose: 2,
      slowRequestThresholdMs: 1000,
    });

    expect(diagnosis.status).toBe('unknown');
    expect(diagnosis.confidenceLevel).toBe('low');
  });

  it('detects a specific slow endpoint', function () {
    var diagnosis = diagnoseNetwork(
      [
        event('1', '/reports/:id', 1800, 200),
        event('2', '/reports/:id', 1900, 200),
        event('3', '/users', 100, 200),
        event('4', '/users', 120, 200),
        event('5', '/users', 130, 200),
      ],
      { minimumSamplesToDiagnose: 5, slowRequestThresholdMs: 1000 }
    );

    expect(diagnosis.status).toBe('degraded');
    expect(diagnosis.probableCause).toBe('specific-endpoint');
    expect(diagnosis.affectedEndpoints[0].normalizedRoute).toBe('/reports/:id');
    expect(diagnosis.affectedEndpoints[0].issueTypes).toEqual(['slow']);
    expect(diagnosis.affectedEndpoints[0].slowRequestRate).toBe(1);
  });

  it('detects many 5xx errors as backend probable cause', function () {
    var diagnosis = diagnoseNetwork(
      [
        event('1', '/a', 100, 500),
        event('2', '/b', 100, 502),
        event('3', '/c', 100, 200),
        event('4', '/d', 100, 200),
        event('5', '/e', 100, 503),
      ],
      { minimumSamplesToDiagnose: 5, slowRequestThresholdMs: 1000 }
    );

    expect(diagnosis.status).toBe('poor');
    expect(diagnosis.probableCause).toBe('backend');
  });
});
