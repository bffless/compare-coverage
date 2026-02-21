import { XMLParser } from 'fast-xml-parser';
import { NormalizedCoverage, CoverageSummary, FileCoverage, CoverageMetric } from '../types';
import { CoverageParser } from './index';

/**
 * Cobertura XML format
 * Used by Python coverage.py, PHPUnit, .NET, and others
 */
interface CoberturaXml {
  coverage: {
    '@_line-rate': string;
    '@_branch-rate': string;
    '@_lines-covered'?: string;
    '@_lines-valid'?: string;
    '@_branches-covered'?: string;
    '@_branches-valid'?: string;
    packages?: {
      package: CoberturaPackage | CoberturaPackage[];
    };
  };
}

interface CoberturaPackage {
  '@_name': string;
  '@_line-rate': string;
  '@_branch-rate': string;
  classes?: {
    class: CoberturaClass | CoberturaClass[];
  };
}

interface CoberturaClass {
  '@_name': string;
  '@_filename': string;
  '@_line-rate': string;
  '@_branch-rate': string;
  methods?: {
    method: CoberturaMethod | CoberturaMethod[];
  };
  lines?: {
    line: CoberturaLine | CoberturaLine[];
  };
}

interface CoberturaMethod {
  '@_name': string;
  '@_signature': string;
  '@_line-rate': string;
  '@_branch-rate': string;
  lines?: {
    line: CoberturaLine | CoberturaLine[];
  };
}

interface CoberturaLine {
  '@_number': string;
  '@_hits': string;
  '@_branch'?: string;
  '@_condition-coverage'?: string;
}

export class CoberturaParser implements CoverageParser {
  private parser: XMLParser;

  constructor() {
    this.parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      parseAttributeValue: false,
    });
  }

  detect(content: string, filename: string): boolean {
    if (!filename.toLowerCase().endsWith('.xml')) {
      if (!content.includes('<?xml') && !content.trim().startsWith('<')) {
        return false;
      }
    }
    return content.includes('<coverage') && content.includes('line-rate');
  }

  async parse(content: string): Promise<NormalizedCoverage> {
    let data: CoberturaXml;

    try {
      data = this.parser.parse(content);
    } catch (err) {
      throw new Error(
        `Failed to parse Cobertura XML: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    if (!data.coverage) {
      throw new Error('Invalid Cobertura format: missing coverage element');
    }

    const files: FileCoverage[] = [];

    // Parse packages and classes
    if (data.coverage.packages) {
      const packages = Array.isArray(data.coverage.packages.package)
        ? data.coverage.packages.package
        : [data.coverage.packages.package];

      for (const pkg of packages) {
        if (pkg.classes) {
          const classes = Array.isArray(pkg.classes.class)
            ? pkg.classes.class
            : [pkg.classes.class];

          for (const cls of classes) {
            files.push(this.parseClass(cls));
          }
        }
      }
    }

    // Calculate summary
    const summary = this.calculateSummary(data.coverage, files);

    return {
      format: 'cobertura',
      summary,
      files,
    };
  }

  private parseClass(cls: CoberturaClass): FileCoverage {
    let totalLines = 0;
    let coveredLines = 0;
    let totalBranches = 0;
    let coveredBranches = 0;
    let totalFunctions = 0;
    let coveredFunctions = 0;

    // Parse methods
    if (cls.methods) {
      const methods = Array.isArray(cls.methods.method) ? cls.methods.method : [cls.methods.method];

      for (const method of methods) {
        totalFunctions++;
        const methodLineRate = parseFloat(method['@_line-rate']) || 0;
        if (methodLineRate > 0) {
          coveredFunctions++;
        }
      }
    }

    // Parse lines
    if (cls.lines) {
      const lines = Array.isArray(cls.lines.line) ? cls.lines.line : [cls.lines.line];

      for (const line of lines) {
        totalLines++;
        const hits = parseInt(line['@_hits'], 10) || 0;
        if (hits > 0) {
          coveredLines++;
        }

        // Parse branch coverage from condition-coverage attribute
        // Format: "50% (1/2)" or "100% (2/2)"
        if (line['@_branch'] === 'true' && line['@_condition-coverage']) {
          const match = line['@_condition-coverage'].match(/\((\d+)\/(\d+)\)/);
          if (match) {
            const branchCovered = parseInt(match[1], 10);
            const branchTotal = parseInt(match[2], 10);
            totalBranches += branchTotal;
            coveredBranches += branchCovered;
          }
        }
      }
    }

    return {
      path: cls['@_filename'],
      statements: this.calculateMetric(coveredLines, totalLines),
      branches: this.calculateMetric(coveredBranches, totalBranches),
      functions: this.calculateMetric(coveredFunctions, totalFunctions),
      lines: this.calculateMetric(coveredLines, totalLines),
    };
  }

  private calculateSummary(
    coverage: CoberturaXml['coverage'],
    files: FileCoverage[],
  ): CoverageSummary {
    // Try to use top-level attributes if available
    const linesCovered = parseInt(coverage['@_lines-covered'] || '0', 10);
    const linesValid = parseInt(coverage['@_lines-valid'] || '0', 10);
    const branchesCovered = parseInt(coverage['@_branches-covered'] || '0', 10);
    const branchesValid = parseInt(coverage['@_branches-valid'] || '0', 10);

    // If top-level attributes are present, use them
    if (linesValid > 0) {
      const lineRate = parseFloat(coverage['@_line-rate']) || 0;
      const branchRate = parseFloat(coverage['@_branch-rate']) || 0;

      return {
        statements: {
          total: linesValid,
          covered: linesCovered,
          percentage: lineRate * 100,
        },
        branches: {
          total: branchesValid,
          covered: branchesCovered,
          percentage: branchRate * 100,
        },
        functions: this.aggregateMetric(files, 'functions'),
        lines: {
          total: linesValid,
          covered: linesCovered,
          percentage: lineRate * 100,
        },
      };
    }

    // Otherwise aggregate from files
    return {
      statements: this.aggregateMetric(files, 'statements'),
      branches: this.aggregateMetric(files, 'branches'),
      functions: this.aggregateMetric(files, 'functions'),
      lines: this.aggregateMetric(files, 'lines'),
    };
  }

  private aggregateMetric(
    files: FileCoverage[],
    metric: 'statements' | 'branches' | 'functions' | 'lines',
  ): CoverageMetric {
    let total = 0;
    let covered = 0;

    for (const file of files) {
      total += file[metric].total;
      covered += file[metric].covered;
    }

    return {
      total,
      covered,
      percentage: total > 0 ? (covered / total) * 100 : 100,
    };
  }

  private calculateMetric(covered: number, total: number): CoverageMetric {
    return {
      total,
      covered,
      percentage: total > 0 ? (covered / total) * 100 : 100,
    };
  }
}
