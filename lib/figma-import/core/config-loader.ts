/**
 * Configuration Loader and Validator
 *
 * Builds a fully-resolved {@link ImportConfig} from an optional configuration
 * file object and optional CLI-argument-style overrides, applying documented
 * default values for any missing optional settings and validating the result.
 *
 * Precedence (highest first): CLI overrides > config file > environment
 * (token only) > built-in defaults. (Requirements 10.1–10.6)
 */

import * as path from 'path';
import { ImportConfig } from '../types/config';
import {
  DEFAULT_ASSETS_DIR,
  DEFAULT_IMAGE_FORMAT,
  DEFAULT_IMAGE_SCALE,
} from './asset-downloader';

/**
 * Default output directory for generated components.
 * Documented contract: `./components/figma` (design.md).
 */
export const DEFAULT_OUTPUT_DIR = path.join('components', 'figma');

/**
 * Default Tailwind setting. When enabled the generators emit Tailwind utility
 * classes; when disabled they emit CSS modules (Requirements 10.3, 10.4).
 * The documented configuration-file contract enables Tailwind by default.
 */
export const DEFAULT_USE_TAILWIND = true;

/**
 * Default component naming convention (design.md: pascal).
 */
export const DEFAULT_NAMING_CONVENTION: ImportConfig['namingConvention'] = 'pascal';

/**
 * Environment variable consulted as a fallback source for the Figma personal
 * access token when it is not supplied via CLI or config file.
 */
export const FIGMA_TOKEN_ENV_VAR = 'FIGMA_TOKEN';

/**
 * Allowed values for the naming convention option.
 */
export const VALID_NAMING_CONVENTIONS: ReadonlyArray<ImportConfig['namingConvention']> = [
  'pascal',
  'kebab',
  'camel',
];

/**
 * Allowed values for the image export format option.
 */
export const VALID_IMAGE_FORMATS: ReadonlyArray<ImportConfig['imageFormat']> = [
  'png',
  'jpg',
  'svg',
];

/**
 * Minimum and maximum supported image export scale. Figma's image export API
 * accepts scales in the range (0, 4].
 */
export const MIN_IMAGE_SCALE = 0.01;
export const MAX_IMAGE_SCALE = 4;

/**
 * Inputs accepted by {@link ConfigLoader.load}. Every source is optional;
 * missing optional settings fall back to documented defaults.
 */
export interface ConfigLoadOptions {
  /** Values parsed from a configuration file (e.g. figma-import.config.js). */
  file?: Partial<ImportConfig>;
  /** CLI-argument-style overrides. Take precedence over `file` values. */
  cli?: Partial<ImportConfig>;
  /** Environment source for token fallback. Defaults to `process.env`. */
  env?: Record<string, string | undefined>;
}

/**
 * Error thrown when the resolved configuration is invalid. Aggregates all
 * validation problems so callers can surface every issue at once instead of
 * a single raw error.
 */
export class ConfigValidationError extends Error {
  /** Individual, human-readable validation messages. */
  readonly errors: string[];

  constructor(errors: string[]) {
    super(
      `Invalid Figma import configuration:\n${errors
        .map((e) => `  - ${e}`)
        .join('\n')}`
    );
    this.name = 'ConfigValidationError';
    this.errors = errors;
  }
}

/**
 * Loads, resolves, and validates Figma import configuration.
 */
export class ConfigLoader {
  /**
   * Build a fully-resolved, validated {@link ImportConfig}.
   *
   * @throws {ConfigValidationError} If the resolved configuration is invalid.
   */
  load(options: ConfigLoadOptions = {}): ImportConfig {
    const resolved = this.resolve(options);
    this.validate(resolved);
    return resolved;
  }

  /**
   * Merge the provided sources with defaults to produce a complete config,
   * WITHOUT validating it. Useful for inspecting the effective configuration
   * (e.g. dry runs) and for tests that assert defaulting behaviour.
   *
   * Precedence: CLI > file > (env for token) > default.
   */
  resolve(options: ConfigLoadOptions = {}): ImportConfig {
    const { file = {}, cli = {}, env = process.env } = options;

    const pick = <K extends keyof ImportConfig>(
      key: K
    ): ImportConfig[K] | undefined => {
      if (cli[key] !== undefined) return cli[key];
      if (file[key] !== undefined) return file[key];
      return undefined;
    };

    // Token resolution includes the environment-variable fallback.
    const token =
      cli.token ?? file.token ?? env[FIGMA_TOKEN_ENV_VAR] ?? '';

    return {
      fileUrl: pick('fileUrl') ?? '',
      token,
      outputDir: pick('outputDir') ?? DEFAULT_OUTPUT_DIR,
      assetsDir: pick('assetsDir') ?? DEFAULT_ASSETS_DIR,
      useTailwind: pick('useTailwind') ?? DEFAULT_USE_TAILWIND,
      namingConvention: pick('namingConvention') ?? DEFAULT_NAMING_CONVENTION,
      imageFormat: pick('imageFormat') ?? DEFAULT_IMAGE_FORMAT,
      imageScale: pick('imageScale') ?? DEFAULT_IMAGE_SCALE,
    };
  }

  /**
   * Validate a resolved configuration. Collects all problems and throws a
   * single {@link ConfigValidationError}; never throws raw errors.
   *
   * @throws {ConfigValidationError} If any field is missing or invalid.
   */
  validate(config: ImportConfig): void {
    const errors: string[] = [];

    // Required: fileUrl (Requirement 10.1)
    if (!config.fileUrl || config.fileUrl.trim().length === 0) {
      errors.push(
        'fileUrl is required. Provide a Figma file URL via --file-url or the config file.'
      );
    } else if (!/figma\.com\/(file|design)\/([a-zA-Z0-9]+)/.test(config.fileUrl)) {
      errors.push(
        `fileUrl "${config.fileUrl}" is not a valid Figma file URL. Expected format: https://www.figma.com/file/{fileKey}/{fileName} or https://www.figma.com/design/{fileKey}/{fileName}.`
      );
    }

    // Required: token (Requirement 10 — fallback to FIGMA_TOKEN env var)
    if (!config.token || config.token.trim().length === 0) {
      errors.push(
        `token is required. Provide a Figma personal access token via --token, the config file, or the ${FIGMA_TOKEN_ENV_VAR} environment variable.`
      );
    }

    // Output directories must be non-empty strings (Requirement 10.1)
    if (!config.outputDir || config.outputDir.trim().length === 0) {
      errors.push('outputDir must be a non-empty path.');
    }
    if (!config.assetsDir || config.assetsDir.trim().length === 0) {
      errors.push('assetsDir must be a non-empty path.');
    }

    // Naming convention enum (Requirement 10.2)
    if (!VALID_NAMING_CONVENTIONS.includes(config.namingConvention)) {
      errors.push(
        `namingConvention "${config.namingConvention}" is invalid. Expected one of: ${VALID_NAMING_CONVENTIONS.join(
          ', '
        )}.`
      );
    }

    // Image format enum (Requirement 10.5)
    if (!VALID_IMAGE_FORMATS.includes(config.imageFormat)) {
      errors.push(
        `imageFormat "${config.imageFormat}" is invalid. Expected one of: ${VALID_IMAGE_FORMATS.join(
          ', '
        )}.`
      );
    }

    // Image scale numeric range (Requirement 10.5)
    if (
      typeof config.imageScale !== 'number' ||
      Number.isNaN(config.imageScale) ||
      !Number.isFinite(config.imageScale)
    ) {
      errors.push('imageScale must be a finite number.');
    } else if (
      config.imageScale < MIN_IMAGE_SCALE ||
      config.imageScale > MAX_IMAGE_SCALE
    ) {
      errors.push(
        `imageScale ${config.imageScale} is out of range. Expected a value between ${MIN_IMAGE_SCALE} and ${MAX_IMAGE_SCALE}.`
      );
    }

    // useTailwind must be boolean (Requirements 10.3, 10.4)
    if (typeof config.useTailwind !== 'boolean') {
      errors.push('useTailwind must be a boolean.');
    }

    if (errors.length > 0) {
      throw new ConfigValidationError(errors);
    }
  }
}
