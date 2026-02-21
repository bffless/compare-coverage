import { NormalizedCoverage } from '../types';
import { CoverageParser } from './index';
export declare class IstanbulParser implements CoverageParser {
    detect(content: string, filename: string): boolean;
    parse(content: string): Promise<NormalizedCoverage>;
    private calculateStatements;
    private calculateBranches;
    private calculateFunctions;
    private calculateLines;
    private calculateSummary;
}
//# sourceMappingURL=istanbul.d.ts.map