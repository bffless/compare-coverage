import { ActionInputs, NormalizedCoverage, CoverageFormat } from './types';
/**
 * Parse coverage file from local filesystem
 */
export declare function parseLocalCoverage(inputs: ActionInputs): Promise<NormalizedCoverage>;
/**
 * Parse coverage from downloaded baseline content
 */
export declare function parseBaselineCoverage(content: string, filename: string, format: CoverageFormat | 'auto'): Promise<NormalizedCoverage>;
