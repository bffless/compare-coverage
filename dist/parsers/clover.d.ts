import { NormalizedCoverage } from '../types';
import { CoverageParser } from './index';
export declare class CloverParser implements CoverageParser {
    private parser;
    constructor();
    detect(content: string, filename: string): boolean;
    parse(content: string): Promise<NormalizedCoverage>;
    private parseFile;
    private parseMetrics;
    private aggregateSummary;
    private calculateMetric;
}
//# sourceMappingURL=clover.d.ts.map