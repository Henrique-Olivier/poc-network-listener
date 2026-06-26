import { diagnoseNetwork } from '../core/ruleEngine';
import { NetworkRequestEvent } from '../core/types';

function event(
  id: string,
  route: string,
  durationMs: number,
  status?: number,
  errorType?: NetworkRequestEvent['errorType'],
  timedOut?: boolean
): NetworkRequestEvent {
  var success = typeof status === 'number' ? status < 400 : !errorType;

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
    errorType: errorType || (status && status >= 500 ? 'http-server' : status && status >= 400 ? 'http-client' : undefined),
    timedOut: !!timedOut,
    aborted: false,
  };
}

function options() {
  return {
    minimumSamplesToDiagnose: 5,
    slowRequestThresholdMs: 1000,
  };
}

describe('diagnoseNetwork', function () {
  it('returns unknown with low confidence when there are too few samples', function () {
    var diagnosis = diagnoseNetwork([event('1', '/a', 100, 200)], {
      minimumSamplesToDiagnose: 2,
      slowRequestThresholdMs: 1000,
    });

    expect(diagnosis.status).toBe('unknown');
    expect(diagnosis.probableCause).toBe('unknown');
    expect(diagnosis.confidenceLevel).toBe('low');
  });

  it('classifies simulated throttling as client network degradation', function () {
    var diagnosis = diagnoseNetwork(
      [
        event('1', '/a', 1800, 200),
        event('2', '/b', 1900, 200),
        event('3', '/c', 2000, 200),
        event('4', '/d', 2100, 200),
        event('5', '/e', 2200, 200),
      ],
      options()
    );

    expect(diagnosis.status).toBe('degraded');
    expect(diagnosis.probableCause).toBe('client-network');
    expect(diagnosis.summary.serverErrorRate).toBe(0);
    expect(diagnosis.summary.timeoutRate).toBe(0);
  });

  it('classifies widespread slow endpoints with many 5xx as infrastructure', function () {
    var diagnosis = diagnoseNetwork(
      [
        event('1', '/a', 1800, 500),
        event('2', '/b', 1900, 502),
        event('3', '/c', 2000, 503),
        event('4', '/d', 2100, 200),
        event('5', '/e', 2200, 200),
      ],
      options()
    );

    expect(diagnosis.status).toBe('poor');
    expect(diagnosis.probableCause).toBe('infrastructure');
  });

  it('classifies widespread timeouts as client network or infrastructure', function () {
    var diagnosis = diagnoseNetwork(
      [
        event('1', '/a', 6000, undefined, 'timeout', true),
        event('2', '/b', 6000, undefined, 'timeout', true),
        event('3', '/c', 6000, undefined, 'timeout', true),
        event('4', '/d', 100, 200),
        event('5', '/e', 120, 200),
      ],
      options()
    );

    expect(diagnosis.status).toBe('poor');
    expect(diagnosis.probableCause).toBe('client-network-or-infrastructure');
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
      options()
    );

    expect(diagnosis.status).toBe('degraded');
    expect(diagnosis.probableCause).toBe('specific-endpoint');
    expect(diagnosis.affectedEndpoints[0].normalizedRoute).toBe('/reports/:id');
    expect(diagnosis.affectedEndpoints[0].issueTypes).toEqual(['slow']);
  });

  it('does not classify fast 4xx errors as infrastructure', function () {
    var diagnosis = diagnoseNetwork(
      [
        event('1', '/a', 100, 400),
        event('2', '/b', 100, 401),
        event('3', '/c', 100, 403),
        event('4', '/d', 100, 200),
        event('5', '/e', 100, 200),
      ],
      options()
    );

    expect(diagnosis.status).toBe('degraded');
    expect(diagnosis.probableCause).toBe('client-request');
    expect(diagnosis.probableCause).not.toBe('infrastructure');
  });

  it('classifies fast 5xx errors as backend', function () {
    var diagnosis = diagnoseNetwork(
      [
        event('1', '/a', 100, 500),
        event('2', '/b', 100, 502),
        event('3', '/c', 100, 503),
        event('4', '/d', 100, 200),
        event('5', '/e', 100, 200),
      ],
      options()
    );

    expect(diagnosis.status).toBe('poor');
    expect(diagnosis.probableCause).toBe('backend');
  });

  it('classifies healthy traffic as good', function () {
    var diagnosis = diagnoseNetwork(
      [
        event('1', '/a', 100, 200),
        event('2', '/b', 120, 200),
        event('3', '/c', 140, 200),
        event('4', '/d', 160, 200),
        event('5', '/e', 180, 200),
      ],
      options()
    );

    expect(diagnosis.status).toBe('good');
    expect(diagnosis.probableCause).toBe('unknown');
  });
});
