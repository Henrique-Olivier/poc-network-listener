import { NetworkDiagnosis, NetworkRequestEvent } from './types';
export type RuleEngineOptions = {
    minimumSamplesToDiagnose: number;
    slowRequestThresholdMs: number;
};
export declare function diagnoseNetwork(events: NetworkRequestEvent[], options: RuleEngineOptions): NetworkDiagnosis;
