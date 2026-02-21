import * as core from '@actions/core';
import * as fs from 'fs';
import { getInputs } from './inputs';
import { deriveContext } from './context';
import { downloadBaseline } from './download';
import { parseLocalCoverage } from './parse';
import { compareCoverage, shouldFail } from './compare';
import { uploadResults } from './upload';
import { generateSummary } from './summary';
import { postPRComment } from './comment';
import { writeReport } from './report';
import { ActionOutputs, CoverageReport, UploadResult } from './types';

async function run(): Promise<void> {
  let baselineDir: string | undefined;

  try {
    // 1. Parse and validate inputs
    const inputs = getInputs();
    core.setSecret(inputs.apiKey);

    core.info(`Path: ${inputs.path}`);
    core.info(`Baseline alias: ${inputs.baselineAlias}`);
    core.info(`API URL: ${inputs.apiUrl}`);
    core.info(`Repository: ${inputs.repository}`);
    core.info(`Format: ${inputs.format}`);
    core.info(`Threshold: ${inputs.threshold}%`);
    core.info(`Upload results: ${inputs.uploadResults}`);

    // 2. Get git context
    const context = deriveContext();
    core.info(`Commit SHA: ${context.commitSha}`);
    core.info(`Branch: ${context.branch}`);
    if (context.prNumber) core.info(`PR Number: ${context.prNumber}`);

    // 3. Parse local coverage file
    core.info(`\nParsing local coverage from: ${inputs.path}`);
    const currentCoverage = await parseLocalCoverage(inputs);
    core.info(`Format: ${currentCoverage.format}`);
    core.info(`Files: ${currentCoverage.files.length}`);
    core.info(
      `Lines: ${currentCoverage.summary.lines.covered}/${currentCoverage.summary.lines.total} (${currentCoverage.summary.lines.percentage.toFixed(1)}%)`,
    );

    // 4. Download baseline coverage from BFFLESS
    core.info(`\nDownloading baseline from alias: ${inputs.baselineAlias}`);
    const baseline = await downloadBaseline(inputs, context);
    baselineDir = baseline.outputDir;
    core.info(`Baseline commit SHA: ${baseline.commitSha}`);

    if (!baseline.coverage) {
      throw new Error('Failed to parse baseline coverage');
    }

    core.info(
      `Baseline lines: ${baseline.coverage.summary.lines.covered}/${baseline.coverage.summary.lines.total} (${baseline.coverage.summary.lines.percentage.toFixed(1)}%)`,
    );

    // 5. Compare coverage
    core.info(`\nComparing coverage...`);
    const comparison = compareCoverage(currentCoverage, baseline.coverage, inputs.threshold);

    // Log comparison results
    core.info(`\nComparison Results:`);
    core.info(`  Overall status: ${comparison.overallStatus}`);
    core.info(`  Overall delta: ${comparison.overallDelta.toFixed(2)}%`);
    for (const metric of comparison.metrics) {
      core.info(
        `  ${metric.metric}: ${metric.baseline.percentage.toFixed(1)}% -> ${metric.current.percentage.toFixed(1)}% (${metric.delta >= 0 ? '+' : ''}${metric.delta.toFixed(1)}%)`,
      );
    }

    // 6. Build report
    const report: CoverageReport = {
      timestamp: new Date().toISOString(),
      baselineAlias: inputs.baselineAlias,
      baselineCommitSha: baseline.commitSha,
      currentCommitSha: context.commitSha,
      threshold: inputs.threshold,
      format: currentCoverage.format,
      baseline: baseline.coverage.summary,
      current: currentCoverage.summary,
      comparison,
    };

    // 7. Write JSON report
    const reportPath = './coverage-report.json';
    await writeReport(report, reportPath);
    core.info(`\nReport written to: ${reportPath}`);

    // 8. Upload results if enabled
    let uploadedUrls: UploadResult = {};
    if (inputs.uploadResults) {
      core.info('\nUploading coverage to BFFLESS...');
      uploadedUrls = await uploadResults(inputs, context);
    }

    // 9. Set outputs
    const result =
      comparison.overallStatus === 'regressed'
        ? 'fail'
        : comparison.overallStatus === 'improved'
          ? 'improved'
          : 'pass';

    const outputs: ActionOutputs = {
      statements: currentCoverage.summary.statements.percentage,
      branches: currentCoverage.summary.branches.percentage,
      functions: currentCoverage.summary.functions.percentage,
      lines: currentCoverage.summary.lines.percentage,
      statementsDelta: comparison.metrics.find((m) => m.metric === 'statements')?.delta ?? 0,
      branchesDelta: comparison.metrics.find((m) => m.metric === 'branches')?.delta ?? 0,
      functionsDelta: comparison.metrics.find((m) => m.metric === 'functions')?.delta ?? 0,
      linesDelta: comparison.metrics.find((m) => m.metric === 'lines')?.delta ?? 0,
      result,
      report: JSON.stringify(report),
      baselineCommitSha: baseline.commitSha,
      ...uploadedUrls,
    };

    core.setOutput('statements', outputs.statements.toFixed(1));
    core.setOutput('branches', outputs.branches.toFixed(1));
    core.setOutput('functions', outputs.functions.toFixed(1));
    core.setOutput('lines', outputs.lines.toFixed(1));
    core.setOutput('statements-delta', outputs.statementsDelta.toFixed(1));
    core.setOutput('branches-delta', outputs.branchesDelta.toFixed(1));
    core.setOutput('functions-delta', outputs.functionsDelta.toFixed(1));
    core.setOutput('lines-delta', outputs.linesDelta.toFixed(1));
    core.setOutput('result', outputs.result);
    core.setOutput('report', outputs.report);
    core.setOutput('baseline-commit-sha', outputs.baselineCommitSha);
    if (outputs.uploadUrl) core.setOutput('upload-url', outputs.uploadUrl);

    // 10. Generate summary
    if (inputs.summary) {
      await generateSummary(report, inputs, context, uploadedUrls);
    }

    // 11. Post PR comment
    if (inputs.comment) {
      await postPRComment(report, inputs, context, uploadedUrls);
    }

    // 12. Fail if regression detected and configured to fail
    if (shouldFail(comparison, inputs)) {
      core.setFailed(
        `Coverage regressed by ${Math.abs(comparison.overallDelta).toFixed(1)}% (threshold: ${inputs.threshold}%)`,
      );
    }

    // Force exit to close any dangling HTTP connections
    process.exit(shouldFail(comparison, inputs) ? 1 : 0);
  } catch (error) {
    core.setFailed(error instanceof Error ? error.message : String(error));
    process.exit(1);
  } finally {
    // Clean up temp baseline directory
    if (baselineDir && fs.existsSync(baselineDir)) {
      try {
        fs.rmSync(baselineDir, { recursive: true });
        core.info('Cleaned up temporary baseline directory');
      } catch {
        core.warning(`Failed to clean up temp directory: ${baselineDir}`);
      }
    }
  }
}

run();
