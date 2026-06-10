/**
 * Figma Importer (Orchestrator)
 *
 * Coordinates the complete Figma import workflow described in design.md
 * section 7 ("Figma Importer (Orchestrator)"). It validates configuration,
 * drives the API client, parser, style extractor, component generator,
 * stylesheet generator and asset downloader in order, collects warnings and
 * errors throughout, and returns a complete {@link ImportResult}.
 *
 * Workflow (design.md "Workflow Orchestration"):
 *   1. Validate configuration
 *   2. Authenticate with the Figma API
 *   3. Fetch file data
 *   4. Validate file structure
 *   5. Parse the design tree
 *   6. Extract styles (stylesheets)
 *   7. Request image export URLs
 *   8. Generate components
 *   9. Download assets
 *  10. Write summary report
 *  11. Return result
 *
 * Design principles honoured here:
 *  - Fault tolerance / graceful degradation: recoverable failures (a single
 *    component that fails to generate, image-URL export problems, individual
 *    asset download failures) are collected as errors/warnings WITHOUT aborting
 *    the run. Only fatal failures (invalid config, authentication, file fetch,
 *    structure validation) short-circuit the workflow and return
 *    `success: false`.
 *  - Dependency injection: every collaborator is injectable via the
 *    constructor with sensible real defaults, so the orchestrator can be unit
 *    and integration tested with mocked collaborators and without touching the
 *    network or disk.
 *  - No I/O at import (module-load) time: file writes only happen while
 *    `import()` runs, and the writer is injectable.
 */

import * as fs from 'fs';
import * as path from 'path';

import { ImportConfig, ImportResult } from '../types/config';
import { ParsedDesign, ParsedFrame, ParsedNode } from '../types/internal-models';
import { FigmaFile, ImageUrls } from '../types/figma-api';

import { FigmaApiClient } from './figma-api-client';
import { DesignParser } from './design-parser';
import { StyleExtractor } from './style-extractor';
import { ComponentGenerator, GeneratedComponent } from './component-generator';
import { StylesheetGenerator } from './stylesheet-generator';
import { AssetDownloader, AssetInfo, FailedAsset } from './asset-downloader';
import { ConfigLoader, ConfigValidationError } from './config-loader';
import {
  SummaryReportGenerator,
  GeneratedComponentSummary,
} from './summary-report';

/**
 * Writes a single file to disk. Injecting a custom implementation keeps the
 * orchestrator testable without real file-system access. The default
 * implementation ensures the parent directory exists, then writes UTF-8 text.
 */
export type ComponentFileWriter = (filePath: string, content: string) => void;

/**
 * Default {@link ComponentFileWriter}: creates the parent directory (recursive)
 * and writes the content as UTF-8. Note: capturing this reference performs no
 * I/O; writes only occur when the importer actually runs.
 */
const defaultFileWriter: ComponentFileWriter = (filePath, content) => {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, content, 'utf-8');
};

/**
 * Injectable collaborators and behavioural options for {@link FigmaImporter}.
 * Every field is optional; omitted fields fall back to real default
 * implementations.
 */
export interface FigmaImporterDependencies {
  /** Validates the resolved configuration. */
  configLoader?: ConfigLoader;
  /** Authenticates and talks to the Figma REST API. */
  apiClient?: FigmaApiClient;
  /** Parses the Figma file into the internal representation. */
  parser?: DesignParser;
  /** Extracts styles from parsed nodes (used via the stylesheet generator). */
  styleExtractor?: StyleExtractor;
  /** Generates React components from parsed frames. */
  componentGenerator?: ComponentGenerator;
  /** Generates stylesheets (CSS modules) for parsed frames. */
  stylesheetGenerator?: StylesheetGenerator;
  /** Downloads image assets from Figma. */
  assetDownloader?: AssetDownloader;
  /** Aggregates the run into a structured summary report. */
  summaryReportGenerator?: SummaryReportGenerator;
  /** Writes generated component/stylesheet files. Defaults to fs-based writer. */
  writeFile?: ComponentFileWriter;
  /**
   * Monotonic-ish clock used to measure duration. Injectable for deterministic
   * tests. Defaults to {@link Date.now}.
   */
  now?: () => number;
  /**
   * When `true` (the default), the summary report is also persisted to
   * `import-summary.json` under the output directory (Requirement 11.6). Set to
   * `false` to skip the write (e.g. dry runs / tests).
   */
  writeSummaryReport?: boolean;
}

/**
 * Orchestrates the end-to-end Figma import workflow.
 */
export class FigmaImporter {
  private readonly configLoader: ConfigLoader;
  private readonly apiClient: FigmaApiClient;
  private readonly parser: DesignParser;
  private readonly styleExtractor: StyleExtractor;
  private readonly componentGenerator: ComponentGenerator;
  private readonly stylesheetGenerator: StylesheetGenerator;
  private readonly assetDownloader: AssetDownloader;
  private readonly summaryReportGenerator: SummaryReportGenerator;
  private readonly writeFile: ComponentFileWriter;
  private readonly now: () => number;
  private readonly writeSummaryReport: boolean;

  constructor(deps: FigmaImporterDependencies = {}) {
    this.configLoader = deps.configLoader ?? new ConfigLoader();
    this.apiClient = deps.apiClient ?? new FigmaApiClient();
    this.parser = deps.parser ?? new DesignParser();
    this.styleExtractor = deps.styleExtractor ?? new StyleExtractor();
    this.componentGenerator = deps.componentGenerator ?? new ComponentGenerator();
    this.stylesheetGenerator = deps.stylesheetGenerator ?? new StylesheetGenerator();
    this.assetDownloader = deps.assetDownloader ?? new AssetDownloader();
    this.summaryReportGenerator =
      deps.summaryReportGenerator ?? new SummaryReportGenerator();
    this.writeFile = deps.writeFile ?? defaultFileWriter;
    this.now = deps.now ?? (() => Date.now());
    this.writeSummaryReport = deps.writeSummaryReport ?? true;
  }

  /**
   * Run the complete import workflow.
   *
   * Always resolves (never rejects): fatal failures are surfaced as an
   * {@link ImportResult} with `success: false` and a populated `errors` array,
   * while recoverable failures are collected into `errors`/`warnings` without
   * aborting the run.
   */
  async import(config: ImportConfig): Promise<ImportResult> {
    const start = this.now();
    const warnings: string[] = [];
    const errors: string[] = [];

    // ---- Step 1: Validate configuration -------------------------------------
    // ConfigValidationError aggregates every problem; surface them as a failed
    // result rather than throwing out of import().
    try {
      this.configLoader.validate(config);
    } catch (error) {
      const configErrors =
        error instanceof ConfigValidationError
          ? error.errors
          : [this.errorMessage(error)];
      return this.failure(configErrors, warnings, start);
    }

    // ---- Step 2: Authenticate -----------------------------------------------
    let fileKey: string;
    let figmaFile: FigmaFile;
    try {
      await this.apiClient.authenticate(config.token);

      // Step 2b: Resolve the file key from the configured URL.
      fileKey = this.apiClient.extractFileKey(config.fileUrl);

      // ---- Step 3: Fetch file data ------------------------------------------
      figmaFile = await this.apiClient.getFile(fileKey);
    } catch (error) {
      // Authentication / file-fetch failures are fatal: short-circuit.
      return this.failure([this.errorMessage(error)], warnings, start);
    }

    // ---- Step 4: Validate file structure ------------------------------------
    const validation = this.parser.validateStructure(figmaFile);
    for (const warning of validation.warnings) {
      warnings.push(this.formatValidationMessage(warning));
    }
    if (!validation.isValid) {
      const structureErrors =
        validation.errors.length > 0
          ? validation.errors.map((e) => this.formatValidationMessage(e))
          : ['Figma file failed structure validation.'];
      return this.failure(structureErrors, warnings, start, figmaFile.name);
    }

    // ---- Step 5: Parse the design tree --------------------------------------
    let design: ParsedDesign;
    try {
      design = this.parser.parse(figmaFile);
      design.metadata.fileKey = fileKey;
    } catch (error) {
      // A parse failure here means the file could not be interpreted at all.
      return this.failure([this.errorMessage(error)], warnings, start, figmaFile.name);
    }

    // Collect any warnings the parser accumulated while traversing the tree
    // (unsupported nodes, name sanitization, nesting depth, etc.).
    for (const warning of this.parser.getWarnings()) {
      warnings.push(this.formatValidationMessage(warning));
    }

    // Flatten every frame and the nodes beneath it so downstream steps can scan
    // the whole tree for images and generate one component per frame.
    const frames = this.collectFrames(design);
    const allNodes = this.collectNodes(frames);

    // ---- Step 6: Extract styles / generate stylesheets ----------------------
    // Resolve component-id -> generated-name mappings up front so instances are
    // resolvable during component generation (Requirement 9.2/9.4).
    const components = Array.from(design.componentLibrary.components.values());
    try {
      this.componentGenerator.resolveComponentReferences(components);
    } catch (error) {
      // Reference resolution is best-effort; a failure only degrades instance
      // wiring, so collect and continue.
      warnings.push(`Component reference resolution failed: ${this.errorMessage(error)}`);
    }

    // ---- Step 7: Request image export URLs (recoverable) --------------------
    const imageNodeIds = this.safeGetImageNodeIds(allNodes, warnings);
    let imageUrls: ImageUrls = {};
    if (imageNodeIds.length > 0) {
      try {
        imageUrls = await this.apiClient.getImages(fileKey, imageNodeIds, {
          format: config.imageFormat,
          scale: config.imageScale,
        });
      } catch (error) {
        // Non-fatal: continue without asset URLs. Components still generate.
        errors.push(`Failed to request image export URLs: ${this.errorMessage(error)}`);
      }
    }

    // ---- Step 8: Generate components (+ stylesheets) ------------------------
    const generatedComponents: GeneratedComponent[] = [];
    const additionalFiles: string[] = [];

    for (const frame of frames) {
      try {
        const component = this.componentGenerator.generate(frame, {
          namingConvention: config.namingConvention,
          useTailwind: config.useTailwind,
          outputDir: config.outputDir,
        });
        generatedComponents.push(component);
        this.writeFileSafely(component.filePath, component.content, errors);

        // When Tailwind is disabled, emit a CSS-module stylesheet alongside the
        // component (Requirement 10.4). Recoverable on a per-frame basis.
        if (!config.useTailwind) {
          try {
            const stylesheet = this.stylesheetGenerator.generateCssModule(frame, {
              namingConvention: config.namingConvention,
            });
            const stylesheetPath = path.join(config.outputDir, stylesheet.fileName);
            this.writeFileSafely(stylesheetPath, stylesheet.content, errors);
            additionalFiles.push(stylesheetPath);
          } catch (error) {
            errors.push(
              `Failed to generate stylesheet for frame "${frame.name}": ${this.errorMessage(error)}`
            );
          }
        }
      } catch (error) {
        // A single failed component must not abort the whole import.
        errors.push(
          `Failed to generate component for frame "${frame.name}": ${this.errorMessage(error)}`
        );
      }
    }

    // ---- Step 9: Download assets (recoverable) ------------------------------
    let successfulAssets: AssetInfo[] = [];
    let failedAssets: FailedAsset[] = [];
    if (imageNodeIds.length > 0 && Object.keys(imageUrls).length > 0) {
      try {
        const downloadResult = await this.assetDownloader.downloadAssets(
          allNodes,
          imageUrls,
          config.assetsDir
        );
        successfulAssets = downloadResult.successful;
        failedAssets = downloadResult.failed;
      } catch (error) {
        // A catastrophic downloader failure is still non-fatal for the import.
        errors.push(`Asset download failed: ${this.errorMessage(error)}`);
      }
    }

    // ---- Step 10: Build (and persist) the summary report --------------------
    const componentSummaries: GeneratedComponentSummary[] = generatedComponents.map(
      (component) => ({ name: component.name, filePath: component.filePath })
    );

    const duration = Math.max(0, this.now() - start);

    const report = this.summaryReportGenerator.generate({
      components: componentSummaries,
      assets: successfulAssets,
      failedAssets,
      additionalFiles,
      warnings,
      errors,
      duration,
      fileName: design.metadata.fileName,
      // The workflow completed end-to-end. Recoverable errors are reported in
      // `errors` but do not flip overall success to false (graceful
      // degradation). Fatal failures return earlier via failure().
      success: true,
    });

    if (this.writeSummaryReport) {
      try {
        this.summaryReportGenerator.writeReport(report, config.outputDir);
      } catch (error) {
        // Persisting the report is best-effort; never fail the run over it.
        report.warnings.push(
          `Failed to write summary report: ${this.errorMessage(error)}`
        );
      }
    }

    // ---- Step 11: Return result ---------------------------------------------
    return this.toImportResult(report);
  }

  /**
   * Collect every {@link ParsedFrame} across all pages of the parsed design.
   */
  private collectFrames(design: ParsedDesign): ParsedFrame[] {
    const frames: ParsedFrame[] = [];
    for (const page of design.pages) {
      for (const frame of page.frames) {
        frames.push(frame);
      }
    }
    return frames;
  }

  /**
   * Flatten the children of every frame into a single list of parsed nodes for
   * tree-wide scans (image identification, asset download). Frame children are
   * already nested, and the consumers traverse recursively.
   */
  private collectNodes(frames: ParsedFrame[]): ParsedNode[] {
    const nodes: ParsedNode[] = [];
    for (const frame of frames) {
      if (frame.children) {
        nodes.push(...frame.children);
      }
    }
    return nodes;
  }

  /**
   * Identify image node ids without letting an unexpected failure abort the
   * run; problems are recorded as warnings and treated as "no images".
   */
  private safeGetImageNodeIds(nodes: ParsedNode[], warnings: string[]): string[] {
    try {
      return this.assetDownloader.getImageNodeIds(nodes);
    } catch (error) {
      warnings.push(`Failed to identify image nodes: ${this.errorMessage(error)}`);
      return [];
    }
  }

  /**
   * Write a generated file, collecting any failure as a recoverable error.
   */
  private writeFileSafely(filePath: string, content: string, errors: string[]): void {
    try {
      this.writeFile(filePath, content);
    } catch (error) {
      errors.push(`Failed to write file "${filePath}": ${this.errorMessage(error)}`);
    }
  }

  /**
   * Build a failed {@link ImportResult} for a fatal, short-circuiting error.
   */
  private failure(
    errors: string[],
    warnings: string[],
    start: number,
    fileName?: string
  ): ImportResult {
    const duration = Math.max(0, this.now() - start);
    const report = this.summaryReportGenerator.generate({
      warnings,
      errors,
      duration,
      fileName,
      success: false,
    });
    return this.toImportResult(report);
  }

  /**
   * Narrow a {@link SummaryReport} down to the {@link ImportResult} contract.
   */
  private toImportResult(report: ImportResult): ImportResult {
    return {
      success: report.success,
      componentsGenerated: report.componentsGenerated,
      assetsDownloaded: report.assetsDownloaded,
      files: report.files,
      warnings: report.warnings,
      errors: report.errors,
      duration: report.duration,
    };
  }

  /** Render a thrown value into a human-readable message. */
  private errorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }

  /** Render a parser validation message, prefixing the node name when present. */
  private formatValidationMessage(message: {
    nodeName?: string;
    message: string;
  }): string {
    return message.nodeName
      ? `${message.nodeName}: ${message.message}`
      : message.message;
  }
}
