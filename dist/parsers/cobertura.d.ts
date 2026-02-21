import { NormalizedCoverage } from '../types';
import { CoverageParser } from './index';
export declare class CoberturaParser implements CoverageParser {
    private parser;
    constructor();
    detect(content: string, filename: string): boolean;
    parse(content: string): Promise<NormalizedCoverage>;
    private parseClass;
    private calculateSummary;
    private aggregateMetric;
    private calculateMetric;
}
//# sourceMappingURL=cobertura.d.ts.map