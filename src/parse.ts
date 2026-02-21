import * as core from '@actions/core';
import * as fs from 'fs';
import * as path from 'path';
import { ActionInputs, NormalizedCoverage, CoverageFormat } from './types';
import { readFileContents } from './files';
import { parseCoverage, detectFormat } from './parsers';

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
function resolveCoveragePath(inputPath: string): string {
  const resolvedPath = path.resolve(inputPath);

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Path does not exist: ${resolvedPath}`);
  }

  const stat = fs.statSync(resolvedPath);

  if (stat.isFile()) {
    return resolvedPath;
  }

  if (stat.isDirectory()) {
    core.info(`Path is a directory, searching for coverage file...`);
    const coverageFile = findCoverageFile(resolvedPath);

    if (coverageFile) {
      core.info(`Found coverage file: ${path.basename(coverageFile)}`);
      return coverageFile;
    }

    throw new Error(
      `No coverage file found in directory: ${resolvedPath}\n` +
        `Looked for: ${COMMON_COVERAGE_FILES.join(', ')}\n` +
        `Please specify the full path to your coverage file.`,
    );
  }

  throw new Error(`Path is not a file or directory: ${resolvedPath}`);
}

/**
 * Parse coverage file from local filesystem
 */
export async function parseLocalCoverage(inputs: ActionInputs): Promise<NormalizedCoverage> {
  const filePath = resolveCoveragePath(inputs.path);
  const content = readFileContents(filePath);
  const filename = path.basename(filePath);

  core.info(`Parsing coverage file: ${filePath}`);

  const coverage = await parseCoverage(content, filename, inputs.format);

  const format = inputs.format === 'auto' ? detectFormat(content, filename) : inputs.format;
  core.info(`Detected format: ${format}`);
  core.info(`Files in coverage: ${coverage.files.length}`);

  return coverage;
}

/**
 * Parse coverage from downloaded baseline content
 */
export async function parseBaselineCoverage(
  content: string,
  filename: string,
  format: CoverageFormat | 'auto',
): Promise<NormalizedCoverage> {
  return parseCoverage(content, filename, format);
}
