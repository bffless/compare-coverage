import * as core from '@actions/core';
import { CoverageReport, ActionInputs, GitContext, UploadResult } from './types';

/**
 * Generate GitHub step summary
 */
export async function generateSummary(
  report: CoverageReport,
  inputs: ActionInputs,
  context: GitContext,
  uploadResult: UploadResult,
): Promise<void> {
  const { comparison } = report;

  let md = '## Coverage Report\n\n';

  // Summary line
  const overallDelta = formatDelta(comparison.overallDelta);

  if (comparison.overallStatus === 'improved') {
    md += `> :white_check_mark: Coverage improved by **${overallDelta}** overall\n\n`;
  } else if (comparison.overallStatus === 'regressed') {
    md += `> :warning: Coverage regressed by **${overallDelta}** overall\n\n`;
  } else {
    md += `> :information_source: Coverage unchanged\n\n`;
  }

  // Metadata
  md += `**Baseline:** \`${inputs.baselineAlias}\` @ \`${report.baselineCommitSha.slice(0, 7)}\`\n`;
  md += `**Current:** \`${report.currentCommitSha.slice(0, 7)}\`\n`;
  md += `**Threshold:** ${inputs.threshold}%\n`;
  md += `**Format:** ${report.format}\n\n`;

  // Metrics table
  md += '### Metrics\n\n';
  md += '| Metric | Baseline | Current | Delta | Status |\n';
  md += '|--------|----------|---------|-------|--------|\n';

  for (const metric of comparison.metrics) {
    const baselinePct = formatPercentage(metric.baseline.percentage);
    const currentPct = formatPercentage(metric.current.percentage);
    const delta = formatDelta(metric.delta);
    const statusEmoji =
      metric.status === 'improved'
        ? ':arrow_up:'
        : metric.status === 'regressed'
          ? ':arrow_down:'
          : ':left_right_arrow:';

    md += `| ${capitalizeFirst(metric.metric)} | ${baselinePct} | ${currentPct} | ${delta} | ${statusEmoji} ${metric.status} |\n`;
  }

  md += '\n';

  // Coverage breakdown
  md += '### Coverage Breakdown\n\n';
  md += '| Metric | Covered | Total |\n';
  md += '|--------|---------|-------|\n';

  md += `| Statements | ${report.current.statements.covered} | ${report.current.statements.total} |\n`;
  md += `| Branches | ${report.current.branches.covered} | ${report.current.branches.total} |\n`;
  md += `| Functions | ${report.current.functions.covered} | ${report.current.functions.total} |\n`;
  md += `| Lines | ${report.current.lines.covered} | ${report.current.lines.total} |\n`;

  md += '\n';

  // Files with changes
  if (comparison.files.length > 0) {
    md += '### Files with Coverage Changes\n\n';

    const regressedFiles = comparison.files.filter((f) => f.status === 'regressed');
    const improvedFiles = comparison.files.filter((f) => f.status === 'improved');

    if (regressedFiles.length > 0) {
      md += '#### Regressed\n\n';
      md += '| File | \u0394 Lines |\n';
      md += '|------|--------|\n';

      for (const file of regressedFiles.slice(0, 10)) {
        md += `| ${file.path} | ${formatDelta(file.linesDelta)} |\n`;
      }

      if (regressedFiles.length > 10) {
        md += `\n*...and ${regressedFiles.length - 10} more files*\n`;
      }

      md += '\n';
    }

    if (improvedFiles.length > 0) {
      md += '#### Improved\n\n';
      md += '| File | \u0394 Lines |\n';
      md += '|------|--------|\n';

      for (const file of improvedFiles.slice(0, 10)) {
        md += `| ${file.path} | ${formatDelta(file.linesDelta)} |\n`;
      }

      if (improvedFiles.length > 10) {
        md += `\n*...and ${improvedFiles.length - 10} more files*\n`;
      }

      md += '\n';
    }
  }

  // Upload URL
  if (uploadResult.uploadUrl) {
    md += '### Uploaded Results\n\n';
    md += `- [View Coverage on BFFLESS](${uploadResult.uploadUrl})\n`;
  }

  // Footer
  md += '---\n\n';
  md += '<table><tr>\n';
  md += '<td width="96"><img src="https://bffless.app/images/logo-circle.svg" width="96" height="96" /></td>\n';
  md += '<td valign="top">\n';
  md += '<strong><a href="https://bffless.app">BFFless</a></strong><br/>\n';
  md += 'The BFF your frontend deserves<br/>\n';
  md += '<a href="https://github.com/bffless/compare-coverage">bffless/compare-coverage</a>\n';
  md += '</td>\n';
  md += '</tr></table>\n';

  await core.summary.addRaw(md).write();
}

/**
 * Format a percentage value
 */
function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`;
}

/**
 * Format a delta value with sign
 */
function formatDelta(value: number): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

/**
 * Capitalize first letter
 */
function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
