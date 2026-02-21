import * as core from '@actions/core';
import * as fs from 'fs';
import * as path from 'path';
import { ActionInputs, GitContext, UploadResult, FileInfo } from './types';
import { requestPrepareBatchUpload, uploadFilesWithPresignedUrls, finalizeUpload } from './api';
import * as mimeTypes from 'mime-types';

/**
 * Upload coverage file to BFFLESS
 */
export async function uploadResults(
  inputs: ActionInputs,
  context: GitContext,
): Promise<UploadResult> {
  const result: UploadResult = {};

  // Get the coverage file info
  const coveragePath = path.resolve(inputs.path);

  if (!fs.existsSync(coveragePath)) {
    core.warning(`Coverage file not found: ${coveragePath}`);
    return result;
  }

  const stat = fs.statSync(coveragePath);
  if (!stat.isFile()) {
    core.warning(`Coverage path is not a file: ${coveragePath}`);
    return result;
  }

  const relativePath = inputs.path.replace(/^\.\//, '');
  const contentType = mimeTypes.lookup(coveragePath) || 'application/octet-stream';

  const fileInfo: FileInfo = {
    absolutePath: coveragePath,
    relativePath,
    size: stat.size,
    contentType,
  };

  core.info(`Uploading coverage to alias: ${inputs.alias}`);

  try {
    // Request presigned URL
    const prepareResponse = await requestPrepareBatchUpload(inputs.apiUrl, inputs.apiKey, {
      repository: inputs.repository,
      commitSha: context.commitSha,
      branch: context.branch,
      alias: inputs.alias,
      description: `Coverage report for ${context.prNumber ? `PR #${context.prNumber}` : context.commitSha.slice(0, 7)}`,
      files: [
        {
          path: relativePath,
          size: fileInfo.size,
          contentType: fileInfo.contentType,
        },
      ],
    });

    // Check if presigned URLs are supported
    if (!prepareResponse.presignedUrlsSupported) {
      core.warning('Storage does not support presigned URLs for upload');
      return result;
    }

    if (!prepareResponse.files || !prepareResponse.uploadToken) {
      throw new Error('Invalid response from prepare-batch-upload');
    }

    core.info(
      `Received ${prepareResponse.files.length} presigned URLs (expires: ${prepareResponse.expiresAt})`,
    );

    // Get presigned URL for the coverage file
    const urlInfo = prepareResponse.files.find((f) => f.path === relativePath);
    if (!urlInfo) {
      throw new Error(`No presigned URL for coverage file: ${relativePath}`);
    }

    // Upload file
    core.info('Uploading coverage file to storage...');
    const uploadResults = await uploadFilesWithPresignedUrls(
      [{ file: fileInfo, presignedUrl: urlInfo.presignedUrl }],
      1,
      3,
    );

    if (uploadResults.failed.length > 0) {
      throw new Error(`Upload failed: ${uploadResults.failed[0].error}`);
    }

    core.info('Successfully uploaded coverage file');

    // Finalize upload
    const response = await finalizeUpload(inputs.apiUrl, inputs.apiKey, {
      uploadToken: prepareResponse.uploadToken,
    });

    core.info('Upload finalized successfully');
    core.info(`Deployment ID: ${response.deploymentId}`);

    result.uploadUrl = response.urls.sha || response.urls.alias;
    core.info(`Coverage uploaded: ${result.uploadUrl}`);
  } catch (error) {
    core.warning(
      `Failed to upload coverage: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  return result;
}
