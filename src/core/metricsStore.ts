import { NetworkRequestEvent, NetworkSummary } from './types';

export type MetricsStore = {
  add: (event: NetworkRequestEvent) => NetworkSummary;
  getEvents: () => NetworkRequestEvent[];
  getSummary: () => NetworkSummary;
  clear: () => void;
};

export type MetricsStoreOptions = {
  maxSamples: number;
  slowRequestThresholdMs: number;
};

function createEmptySummary(): NetworkSummary {
  return {
    requestCount: 0,
    errorRate: 0,
    timeoutRate: 0,
    slowRequestRate: 0,
    medianDurationMs: 0,
    p95DurationMs: 0,
    affectedEndpointRatio: 0,
  };
}

function percentile(sortedValues: number[], percentileValue: number): number {
  var index: number;

  if (sortedValues.length === 0) {
    return 0;
  }

  index = Math.ceil((percentileValue / 100) * sortedValues.length) - 1;
  if (index < 0) {
    index = 0;
  }

  return sortedValues[index];
}

export function calculateSummary(events: NetworkRequestEvent[], slowRequestThresholdMs: number): NetworkSummary {
  var total = events.length;
  var errors = 0;
  var timeouts = 0;
  var slow = 0;
  var durations: number[] = [];
  var endpoints: { [route: string]: boolean } = {};
  var affectedEndpoints: { [route: string]: boolean } = {};
  var endpointCount = 0;
  var affectedEndpointCount = 0;
  var i: number;
  var event: NetworkRequestEvent;
  var route: string;
  var affected: boolean;

  if (total === 0) {
    return createEmptySummary();
  }

  for (i = 0; i < total; i += 1) {
    event = events[i];
    route = event.normalizedRoute;
    affected = false;
    durations.push(event.durationMs);

    if (!event.success) {
      errors += 1;
      affected = true;
    }

    if (event.timedOut) {
      timeouts += 1;
      affected = true;
    }

    if (event.durationMs >= slowRequestThresholdMs) {
      slow += 1;
      affected = true;
    }

    if (!endpoints[route]) {
      endpoints[route] = true;
      endpointCount += 1;
    }

    if (affected && !affectedEndpoints[route]) {
      affectedEndpoints[route] = true;
      affectedEndpointCount += 1;
    }
  }

  durations.sort(function (a, b) {
    return a - b;
  });

  return {
    requestCount: total,
    errorRate: errors / total,
    timeoutRate: timeouts / total,
    slowRequestRate: slow / total,
    medianDurationMs: percentile(durations, 50),
    p95DurationMs: percentile(durations, 95),
    affectedEndpointRatio: endpointCount === 0 ? 0 : affectedEndpointCount / endpointCount,
  };
}

export function createMetricsStore(options: MetricsStoreOptions): MetricsStore {
  var events: NetworkRequestEvent[] = [];

  return {
    add: function add(event: NetworkRequestEvent): NetworkSummary {
      events.push(event);

      while (events.length > options.maxSamples) {
        events.shift();
      }

      return calculateSummary(events, options.slowRequestThresholdMs);
    },

    getEvents: function getEvents(): NetworkRequestEvent[] {
      return events.slice();
    },

    getSummary: function getSummary(): NetworkSummary {
      return calculateSummary(events, options.slowRequestThresholdMs);
    },

    clear: function clear(): void {
      events = [];
    },
  };
}
