/**
 * Core modules for Figma Import
 * This file will export the main orchestrator and core functionality
 */

export { FigmaApiClient, FigmaAuthenticationError, FigmaFileError } from './figma-api-client';
export { DesignParser } from './design-parser';
export { StyleExtractor } from './style-extractor';
export type { TailwindTypographyConfig } from './style-extractor';
export { AssetDownloader } from './asset-downloader';
export type { AssetInfo, FailedAsset, DownloadResult, ImageExportItem } from './asset-downloader';
export { StylesheetGenerator } from './stylesheet-generator';
export type { GeneratedStylesheet, StylesheetGeneratorOptions } from './stylesheet-generator';
export {
  ConfigLoader,
  ConfigValidationError,
  DEFAULT_OUTPUT_DIR,
  DEFAULT_USE_TAILWIND,
  DEFAULT_NAMING_CONVENTION,
  FIGMA_TOKEN_ENV_VAR,
  VALID_NAMING_CONVENTIONS,
  VALID_IMAGE_FORMATS,
  MIN_IMAGE_SCALE,
  MAX_IMAGE_SCALE,
} from './config-loader';
export type { ConfigLoadOptions } from './config-loader';
export { SummaryReportGenerator, SUMMARY_REPORT_FILENAME } from './summary-report';
export type {
  SummaryReport,
  SummaryReportInput,
  GeneratedComponentSummary,
  FileWriter,
} from './summary-report';
export { FigmaImporter } from './figma-importer';
export type {
  FigmaImporterDependencies,
  ComponentFileWriter,
} from './figma-importer';

