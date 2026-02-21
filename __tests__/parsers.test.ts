import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { parseCoverage, detectFormat } from '../src/parsers';

const fixturesDir = path.join(__dirname, 'fixtures');

describe('Coverage Parsers', () => {
  describe('Format Detection', () => {
    it('detects LCOV format from extension', () => {
      const content = fs.readFileSync(path.join(fixturesDir, 'lcov.info'), 'utf-8');
      expect(detectFormat(content, 'lcov.info')).toBe('lcov');
    });

    it('detects LCOV format from content', () => {
      const content = fs.readFileSync(path.join(fixturesDir, 'lcov.info'), 'utf-8');
      expect(detectFormat(content, 'coverage.txt')).toBe('lcov');
    });

    it('detects Istanbul format', () => {
      const content = fs.readFileSync(path.join(fixturesDir, 'coverage-final.json'), 'utf-8');
      expect(detectFormat(content, 'coverage-final.json')).toBe('istanbul');
    });

    it('detects Cobertura format', () => {
      const content = fs.readFileSync(path.join(fixturesDir, 'cobertura.xml'), 'utf-8');
      expect(detectFormat(content, 'cobertura.xml')).toBe('cobertura');
    });

    it('detects Clover format', () => {
      const content = fs.readFileSync(path.join(fixturesDir, 'clover.xml'), 'utf-8');
      expect(detectFormat(content, 'clover.xml')).toBe('clover');
    });

    it('detects JaCoCo format', () => {
      const content = fs.readFileSync(path.join(fixturesDir, 'jacoco.xml'), 'utf-8');
      expect(detectFormat(content, 'jacoco.xml')).toBe('jacoco');
    });
  });

  describe('LCOV Parser', () => {
    it('parses LCOV file correctly', async () => {
      const content = fs.readFileSync(path.join(fixturesDir, 'lcov.info'), 'utf-8');
      const coverage = await parseCoverage(content, 'lcov.info', 'lcov');

      expect(coverage.format).toBe('lcov');
      expect(coverage.files.length).toBe(2);

      // Check summary
      expect(coverage.summary.lines.total).toBe(17);
      expect(coverage.summary.lines.covered).toBe(12);
      expect(coverage.summary.functions.total).toBe(4);
      expect(coverage.summary.functions.covered).toBe(3);
    });
  });

  describe('Istanbul Parser', () => {
    it('parses Istanbul JSON correctly', async () => {
      const content = fs.readFileSync(path.join(fixturesDir, 'coverage-final.json'), 'utf-8');
      const coverage = await parseCoverage(content, 'coverage-final.json', 'istanbul');

      expect(coverage.format).toBe('istanbul');
      expect(coverage.files.length).toBe(2);

      // Check that we have valid metrics
      expect(coverage.summary.statements.total).toBeGreaterThan(0);
      expect(coverage.summary.functions.total).toBeGreaterThan(0);
    });
  });

  describe('Cobertura Parser', () => {
    it('parses Cobertura XML correctly', async () => {
      const content = fs.readFileSync(path.join(fixturesDir, 'cobertura.xml'), 'utf-8');
      const coverage = await parseCoverage(content, 'cobertura.xml', 'cobertura');

      expect(coverage.format).toBe('cobertura');
      expect(coverage.files.length).toBe(2);

      // Check summary from top-level attributes
      expect(coverage.summary.lines.percentage).toBeCloseTo(75, 0);
      expect(coverage.summary.branches.percentage).toBeCloseTo(75, 0);
    });
  });

  describe('Clover Parser', () => {
    it('parses Clover XML correctly', async () => {
      const content = fs.readFileSync(path.join(fixturesDir, 'clover.xml'), 'utf-8');
      const coverage = await parseCoverage(content, 'clover.xml', 'clover');

      expect(coverage.format).toBe('clover');
      expect(coverage.files.length).toBe(2);

      // Check summary from project metrics
      expect(coverage.summary.statements.total).toBe(20);
      expect(coverage.summary.statements.covered).toBe(15);
      expect(coverage.summary.functions.total).toBe(4);
      expect(coverage.summary.functions.covered).toBe(3);
    });
  });

  describe('JaCoCo Parser', () => {
    it('parses JaCoCo XML correctly', async () => {
      const content = fs.readFileSync(path.join(fixturesDir, 'jacoco.xml'), 'utf-8');
      const coverage = await parseCoverage(content, 'jacoco.xml', 'jacoco');

      expect(coverage.format).toBe('jacoco');
      expect(coverage.files.length).toBe(1);

      // Check summary from report counters
      expect(coverage.summary.statements.total).toBe(35); // INSTRUCTION: missed 15 + covered 20
      expect(coverage.summary.statements.covered).toBe(20);
      expect(coverage.summary.lines.total).toBe(10); // LINE: missed 3 + covered 7
      expect(coverage.summary.lines.covered).toBe(7);
    });
  });

  describe('Auto-detection with parsing', () => {
    it('auto-detects and parses LCOV', async () => {
      const content = fs.readFileSync(path.join(fixturesDir, 'lcov.info'), 'utf-8');
      const coverage = await parseCoverage(content, 'lcov.info', 'auto');

      expect(coverage.format).toBe('lcov');
    });

    it('auto-detects and parses Istanbul', async () => {
      const content = fs.readFileSync(path.join(fixturesDir, 'coverage-final.json'), 'utf-8');
      const coverage = await parseCoverage(content, 'coverage-final.json', 'auto');

      expect(coverage.format).toBe('istanbul');
    });
  });
});
