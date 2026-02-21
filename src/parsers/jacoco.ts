import { XMLParser } from 'fast-xml-parser';
import { NormalizedCoverage, CoverageSummary, FileCoverage, CoverageMetric } from '../types';
import { CoverageParser } from './index';

/**
 * JaCoCo XML format
 * Used by Java, Kotlin, Scala projects
 */
interface JacocoXml {
  report: {
    '@_name': string;
    sessioninfo?: JacocoSession | JacocoSession[];
    package?: JacocoPackage | JacocoPackage[];
    counter?: JacocoCounter | JacocoCounter[];
  };
}

interface JacocoSession {
  '@_id': string;
  '@_start': string;
  '@_dump': string;
}

interface JacocoPackage {
  '@_name': string;
  class?: JacocoClass | JacocoClass[];
  sourcefile?: JacocoSourceFile | JacocoSourceFile[];
  counter?: JacocoCounter | JacocoCounter[];
}

interface JacocoClass {
  '@_name': string;
  '@_sourcefilename'?: string;
  method?: JacocoMethod | JacocoMethod[];
  counter?: JacocoCounter | JacocoCounter[];
}

interface JacocoSourceFile {
  '@_name': string;
  line?: JacocoLine | JacocoLine[];
  counter?: JacocoCounter | JacocoCounter[];
}

interface JacocoMethod {
  '@_name': string;
  '@_desc': string;
  '@_line'?: string;
  counter?: JacocoCounter | JacocoCounter[];
}

interface JacocoLine {
  '@_nr': string;
  '@_mi': string; // missed instructions
  '@_ci': string; // covered instructions
  '@_mb': string; // missed branches
  '@_cb': string; // covered branches
}

interface JacocoCounter {
  '@_type': 'INSTRUCTION' | 'BRANCH' | 'LINE' | 'COMPLEXITY' | 'METHOD' | 'CLASS';
  '@_missed': string;
  '@_covered': string;
}

export class JacocoParser implements CoverageParser {
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
    return content.includes('<report') && content.includes('<counter');
  }

  async parse(content: string): Promise<NormalizedCoverage> {
    let data: JacocoXml;

    try {
      data = this.parser.parse(content);
    } catch (err) {
      throw new Error(
        `Failed to parse JaCoCo XML: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    if (!data.report) {
      throw new Error('Invalid JaCoCo format: missing report element');
    }

    const files: FileCoverage[] = [];

    // Parse packages
    if (data.report.package) {
      const packages = Array.isArray(data.report.package)
        ? data.report.package
        : [data.report.package];

      for (const pkg of packages) {
        // Parse source files within package
        if (pkg.sourcefile) {
          const sourceFiles = Array.isArray(pkg.sourcefile) ? pkg.sourcefile : [pkg.sourcefile];

          for (const srcFile of sourceFiles) {
            const filePath = `${pkg['@_name'].replace(/\//g, '/')}/${srcFile['@_name']}`;
            files.push(this.parseSourceFile(srcFile, filePath));
          }
        }
      }
    }

    // Calculate summary from report-level counters
    const summary = data.report.counter
      ? this.parseCounters(data.report.counter)
      : this.aggregateSummary(files);

    return {
      format: 'jacoco',
      summary,
      files,
    };
  }

  private parseSourceFile(srcFile: JacocoSourceFile, filePath: string): FileCoverage {
    if (srcFile.counter) {
      const coverage = this.parseCounters(srcFile.counter);
      return {
        path: filePath,
        ...coverage,
      };
    }

    // Parse from line elements if no counters
    let totalLines = 0;
    let coveredLines = 0;
    let totalBranches = 0;
    let coveredBranches = 0;
    let totalInstructions = 0;
    let coveredInstructions = 0;

    if (srcFile.line) {
      const lines = Array.isArray(srcFile.line) ? srcFile.line : [srcFile.line];

      for (const line of lines) {
        const mi = parseInt(line['@_mi'], 10) || 0;
        const ci = parseInt(line['@_ci'], 10) || 0;
        const mb = parseInt(line['@_mb'], 10) || 0;
        const cb = parseInt(line['@_cb'], 10) || 0;

        totalInstructions += mi + ci;
        coveredInstructions += ci;

        totalBranches += mb + cb;
        coveredBranches += cb;

        totalLines++;
        if (ci > 0) coveredLines++;
      }
    }

    return {
      path: filePath,
      statements: this.calculateMetric(coveredInstructions, totalInstructions),
      branches: this.calculateMetric(coveredBranches, totalBranches),
      functions: { total: 0, covered: 0, percentage: 100 }, // Methods need class-level parsing
      lines: this.calculateMetric(coveredLines, totalLines),
    };
  }

  private parseCounters(counters: JacocoCounter | JacocoCounter[]): CoverageSummary {
    const counterArray = Array.isArray(counters) ? counters : [counters];

    const metrics: Record<string, CoverageMetric> = {};

    for (const counter of counterArray) {
      const missed = parseInt(counter['@_missed'], 10) || 0;
      const covered = parseInt(counter['@_covered'], 10) || 0;
      const total = missed + covered;

      metrics[counter['@_type']] = {
        total,
        covered,
        percentage: total > 0 ? (covered / total) * 100 : 100,
      };
    }

    return {
      // Use INSTRUCTION for statements (JaCoCo's primary coverage metric)
      statements: metrics['INSTRUCTION'] || { total: 0, covered: 0, percentage: 100 },
      branches: metrics['BRANCH'] || { total: 0, covered: 0, percentage: 100 },
      functions: metrics['METHOD'] || { total: 0, covered: 0, percentage: 100 },
      lines: metrics['LINE'] || { total: 0, covered: 0, percentage: 100 },
    };
  }

  private aggregateSummary(files: FileCoverage[]): CoverageSummary {
    const aggregate = (
      metric: 'statements' | 'branches' | 'functions' | 'lines',
    ): CoverageMetric => {
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
    };

    return {
      statements: aggregate('statements'),
      branches: aggregate('branches'),
      functions: aggregate('functions'),
      lines: aggregate('lines'),
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
