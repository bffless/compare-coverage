import { CoverageReport, ActionInputs, GitContext, UploadResult } from './types';
/**
 * Generate GitHub step summary
 */
export declare function generateSummary(report: CoverageReport, inputs: ActionInputs, context: GitContext, uploadResult: UploadResult): Promise<void>;
