import { XMLParser } from 'fast-xml-parser';
import { NormalizedCoverage, CoverageSummary, FileCoverage, CoverageMetric } from '../types';
import { CoverageParser } from './index';

/**
 * Clover XML format
 * Used by PHP, Java, and other tools
 */
interface CloverXml {
  coverage?: {
    '@_generated'?: string;
    '@_clover'?: string;
    project?: CloverProject;
  };
  project?: CloverProject; // Alternative structure
}

interface CloverProject {
  '@_name'?: string;
  '@_timestamp'?: string;
  metrics?: CloverMetrics;
  package?: CloverPackage | CloverPackage[];
  file?: CloverFile | CloverFile[];
}

interface CloverPackage {
  '@_name': string;
  metrics?: CloverMetrics;
  file?: CloverFile | CloverFile[];
}

interface CloverFile {
  '@_name': string;
  '@_path'?: string;
  metrics?: CloverMetrics;
  class?: CloverClass | CloverClass[];
  line?: CloverLine | CloverLine[];
}

interface CloverClass {
  '@_name': string;
  metrics?: CloverMetrics;
}

interface CloverMetrics {
  '@_statements'?: string;
  '@_coveredstatements'?: string;
  '@_conditionals'?: string;
  '@_coveredconditionals'?: string;
  '@_methods'?: string;
  '@_coveredmethods'?: string;
  '@_elements'?: string;
  '@_coveredelements'?: string;
  '@_loc'?: string;
  '@_ncloc'?: string;
  '@_classes'?: string;
  '@_files'?: string;
  '@_packages'?: string;
}

interface CloverLine {
  '@_num': string;
  '@_count': string;
  '@_type': 'stmt' | 'cond' | 'method';
  '@_truecount'?: string;
  '@_falsecount'?: string;
}

export class CloverParser implements CoverageParser {
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
    return (
      (content.includes('<coverage') && content.includes('clover')) || content.includes('<project')
    );
  }

  async parse(content: string): Promise<NormalizedCoverage> {
    let data: CloverXml;

    try {
      data = this.parser.parse(content);
    } catch (err) {
      throw new Error(
        `Failed to parse Clover XML: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    const project = data.coverage?.project || data.project;
    if (!project) {
      throw new Error('Invalid Clover format: missing project element');
    }

    const files: FileCoverage[] = [];

    // Parse files directly under project
    if (project.file) {
      const projectFiles = Array.isArray(project.file) ? project.file : [project.file];
      for (const file of projectFiles) {
        files.push(this.parseFile(file));
      }
    }

    // Parse packages
    if (project.package) {
      const packages = Array.isArray(project.package) ? project.package : [project.package];
      for (const pkg of packages) {
        if (pkg.file) {
          const pkgFiles = Array.isArray(pkg.file) ? pkg.file : [pkg.file];
          for (const file of pkgFiles) {
            files.push(this.parseFile(file));
          }
        }
      }
    }

    // Calculate summary from project metrics or aggregate from files
    const summary = project.metrics
      ? this.parseMetrics(project.metrics)
      : this.aggregateSummary(files);

    return {
      format: 'clover',
      summary,
      files,
    };
  }

  private parseFile(file: CloverFile): FileCoverage {
    const filePath = file['@_path'] || file['@_name'];

    if (file.metrics) {
      return {
        path: filePath,
        ...this.parseMetrics(file.metrics),
      };
    }

    // Parse from line elements if no metrics
    let totalStatements = 0;
    let coveredStatements = 0;
    let totalBranches = 0;
    let coveredBranches = 0;
    let totalMethods = 0;
    let coveredMethods = 0;

    if (file.line) {
      const lines = Array.isArray(file.line) ? file.line : [file.line];

      for (const line of lines) {
        const count = parseInt(line['@_count'], 10) || 0;

        switch (line['@_type']) {
          case 'stmt':
            totalStatements++;
            if (count > 0) coveredStatements++;
            break;
          case 'cond':
            // Branches
            const trueCount = parseInt(line['@_truecount'] || '0', 10);
            const falseCount = parseInt(line['@_falsecount'] || '0', 10);
            totalBranches += 2; // true and false branches
            if (trueCount > 0) coveredBranches++;
            if (falseCount > 0) coveredBranches++;
            break;
          case 'method':
            totalMethods++;
            if (count > 0) coveredMethods++;
            break;
        }
      }
    }

    return {
      path: filePath,
      statements: this.calculateMetric(coveredStatements, totalStatements),
      branches: this.calculateMetric(coveredBranches, totalBranches),
      functions: this.calculateMetric(coveredMethods, totalMethods),
      lines: this.calculateMetric(coveredStatements, totalStatements),
    };
  }

  private parseMetrics(metrics: CloverMetrics): CoverageSummary {
    const statements = parseInt(metrics['@_statements'] || '0', 10);
    const coveredStatements = parseInt(metrics['@_coveredstatements'] || '0', 10);
    const conditionals = parseInt(metrics['@_conditionals'] || '0', 10);
    const coveredConditionals = parseInt(metrics['@_coveredconditionals'] || '0', 10);
    const methods = parseInt(metrics['@_methods'] || '0', 10);
    const coveredMethods = parseInt(metrics['@_coveredmethods'] || '0', 10);

    return {
      statements: this.calculateMetric(coveredStatements, statements),
      branches: this.calculateMetric(coveredConditionals, conditionals),
      functions: this.calculateMetric(coveredMethods, methods),
      lines: this.calculateMetric(coveredStatements, statements),
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
