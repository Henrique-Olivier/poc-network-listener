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
export declare function calculateSummary(events: NetworkRequestEvent[], slowRequestThresholdMs: number): NetworkSummary;
export declare function createMetricsStore(options: MetricsStoreOptions): MetricsStore;
