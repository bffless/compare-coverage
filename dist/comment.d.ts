import { CoverageReport, ActionInputs, GitContext, UploadResult } from './types';
/**
 * Post or update a PR comment with the coverage report
 */
export declare function postPRComment(report: CoverageReport, inputs: ActionInputs, context: GitContext, uploadResult: UploadResult): Promise<void>;
