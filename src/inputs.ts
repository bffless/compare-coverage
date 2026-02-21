import * as core from '@actions/core';
import { ActionInputs, CoverageFormat } from './types';
import { deriveContext } from './context';

export function getInputs(): ActionInputs {
  // Required inputs
  const path = core.getInput('path', { required: true });
  const baselineAlias = core.getInput('baseline-alias', { required: true });
  const apiUrl = core.getInput('api-url', { required: true });
  const apiKey = core.getInput('api-key', { required: true });
  core.setSecret(apiKey);

  // Format option
  const formatInput = core.getInput('format') || 'auto';
  const validFormats = ['auto', 'lcov', 'istanbul', 'cobertura', 'clover', 'jacoco'];
  if (!validFormats.includes(formatInput)) {
    throw new Error(`Invalid format: ${formatInput}. Must be one of: ${validFormats.join(', ')}`);
  }
  const format = formatInput as CoverageFormat | 'auto';

  // Comparison options
  const thresholdInput = core.getInput('threshold') || '0';
  const threshold = parseFloat(thresholdInput);
  if (isNaN(threshold) || threshold < 0 || threshold > 100) {
    throw new Error(`Invalid threshold: ${thresholdInput}. Must be a number between 0 and 100.`);
  }

  // Upload options
  const uploadResultsInput = core.getInput('upload-results') || 'true';
  const uploadResults = uploadResultsInput.toLowerCase() !== 'false';
  const alias = core.getInput('alias') || 'preview';

  // Repository context
  const context = deriveContext();
  const repository = core.getInput('repository') || context.repository;

  // Behavior options
  const failOnRegressionInput = core.getInput('fail-on-regression') || 'true';
  const failOnRegression = failOnRegressionInput.toLowerCase() !== 'false';

  const summaryInput = core.getInput('summary') || 'true';
  const summary = summaryInput.toLowerCase() !== 'false';

  // PR Comment options
  const commentInput = core.getInput('comment') || 'true';
  const comment = commentInput.toLowerCase() !== 'false';
  const commentHeader = core.getInput('comment-header') || '## Coverage Report';

  return {
    path,
    baselineAlias,
    apiUrl,
    apiKey,
    format,
    threshold,
    uploadResults,
    alias,
    repository,
    failOnRegression,
    summary,
    comment,
    commentHeader,
  };
}
