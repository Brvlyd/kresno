#!/usr/bin/env node
/**
 * Executable entry point for the `figma-import` CLI command.
 *
 * This is a thin wrapper whose only job is to invoke {@link main} from the CLI
 * module with the real process arguments. It exists separately from `cli.ts`
 * so that:
 *
 *  - The compiled output (`bin.js`) carries the `#!/usr/bin/env node` shebang
 *    required for a runnable npm `bin` executable, while `cli.ts` stays a clean,
 *    side-effect-free, unit-testable module.
 *  - The `bin` field in `package.json` can point at a single, stable file.
 *
 * Build this (and the rest of the figma-import lib) for distribution with:
 *
 *   npm run build:cli
 *
 * which compiles to `dist/cli/...` via `tsconfig.cli.json`. The `bin` mapping in
 * `package.json` resolves to the compiled `dist/cli/cli/bin.js`.
 */

import { main } from './cli';

main(process.argv.slice(2)).catch((error) => {
  // eslint-disable-next-line no-console
  console.error(
    `Unexpected error: ${error instanceof Error ? error.message : String(error)}`
  );
  process.exitCode = 1;
});
