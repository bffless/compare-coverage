import { CoverageFormat, NormalizedCoverage } from '../types';
/**
 * Interface for coverage parsers
 */
export interface CoverageParser {
    /**
     * Parse coverage file content and return normalized coverage data
     */
    parse(content: string): Promise<NormalizedCoverage>;
    /**
     * Detect if the content matches this parser's format
     */
    detect(content: string, filename: string): boolean;
}
/**
 * Registry of all available parsers
 */
export declare const parsers: Record<CoverageFormat, CoverageParser>;
/**
 * Detect the format of a coverage file
 */
export declare function detectFormat(content: string, filename: string): CoverageFormat;
/**
 * Parse coverage file using the appropriate parser
 */
export declare function parseCoverage(content: string, filename: string, format: CoverageFormat | 'auto'): Promise<NormalizedCoverage>;
//# sourceMappingURL=index.d.ts.map