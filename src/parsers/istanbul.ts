import { NormalizedCoverage, CoverageSummary, FileCoverage, CoverageMetric } from '../types';
import { CoverageParser } from './index';

/**
 * Istanbul/NYC coverage-final.json format
 * Each key is a file path, value contains coverage data
 */
interface IstanbulCoverage {
  [filePath: string]: IstanbulFileCoverage;
}

interface IstanbulFileCoverage {
  path: string;
  statementMap: Record<string, IstanbulLocation>;
  fnMap: Record<string, IstanbulFunction>;
  branchMap: Record<string, IstanbulBranch>;
  s: Record<string, number>; // statement hits
  f: Record<string, number>; // function hits
  b: Record<string, number[]>; // branch hits
}

interface IstanbulLocation {
  start: { line: number; column: number };
  end: { line: number; column: number };
}

interface IstanbulFunction {
  name: string;
  decl: IstanbulLocation;
  loc: IstanbulLocation;
}

interface IstanbulBranch {
  type: string;
  loc: IstanbulLocation;
  locations: IstanbulLocation[];
}

export class IstanbulParser implements CoverageParser {
  detect(content: string, filename: string): boolean {
    if (!filename.toLowerCase().endsWith('.json')) {
      return false;
    }

    try {
      const parsed = JSON.parse(content);
      const keys = Object.keys(parsed);
      if (keys.length > 0) {
        const firstValue = parsed[keys[0]];
        return (
          firstValue &&
          typeof firstValue === 'object' &&
          ('statementMap' in firstValue || 's' in firstValue)
        );
      }
    } catch {
      return false;
    }

    return false;
  }

  async parse(content: string): Promise<NormalizedCoverage> {
    let data: IstanbulCoverage;

    try {
      data = JSON.parse(content);
    } catch (err) {
      throw new Error(
        `Failed to parse Istanbul JSON: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    const filePaths = Object.keys(data);
    if (filePaths.length === 0) {
      throw new Error('Istanbul coverage file contains no data');
    }

    const files: FileCoverage[] = filePaths.map((filePath) => {
      const file = data[filePath];
      return {
        path: file.path || filePath,
        statements: this.calculateStatements(file),
        branches: this.calculateBranches(file),
        functions: this.calculateFunctions(file),
        lines: this.calculateLines(file),
      };
    });

    const summary = this.calculateSummary(files);

    return {
      format: 'istanbul',
      summary,
      files,
    };
  }

  private calculateStatements(file: IstanbulFileCoverage): CoverageMetric {
    const total = Object.keys(file.statementMap || {}).length;
    const covered = Object.values(file.s || {}).filter((hit) => hit > 0).length;
    return {
      total,
      covered,
      percentage: total > 0 ? (covered / total) * 100 : 100,
    };
  }

  private calculateBranches(file: IstanbulFileCoverage): CoverageMetric {
    let total = 0;
    let covered = 0;

    for (const branch of Object.values(file.branchMap || {})) {
      total += branch.locations.length;
    }

    for (const hits of Object.values(file.b || {})) {
      covered += hits.filter((hit) => hit > 0).length;
    }

    return {
      total,
      covered,
      percentage: total > 0 ? (covered / total) * 100 : 100,
    };
  }

  private calculateFunctions(file: IstanbulFileCoverage): CoverageMetric {
    const total = Object.keys(file.fnMap || {}).length;
    const covered = Object.values(file.f || {}).filter((hit) => hit > 0).length;
    return {
      total,
      covered,
      percentage: total > 0 ? (covered / total) * 100 : 100,
    };
  }

  private calculateLines(file: IstanbulFileCoverage): CoverageMetric {
    // Extract unique lines from statement locations
    const lineSet = new Set<number>();
    const coveredLines = new Set<number>();

    for (const [key, loc] of Object.entries(file.statementMap || {})) {
      for (let line = loc.start.line; line <= loc.end.line; line++) {
        lineSet.add(line);
        if (file.s && file.s[key] > 0) {
          coveredLines.add(line);
        }
      }
    }

    return {
      total: lineSet.size,
      covered: coveredLines.size,
      percentage: lineSet.size > 0 ? (coveredLines.size / lineSet.size) * 100 : 100,
    };
  }

  private calculateSummary(files: FileCoverage[]): CoverageSummary {
    const sumMetrics = (metricFn: (f: FileCoverage) => CoverageMetric): CoverageMetric => {
      let total = 0;
      let covered = 0;

      for (const file of files) {
        const metric = metricFn(file);
        total += metric.total;
        covered += metric.covered;
      }

      return {
        total,
        covered,
        percentage: total > 0 ? (covered / total) * 100 : 100,
      };
    };

    return {
      statements: sumMetrics((f) => f.statements),
      branches: sumMetrics((f) => f.branches),
      functions: sumMetrics((f) => f.functions),
      lines: sumMetrics((f) => f.lines),
    };
  }
}
