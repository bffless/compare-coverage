import { ActionInputs, BaselineResult, GitContext } from './types';
/**
 * Download baseline coverage from BFFLESS
 */
export declare function downloadBaseline(inputs: ActionInputs, context: GitContext): Promise<BaselineResult>;
