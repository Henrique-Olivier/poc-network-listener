import { NetworkListenerConfig, NetworkDiagnosis, NetworkRequestEvent } from './types';
export type RuleEngineOptions = Partial<NetworkListenerConfig> & {
    minimumSamplesToDiagnose: number;
    slowRequestThresholdMs: number;
};
export declare function diagnoseNetwork(events: NetworkRequestEvent[], options: RuleEngineOptions): NetworkDiagnosis;
