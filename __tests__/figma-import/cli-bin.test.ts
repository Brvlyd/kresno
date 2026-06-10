/**
 * Tests for the runnable CLI entry point (`bin.ts`) and the package/build
 * configuration that exposes it as the `figma-import` executable.
 *
 * Covers:
 *  - `bin.ts` forwards the real process arguments to `main`.
 *  - `package.json` declares a `figma-import` bin mapped to the compiled entry,
 *    plus a `build:cli` script.
 *  - The CLI build config (`tsconfig.cli.json`) and bin source exist and the
 *    bin source carries the Node shebang required for an executable.
 *
 * The build output path declared in `package.json#bin` is asserted to match the
 * `outDir`/`rootDir` of `tsconfig.cli.json`, so the wiring stays consistent.
 *
 * _Requirements: 10.1_
 */

import * as fs from 'fs';
import * as path from 'path';

const REPO_ROOT = path.resolve(__dirname, '..', '..');

describe('bin entry point', () => {
  afterEach(() => {
    jest.resetModules();
    jest.restoreAllMocks();
  });

  it('forwards process arguments to main() exactly once', () => {
    // `main` is async and returns a Promise; `bin.ts` chains `.catch()` onto
    // the result, so the mock must resolve to a Promise to match the contract.
    const mainMock = jest.fn().mockResolvedValue(undefined);

    jest.isolateModules(() => {
      jest.doMock('@/lib/figma-import/cli/cli', () => ({ main: mainMock }));
      // Importing the bin module triggers its top-level main() call.
      require('@/lib/figma-import/cli/bin');
    });

    expect(mainMock).toHaveBeenCalledTimes(1);
    expect(mainMock).toHaveBeenCalledWith(process.argv.slice(2));
  });
});

describe('bin source file', () => {
  const binSource = fs.readFileSync(
    path.join(REPO_ROOT, 'lib', 'figma-import', 'cli', 'bin.ts'),
    'utf-8'
  );

  it('starts with a Node shebang so the compiled output is executable', () => {
    expect(binSource.startsWith('#!/usr/bin/env node')).toBe(true);
  });

  it('invokes main with the forwarded CLI arguments', () => {
    expect(binSource).toContain('main(process.argv.slice(2))');
  });
});

describe('package.json CLI configuration', () => {
  const pkg = JSON.parse(
    fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf-8')
  ) as {
    bin?: Record<string, string>;
    scripts?: Record<string, string>;
  };

  it('exposes a "figma-import" bin', () => {
    expect(pkg.bin).toBeDefined();
    expect(pkg.bin!['figma-import']).toBeDefined();
  });

  it('points the bin at a compiled JavaScript file', () => {
    const binPath = pkg.bin!['figma-import'];
    expect(binPath.endsWith('.js')).toBe(true);
  });

  it('provides a build:cli script that uses the CLI tsconfig', () => {
    expect(pkg.scripts).toBeDefined();
    expect(pkg.scripts!['build:cli']).toContain('tsconfig.cli.json');
  });

  it('declares the bin path consistent with the CLI tsconfig outDir/rootDir', () => {
    const rawTsconfig = fs.readFileSync(
      path.join(REPO_ROOT, 'tsconfig.cli.json'),
      'utf-8'
    );
    // tsconfig files are JSONC; strip line comments before parsing.
    const tsconfigCli = JSON.parse(
      rawTsconfig.replace(/^\s*\/\/.*$/gm, '')
    ) as { compilerOptions?: { outDir?: string; rootDir?: string } };

    const outDir = (tsconfigCli.compilerOptions?.outDir ?? './dist').replace(
      /^\.\//,
      ''
    );
    const rootDir = (tsconfigCli.compilerOptions?.rootDir ?? './lib').replace(
      /^\.\//,
      ''
    );

    // bin.ts lives at <rootDir>/figma-import/cli/bin.ts, so the compiled file
    // is at <outDir>/figma-import/cli/bin.js (rootDir stripped from the path).
    const expectedBin = path
      .join(outDir, 'figma-import', 'cli', 'bin.js')
      .replace(/\\/g, '/');

    expect(pkg.bin!['figma-import'].replace(/\\/g, '/')).toBe(expectedBin);
    expect(rootDir).toBe('lib');
  });
});
