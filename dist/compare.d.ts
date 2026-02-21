import { NormalizedCoverage, CoverageComparison, ActionInputs } from './types';
/**
 * Compare current coverage against baseline
 */
export declare function compareCoverage(current: NormalizedCoverage, baseline: NormalizedCoverage, threshold: number): CoverageComparison;
/**
 * Determine if the action should fail based on comparison results
 */
export declare function shouldFail(comparison: CoverageComparison, inputs: ActionInputs): boolean;
