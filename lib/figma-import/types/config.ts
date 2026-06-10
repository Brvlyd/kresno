/**
 * Configuration types for the Figma Import tool
 */

export interface ImportConfig {
  fileUrl: string;
  token: string;
  outputDir: string;
  assetsDir: string;
  useTailwind: boolean;
  namingConvention: 'pascal' | 'kebab' | 'camel';
  imageFormat: 'png' | 'jpg' | 'svg';
  imageScale: number;
}

export interface ImportResult {
  success: boolean;
  componentsGenerated: number;
  assetsDownloaded: number;
  files: string[];
  warnings: string[];
  errors: string[];
  duration: number;
}

export interface GeneratorOptions {
  namingConvention: 'pascal' | 'kebab' | 'camel';
  useTailwind: boolean;
  outputDir: string;
}

export interface AssetDownloadOptions {
  format: 'png' | 'jpg' | 'svg';
  scale: number;
  outputDir: string;
}
