/**
 * Unit tests for the Figma Import CLI help / usage output and error messaging.
 *
 * Covers:
 *  - `getUsage()` lists every supported flag, an example, and the env var.
 *  - `main(['--help'])` prints usage and does not set a non-zero exit code.
 *  - `main([])` (missing required args) prints an error + a --help hint and
 *    sets a non-zero `process.exitCode`.
 *
 * Console output is captured via jest spies and `process.exitCode` is restored
 * between tests.
 *
 * _Requirements: 10.1_
 */

import { getUsage, main } from '@/lib/figma-import/cli/cli';
import { FIGMA_TOKEN_ENV_VAR } from '@/lib/figma-import/core/config-loader';

describe('getUsage', () => {
  const usage = getUsage();

  it.each([
    '--file-url',
    '--token',
    '--output-dir',
    '--assets-dir',
    '--tailwind',
    '--no-tailwind',
    '--naming',
    '--image-format',
    '--image-scale',
    '--config',
    '--help',
  ])('mentions the %s flag', (flag) => {
    expect(usage).toContain(flag);
  });

  it('lists the -h short help alias', () => {
    expect(usage).toContain('-h');
  });

  it('documents the FIGMA_TOKEN environment-variable fallback', () => {
    expect(usage).toContain(FIGMA_TOKEN_ENV_VAR);
  });

  it('includes at least one usage example command line', () => {
    expect(usage.toLowerCase()).toContain('example');
    expect(usage).toMatch(/figma-import --file-url/);
  });

  it('documents the allowed naming conventions and image formats', () => {
    expect(usage).toContain('pascal|kebab|camel');
    expect(usage).toContain('png|jpg|svg');
  });
});

describe('main help and error handling', () => {
  let logSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;
  const originalExitCode = process.exitCode;

  beforeEach(() => {
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    process.exitCode = undefined;
  });

  afterEach(() => {
    logSpy.mockRestore();
    errorSpy.mockRestore();
    process.exitCode = originalExitCode;
  });

  it('prints usage on --help without setting a non-zero exit code', () => {
    main(['--help']);

    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy.mock.calls[0][0]).toBe(getUsage());
    expect(errorSpy).not.toHaveBeenCalled();
    expect(process.exitCode).toBeFalsy();
  });

  it('prints usage on -h without setting a non-zero exit code', () => {
    main(['-h']);

    expect(logSpy.mock.calls[0][0]).toBe(getUsage());
    expect(process.exitCode).toBeFalsy();
  });

  it('prints an error and a --help hint and sets a non-zero exit code when required args are missing', () => {
    main([]);

    expect(errorSpy).toHaveBeenCalled();
    const combined = errorSpy.mock.calls.map((c) => c[0]).join('\n');
    // Aggregated validation message stays intact.
    expect(combined).toContain('Invalid Figma import configuration');
    expect(combined).toContain('fileUrl is required');
    expect(combined).toContain('token is required');
    // Hint to consult --help.
    expect(combined).toContain('--help');
    // Non-zero exit code.
    expect(process.exitCode).not.toBe(0);
    expect(process.exitCode).toBeTruthy();
  });

  it('prints an error and a --help hint and sets a non-zero exit code on unknown flags', () => {
    main(['--bogus']);

    const combined = errorSpy.mock.calls.map((c) => c[0]).join('\n');
    expect(combined).toContain('Unknown option');
    expect(combined).toContain('--help');
    expect(process.exitCode).toBeTruthy();
  });
});
