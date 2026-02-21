export interface ActionInputs {
    path: string;
    baselineAlias: string;
    apiUrl: string;
    apiKey: string;
    format: CoverageFormat | 'auto';
    threshold: number;
    uploadResults: boolean;
    alias: string;
    repository: string;
    failOnRegression: boolean;
    summary: boolean;
    comment: boolean;
    commentHeader: string;
}
export interface GitContext {
    repository: string;
    commitSha: string;
    branch: string;
    prNumber?: number;
}
export type CoverageFormat = 'lcov' | 'istanbul' | 'cobertura' | 'clover' | 'jacoco';
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
    overallDelta: number;
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
export interface BaselineResult {
    commitSha: string;
    isPublic: boolean;
    outputDir: string;
    fileCount: number;
    files: string[];
    coverage?: NormalizedCoverage;
}
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
export interface UploadResult {
    uploadUrl?: string;
}
