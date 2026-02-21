import { NormalizedCoverage } from '../types';
import { CoverageParser } from './index';
export declare class JacocoParser implements CoverageParser {
    private parser;
    constructor();
    detect(content: string, filename: string): boolean;
    parse(content: string): Promise<NormalizedCoverage>;
    private parseSourceFile;
    private parseCounters;
    private aggregateSummary;
    private calculateMetric;
}
//# sourceMappingURL=jacoco.d.ts.map