import * as fs from 'fs';
import * as path from 'path';
import { CoverageReport } from './types';

/**
 * Write JSON report to file
 */
export async function writeReport(report: CoverageReport, reportPath: string): Promise<void> {
  const resolvedPath = path.resolve(reportPath);
  const dir = path.dirname(resolvedPath);

  // Ensure directory exists
  fs.mkdirSync(dir, { recursive: true });

  // Write report
  fs.writeFileSync(resolvedPath, JSON.stringify(report, null, 2));
}
