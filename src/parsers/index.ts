import { CoverageFormat, NormalizedCoverage } from '../types';
import { LcovParser } from './lcov';
import { IstanbulParser } from './istanbul';
import { CoberturaParser } from './cobertura';
import { CloverParser } from './clover';
import { JacocoParser } from './jacoco';

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
export const parsers: Record<CoverageFormat, CoverageParser> = {
  lcov: new LcovParser(),
  istanbul: new IstanbulParser(),
  cobertura: new CoberturaParser(),
  clover: new CloverParser(),
  jacoco: new JacocoParser(),
};

/**
 * Detect the format of a coverage file
 */
export function detectFormat(content: string, filename: string): CoverageFormat {
  // Check file extension first
  const ext = filename.toLowerCase();

  if (ext.endsWith('.info') || ext.endsWith('.lcov')) {
    return 'lcov';
  }

  if (ext.endsWith('.json')) {
    // Could be istanbul/nyc JSON
    try {
      const parsed = JSON.parse(content);
      // Istanbul coverage-final.json has file paths as keys with coverage data
      const keys = Object.keys(parsed);
      if (keys.length > 0) {
        const firstValue = parsed[keys[0]];
        if (
          firstValue &&
          typeof firstValue === 'object' &&
          ('statementMap' in firstValue || 's' in firstValue)
        ) {
          return 'istanbul';
        }
      }
    } catch {
      // Not valid JSON
    }
  }

  // Check content for XML formats
  if (content.includes('<?xml') || content.trim().startsWith('<')) {
    // Cobertura: <coverage> with line-rate, branch-rate attributes
    if (content.includes('<coverage') && content.includes('line-rate')) {
      return 'cobertura';
    }

    // Clover: <coverage> with clover attribute or <project>
    if (
      (content.includes('<coverage') && content.includes('clover')) ||
      content.includes('<project')
    ) {
      return 'clover';
    }

    // JaCoCo: <report> with counter elements
    if (content.includes('<report') && content.includes('<counter')) {
      return 'jacoco';
    }
  }

  // Check for LCOV format markers
  if (content.includes('SF:') && (content.includes('LF:') || content.includes('DA:'))) {
    return 'lcov';
  }

  throw new Error(
    'Unable to detect coverage format. Please specify the format explicitly using the format input.',
  );
}

/**
 * Parse coverage file using the appropriate parser
 */
export async function parseCoverage(
  content: string,
  filename: string,
  format: CoverageFormat | 'auto',
): Promise<NormalizedCoverage> {
  const detectedFormat = format === 'auto' ? detectFormat(content, filename) : format;
  const parser = parsers[detectedFormat];

  if (!parser) {
    throw new Error(`Unknown coverage format: ${detectedFormat}`);
  }

  return parser.parse(content);
}
