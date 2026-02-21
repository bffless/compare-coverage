import { ActionInputs, GitContext, UploadResult } from './types';
/**
 * Upload coverage file to BFFLESS
 */
export declare function uploadResults(inputs: ActionInputs, context: GitContext): Promise<UploadResult>;
