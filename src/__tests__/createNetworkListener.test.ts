import { createNetworkListener } from '../core/createNetworkListener';

describe('createNetworkListener', function () {
  it('notifies subscribers when events are recorded', function () {
    var listener = createNetworkListener({ minimumSamplesToDiagnose: 1 });
    var calls = 0;

    listener.subscribe(function () {
      calls += 1;
    });

    listener.record({
      requestId: '1',
      source: 'fetch',
      method: 'GET',
      route: '/a',
      normalizedRoute: '/a',
      startedAt: 0,
      finishedAt: 10,
      durationMs: 10,
      status: 200,
      success: true,
      timedOut: false,
      aborted: false,
    });

    expect(calls).toBe(1);
    expect(listener.getSnapshot().status).toBe('good');
  });

  it('wraps fetch without changing the returned response', function () {
    var response = { status: 200 };
    var target = {
      fetch: jest.fn(function () {
        return Promise.resolve(response);
      }) as any,
    };
    var listener = createNetworkListener({ minimumSamplesToDiagnose: 1 });

    listener.installFetch(target);
    listener.start();

    return target.fetch('/api/users/123').then(function (result: any) {
      expect(result).toBe(response);
      expect(listener.getSnapshot().summary.requestCount).toBe(1);
    });
  });
});
