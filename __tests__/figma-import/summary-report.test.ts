/**
 * Tests for SummaryReportGenerator
 *
 * Covers Requirement 11: accurate component/asset counts (11.2, 11.3),
 * complete generated file path list (11.5), inclusion of all warnings and
 * errors (11.4), console formatting (11.1), and JSON output written to
 * import-summary.json via an injected writer (11.6).
 */

import {
  SummaryReportGenerator,
  SUMMARY_REPORT_FILENAME,
  SummaryReportInput,
} from '../../lib/figma-import/core/summary-report';
import { AssetInfo, FailedAsset } from '../../lib/figma-import/core/asset-downloader';
import * as path from 'path';

const sampleAsset = (overrides: Partial<AssetInfo> = {}): AssetInfo => ({
  nodeId: '1:1',
  nodeName: 'Image',
  fileName: 'image.png',
  filePath: path.join('public', 'figma-assets', 'image.png'),
  size: 1024,
  ...overrides,
});

const fullInput = (): SummaryReportInput => ({
  components: [
    { name: 'Hero', filePath: path.join('components', 'figma', 'Hero.tsx') },
    { name: 'Card', filePath: path.join('components', 'figma', 'Card.tsx') },
  ],
  assets: [
    sampleAsset({ nodeId: '1:1', fileName: 'hero.png', filePath: path.join('public', 'hero.png') }),
    sampleAsset({ nodeId: '1:2', fileName: 'card.png', filePath: path.join('public', 'card.png') }),
    sampleAsset({ nodeId: '1:3', fileName: 'logo.png', filePath: path.join('public', 'logo.png') }),
  ],
  additionalFiles: [path.join('components', 'figma', 'Hero.module.css')],
  warnings: ['Node "Weird Name!" was sanitized to "WeirdName"'],
  errors: [],
  duration: 4200,
  fileName: 'MyDesign',
});

describe('SummaryReportGenerator', () => {
  describe('generate', () => {
    it('counts components and assets accurately (Requirements 11.2, 11.3)', () => {
      const report = new SummaryReportGenerator().generate(fullInput());

      expect(report.componentsGenerated).toBe(2);
      expect(report.assetsDownloaded).toBe(3);
    });

    it('lists every generated file path, de-duplicated (Requirement 11.5)', () => {
      const report = new SummaryReportGenerator().generate(fullInput());

      expect(report.files).toEqual([
        path.join('components', 'figma', 'Hero.tsx'),
        path.join('components', 'figma', 'Card.tsx'),
        path.join('public', 'hero.png'),
        path.join('public', 'card.png'),
        path.join('public', 'logo.png'),
        path.join('components', 'figma', 'Hero.module.css'),
      ]);
    });

    it('de-duplicates repeated file paths while preserving order', () => {
      const generator = new SummaryReportGenerator();
      const report = generator.generate({
        components: [{ name: 'A', filePath: 'a.tsx' }],
        additionalFiles: ['a.tsx', 'b.css', 'b.css'],
      });

      expect(report.files).toEqual(['a.tsx', 'b.css']);
    });

    it('includes all warnings and errors collected during import (Requirement 11.4)', () => {
      const report = new SummaryReportGenerator().generate({
        warnings: ['w1', 'w2'],
        errors: ['e1'],
      });

      expect(report.warnings).toEqual(['w1', 'w2']);
      expect(report.errors).toEqual(['e1']);
    });

    it('folds failed-asset errors into the report errors (Requirement 11.4)', () => {
      const failedAssets: FailedAsset[] = [
        { nodeId: '2:1', nodeName: 'Broken', error: 'HTTP 404' },
      ];
      const report = new SummaryReportGenerator().generate({
        errors: ['existing error'],
        failedAssets,
      });

      expect(report.errors).toHaveLength(2);
      expect(report.errors[0]).toBe('existing error');
      expect(report.errors[1]).toContain('Broken');
      expect(report.errors[1]).toContain('2:1');
      expect(report.errors[1]).toContain('HTTP 404');
    });

    it('derives success from the absence of errors when not provided', () => {
      const gen = new SummaryReportGenerator();
      expect(gen.generate({}).success).toBe(true);
      expect(gen.generate({ errors: ['boom'] }).success).toBe(false);
      expect(
        gen.generate({ failedAssets: [{ nodeId: 'x', nodeName: 'y', error: 'z' }] }).success
      ).toBe(false);
    });

    it('honors an explicit success flag', () => {
      const report = new SummaryReportGenerator().generate({
        success: false,
        errors: [],
      });
      expect(report.success).toBe(false);
    });

    it('defaults duration and timestamp and carries fileName', () => {
      const report = new SummaryReportGenerator().generate({ fileName: 'Design' });
      expect(report.duration).toBe(0);
      expect(typeof report.timestamp).toBe('string');
      expect(report.fileName).toBe('Design');
    });

    it('handles an empty import with zero counts and empty lists', () => {
      const report = new SummaryReportGenerator().generate({});
      expect(report.componentsGenerated).toBe(0);
      expect(report.assetsDownloaded).toBe(0);
      expect(report.files).toEqual([]);
      expect(report.warnings).toEqual([]);
      expect(report.errors).toEqual([]);
    });
  });

  describe('formatConsole', () => {
    it('contains the key figures (Requirement 11.1)', () => {
      const generator = new SummaryReportGenerator();
      const report = generator.generate(fullInput());
      const text = generator.formatConsole(report);

      expect(text).toContain('Components generated: 2');
      expect(text).toContain('Assets downloaded: 3');
      expect(text).toContain('Files generated: 6');
      expect(text).toContain('Warnings: 1');
      expect(text).toContain('Errors: 0');
      expect(text).toContain('Duration: 4200ms');
      expect(text).toContain('Status: SUCCESS');
      expect(text).toContain('MyDesign');
    });

    it('lists generated files, warnings, and errors in the console output', () => {
      const generator = new SummaryReportGenerator();
      const report = generator.generate({
        components: [{ name: 'Hero', filePath: 'Hero.tsx' }],
        warnings: ['be careful'],
        errors: ['it broke'],
      });
      const text = generator.formatConsole(report);

      expect(text).toContain('Hero.tsx');
      expect(text).toContain('be careful');
      expect(text).toContain('it broke');
      expect(text).toContain('Status: FAILED');
    });

    it('renders "(none)" when there are no generated files', () => {
      const generator = new SummaryReportGenerator();
      const text = generator.formatConsole(generator.generate({}));
      expect(text).toContain('(none)');
    });
  });

  describe('toJSON', () => {
    it('produces parseable JSON matching the report structure (Requirement 11.6)', () => {
      const generator = new SummaryReportGenerator();
      const report = generator.generate(fullInput());
      const json = generator.toJSON(report);

      const parsed = JSON.parse(json);
      expect(parsed.componentsGenerated).toBe(2);
      expect(parsed.assetsDownloaded).toBe(3);
      expect(parsed.files).toHaveLength(6);
      expect(parsed.warnings).toEqual(report.warnings);
      expect(parsed.errors).toEqual(report.errors);
      expect(parsed.success).toBe(true);
      expect(parsed.fileName).toBe('MyDesign');
      expect(typeof parsed.timestamp).toBe('string');
    });
  });

  describe('writeReport', () => {
    it('writes serialized content to import-summary.json via the injected writer (Requirement 11.6)', () => {
      const writeFile = jest.fn();
      const generator = new SummaryReportGenerator(writeFile);
      const report = generator.generate(fullInput());

      const writtenPath = generator.writeReport(report, 'out-dir');

      const expectedPath = path.join('out-dir', SUMMARY_REPORT_FILENAME);
      expect(writtenPath).toBe(expectedPath);
      expect(writeFile).toHaveBeenCalledTimes(1);

      const [calledPath, calledContent] = writeFile.mock.calls[0];
      expect(calledPath).toBe(expectedPath);
      expect(calledContent).toBe(generator.toJSON(report));
      // Content is valid serialized JSON of the report
      expect(JSON.parse(calledContent)).toMatchObject({
        componentsGenerated: 2,
        assetsDownloaded: 3,
      });
    });

    it('defaults the output directory to the current directory', () => {
      const writeFile = jest.fn();
      const generator = new SummaryReportGenerator(writeFile);
      const report = generator.generate({});

      const writtenPath = generator.writeReport(report);

      expect(writtenPath).toBe(path.join('.', SUMMARY_REPORT_FILENAME));
      expect(writeFile).toHaveBeenCalledWith(
        path.join('.', SUMMARY_REPORT_FILENAME),
        expect.any(String)
      );
    });

    it('does not write anything until writeReport is called', () => {
      const writeFile = jest.fn();
      const generator = new SummaryReportGenerator(writeFile);
      generator.generate(fullInput());
      expect(writeFile).not.toHaveBeenCalled();
    });
  });
});

/**
 * Task 15.3 — Unit tests for summary report (Requirements 11.1, 11.6)
 *
 * These blocks complement the cases above by asserting:
 *   - the SummaryReport object's structure (required keys + value types, with a
 *     valid round-trippable ISO timestamp),
 *   - the console output is organized into clearly-labeled sections (header,
 *     counts, generated files, conditional warnings/errors), and
 *   - the file output is written to a path ending in import-summary.json and
 *     deep-equals the report after a JSON round-trip.
 */
describe('SummaryReportGenerator (task 15.3 structure/format/file output)', () => {
  describe('report structure', () => {
    it('has all required keys with correct types', () => {
      const report = new SummaryReportGenerator().generate(fullInput());

      // Required keys present.
      const requiredKeys = [
        'success',
        'componentsGenerated',
        'assetsDownloaded',
        'files',
        'warnings',
        'errors',
        'duration',
        'timestamp',
      ];
      for (const key of requiredKeys) {
        expect(report).toHaveProperty(key);
      }

      // Correct types.
      expect(typeof report.success).toBe('boolean');
      expect(typeof report.componentsGenerated).toBe('number');
      expect(typeof report.assetsDownloaded).toBe('number');
      expect(Array.isArray(report.files)).toBe(true);
      expect(report.files.every((f) => typeof f === 'string')).toBe(true);
      expect(Array.isArray(report.warnings)).toBe(true);
      expect(report.warnings.every((w) => typeof w === 'string')).toBe(true);
      expect(Array.isArray(report.errors)).toBe(true);
      expect(report.errors.every((e) => typeof e === 'string')).toBe(true);
      expect(typeof report.duration).toBe('number');
      expect(typeof report.timestamp).toBe('string');
    });

    it('produces a valid ISO timestamp that round-trips through Date', () => {
      const report = new SummaryReportGenerator().generate({});

      const parsed = new Date(report.timestamp);
      expect(Number.isNaN(parsed.getTime())).toBe(false);
      // Canonical ISO form round-trips exactly.
      expect(parsed.toISOString()).toBe(report.timestamp);
    });

    it('preserves an explicitly provided timestamp', () => {
      const timestamp = '2023-01-02T03:04:05.678Z';
      const report = new SummaryReportGenerator().generate({ timestamp });
      expect(report.timestamp).toBe(timestamp);
    });
  });

  describe('console output sections (Requirement 11.1)', () => {
    it('includes a header/title and a counts section', () => {
      const generator = new SummaryReportGenerator();
      const text = generator.formatConsole(generator.generate(fullInput()));

      // Header / title section.
      expect(text).toContain('Figma Import Summary');
      // Counts section labels.
      expect(text).toContain('Components generated:');
      expect(text).toContain('Assets downloaded:');
      expect(text).toContain('Files generated:');
    });

    it('includes a Generated files section listing every file', () => {
      const generator = new SummaryReportGenerator();
      const report = generator.generate(fullInput());
      const text = generator.formatConsole(report);

      expect(text).toContain('Generated files:');
      for (const file of report.files) {
        expect(text).toContain(file);
      }
    });

    it('includes a Warnings section header with each warning line when warnings exist', () => {
      const generator = new SummaryReportGenerator();
      const text = generator.formatConsole(
        generator.generate({ warnings: ['first warning', 'second warning'] })
      );
      const lines = text.split('\n');

      // A dedicated section header line (distinct from the "Warnings: N" count).
      expect(lines).toContain('Warnings:');
      expect(text).toContain('first warning');
      expect(text).toContain('second warning');
    });

    it('includes an Errors section header with each error line when errors exist', () => {
      const generator = new SummaryReportGenerator();
      const text = generator.formatConsole(
        generator.generate({ errors: ['boom one', 'boom two'] })
      );
      const lines = text.split('\n');

      expect(lines).toContain('Errors:');
      expect(text).toContain('boom one');
      expect(text).toContain('boom two');
    });

    it('omits the Warnings and Errors section headers when there are none', () => {
      const generator = new SummaryReportGenerator();
      const text = generator.formatConsole(
        generator.generate({ components: [{ name: 'A', filePath: 'A.tsx' }] })
      );
      const lines = text.split('\n');

      // The section header lines are absent (the "Warnings: 0"/"Errors: 0"
      // count lines still appear, but the standalone section headers do not).
      expect(lines).not.toContain('Warnings:');
      expect(lines).not.toContain('Errors:');
    });
  });

  describe('file output round-trip (Requirement 11.6)', () => {
    it('writes to a path ending in import-summary.json under the given outputDir', () => {
      const writeFile = jest.fn();
      const generator = new SummaryReportGenerator(writeFile);
      const report = generator.generate(fullInput());

      const writtenPath = generator.writeReport(report, path.join('some', 'output', 'dir'));

      expect(writtenPath.endsWith(SUMMARY_REPORT_FILENAME)).toBe(true);
      expect(writtenPath).toBe(
        path.join('some', 'output', 'dir', 'import-summary.json')
      );
      const [calledPath] = writeFile.mock.calls[0];
      expect(calledPath).toBe(writtenPath);
    });

    it('written content deep-equals the report after a JSON round-trip', () => {
      const writeFile = jest.fn();
      const generator = new SummaryReportGenerator(writeFile);
      const report = generator.generate(fullInput());

      generator.writeReport(report, 'out');

      const [, calledContent] = writeFile.mock.calls[0];
      // Content is exactly the serialized report...
      expect(calledContent).toBe(generator.toJSON(report));
      // ...and round-trips back to an object deep-equal to the report.
      expect(JSON.parse(calledContent)).toEqual(JSON.parse(JSON.stringify(report)));
    });

    it('uses the injected writer and performs no real filesystem I/O', () => {
      const writeFile = jest.fn();
      const generator = new SummaryReportGenerator(writeFile);
      const report = generator.generate(fullInput());

      generator.writeReport(report, 'out');

      expect(writeFile).toHaveBeenCalledTimes(1);
    });
  });
});
