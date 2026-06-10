/**
 * CLI Interface for the Figma Import tool.
 *
 * This module is intentionally split into small, pure, dependency-injected
 * functions so the argument parsing and configuration assembly can be unit
 * tested without touching the real filesystem or `process.env`:
 *
 *  - {@link parseArgs}      Pure mapping of argv → Partial<ImportConfig>.
 *  - {@link getConfigPath}  Extracts the `--config <path>` value (if any).
 *  - {@link isHelpRequested} Detects `--help` / `-h` (help text is owned by a
 *                            later task — see {@link getUsage}).
 *  - {@link buildConfig}    Assembles the final, validated {@link ImportConfig}
 *                           from CLI overrides, an optional config file, and
 *                           the environment, with file reading + env injected.
 *
 * No side effects run at import time. The runnable {@link main} entry point
 * wires the pure pieces to the real `fs` and `process.env`.
 *
 * _Requirements: 10.1_
 */

import * as fs from 'fs';
import { ImportConfig, ImportResult } from '../types/config';
import {
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
} from '../core/config-loader';
import {
  DEFAULT_ASSETS_DIR,
  DEFAULT_IMAGE_FORMAT,
  DEFAULT_IMAGE_SCALE,
} from '../core/asset-downloader';
import { FigmaImporter } from '../core/figma-importer';

/**
 * Error raised for CLI-level problems (unknown flags, missing flag values,
 * unreadable/invalid config files). Carries a clean, user-facing message so
 * callers never surface a raw `fs`/`JSON` error.
 */
export class CliError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CliError';
  }
}

/**
 * Dependencies injected into {@link buildConfig} so tests avoid real I/O.
 */
export interface BuildConfigDeps {
  /** Reads a config file and returns its raw text. Defaults to `fs.readFileSync`. */
  readFile?: (filePath: string) => string;
  /** Environment source for token fallback. Defaults to `process.env`. */
  env?: Record<string, string | undefined>;
}

/**
 * Mapping of value-taking long flags to their corresponding {@link ImportConfig}
 * keys. Boolean flags and `--config` are handled separately.
 */
const VALUE_FLAG_TO_KEY: Record<string, keyof ImportConfig> = {
  '--file-url': 'fileUrl',
  '--token': 'token',
  '--output-dir': 'outputDir',
  '--assets-dir': 'assetsDir',
  '--naming': 'namingConvention',
  '--image-format': 'imageFormat',
  '--image-scale': 'imageScale',
};

/**
 * Splits a single argv token into its flag name and an optional inline value.
 *
 * Supports the `--flag=value` form: `--naming=kebab` → `['--naming', 'kebab']`.
 * For the plain `--flag` form the value is `undefined`.
 */
function splitFlag(token: string): { flag: string; inlineValue?: string } {
  const eq = token.indexOf('=');
  if (token.startsWith('--') && eq !== -1) {
    return { flag: token.slice(0, eq), inlineValue: token.slice(eq + 1) };
  }
  return { flag: token };
}

/**
 * Assigns a parsed value to the appropriate {@link ImportConfig} field,
 * applying per-field coercion (currently only numeric coercion for
 * `imageScale`). Enum-like fields (`namingConvention`, `imageFormat`) are
 * passed through as-is and validated later by {@link ConfigLoader}.
 */
function assignValue(
  overrides: Partial<ImportConfig>,
  key: keyof ImportConfig,
  value: string
): void {
  if (key === 'imageScale') {
    overrides.imageScale = Number(value);
    return;
  }
  // Remaining value flags are all string-typed on ImportConfig (fileUrl,
  // token, outputDir, assetsDir) or string-literal unions validated later
  // (namingConvention, imageFormat).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (overrides as any)[key] = value;
}

/**
 * Parse command-line arguments into a {@link ImportConfig} override object.
 *
 * Supported flags (all from design.md):
 *   --file-url <url>          → fileUrl
 *   --token <token>           → token
 *   --output-dir <path>       → outputDir
 *   --assets-dir <path>       → assetsDir
 *   --naming <convention>     → namingConvention (pascal|kebab|camel)
 *   --image-format <fmt>      → imageFormat (png|jpg|svg)
 *   --image-scale <n>         → imageScale (coerced to number)
 *   --tailwind / --use-tailwind → useTailwind = true
 *   --no-tailwind             → useTailwind = false
 *
 * Both `--flag value` and `--flag=value` forms are accepted for value flags.
 *
 * `--config <path>` and `--help`/`-h` are recognised but NOT part of
 * {@link ImportConfig}; use {@link getConfigPath} and {@link isHelpRequested}
 * to read those. They are skipped here (including their values) so they do not
 * pollute the overrides.
 *
 * This function is pure: it performs no I/O and does not read `process.env`.
 *
 * @throws {CliError} For unknown flags or value flags missing their value.
 */
export function parseArgs(argv: string[]): Partial<ImportConfig> {
  const overrides: Partial<ImportConfig> = {};

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith('--') && !token.startsWith('-')) {
      throw new CliError(`Unexpected argument: "${token}".`);
    }

    const { flag, inlineValue } = splitFlag(token);

    // Boolean flags.
    if (flag === '--tailwind' || flag === '--use-tailwind') {
      overrides.useTailwind = true;
      continue;
    }
    if (flag === '--no-tailwind') {
      overrides.useTailwind = false;
      continue;
    }

    // Meta flags handled elsewhere; consume their value if present.
    if (flag === '--help' || flag === '-h') {
      continue;
    }
    if (flag === '--config') {
      if (inlineValue === undefined) {
        // Skip the following value token (validated/used by getConfigPath).
        if (i + 1 >= argv.length) {
          throw new CliError('Missing value for --config.');
        }
        i++;
      }
      continue;
    }

    // Value flags.
    const key = VALUE_FLAG_TO_KEY[flag];
    if (key === undefined) {
      throw new CliError(`Unknown option: "${flag}".`);
    }

    let value: string;
    if (inlineValue !== undefined) {
      value = inlineValue;
    } else {
      if (i + 1 >= argv.length) {
        throw new CliError(`Missing value for ${flag}.`);
      }
      value = argv[++i];
    }

    assignValue(overrides, key, value);
  }

  return overrides;
}

/**
 * Extract the `--config <path>` value from argv, if provided. Supports both
 * `--config path` and `--config=path` forms. Returns `undefined` when the flag
 * is absent. Pure: performs no I/O.
 *
 * @throws {CliError} When `--config` is given without a path.
 */
export function getConfigPath(argv: string[]): string | undefined {
  for (let i = 0; i < argv.length; i++) {
    const { flag, inlineValue } = splitFlag(argv[i]);
    if (flag !== '--config') continue;

    if (inlineValue !== undefined) {
      if (inlineValue.length === 0) {
        throw new CliError('Missing value for --config.');
      }
      return inlineValue;
    }
    if (i + 1 >= argv.length) {
      throw new CliError('Missing value for --config.');
    }
    return argv[i + 1];
  }
  return undefined;
}

/**
 * Detect whether help was requested (`--help` or `-h`). The actual help text
 * is intentionally minimal here; a later task owns rich usage output.
 */
export function isHelpRequested(argv: string[]): boolean {
  return argv.some((a) => a === '--help' || a === '-h');
}

/**
 * Read and parse a JSON configuration file into a {@link ImportConfig} override
 * object. Wraps missing-file and malformed-JSON failures in a {@link CliError}
 * so callers never see a raw `fs`/`JSON` error.
 */
function loadConfigFile(
  filePath: string,
  readFile: (filePath: string) => string
): Partial<ImportConfig> {
  let raw: string;
  try {
    raw = readFile(filePath);
  } catch {
    throw new CliError(
      `Could not read configuration file "${filePath}". Check that the path exists and is readable.`
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new CliError(
      `Configuration file "${filePath}" is not valid JSON.`
    );
  }

  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new CliError(
      `Configuration file "${filePath}" must contain a JSON object.`
    );
  }

  return parsed as Partial<ImportConfig>;
}

/**
 * Assemble a fully-resolved, validated {@link ImportConfig} from CLI arguments,
 * an optional `--config` file, and the environment.
 *
 * Precedence (handled by {@link ConfigLoader}): CLI > config file > env (token
 * only) > defaults.
 *
 * File reading and the environment are injected via {@link BuildConfigDeps} so
 * tests need not touch the real filesystem or `process.env`.
 *
 * @throws {CliError} For CLI/config-file problems (unknown flags, unreadable or
 *   malformed config file).
 * @throws {ConfigValidationError} When the resolved configuration is invalid.
 */
export function buildConfig(
  argv: string[],
  deps: BuildConfigDeps = {}
): ImportConfig {
  const readFile =
    deps.readFile ?? ((p: string) => fs.readFileSync(p, 'utf-8'));
  const env = deps.env ?? process.env;

  const cli = parseArgs(argv);

  const configPath = getConfigPath(argv);
  const file = configPath !== undefined
    ? loadConfigFile(configPath, readFile)
    : undefined;

  return new ConfigLoader().load({ file, cli, env });
}

/**
 * Build the full, user-facing help / usage text for the CLI.
 *
 * Lists every supported flag with a short description and, where relevant, the
 * value type / allowed values / default. Includes example command lines and
 * documents the `FIGMA_TOKEN` environment-variable fallback for the token.
 *
 * Defaults are sourced from the config loader / asset downloader so the help
 * text and runtime behaviour stay in sync.
 *
 * _Requirements: 10.1_
 */
export function getUsage(): string {
  const namings = VALID_NAMING_CONVENTIONS.join('|');
  const formats = VALID_IMAGE_FORMATS.join('|');

  return [
    'figma-import — Generate React components and assets from a Figma file.',
    '',
    'Usage:',
    '  figma-import [options]',
    '',
    'Options:',
    '  --file-url <url>         Figma file URL (required).',
    `  --token <token>          Figma personal access token. Falls back to the`,
    `                           ${FIGMA_TOKEN_ENV_VAR} environment variable when omitted.`,
    `  --output-dir <path>      Output directory for generated components`,
    `                           (default: ${DEFAULT_OUTPUT_DIR}).`,
    `  --assets-dir <path>      Output directory for downloaded assets`,
    `                           (default: ${DEFAULT_ASSETS_DIR}).`,
    `  --tailwind               Emit Tailwind CSS utility classes`,
    `                           (default: ${DEFAULT_USE_TAILWIND ? 'enabled' : 'disabled'}).`,
    '  --no-tailwind            Emit CSS modules instead of Tailwind classes.',
    `  --naming <convention>    Component naming convention: ${namings}`,
    `                           (default: ${DEFAULT_NAMING_CONVENTION}).`,
    `  --image-format <format>  Asset export format: ${formats}`,
    `                           (default: ${DEFAULT_IMAGE_FORMAT}).`,
    `  --image-scale <number>   Asset export scale, ${MIN_IMAGE_SCALE}–${MAX_IMAGE_SCALE}`,
    `                           (default: ${DEFAULT_IMAGE_SCALE}).`,
    '  --config <path>          Path to a JSON configuration file.',
    '  -h, --help               Show this help message and exit.',
    '',
    'Environment:',
    `  ${FIGMA_TOKEN_ENV_VAR}             Used as the access token when --token is not provided.`,
    '',
    'Examples:',
    '  # Using CLI flags',
    '  figma-import --file-url "https://www.figma.com/file/ABC123/MyDesign" --token "figd_xxx"',
    '',
    '  # Using the FIGMA_TOKEN environment variable for the token',
    '  export FIGMA_TOKEN="figd_xxx"',
    '  figma-import --file-url "https://www.figma.com/file/ABC123/MyDesign" --tailwind',
    '',
    '  # Using a configuration file',
    '  figma-import --config ./figma-import.config.json',
    '',
  ].join('\n');
}

/**
 * Format an {@link ImportResult} into a concise, user-facing console summary.
 *
 * Lists the component/asset counts, the generated files, and any warnings or
 * errors collected during the run. Pure: builds and returns a string.
 */
export function formatResult(result: ImportResult): string {
  const lines: string[] = [];
  lines.push(result.success ? 'Figma import completed.' : 'Figma import failed.');
  lines.push(`  Components generated: ${result.componentsGenerated}`);
  lines.push(`  Assets downloaded:    ${result.assetsDownloaded}`);
  lines.push(`  Duration:             ${result.duration}ms`);

  if (result.files.length > 0) {
    lines.push(`  Files (${result.files.length}):`);
    for (const file of result.files) {
      lines.push(`    - ${file}`);
    }
  }

  if (result.warnings.length > 0) {
    lines.push(`  Warnings (${result.warnings.length}):`);
    for (const warning of result.warnings) {
      lines.push(`    ! ${warning}`);
    }
  }

  if (result.errors.length > 0) {
    lines.push(`  Errors (${result.errors.length}):`);
    for (const error of result.errors) {
      lines.push(`    x ${error}`);
    }
  }

  return lines.join('\n');
}

/**
 * Runnable CLI entry point. Wires the pure helpers to the real `fs` and
 * `process.env`, executes the import workflow via {@link FigmaImporter}, prints
 * the resulting summary (or user-facing errors), and sets a non-zero exit code
 * on failure. Not invoked at import time.
 */
export async function main(argv: string[] = process.argv.slice(2)): Promise<void> {
  if (isHelpRequested(argv)) {
    // eslint-disable-next-line no-console
    console.log(getUsage());
    return;
  }

  let config: ImportConfig;
  try {
    config = buildConfig(argv);
  } catch (error) {
    if (error instanceof ConfigValidationError || error instanceof CliError) {
      // Surface the clean, user-facing message (ConfigValidationError keeps its
      // aggregated per-field list intact) followed by a hint to consult --help.
      // eslint-disable-next-line no-console
      console.error(error.message);
      // eslint-disable-next-line no-console
      console.error('\nRun "figma-import --help" to see usage and available options.');
    } else {
      // eslint-disable-next-line no-console
      console.error(
        `Unexpected error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
    process.exitCode = 1;
    return;
  }

  // Execute the end-to-end import workflow. FigmaImporter.import() never
  // rejects: fatal failures come back as a result with success=false and a
  // populated errors array, which we surface below.
  // eslint-disable-next-line no-console
  console.log(`Starting Figma import for ${config.fileUrl} ...`);
  const result = await new FigmaImporter().import(config);

  // eslint-disable-next-line no-console
  console.log(formatResult(result));

  if (!result.success) {
    process.exitCode = 1;
  }
}

// Only run when executed directly, never on import.
if (require.main === module) {
  main().catch((error) => {
    // eslint-disable-next-line no-console
    console.error(
      `Unexpected error: ${error instanceof Error ? error.message : String(error)}`
    );
    process.exitCode = 1;
  });
}
