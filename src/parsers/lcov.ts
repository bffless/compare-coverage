import * as lcovParse from 'lcov-parse';
import { NormalizedCoverage, CoverageSummary, FileCoverage, CoverageMetric } from '../types';
import { CoverageParser } from './index';

interface LcovFile {
  file: string;
  title?: string;
  lines: {
    found: number;
    hit: number;
    details: Array<{ line: number; hit: number }>;
  };
  functions: {
    found: number;
    hit: number;
    details: Array<{ name: string; line: number; hit: number }>;
  };
  branches: {
    found: number;
    hit: number;
    details: Array<{ line: number; block: number; branch: number; taken: number }>;
  };
}

export class LcovParser implements CoverageParser {
  detect(content: string, filename: string): boolean {
    const ext = filename.toLowerCase();
    if (ext.endsWith('.info') || ext.endsWith('.lcov')) {
      return true;
    }
    // Check for LCOV format markers
    return content.includes('SF:') && (content.includes('LF:') || content.includes('DA:'));
  }

  async parse(content: string): Promise<NormalizedCoverage> {
    return new Promise((resolve, reject) => {
      lcovParse.source(content, (err: string | null, data: LcovFile[] | undefined) => {
        if (err) {
          reject(new Error(`Failed to parse LCOV: ${err}`));
          return;
        }

        if (!data || data.length === 0) {
          reject(new Error('LCOV file contains no coverage data'));
          return;
        }

        const files: FileCoverage[] = data.map((file) => ({
          path: file.file,
          statements: this.calculateMetric(file.lines.hit, file.lines.found),
          branches: this.calculateMetric(file.branches.hit, file.branches.found),
          functions: this.calculateMetric(file.functions.hit, file.functions.found),
          lines: this.calculateMetric(file.lines.hit, file.lines.found),
        }));

        // Calculate summary by aggregating all files
        const summary = this.calculateSummary(data);

        resolve({
          format: 'lcov',
          summary,
          files,
        });
      });
    });
  }

  private calculateMetric(covered: number, total: number): CoverageMetric {
    return {
      total,
      covered,
      percentage: total > 0 ? (covered / total) * 100 : 100,
    };
  }

  private calculateSummary(data: LcovFile[]): CoverageSummary {
    let totalLines = 0;
    let coveredLines = 0;
    let totalBranches = 0;
    let coveredBranches = 0;
    let totalFunctions = 0;
    let coveredFunctions = 0;

    for (const file of data) {
      totalLines += file.lines.found;
      coveredLines += file.lines.hit;
      totalBranches += file.branches.found;
      coveredBranches += file.branches.hit;
      totalFunctions += file.functions.found;
      coveredFunctions += file.functions.hit;
    }

    return {
      // LCOV doesn't distinguish statements from lines
      statements: this.calculateMetric(coveredLines, totalLines),
      branches: this.calculateMetric(coveredBranches, totalBranches),
      functions: this.calculateMetric(coveredFunctions, totalFunctions),
      lines: this.calculateMetric(coveredLines, totalLines),
    };
  }
}
