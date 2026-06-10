/**
 * Summary Report Generator
 *
 * Aggregates the data produced by a completed Figma import run into a single
 * structured report (Requirement 11). The report:
 *   - counts the components generated and assets downloaded (11.2, 11.3),
 *   - lists the file paths of every generated file (11.5),
 *   - includes all warnings and errors encountered during the import (11.4),
 *   - can be rendered for human-readable console output and serialized to
 *     `import-summary.json` (11.1, 11.6).
 *
 * I/O is performed only when {@link SummaryReportGenerator.writeReport} is
 * explicitly called, and the write is delegated to an injected writer so the
 * generator stays pure and unit-testable without touching disk. Nothing is
 * written at import (module-load) time.
 */

import * as fs from 'fs';
import * as path from 'path';
import { ImportResult } from '../types/config';
import { AssetInfo, FailedAsset } from './asset-downloader';

/**
 * Canonical filename the summary report is written to (Requirement 11.6).
 */
export const SUMMARY_REPORT_FILENAME = 'import-summary.json';

/**
 * Minimal description of a component that was generated during the import.
 * Used to count components (11.2) and to collect their file paths (11.5).
 */
export interface GeneratedComponentSummary {
  /** Generated component name. */
  name: string;
  /** Path of the generated component file. */
  filePath: string;
}

/**
 * Inputs collected during an import run, consumed by the generator to build a
 * {@link SummaryReport}. Every field is optional so the report can be produced
 * even from a partial / failed run.
 */
export interface SummaryReportInput {
  /** Components generated during the import (counted + file paths collected). */
  components?: GeneratedComponentSummary[];
  /** Successfully downloaded assets (counted + file paths collected). */
  assets?: AssetInfo[];
  /**
   * Assets that failed to download. Their errors are folded into the report's
   * error list so the summary reflects every problem encountered (11.4).
   */
  failedAssets?: FailedAsset[];
  /**
   * Additional generated file paths that are not represented by `components`
   * or `assets` (e.g. stylesheets, index/barrel files). Included in the file
   * path list (11.5).
   */
  additionalFiles?: string[];
  /** Warnings collected during the import (11.4). */
  warnings?: string[];
  /** Errors collected during the import (11.4). */
  errors?: string[];
  /** Total import duration in milliseconds. */
  duration?: number;
  /** Name of the imported Figma file, for report context. */
  fileName?: string;
  /**
   * Explicit success flag. When omitted, success is derived from the absence
   * of errors (including failed-asset errors).
   */
  success?: boolean;
  /**
   * ISO timestamp recorded on the report. Defaults to the current time when
   * the report is generated.
   */
  timestamp?: string;
}

/**
 * Structured summary of a completed import.
 *
 * Extends {@link ImportResult} (the orchestrator's return shape) so the report
 * stays consistent with the established contract, adding only report-specific
 * context fields.
 */
export interface SummaryReport extends ImportResult {
  /** ISO timestamp of when the import completed / the report was generated. */
  timestamp: string;
  /** Name of the imported Figma file, when known. */
  fileName?: string;
}

/**
 * Function used to persist the report to disk. Defaults to a thin wrapper
 * around {@link fs.writeFileSync}; injecting a custom implementation keeps the
 * generator testable without real file-system access.
 */
export type FileWriter = (filePath: string, content: string) => void;

/**
 * Builds and renders Figma import summary reports.
 */
export class SummaryReportGenerator {
  private readonly writeFile: FileWriter;

  /**
   * @param writeFile Optional injected writer. Defaults to writing UTF-8 text
   *                  via {@link fs.writeFileSync}. The default merely captures
   *                  a reference; no I/O occurs until {@link writeReport} runs.
   */
  constructor(writeFile?: FileWriter) {
    this.writeFile =
      writeFile ?? ((filePath, content) => fs.writeFileSync(filePath, content, 'utf-8'));
  }

  /**
   * Build a structured {@link SummaryReport} from the collected import data.
   *
   * Counts components and assets, gathers a de-duplicated list of every
   * generated file path, and merges all warnings and errors (including any
   * failed-asset errors) into the report (Requirements 11.2–11.5).
   */
  generate(input: SummaryReportInput): SummaryReport {
    const components = input.components ?? [];
    const assets = input.assets ?? [];
    const failedAssets = input.failedAssets ?? [];

    // Collect every generated file path: components, assets, then any extras.
    // De-duplicate while preserving first-seen order (Requirement 11.5).
    const files = this.dedupe([
      ...components.map((c) => c.filePath),
      ...assets.map((a) => a.filePath),
      ...(input.additionalFiles ?? []),
    ]);

    // Merge explicit errors with descriptive failed-asset errors (11.4).
    const errors = [
      ...(input.errors ?? []),
      ...failedAssets.map(
        (f) => `Asset download failed for "${f.nodeName}" (${f.nodeId}): ${f.error}`
      ),
    ];

    const warnings = [...(input.warnings ?? [])];

    // Derive success from the absence of errors unless explicitly provided.
    const success = input.success ?? errors.length === 0;

    return {
      success,
      componentsGenerated: components.length,
      assetsDownloaded: assets.length,
      files,
      warnings,
      errors,
      duration: input.duration ?? 0,
      timestamp: input.timestamp ?? new Date().toISOString(),
      fileName: input.fileName,
    };
  }

  /**
   * Render a report as human-readable text for console output (Requirement
   * 11.1, 11.6). Includes the key figures: status, counts, durations, the full
   * file list, and every warning and error.
   */
  formatConsole(report: SummaryReport): string {
    const lines: string[] = [];

    lines.push('Figma Import Summary');
    lines.push('====================');
    if (report.fileName) {
      lines.push(`File: ${report.fileName}`);
    }
    lines.push(`Status: ${report.success ? 'SUCCESS' : 'FAILED'}`);
    lines.push(`Components generated: ${report.componentsGenerated}`);
    lines.push(`Assets downloaded: ${report.assetsDownloaded}`);
    lines.push(`Files generated: ${report.files.length}`);
    lines.push(`Warnings: ${report.warnings.length}`);
    lines.push(`Errors: ${report.errors.length}`);
    lines.push(`Duration: ${report.duration}ms`);

    lines.push('');
    lines.push('Generated files:');
    if (report.files.length === 0) {
      lines.push('  (none)');
    } else {
      for (const file of report.files) {
        lines.push(`  - ${file}`);
      }
    }

    if (report.warnings.length > 0) {
      lines.push('');
      lines.push('Warnings:');
      for (const warning of report.warnings) {
        lines.push(`  ! ${warning}`);
      }
    }

    if (report.errors.length > 0) {
      lines.push('');
      lines.push('Errors:');
      for (const error of report.errors) {
        lines.push(`  x ${error}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Serialize the report to the JSON string saved to `import-summary.json`
   * (Requirement 11.6). Pretty-printed with two-space indentation.
   */
  toJSON(report: SummaryReport): string {
    return JSON.stringify(report, null, 2);
  }

  /**
   * Persist the report to `import-summary.json` under `outputDir` using the
   * injected writer (Requirement 11.6).
   *
   * @param report    The report to serialize and write.
   * @param outputDir Directory the report file is written into (default: cwd).
   * @returns The path the report was written to.
   */
  writeReport(report: SummaryReport, outputDir: string = '.'): string {
    const filePath = path.join(outputDir, SUMMARY_REPORT_FILENAME);
    this.writeFile(filePath, this.toJSON(report));
    return filePath;
  }

  /** Remove duplicate strings while preserving first-seen order. */
  private dedupe(values: string[]): string[] {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const value of values) {
      if (!seen.has(value)) {
        seen.add(value);
        result.push(value);
      }
    }
    return result;
  }
}
