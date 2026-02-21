import * as core from '@actions/core';
import * as path from 'path';
import { ActionInputs, NormalizedCoverage, CoverageFormat } from './types';
import { validateFile, readFileContents } from './files';
import { parseCoverage, detectFormat } from './parsers';

/**
 * Parse coverage file from local filesystem
 */
export async function parseLocalCoverage(inputs: ActionInputs): Promise<NormalizedCoverage> {
  const filePath = validateFile(inputs.path);
  const content = readFileContents(filePath);
  const filename = path.basename(filePath);

  core.info(`Parsing coverage file: ${inputs.path}`);

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
