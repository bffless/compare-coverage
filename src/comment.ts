import * as core from '@actions/core';
import * as github from '@actions/github';
import { CoverageReport, ActionInputs, GitContext, UploadResult } from './types';

/**
 * Post or update a PR comment with the coverage report
 */
export async function postPRComment(
  report: CoverageReport,
  inputs: ActionInputs,
  context: GitContext,
  uploadResult: UploadResult,
): Promise<void> {
  // Check if we're in a PR context
  if (!context.prNumber) {
    core.info('Not in a PR context, skipping PR comment');
    return;
  }

  // Get GitHub token from environment
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    core.warning('GITHUB_TOKEN not available, skipping PR comment');
    return;
  }

  const octokit = github.getOctokit(token);
  const { comparison } = report;

  // Build the comment body
  let body = `${inputs.commentHeader}\n\n`;

  // Summary line with GitHub alert syntax
  const overallDelta = comparison.overallDelta;
  const deltaFormatted = formatDelta(overallDelta);

  if (comparison.overallStatus === 'improved') {
    body += `> [!TIP]\n> Coverage improved by **${deltaFormatted}** overall\n\n`;
  } else if (comparison.overallStatus === 'regressed') {
    body += `> [!WARNING]\n> Coverage regressed by **${deltaFormatted}** overall\n\n`;
  } else {
    body += `> [!NOTE]\n> Coverage unchanged\n\n`;
  }

  // Metrics table
  body += '| Metric | Baseline | Current | Delta |\n';
  body += '|:-------|:--------:|:-------:|------:|\n';

  for (const metric of comparison.metrics) {
    const baselinePct = formatPercentage(metric.baseline.percentage);
    const currentPct = formatPercentage(metric.current.percentage);
    const delta = formatDelta(metric.delta);
    const deltaStyle =
      metric.status === 'regressed' ? delta : metric.status === 'improved' ? `**${delta}**` : delta;

    body += `| ${capitalizeFirst(metric.metric)} | ${baselinePct} | ${currentPct} | ${deltaStyle} |\n`;
  }

  body += '\n';

  // Metadata table
  body += '<table>\n';
  body += `<tr><td><strong>Baseline</strong></td><td><code>${inputs.baselineAlias}</code> @ <code>${report.baselineCommitSha.slice(0, 7)}</code></td></tr>\n`;
  body += `<tr><td><strong>Current</strong></td><td><code>${report.currentCommitSha.slice(0, 7)}</code></td></tr>\n`;
  body += `<tr><td><strong>Threshold</strong></td><td>${inputs.threshold}%</td></tr>\n`;
  body += '</table>\n\n';

  // Files with coverage changes
  if (comparison.files.length > 0) {
    body += '---\n\n';
    body += '<details>\n';
    body += '<summary>Files with coverage changes</summary>\n\n';
    body += '| File | \u0394 Lines |\n';
    body += '|:-----|--------:|\n';

    // Show top 20 files
    const topFiles = comparison.files.slice(0, 20);
    for (const file of topFiles) {
      const delta = formatDelta(file.linesDelta);
      body += `| \`${shortenPath(file.path)}\` | ${delta} |\n`;
    }

    if (comparison.files.length > 20) {
      body += `\n*...and ${comparison.files.length - 20} more files*\n`;
    }

    body += '\n</details>\n\n';
  }

  // Upload URL
  if (uploadResult.uploadUrl) {
    body += `---\n\n`;
    body += `**Coverage Report:** [View on BFFLESS](${uploadResult.uploadUrl})\n\n`;
  }

  // Footer
  body +=
    '<p align="right"><img src="https://bffless.app/images/logo-circle.svg" width="20" height="20" align="absmiddle" /> <sub><a href="https://github.com/bffless/compare-coverage">BFFLESS</a></sub></p>';

  // Find existing comment by header
  const [owner, repo] = context.repository.split('/');
  const { data: comments } = await octokit.rest.issues.listComments({
    owner,
    repo,
    issue_number: context.prNumber,
  });

  const botComment = comments.find(
    (comment) => comment.user?.type === 'Bot' && comment.body?.includes(inputs.commentHeader),
  );

  if (botComment) {
    // Update existing comment
    await octokit.rest.issues.updateComment({
      owner,
      repo,
      comment_id: botComment.id,
      body,
    });
    core.info(`Updated existing PR comment (ID: ${botComment.id})`);
  } else {
    // Create new comment
    const { data: newComment } = await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: context.prNumber,
      body,
    });
    core.info(`Created new PR comment (ID: ${newComment.id})`);
  }
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

/**
 * Shorten a file path for display
 */
function shortenPath(filePath: string): string {
  // If path is short enough, return as-is
  if (filePath.length <= 50) {
    return filePath;
  }

  // Otherwise, show last 50 chars with ellipsis
  return '...' + filePath.slice(-47);
}
