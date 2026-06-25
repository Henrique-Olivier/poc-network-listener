import { AxiosLike, NetworkRequestEvent, RouteNormalizer, Uninstall } from '../core/types';
export type AxiosAdapterOptions = {
    axiosInstance: AxiosLike;
    isStarted: () => boolean;
    onEvent: (event: NetworkRequestEvent) => void;
    routeNormalizer: RouteNormalizer;
    timeoutThresholdMs: number;
    now: () => number;
    nextRequestId: () => string;
};
export declare function installAxiosAdapter(options: AxiosAdapterOptions): Uninstall;
