import * as core from '@actions/core';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ActionInputs, BaselineResult, GitContext, NormalizedCoverage } from './types';
import {
  requestPrepareBatchDownload,
  downloadFilesWithPresignedUrls,
  downloadFilesDirect,
} from '@bffless/artifact-client';
import { parseBaselineCoverage } from './parse';

/**
 * Common coverage file names to look for when a directory is provided
 */
const COMMON_COVERAGE_FILES = [
  'lcov.info',
  'coverage.lcov',
  'coverage-final.json',
  'coverage.json',
  'cobertura.xml',
  'cobertura-coverage.xml',
  'coverage.xml',
  'clover.xml',
  'jacoco.xml',
  'jacocoTestReport.xml',
];

/**
 * Find coverage file in a directory
 */
function findCoverageFile(dirPath: string): string | null {
  for (const filename of COMMON_COVERAGE_FILES) {
    const filePath = path.join(dirPath, filename);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      return filePath;
    }
  }
  return null;
}

/**
 * Resolve the coverage file path - handles both files and directories
 */
function resolveCoveragePath(inputPath: string): string | null {
  if (!fs.existsSync(inputPath)) {
    return null;
  }

  const stat = fs.statSync(inputPath);

  if (stat.isFile()) {
    return inputPath;
  }

  if (stat.isDirectory()) {
    return findCoverageFile(inputPath);
  }

  return null;
}

/**
 * Download baseline coverage from BFFLESS
 */
export async function downloadBaseline(
  inputs: ActionInputs,
  context: GitContext,
): Promise<BaselineResult> {
  // Create temp directory for baseline
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'coverage-baseline-'));

  core.info(`Downloading baseline to: ${tempDir}`);

  // The baseline-alias refers to a specific path in BFFLESS
  // We need to extract just the filename portion for the local path
  const baselinePath = inputs.path.replace(/^\.\//, '').replace(/\/$/, '');

  const prepareResponse = await requestPrepareBatchDownload(inputs.apiUrl, inputs.apiKey, {
    repository: inputs.repository,
    path: baselinePath,
    alias: inputs.baselineAlias,
  });

  if (prepareResponse.files.length === 0) {
    core.warning('No baseline files found');
    return {
      commitSha: prepareResponse.commitSha,
      isPublic: prepareResponse.isPublic ?? false,
      outputDir: tempDir,
      fileCount: 0,
      files: [],
    };
  }

  core.info(`Found ${prepareResponse.files.length} baseline files`);
  core.info(`Baseline commit SHA: ${prepareResponse.commitSha}`);
  core.info(`Baseline is public: ${prepareResponse.isPublic ?? false}`);

  let downloadResults: { success: string[]; failed: Array<{ path: string; error: string }> };

  if (prepareResponse.presignedUrlsSupported) {
    // Download using presigned URLs (direct from storage)
    core.info('Downloading baseline directly from storage...');
    downloadResults = await downloadFilesWithPresignedUrls(prepareResponse.files, tempDir, 10, 3);
  } else {
    // Fallback to direct download through API
    core.info('Storage does not support presigned URLs, downloading through API...');
    downloadResults = await downloadFilesDirect(
      inputs.apiUrl,
      inputs.apiKey,
      prepareResponse.files,
      tempDir,
      {
        repository: inputs.repository,
        alias: inputs.baselineAlias,
      },
      10,
      3,
    );
  }

  if (downloadResults.failed.length > 0) {
    core.warning(
      `${downloadResults.failed.length} baseline files failed to download:\n` +
        downloadResults.failed
          .slice(0, 10)
          .map((f) => `  - ${f.path}: ${f.error}`)
          .join('\n'),
    );

    if (downloadResults.failed.length > downloadResults.success.length) {
      throw new Error(
        `Too many download failures: ${downloadResults.failed.length}/${prepareResponse.files.length}`,
      );
    }
  }

  core.info(`Successfully downloaded ${downloadResults.success.length} baseline files`);

  // Parse the downloaded coverage file
  let coverage: NormalizedCoverage | undefined;

  if (downloadResults.success.length > 0) {
    // Files are downloaded relative to the requested path, so they're directly in tempDir
    // e.g., if we request "coverage", files come back as "coverage-final.json" not "coverage/coverage-final.json"
    const coverageFilePath = resolveCoveragePath(tempDir);

    if (coverageFilePath) {
      core.info(`Found baseline coverage file: ${path.basename(coverageFilePath)}`);
      const content = fs.readFileSync(coverageFilePath, 'utf-8');
      const filename = path.basename(coverageFilePath);

      try {
        coverage = await parseBaselineCoverage(content, filename, inputs.format);
        core.info(`Parsed baseline coverage: ${coverage.format} format`);
      } catch (err) {
        core.warning(
          `Failed to parse baseline coverage: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    } else {
      core.warning(
        `Baseline coverage file not found in: ${tempDir}\n` +
          `Downloaded files: ${downloadResults.success.slice(0, 5).join(', ')}${downloadResults.success.length > 5 ? '...' : ''}\n` +
          `Looked for: ${COMMON_COVERAGE_FILES.join(', ')}`,
      );
    }
  }

  return {
    commitSha: prepareResponse.commitSha,
    isPublic: prepareResponse.isPublic ?? false,
    outputDir: tempDir,
    fileCount: downloadResults.success.length,
    files: downloadResults.success,
    coverage,
  };
}
