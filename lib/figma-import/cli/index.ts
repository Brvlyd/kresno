/**
 * CLI module exports for Figma Import.
 */

export {
  parseArgs,
  getConfigPath,
  isHelpRequested,
  buildConfig,
  getUsage,
  main,
  CliError,
} from './cli';
export type { BuildConfigDeps } from './cli';
