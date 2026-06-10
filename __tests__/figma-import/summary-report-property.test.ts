/**
 * Property-Based Tests for SummaryReportGenerator
 * Task 15.2: Write property test for summary report accuracy
 *
 * **Validates: Requirements 11.2, 11.3, 11.4, 11.5**
 *
 * Property 36: Summary Report Accuracy
 * For any set of import inputs (components, assets, failed assets, additional
 * files, warnings, errors), the generated SummaryReport SHALL accurately
 * reflect those inputs:
 *   - componentsGenerated exactly equals the number of input components (11.2)
 *   - assetsDownloaded exactly equals the number of successful assets (11.3)
 *   - files contains every component/asset/additional file path, de-duplicated (11.5)
 *   - errors include all explicit errors plus a folded entry per failed asset (11.4)
 *   - warnings include all input warnings, none lost (11.4)
 */

import {
  SummaryReportGenerator,
  SummaryReportInput,
  GeneratedComponentSummary,
} from '../../lib/figma-import/core/summary-report';
import { AssetInfo, FailedAsset } from '../../lib/figma-import/core/asset-downloader';
import * as fc from 'fast-check';

// ---------------------------------------------------------------------------
// Generators (constrained to the real input space)
// ---------------------------------------------------------------------------

const filePathArb = (): fc.Arbitrary<string> =>
  fc.string({ minLength: 1, maxLength: 40 });

const componentArb = (): fc.Arbitrary<GeneratedComponentSummary> =>
  fc.record({
    name: fc.string({ minLength: 1, maxLength: 20 }),
    filePath: filePathArb(),
  });

const assetArb = (): fc.Arbitrary<AssetInfo> =>
  fc.record({
    nodeId: fc.string({ minLength: 1, maxLength: 10 }),
    nodeName: fc.string({ minLength: 1, maxLength: 20 }),
    fileName: fc.string({ minLength: 1, maxLength: 20 }),
    filePath: filePathArb(),
    size: fc.integer({ min: 0, max: 10_000_000 }),
  });

const failedAssetArb = (): fc.Arbitrary<FailedAsset> =>
  fc.record({
    nodeId: fc.string({ minLength: 1, maxLength: 10 }),
    nodeName: fc.string({ minLength: 1, maxLength: 20 }),
    error: fc.string({ minLength: 1, maxLength: 30 }),
  });

const inputArb = (): fc.Arbitrary<SummaryReportInput> =>
  fc.record({
    components: fc.array(componentArb(), { maxLength: 10 }),
    assets: fc.array(assetArb(), { maxLength: 10 }),
    failedAssets: fc.array(failedAssetArb(), { maxLength: 10 }),
    additionalFiles: fc.array(filePathArb(), { maxLength: 10 }),
    warnings: fc.array(fc.string({ maxLength: 30 }), { maxLength: 10 }),
    errors: fc.array(fc.string({ maxLength: 30 }), { maxLength: 10 }),
    duration: fc.integer({ min: 0, max: 1_000_000 }),
    fileName: fc.string({ maxLength: 20 }),
  });

describe('Property-Based Test: Summary Report Accuracy (Property 36)', () => {
  /**
   * Property 36: Summary Report Accuracy
   * **Validates: Requirements 11.2, 11.3, 11.4, 11.5**
   */
  it('produces a report whose counts and lists match the actual inputs', () => {
    fc.assert(
      fc.property(inputArb(), (input) => {
        const report = new SummaryReportGenerator().generate(input);

        const components = input.components ?? [];
        const assets = input.assets ?? [];
        const failedAssets = input.failedAssets ?? [];
        const additionalFiles = input.additionalFiles ?? [];
        const inputWarnings = input.warnings ?? [];
        const inputErrors = input.errors ?? [];

        // --- 11.2: exact component count ---
        expect(report.componentsGenerated).toBe(components.length);

        // --- 11.3: exact (successful) asset count ---
        expect(report.assetsDownloaded).toBe(assets.length);

        // --- 11.5: files contain all source paths (set-containment) ---
        const fileSet = new Set(report.files);
        for (const c of components) {
          expect(fileSet.has(c.filePath)).toBe(true);
        }
        for (const a of assets) {
          expect(fileSet.has(a.filePath)).toBe(true);
        }
        for (const f of additionalFiles) {
          expect(fileSet.has(f)).toBe(true);
        }

        // --- 11.5: files are de-duplicated (no duplicates) ---
        expect(report.files.length).toBe(fileSet.size);

        // --- 11.5: files set equals the union of all input paths ---
        const expectedFileSet = new Set<string>([
          ...components.map((c) => c.filePath),
          ...assets.map((a) => a.filePath),
          ...additionalFiles,
        ]);
        expect(fileSet).toEqual(expectedFileSet);

        // --- 11.4: errors = explicit errors + one folded message per failed asset ---
        // Errors are never de-duplicated, so the count is exact regardless of content.
        expect(report.errors.length).toBe(inputErrors.length + failedAssets.length);
        // All explicit errors are preserved (in order, at the front).
        expect(report.errors.slice(0, inputErrors.length)).toEqual(inputErrors);
        // Each failed asset contributes an entry mentioning its id, name, and error.
        const foldedErrors = report.errors.slice(inputErrors.length);
        failedAssets.forEach((f, i) => {
          const entry = foldedErrors[i];
          expect(entry).toContain(f.nodeId);
          expect(entry).toContain(f.nodeName);
          expect(entry).toContain(f.error);
        });

        // --- 11.4: warnings include all input warnings, none lost ---
        expect(report.warnings).toEqual(inputWarnings);

        // --- success derived from absence of errors when not explicitly provided ---
        expect(report.success).toBe(report.errors.length === 0);

        // --- duration carried through ---
        expect(report.duration).toBe(input.duration ?? 0);
      }),
      { numRuns: 300 }
    );
  });

  /**
   * Determinism: generating from the same input (with a fixed timestamp)
   * yields an identical report.
   * **Validates: Requirements 11.2, 11.3, 11.4, 11.5**
   */
  it('is deterministic for a fixed timestamp input', () => {
    fc.assert(
      fc.property(
        inputArb(),
        fc.constant('2024-01-01T00:00:00.000Z'),
        (base, timestamp) => {
          const input: SummaryReportInput = { ...base, timestamp };
          const a = new SummaryReportGenerator().generate(input);
          const b = new SummaryReportGenerator().generate(input);
          expect(a).toEqual(b);
          expect(a.timestamp).toBe(timestamp);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Explicit success flag is always honored regardless of error contents.
   * **Validates: Requirements 11.4**
   */
  it('honors an explicit success flag over the derived value', () => {
    fc.assert(
      fc.property(inputArb(), fc.boolean(), (base, success) => {
        const report = new SummaryReportGenerator().generate({ ...base, success });
        expect(report.success).toBe(success);
      }),
      { numRuns: 100 }
    );
  });
});
