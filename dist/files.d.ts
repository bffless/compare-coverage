import { FileInfo } from './types';
/**
 * Recursively walk a directory and collect all files
 * Skips hidden files and system files
 */
export declare function walkDirectory(dirPath: string, basePath: string): Promise<FileInfo[]>;
/**
 * Validate that a directory exists
 */
export declare function validateDirectory(dirPath: string, workingDirectory?: string): string;
/**
 * Validate that a file exists
 */
export declare function validateFile(filePath: string, workingDirectory?: string): string;
/**
 * Read file contents as string
 */
export declare function readFileContents(filePath: string): string;
