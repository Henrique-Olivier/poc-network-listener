export type NetworkRequestSource = 'fetch' | 'axios';

export type NetworkErrorType =
  | 'timeout'
  | 'aborted'
  | 'network'
  | 'http-client'
  | 'http-server'
  | 'unknown';

export type NetworkRequestEvent = {
  requestId: string;
  source: NetworkRequestSource;
  method: string;
  url?: string;
  route: string;
  normalizedRoute: string;
  startedAt: number;
  finishedAt: number;
  durationMs: number;
  status?: number;
  success: boolean;
  errorType?: NetworkErrorType;
  timedOut: boolean;
  aborted: boolean;
};

export type NetworkStatus = 'good' | 'degraded' | 'poor' | 'offline' | 'unknown';

export type ProbableCause =
  | 'client-network'
  | 'specific-endpoint'
  | 'backend'
  | 'infrastructure'
  | 'frontend-or-device'
  | 'unknown';

export type ConfidenceLevel = 'low' | 'medium' | 'high';

export type NetworkSummary = {
  requestCount: number;
  errorRate: number;
  timeoutRate: number;
  slowRequestRate: number;
  medianDurationMs: number;
  p95DurationMs: number;
  affectedEndpointRatio: number;
};

export type EndpointIssueType = 'slow' | 'timeout' | 'http-client' | 'http-server' | 'network' | 'aborted' | 'unknown';

export type EndpointDiagnosis = {
  normalizedRoute: string;
  requestCount: number;
  errorRate: number;
  timeoutRate: number;
  slowRequestRate: number;
  medianDurationMs: number;
  p95DurationMs: number;
  statusCodes: number[];
  issueTypes: EndpointIssueType[];
};

export type NetworkDiagnosis = {
  status: NetworkStatus;
  probableCause: ProbableCause;
  confidenceLevel: ConfidenceLevel;
  reasons: string[];
  summary: NetworkSummary;
  affectedEndpoints: EndpointDiagnosis[];
};

export type RouteNormalizer = (url: string) => string;

export type NetworkListenerOptions = {
  slowRequestThresholdMs?: number;
  maxSamples?: number;
  minimumSamplesToDiagnose?: number;
  routeNormalizer?: RouteNormalizer;
  timeoutThresholdMs?: number;
};

export type NetworkListener = {
  start: () => void;
  stop: () => void;
  subscribe: (subscriber: NetworkDiagnosisSubscriber) => Unsubscribe;
  getSnapshot: () => NetworkDiagnosis;
  record: (event: NetworkRequestEvent) => void;
  installFetch: (target?: FetchTarget) => Uninstall;
  installAxios: (axiosInstance: AxiosLike) => Uninstall;
};

export type NetworkDiagnosisSubscriber = (diagnosis: NetworkDiagnosis) => void;

export type Unsubscribe = () => void;

export type Uninstall = () => void;

export type FetchTarget = {
  fetch?: FetchLike;
};

export type FetchLike = {
  apply: (thisArg: any, args: IArguments | any[]) => Promise<any>;
};

export type AxiosLike = {
  interceptors: {
    request: AxiosInterceptorManager;
    response: AxiosInterceptorManager;
  };
};

export type AxiosInterceptorManager = {
  use: (onFulfilled?: any, onRejected?: any) => number;
  eject: (id: number) => void;
};
