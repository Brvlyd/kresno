/**
 * Additional unit tests for the Figma Import CLI argument parsing.
 *
 * These tests complement (and intentionally do NOT duplicate) the cases in
 * `cli.test.ts` / `cli-help.test.ts`. They focus on flag *combinations* and
 * *edge cases*:
 *   - full option sets, mixed `--flag value` / `--flag=value` forms,
 *     repeated-flag (last-wins) behaviour, boolean flag interactions,
 *     empty-string values, and flag-ordering independence;
 *   - config-file path loading via `buildConfig` with an injected `readFile`
 *     (relative, absolute-style, and `=`-form paths; partial files overridden
 *     by the CLI; JSON-object parsing of typed fields);
 *   - environment-variable token fallback precedence (env-only, file-beats-env,
 *     cli-beats-file+env, and absent-everywhere → validation error).
 *
 * All I/O is dependency-injected: `readFile` and `env` are supplied so no real
 * filesystem or `process.env` is touched.
 *
 * _Requirements: 10.1_
 */

import {
  parseArgs,
  buildConfig,
} from '@/lib/figma-import/cli/cli';
import { ConfigValidationError } from '@/lib/figma-import/core/config-loader';

const VALID_URL = 'https://www.figma.com/file/ABC123/MyDesign';
const OTHER_URL = 'https://www.figma.com/design/XYZ789/OtherDesign';

describe('parseArgs — flag combinations and edge cases', () => {
  describe('full option set', () => {
    it('parses every supported value + boolean flag together', () => {
      const result = parseArgs([
        '--file-url',
        VALID_URL,
        '--token',
        'figd_full',
        '--output-dir',
        './out/components',
        '--assets-dir',
        './out/assets',
        '--tailwind',
        '--naming',
        'kebab',
        '--image-format',
        'svg',
        '--image-scale',
        '2',
      ]);

      expect(result).toEqual({
        fileUrl: VALID_URL,
        token: 'figd_full',
        outputDir: './out/components',
        assetsDir: './out/assets',
        useTailwind: true,
        namingConvention: 'kebab',
        imageFormat: 'svg',
        imageScale: 2,
      });
    });
  });

  describe('mixed --flag value and --flag=value forms in the same argv', () => {
    it('parses a mix of both forms across many flags', () => {
      const result = parseArgs([
        `--file-url=${VALID_URL}`,
        '--token',
        'figd_mix',
        '--output-dir=./out',
        '--assets-dir',
        './assets',
        '--naming=camel',
        '--image-scale',
        '3',
      ]);

      expect(result).toEqual({
        fileUrl: VALID_URL,
        token: 'figd_mix',
        outputDir: './out',
        assetsDir: './assets',
        namingConvention: 'camel',
        imageScale: 3,
      });
    });
  });

  describe('repeated flags (last-wins)', () => {
    it('keeps the last value for a repeated value flag (space form)', () => {
      expect(parseArgs(['--token', 'first', '--token', 'second']).token).toBe(
        'second'
      );
    });

    it('keeps the last value when mixing space and =-form for the same flag', () => {
      expect(
        parseArgs(['--naming', 'pascal', '--naming=camel']).namingConvention
      ).toBe('camel');
    });

    it('keeps the last value for a repeated --file-url', () => {
      expect(
        parseArgs([`--file-url=${VALID_URL}`, '--file-url', OTHER_URL]).fileUrl
      ).toBe(OTHER_URL);
    });

    it('keeps the last value for a repeated --image-scale', () => {
      expect(parseArgs(['--image-scale', '2', '--image-scale=4']).imageScale).toBe(
        4
      );
    });
  });

  describe('boolean flag interactions (last-wins)', () => {
    it('--tailwind then --no-tailwind resolves to false', () => {
      expect(parseArgs(['--tailwind', '--no-tailwind']).useTailwind).toBe(false);
    });

    it('--no-tailwind then --tailwind resolves to true', () => {
      expect(parseArgs(['--no-tailwind', '--tailwind']).useTailwind).toBe(true);
    });

    it('--no-tailwind then --use-tailwind alias resolves to true', () => {
      expect(parseArgs(['--no-tailwind', '--use-tailwind']).useTailwind).toBe(
        true
      );
    });

    it('honours the final boolean flag across three toggles', () => {
      expect(
        parseArgs(['--tailwind', '--no-tailwind', '--tailwind']).useTailwind
      ).toBe(true);
    });
  });

  describe('empty-string values via =-form', () => {
    it('assigns an empty token from --token=', () => {
      const result = parseArgs(['--token=']);
      expect(result.token).toBe('');
    });

    it('assigns an empty fileUrl from --file-url=', () => {
      const result = parseArgs(['--file-url=']);
      expect(result.fileUrl).toBe('');
    });

    it('assigns an empty outputDir from --output-dir=', () => {
      const result = parseArgs(['--output-dir=']);
      expect(result.outputDir).toBe('');
    });
  });

  describe('flag ordering independence', () => {
    it('produces an equal result regardless of flag order', () => {
      const a = parseArgs([
        '--file-url',
        VALID_URL,
        '--naming=kebab',
        '--no-tailwind',
        '--token',
        'figd_order',
      ]);
      const b = parseArgs([
        '--token=figd_order',
        '--no-tailwind',
        '--naming',
        'kebab',
        '--file-url',
        VALID_URL,
      ]);
      expect(a).toEqual(b);
    });
  });
});

describe('buildConfig — config file path loading (injected readFile)', () => {
  it('reads a relative --config path through the injected readFile', () => {
    const readFile = jest
      .fn()
      .mockReturnValue(JSON.stringify({ fileUrl: VALID_URL, token: 't' }));

    const config = buildConfig(['--config', './config/figma.json'], {
      readFile,
      env: {},
    });

    expect(readFile).toHaveBeenCalledWith('./config/figma.json');
    expect(config.fileUrl).toBe(VALID_URL);
  });

  it('reads an absolute-style --config path through the injected readFile', () => {
    const absolutePath = 'C:\\projects\\figma\\figma.config.json';
    const readFile = jest
      .fn()
      .mockReturnValue(JSON.stringify({ fileUrl: VALID_URL, token: 't' }));

    buildConfig(['--config', absolutePath], { readFile, env: {} });

    expect(readFile).toHaveBeenCalledWith(absolutePath);
  });

  it('supports the --config=path form in buildConfig', () => {
    const readFile = jest
      .fn()
      .mockReturnValue(JSON.stringify({ fileUrl: VALID_URL, token: 'eq-form' }));

    const config = buildConfig(['--config=./figma.config.json'], {
      readFile,
      env: {},
    });

    expect(readFile).toHaveBeenCalledWith('./figma.config.json');
    expect(config.token).toBe('eq-form');
  });

  it('merges file-provided fields with CLI overriding a subset', () => {
    const readFile = jest.fn().mockReturnValue(
      JSON.stringify({
        fileUrl: VALID_URL,
        token: 'from-file',
        outputDir: './file-out',
        assetsDir: './file-assets',
        imageFormat: 'png',
      })
    );

    const config = buildConfig(
      ['--config', './figma.config.json', '--image-format=svg', '--output-dir', './cli-out'],
      { readFile, env: {} }
    );

    // CLI wins for the overridden fields.
    expect(config.imageFormat).toBe('svg');
    expect(config.outputDir).toBe('./cli-out');
    // File values survive where the CLI did not override.
    expect(config.assetsDir).toBe('./file-assets');
    expect(config.token).toBe('from-file');
  });

  it('parses the config file as a JSON object preserving field types', () => {
    const readFile = jest.fn().mockReturnValue(
      JSON.stringify({
        fileUrl: VALID_URL,
        token: 't',
        useTailwind: false,
        imageScale: 2.5,
      })
    );

    const config = buildConfig(['--config', './figma.config.json'], {
      readFile,
      env: {},
    });

    expect(config.useTailwind).toBe(false);
    expect(typeof config.imageScale).toBe('number');
    expect(config.imageScale).toBe(2.5);
  });
});

describe('buildConfig — environment-variable token fallback precedence', () => {
  it('resolves the token from env when it is the only source', () => {
    const config = buildConfig(['--file-url', VALID_URL], {
      env: { FIGMA_TOKEN: 'env-only' },
    });
    expect(config.token).toBe('env-only');
  });

  it('prefers a config-file token over the env var', () => {
    const readFile = jest
      .fn()
      .mockReturnValue(JSON.stringify({ fileUrl: VALID_URL, token: 'from-file' }));

    const config = buildConfig(['--config', './figma.config.json'], {
      readFile,
      env: { FIGMA_TOKEN: 'from-env' },
    });

    expect(config.token).toBe('from-file');
  });

  it('prefers a CLI token over both the config file and the env var', () => {
    const readFile = jest
      .fn()
      .mockReturnValue(JSON.stringify({ fileUrl: VALID_URL, token: 'from-file' }));

    const config = buildConfig(
      ['--config', './figma.config.json', '--token', 'from-cli'],
      { readFile, env: { FIGMA_TOKEN: 'from-env' } }
    );

    expect(config.token).toBe('from-cli');
  });

  it('throws ConfigValidationError mentioning the token when it is absent everywhere', () => {
    expect(() =>
      buildConfig(['--file-url', VALID_URL], { env: {} })
    ).toThrow(ConfigValidationError);

    try {
      buildConfig(['--file-url', VALID_URL], { env: {} });
      throw new Error('expected ConfigValidationError');
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigValidationError);
      expect((error as ConfigValidationError).errors.join('\n')).toContain(
        'token is required'
      );
    }
  });

  it('does not fall back to env when the CLI supplies an empty-string token', () => {
    // An empty `--token=` is a provided (non-nullish) value, so it does NOT
    // fall through to FIGMA_TOKEN and the resulting config fails validation.
    expect(() =>
      buildConfig(['--file-url', VALID_URL, '--token='], {
        env: { FIGMA_TOKEN: 'from-env' },
      })
    ).toThrow(ConfigValidationError);
  });
});
