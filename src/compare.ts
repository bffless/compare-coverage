import {
  NormalizedCoverage,
  CoverageComparison,
  MetricComparison,
  FileComparison,
  ComparisonStatus,
  CoverageMetric,
  ActionInputs,
} from './types';

/**
 * Compare current coverage against baseline
 */
export function compareCoverage(
  current: NormalizedCoverage,
  baseline: NormalizedCoverage,
  threshold: number,
): CoverageComparison {
  // Compare each metric
  const metrics: MetricComparison[] = [
    compareMetric('statements', baseline.summary.statements, current.summary.statements, threshold),
    compareMetric('branches', baseline.summary.branches, current.summary.branches, threshold),
    compareMetric('functions', baseline.summary.functions, current.summary.functions, threshold),
    compareMetric('lines', baseline.summary.lines, current.summary.lines, threshold),
  ];

  // Compare files (find files with coverage changes)
  const files = compareFiles(current, baseline, threshold);

  // Calculate overall status
  const overallDelta = calculateOverallDelta(metrics);
  const overallStatus = determineOverallStatus(metrics, threshold);

  return {
    metrics,
    files,
    overallStatus,
    overallDelta,
  };
}

/**
 * Compare a single metric between baseline and current
 */
function compareMetric(
  metric: 'statements' | 'branches' | 'functions' | 'lines',
  baseline: CoverageMetric,
  current: CoverageMetric,
  threshold: number,
): MetricComparison {
  const delta = current.percentage - baseline.percentage;

  let status: ComparisonStatus;
  if (delta > 0) {
    status = 'improved';
  } else if (delta < -threshold) {
    status = 'regressed';
  } else {
    status = 'unchanged';
  }

  return {
    metric,
    baseline,
    current,
    delta,
    status,
  };
}

/**
 * Compare file-level coverage between baseline and current
 */
function compareFiles(
  current: NormalizedCoverage,
  baseline: NormalizedCoverage,
  threshold: number,
): FileComparison[] {
  const comparisons: FileComparison[] = [];

  // Create maps for quick lookup
  const baselineFiles = new Map(baseline.files.map((f) => [f.path, f]));
  const currentFiles = new Map(current.files.map((f) => [f.path, f]));

  // Get all unique file paths
  const allPaths = new Set([...baselineFiles.keys(), ...currentFiles.keys()]);

  for (const filePath of allPaths) {
    const baselineFile = baselineFiles.get(filePath);
    const currentFile = currentFiles.get(filePath);

    if (!baselineFile || !currentFile) {
      // File added or removed - skip for now
      continue;
    }

    const linesDelta = currentFile.lines.percentage - baselineFile.lines.percentage;

    // Only include files with meaningful changes
    if (Math.abs(linesDelta) > 0.1) {
      let status: ComparisonStatus;
      if (linesDelta > 0) {
        status = 'improved';
      } else if (linesDelta < -threshold) {
        status = 'regressed';
      } else {
        status = 'unchanged';
      }

      comparisons.push({
        path: filePath,
        linesDelta,
        status,
      });
    }
  }

  // Sort by delta (most regressed first, then most improved)
  comparisons.sort((a, b) => a.linesDelta - b.linesDelta);

  return comparisons;
}

/**
 * Calculate overall delta (average of all metrics)
 */
function calculateOverallDelta(metrics: MetricComparison[]): number {
  if (metrics.length === 0) return 0;

  const sum = metrics.reduce((acc, m) => acc + m.delta, 0);
  return sum / metrics.length;
}

/**
 * Determine overall status based on all metrics
 */
function determineOverallStatus(metrics: MetricComparison[], threshold: number): ComparisonStatus {
  // If any metric regressed beyond threshold, overall is regressed
  const hasRegression = metrics.some((m) => m.status === 'regressed');
  if (hasRegression) {
    return 'regressed';
  }

  // If any metric improved and none regressed, overall is improved
  const hasImprovement = metrics.some((m) => m.status === 'improved');
  if (hasImprovement) {
    return 'improved';
  }

  return 'unchanged';
}

/**
 * Determine if the action should fail based on comparison results
 */
export function shouldFail(comparison: CoverageComparison, inputs: ActionInputs): boolean {
  if (!inputs.failOnRegression) {
    return false;
  }

  return comparison.overallStatus === 'regressed';
}
