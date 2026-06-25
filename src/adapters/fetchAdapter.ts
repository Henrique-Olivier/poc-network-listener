import {
  FetchTarget,
  NetworkRequestEvent,
  RouteNormalizer,
  Uninstall,
} from '../core/types';

export type FetchAdapterOptions = {
  target?: FetchTarget;
  isStarted: () => boolean;
  onEvent: (event: NetworkRequestEvent) => void;
  routeNormalizer: RouteNormalizer;
  timeoutThresholdMs: number;
  now: () => number;
  nextRequestId: () => string;
};

var MARKER = '__networkListenerFetchInstalled';
var ORIGINAL = '__networkListenerOriginalFetch';

function getDefaultTarget(): FetchTarget | undefined {
  if (typeof window !== 'undefined') {
    return window as any;
  }

  return undefined;
}

function getFetchUrl(input: any): string {
  if (typeof input === 'string') {
    return input;
  }

  if (input && typeof input.url === 'string') {
    return input.url;
  }

  return '';
}

function getFetchMethod(input: any, init: any): string {
  if (init && init.method) {
    return String(init.method).toUpperCase();
  }

  if (input && input.method) {
    return String(input.method).toUpperCase();
  }

  return 'GET';
}

function classifyError(error: any, durationMs: number, timeoutThresholdMs: number): {
  errorType: NetworkRequestEvent['errorType'];
  timedOut: boolean;
  aborted: boolean;
} {
  var name = error && error.name ? String(error.name) : '';
  var message = error && error.message ? String(error.message) : '';
  var aborted = name === 'AbortError';
  var timedOut = durationMs >= timeoutThresholdMs || /timeout/i.test(message);

  return {
    errorType: timedOut ? 'timeout' : aborted ? 'aborted' : 'network',
    timedOut: timedOut,
    aborted: aborted,
  };
}

export function installFetchAdapter(options: FetchAdapterOptions): Uninstall {
  var target = options.target || getDefaultTarget();
  var currentFetch: any;
  var originalFetch: any;

  if (!target || !target.fetch) {
    return function noop(): void {};
  }

  currentFetch = target.fetch as any;

  if (currentFetch[MARKER]) {
    return function noop(): void {};
  }

  originalFetch = currentFetch;

  function wrappedFetch(this: any): Promise<any> {
    var args = arguments;
    var input = args[0];
    var init = args[1];
    var url = getFetchUrl(input);
    var route = options.routeNormalizer(url);
    var method = getFetchMethod(input, init);
    var requestId = options.nextRequestId();
    var startedAt = options.now();

    return originalFetch.apply(this, args).then(
      function onResponse(response: any): any {
        var finishedAt = options.now();
        var status = response && typeof response.status === 'number' ? response.status : undefined;
        var success = typeof status === 'number' ? status < 400 : true;
        var durationMs = finishedAt - startedAt;

        if (options.isStarted()) {
          options.onEvent({
            requestId: requestId,
            source: 'fetch',
            method: method,
            url: url,
            route: route,
            normalizedRoute: route,
            startedAt: startedAt,
            finishedAt: finishedAt,
            durationMs: durationMs,
            status: status,
            success: success,
            errorType: success ? undefined : status && status >= 500 ? 'http-server' : 'http-client',
            timedOut: durationMs >= options.timeoutThresholdMs,
            aborted: false,
          });
        }

        return response;
      },
      function onError(error: any): any {
        var finishedAt = options.now();
        var durationMs = finishedAt - startedAt;
        var errorInfo = classifyError(error, durationMs, options.timeoutThresholdMs);

        if (options.isStarted()) {
          options.onEvent({
            requestId: requestId,
            source: 'fetch',
            method: method,
            url: url,
            route: route,
            normalizedRoute: route,
            startedAt: startedAt,
            finishedAt: finishedAt,
            durationMs: durationMs,
            success: false,
            errorType: errorInfo.errorType,
            timedOut: errorInfo.timedOut,
            aborted: errorInfo.aborted,
          });
        }

        throw error;
      }
    );
  }

  (wrappedFetch as any)[MARKER] = true;
  (wrappedFetch as any)[ORIGINAL] = originalFetch;
  target.fetch = wrappedFetch as any;

  return function uninstallFetchAdapter(): void {
    if (target && target.fetch === (wrappedFetch as any)) {
      target.fetch = originalFetch;
    }
  };
}
