import { NormalizedCoverage } from '../types';
import { CoverageParser } from './index';
export declare class LcovParser implements CoverageParser {
    detect(content: string, filename: string): boolean;
    parse(content: string): Promise<NormalizedCoverage>;
    private calculateMetric;
    private calculateSummary;
}
//# sourceMappingURL=lcov.d.ts.map