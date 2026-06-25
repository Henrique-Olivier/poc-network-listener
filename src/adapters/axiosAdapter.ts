import {
  AxiosLike,
  NetworkRequestEvent,
  RouteNormalizer,
  Uninstall,
} from '../core/types';

export type AxiosAdapterOptions = {
  axiosInstance: AxiosLike;
  isStarted: () => boolean;
  onEvent: (event: NetworkRequestEvent) => void;
  routeNormalizer: RouteNormalizer;
  timeoutThresholdMs: number;
  now: () => number;
  nextRequestId: () => string;
};

var META_KEY = '__networkListenerMeta';

function buildAxiosUrl(config: any): string {
  var baseURL = config && config.baseURL ? String(config.baseURL) : '';
  var url = config && config.url ? String(config.url) : '';

  if (!baseURL || url.indexOf('http://') === 0 || url.indexOf('https://') === 0 || url.indexOf('//') === 0) {
    return url;
  }

  if (baseURL.charAt(baseURL.length - 1) === '/' && url.charAt(0) === '/') {
    return baseURL + url.substring(1);
  }

  if (baseURL.charAt(baseURL.length - 1) !== '/' && url.charAt(0) !== '/') {
    return baseURL + '/' + url;
  }

  return baseURL + url;
}

function getAxiosMethod(config: any): string {
  return config && config.method ? String(config.method).toUpperCase() : 'GET';
}

function classifyAxiosError(error: any, durationMs: number, timeoutThresholdMs: number): {
  errorType: NetworkRequestEvent['errorType'];
  timedOut: boolean;
  aborted: boolean;
} {
  var code = error && error.code ? String(error.code) : '';
  var message = error && error.message ? String(error.message) : '';
  var status = error && error.response && typeof error.response.status === 'number' ? error.response.status : undefined;
  var timedOut = code === 'ECONNABORTED' || durationMs >= timeoutThresholdMs || /timeout/i.test(message);

  if (timedOut) {
    return { errorType: 'timeout', timedOut: true, aborted: false };
  }

  if (status && status >= 500) {
    return { errorType: 'http-server', timedOut: false, aborted: false };
  }

  if (status && status >= 400) {
    return { errorType: 'http-client', timedOut: false, aborted: false };
  }

  if (code === 'ERR_CANCELED') {
    return { errorType: 'aborted', timedOut: false, aborted: true };
  }

  return { errorType: 'network', timedOut: false, aborted: false };
}

export function installAxiosAdapter(options: AxiosAdapterOptions): Uninstall {
  var axiosInstance = options.axiosInstance;
  var requestInterceptorId: number;
  var responseInterceptorId: number;

  requestInterceptorId = axiosInstance.interceptors.request.use(function onRequest(config: any): any {
    var url = buildAxiosUrl(config || {});
    var route = options.routeNormalizer(url);

    config = config || {};
    config[META_KEY] = {
      requestId: options.nextRequestId(),
      startedAt: options.now(),
      method: getAxiosMethod(config),
      url: url,
      route: route,
    };

    return config;
  });

  responseInterceptorId = axiosInstance.interceptors.response.use(
    function onResponse(response: any): any {
      var config = response && response.config ? response.config : {};
      var meta = config[META_KEY];
      var finishedAt: number;
      var status: number | undefined;
      var durationMs: number;
      var success: boolean;

      if (meta && options.isStarted()) {
        finishedAt = options.now();
        status = response && typeof response.status === 'number' ? response.status : undefined;
        durationMs = finishedAt - meta.startedAt;
        success = typeof status === 'number' ? status < 400 : true;

        options.onEvent({
          requestId: meta.requestId,
          source: 'axios',
          method: meta.method,
          url: meta.url,
          route: meta.route,
          normalizedRoute: meta.route,
          startedAt: meta.startedAt,
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
      var config = error && error.config ? error.config : {};
      var meta = config[META_KEY];
      var finishedAt: number;
      var durationMs: number;
      var errorInfo: {
        errorType: NetworkRequestEvent['errorType'];
        timedOut: boolean;
        aborted: boolean;
      };
      var status: number | undefined;

      if (meta && options.isStarted()) {
        finishedAt = options.now();
        durationMs = finishedAt - meta.startedAt;
        errorInfo = classifyAxiosError(error, durationMs, options.timeoutThresholdMs);
        status = error && error.response && typeof error.response.status === 'number' ? error.response.status : undefined;

        options.onEvent({
          requestId: meta.requestId,
          source: 'axios',
          method: meta.method,
          url: meta.url,
          route: meta.route,
          normalizedRoute: meta.route,
          startedAt: meta.startedAt,
          finishedAt: finishedAt,
          durationMs: durationMs,
          status: status,
          success: false,
          errorType: errorInfo.errorType,
          timedOut: errorInfo.timedOut,
          aborted: errorInfo.aborted,
        });
      }

      throw error;
    }
  );

  return function uninstallAxiosAdapter(): void {
    axiosInstance.interceptors.request.eject(requestInterceptorId);
    axiosInstance.interceptors.response.eject(responseInterceptorId);
  };
}
