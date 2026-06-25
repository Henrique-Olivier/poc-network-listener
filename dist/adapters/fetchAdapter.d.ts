import { FetchTarget, NetworkRequestEvent, RouteNormalizer, Uninstall } from '../core/types';
export type FetchAdapterOptions = {
    target?: FetchTarget;
    isStarted: () => boolean;
    onEvent: (event: NetworkRequestEvent) => void;
    routeNormalizer: RouteNormalizer;
    timeoutThresholdMs: number;
    now: () => number;
    nextRequestId: () => string;
};
export declare function installFetchAdapter(options: FetchAdapterOptions): Uninstall;
