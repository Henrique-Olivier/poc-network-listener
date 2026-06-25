import {
  EndpointDiagnosis,
  EndpointIssueType,
  NetworkDiagnosis,
  NetworkRequestEvent,
  NetworkStatus,
  ProbableCause,
} from './types';
import { calculateSummary } from './metricsStore';

export type RuleEngineOptions = {
  minimumSamplesToDiagnose: number;
  slowRequestThresholdMs: number;
};

function countServerErrors(events: NetworkRequestEvent[]): number {
  var count = 0;
  var i: number;
  var status: number | undefined;

  for (i = 0; i < events.length; i += 1) {
    status = events[i].status;
    if (typeof status === 'number' && status >= 500) {
      count += 1;
    }
  }

  return count;
}

function countSlowRoutes(events: NetworkRequestEvent[], slowRequestThresholdMs: number): number {
  var routes: { [route: string]: boolean } = {};
  var count = 0;
  var i: number;
  var route: string;

  for (i = 0; i < events.length; i += 1) {
    if (events[i].durationMs >= slowRequestThresholdMs) {
      route = events[i].normalizedRoute;
      if (!routes[route]) {
        routes[route] = true;
        count += 1;
      }
    }
  }

  return count;
}

function countRoutes(events: NetworkRequestEvent[]): number {
  var routes: { [route: string]: boolean } = {};
  var count = 0;
  var i: number;
  var route: string;

  for (i = 0; i < events.length; i += 1) {
    route = events[i].normalizedRoute;
    if (!routes[route]) {
      routes[route] = true;
      count += 1;
    }
  }

  return count;
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

function pushUniqueString(values: string[], value: string): void {
  if (values.indexOf(value) < 0) {
    values.push(value);
  }
}

function pushUniqueNumber(values: number[], value: number): void {
  if (values.indexOf(value) < 0) {
    values.push(value);
  }
}

function getEndpointIssueType(event: NetworkRequestEvent, slowRequestThresholdMs: number): EndpointIssueType | undefined {
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

function buildAffectedEndpoints(events: NetworkRequestEvent[], slowRequestThresholdMs: number): EndpointDiagnosis[] {
  var grouped: {
    [route: string]: {
      normalizedRoute: string;
      requestCount: number;
      errors: number;
      timeouts: number;
      slowRequests: number;
      durations: number[];
      statusCodes: number[];
      issueTypes: EndpointIssueType[];
    };
  } = {};
  var result: EndpointDiagnosis[] = [];
  var i: number;
  var event: NetworkRequestEvent;
  var route: string;
  var item: {
    normalizedRoute: string;
    requestCount: number;
    errors: number;
    timeouts: number;
    slowRequests: number;
    durations: number[];
    statusCodes: number[];
    issueTypes: EndpointIssueType[];
  };
  var issueType: EndpointIssueType | undefined;

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
      pushUniqueString(item.issueTypes as string[], issueType);
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

function buildDiagnosis(
  status: NetworkStatus,
  probableCause: ProbableCause,
  confidenceLevel: 'low' | 'medium' | 'high',
  reasons: string[],
  events: NetworkRequestEvent[],
  slowRequestThresholdMs: number
): NetworkDiagnosis {
  return {
    status: status,
    probableCause: probableCause,
    confidenceLevel: confidenceLevel,
    reasons: reasons,
    summary: calculateSummary(events, slowRequestThresholdMs),
    affectedEndpoints: buildAffectedEndpoints(events, slowRequestThresholdMs),
  };
}

export function diagnoseNetwork(events: NetworkRequestEvent[], options: RuleEngineOptions): NetworkDiagnosis {
  var summary = calculateSummary(events, options.slowRequestThresholdMs);
  var serverErrorRate: number;
  var slowRouteCount: number;
  var routeCount: number;

  if (summary.requestCount < options.minimumSamplesToDiagnose) {
    return buildDiagnosis(
      'unknown',
      'unknown',
      'low',
      ['Not enough samples to diagnose network communication.'],
      events,
      options.slowRequestThresholdMs
    );
  }

  serverErrorRate = countServerErrors(events) / summary.requestCount;
  slowRouteCount = countSlowRoutes(events, options.slowRequestThresholdMs);
  routeCount = countRoutes(events);

  if (summary.timeoutRate >= 0.5) {
    return buildDiagnosis(
      'poor',
      'client-network',
      'high',
      ['Many requests are timing out.'],
      events,
      options.slowRequestThresholdMs
    );
  }

  if (serverErrorRate >= 0.4) {
    return buildDiagnosis(
      'poor',
      'backend',
      'high',
      ['Many requests are failing with 5xx server errors.'],
      events,
      options.slowRequestThresholdMs
    );
  }

  if (summary.slowRequestRate >= 0.5 && summary.affectedEndpointRatio >= 0.5 && slowRouteCount > 1) {
    return buildDiagnosis(
      summary.slowRequestRate >= 0.75 ? 'poor' : 'degraded',
      'infrastructure',
      'medium',
      ['Several different endpoints are slow in the current sample window.'],
      events,
      options.slowRequestThresholdMs
    );
  }

  if (summary.slowRequestRate >= 0.3 && slowRouteCount === 1 && routeCount > 1) {
    return buildDiagnosis(
      'degraded',
      'specific-endpoint',
      'medium',
      ['Only one endpoint concentrates slow requests.'],
      events,
      options.slowRequestThresholdMs
    );
  }

  if (summary.errorRate >= 0.3) {
    return buildDiagnosis(
      'degraded',
      'unknown',
      'medium',
      ['A relevant share of requests is failing.'],
      events,
      options.slowRequestThresholdMs
    );
  }

  return buildDiagnosis(
    'good',
    'unknown',
    'high',
    ['Most requests in the current sample window are healthy.'],
    events,
    options.slowRequestThresholdMs
  );
}
