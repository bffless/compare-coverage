import { CoverageReport } from './types';
/**
 * Write JSON report to file
 */
export declare function writeReport(report: CoverageReport, reportPath: string): Promise<void>;
