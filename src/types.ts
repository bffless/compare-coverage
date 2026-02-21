// Action Inputs
export interface ActionInputs {
  // Required
  path: string;
  baselineAlias: string;
  apiUrl: string;
  apiKey: string;

  // Format
  format: CoverageFormat | 'auto';

  // Comparison
  threshold: number; // 0-100 percentage

  // Upload
  uploadResults: boolean;
  alias: string;

  // Context
  repository: string;

  // Behavior
  failOnRegression: boolean;
  summary: boolean;

  // PR Comment
  comment: boolean;
  commentHeader: string;
}

// Git Context
export interface GitContext {
  repository: string;
  commitSha: string;
  branch: string;
  prNumber?: number;
}

// Coverage Formats
export type CoverageFormat = 'lcov' | 'istanbul' | 'cobertura' | 'clover' | 'jacoco';

// Coverage Metrics
export interface CoverageMetric {
  total: number;
  covered: number;
  percentage: number;
}

export interface CoverageSummary {
  statements: CoverageMetric;
  branches: CoverageMetric;
  functions: CoverageMetric;
  lines: CoverageMetric;
}

export interface FileCoverage {
  path: string;
  statements: CoverageMetric;
  branches: CoverageMetric;
  functions: CoverageMetric;
  lines: CoverageMetric;
}

export interface NormalizedCoverage {
  format: CoverageFormat;
  summary: CoverageSummary;
  files: FileCoverage[];
}

// Comparison Types
export type ComparisonStatus = 'improved' | 'regressed' | 'unchanged';

export interface MetricComparison {
  metric: 'statements' | 'branches' | 'functions' | 'lines';
  baseline: CoverageMetric;
  current: CoverageMetric;
  delta: number;
  status: ComparisonStatus;
}

export interface FileComparison {
  path: string;
  linesDelta: number;
  status: ComparisonStatus;
}

export interface CoverageComparison {
  metrics: MetricComparison[];
  files: FileComparison[];
  overallStatus: ComparisonStatus;
  overallDelta: number; // Average of all metric deltas
}

export interface CoverageReport {
  timestamp: string;
  baselineAlias: string;
  baselineCommitSha: string;
  currentCommitSha: string;
  threshold: number;
  format: CoverageFormat;
  baseline: CoverageSummary;
  current: CoverageSummary;
  comparison: CoverageComparison;
}

// Download Types (from BFFLESS API)
export interface DownloadFileInfo {
  path: string;
  size: number;
  downloadUrl: string;
}

export interface PrepareBatchDownloadRequest {
  repository: string;
  path: string;
  alias?: string;
  commitSha?: string;
  branch?: string;
}

export interface PrepareBatchDownloadResponse {
  presignedUrlsSupported: boolean;
  commitSha: string;
  isPublic: boolean;
  files: DownloadFileInfo[];
}

export interface BaselineResult {
  commitSha: string;
  isPublic: boolean;
  outputDir: string;
  fileCount: number;
  files: string[];
  coverage?: NormalizedCoverage;
}

// Upload Types (from BFFLESS API)
export interface FileInfo {
  absolutePath: string;
  relativePath: string;
  size: number;
  contentType: string;
}

export interface BatchUploadFile {
  path: string;
  size: number;
  contentType: string;
}

export interface PrepareBatchUploadRequest {
  repository: string;
  commitSha: string;
  branch?: string;
  alias?: string;
  basePath?: string;
  description?: string;
  files: BatchUploadFile[];
}

export interface PresignedUrlInfo {
  path: string;
  presignedUrl: string;
  storageKey: string;
}

export interface PrepareBatchUploadResponse {
  presignedUrlsSupported: boolean;
  uploadToken?: string;
  expiresAt?: string;
  files?: PresignedUrlInfo[];
}

export interface FinalizeUploadRequest {
  uploadToken: string;
}

export interface DeploymentUrls {
  sha?: string;
  alias?: string;
  preview?: string;
  branch?: string;
}

export interface UploadResponse {
  deploymentId: string;
  repository?: string;
  commitSha: string;
  branch?: string;
  fileCount: number;
  totalSize: number;
  aliases?: string[];
  urls: DeploymentUrls;
}

// Action Outputs
export interface ActionOutputs {
  statements: number;
  branches: number;
  functions: number;
  lines: number;
  statementsDelta: number;
  branchesDelta: number;
  functionsDelta: number;
  linesDelta: number;
  result: 'pass' | 'fail' | 'improved';
  report: string;
  baselineCommitSha: string;
  uploadUrl?: string;
}

// Upload Result
export interface UploadResult {
  uploadUrl?: string;
}
