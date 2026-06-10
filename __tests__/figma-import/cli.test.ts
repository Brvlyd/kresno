/**
 * Unit tests for the Figma Import CLI argument parser and config builder.
 *
 * These tests exercise the pure, dependency-injected surface of the CLI:
 * `parseArgs`, `getConfigPath`, `isHelpRequested`, and `buildConfig`. File
 * reading and the environment are injected so no real fs/process.env is used.
 *
 * _Requirements: 10.1_
 */

import {
  parseArgs,
  getConfigPath,
  isHelpRequested,
  buildConfig,
  CliError,
} from '@/lib/figma-import/cli/cli';
import { ConfigValidationError } from '@/lib/figma-import/core/config-loader';

const VALID_URL = 'https://www.figma.com/file/ABC123/MyDesign';

describe('parseArgs', () => {
  it('parses --file-url in space form', () => {
    const result = parseArgs(['--file-url', VALID_URL]);
    expect(result.fileUrl).toBe(VALID_URL);
  });

  it('parses --file-url in =-form', () => {
    const result = parseArgs([`--file-url=${VALID_URL}`]);
    expect(result.fileUrl).toBe(VALID_URL);
  });

  it('parses --token', () => {
    expect(parseArgs(['--token', 'figd_xxx']).token).toBe('figd_xxx');
    expect(parseArgs(['--token=figd_yyy']).token).toBe('figd_yyy');
  });

  it('parses --output-dir and --assets-dir', () => {
    const result = parseArgs([
      '--output-dir',
      './out/components',
      '--assets-dir=./out/assets',
    ]);
    expect(result.outputDir).toBe('./out/components');
    expect(result.assetsDir).toBe('./out/assets');
  });

  it('parses --tailwind as useTailwind=true', () => {
    expect(parseArgs(['--tailwind']).useTailwind).toBe(true);
  });

  it('parses --use-tailwind alias as useTailwind=true', () => {
    expect(parseArgs(['--use-tailwind']).useTailwind).toBe(true);
  });

  it('parses --no-tailwind as useTailwind=false', () => {
    expect(parseArgs(['--no-tailwind']).useTailwind).toBe(false);
  });

  it.each(['pascal', 'kebab', 'camel'] as const)(
    'parses --naming %s',
    (convention) => {
      expect(parseArgs(['--naming', convention]).namingConvention).toBe(
        convention
      );
      expect(parseArgs([`--naming=${convention}`]).namingConvention).toBe(
        convention
      );
    }
  );

  it.each(['png', 'jpg', 'svg'] as const)(
    'parses --image-format %s',
    (format) => {
      expect(parseArgs(['--image-format', format]).imageFormat).toBe(format);
      expect(parseArgs([`--image-format=${format}`]).imageFormat).toBe(format);
    }
  );

  it('parses --image-scale as a number (space form)', () => {
    const result = parseArgs(['--image-scale', '3']);
    expect(result.imageScale).toBe(3);
    expect(typeof result.imageScale).toBe('number');
  });

  it('parses --image-scale as a number (=-form, decimal)', () => {
    const result = parseArgs(['--image-scale=2.5']);
    expect(result.imageScale).toBe(2.5);
  });

  it('produces NaN for a non-numeric --image-scale (validated later)', () => {
    const result = parseArgs(['--image-scale', 'big']);
    expect(Number.isNaN(result.imageScale)).toBe(true);
  });

  it('parses a combination of flags', () => {
    const result = parseArgs([
      '--file-url',
      VALID_URL,
      '--token=figd_xxx',
      '--naming',
      'camel',
      '--no-tailwind',
      '--image-format=svg',
      '--image-scale',
      '4',
    ]);
    expect(result).toEqual({
      fileUrl: VALID_URL,
      token: 'figd_xxx',
      namingConvention: 'camel',
      useTailwind: false,
      imageFormat: 'svg',
      imageScale: 4,
    });
  });

  it('ignores --config and its value', () => {
    const result = parseArgs(['--config', './figma.config.json', '--token', 't']);
    expect(result).toEqual({ token: 't' });
    expect((result as Record<string, unknown>).config).toBeUndefined();
  });

  it('ignores --config=value form', () => {
    const result = parseArgs(['--config=./figma.config.json', '--token=t']);
    expect(result).toEqual({ token: 't' });
  });

  it('ignores --help', () => {
    expect(parseArgs(['--help'])).toEqual({});
  });

  it('throws CliError for unknown flags', () => {
    expect(() => parseArgs(['--bogus', 'x'])).toThrow(CliError);
  });

  it('throws CliError when a value flag is missing its value', () => {
    expect(() => parseArgs(['--token'])).toThrow(CliError);
  });

  it('throws CliError for unexpected positional arguments', () => {
    expect(() => parseArgs(['positional'])).toThrow(CliError);
  });
});

describe('getConfigPath', () => {
  it('returns undefined when --config is absent', () => {
    expect(getConfigPath(['--token', 't'])).toBeUndefined();
  });

  it('reads --config space form', () => {
    expect(getConfigPath(['--config', './a.json'])).toBe('./a.json');
  });

  it('reads --config=value form', () => {
    expect(getConfigPath(['--config=./b.json'])).toBe('./b.json');
  });

  it('throws CliError when --config has no value', () => {
    expect(() => getConfigPath(['--config'])).toThrow(CliError);
  });
});

describe('isHelpRequested', () => {
  it('detects --help and -h', () => {
    expect(isHelpRequested(['--help'])).toBe(true);
    expect(isHelpRequested(['-h'])).toBe(true);
    expect(isHelpRequested(['--token', 't'])).toBe(false);
  });
});

describe('buildConfig', () => {
  it('builds a validated config from CLI flags only', () => {
    const config = buildConfig(
      ['--file-url', VALID_URL, '--token', 'figd_xxx'],
      { env: {} }
    );
    expect(config.fileUrl).toBe(VALID_URL);
    expect(config.token).toBe('figd_xxx');
    // Defaults applied by ConfigLoader.
    expect(config.namingConvention).toBe('pascal');
    expect(config.imageFormat).toBe('png');
  });

  it('loads a --config file as the file source', () => {
    const fileContents = JSON.stringify({
      fileUrl: VALID_URL,
      token: 'from-file',
      namingConvention: 'kebab',
    });
    const readFile = jest.fn().mockReturnValue(fileContents);

    const config = buildConfig(['--config', './figma.config.json'], {
      readFile,
      env: {},
    });

    expect(readFile).toHaveBeenCalledWith('./figma.config.json');
    expect(config.fileUrl).toBe(VALID_URL);
    expect(config.token).toBe('from-file');
    expect(config.namingConvention).toBe('kebab');
  });

  it('lets CLI flags override config file values', () => {
    const fileContents = JSON.stringify({
      fileUrl: VALID_URL,
      token: 'from-file',
      namingConvention: 'kebab',
    });
    const readFile = jest.fn().mockReturnValue(fileContents);

    const config = buildConfig(
      ['--config', './figma.config.json', '--naming', 'camel', '--token', 'from-cli'],
      { readFile, env: {} }
    );

    expect(config.namingConvention).toBe('camel');
    expect(config.token).toBe('from-cli');
  });

  it('falls back to FIGMA_TOKEN env var when no token is provided', () => {
    const config = buildConfig(['--file-url', VALID_URL], {
      env: { FIGMA_TOKEN: 'from-env' },
    });
    expect(config.token).toBe('from-env');
  });

  it('prefers a CLI token over the env var', () => {
    const config = buildConfig(['--file-url', VALID_URL, '--token', 'from-cli'], {
      env: { FIGMA_TOKEN: 'from-env' },
    });
    expect(config.token).toBe('from-cli');
  });

  it('throws CliError when the config file cannot be read', () => {
    const readFile = jest.fn(() => {
      throw new Error('ENOENT');
    });
    expect(() =>
      buildConfig(['--config', './missing.json'], { readFile, env: {} })
    ).toThrow(CliError);
  });

  it('throws CliError when the config file is not valid JSON', () => {
    const readFile = jest.fn().mockReturnValue('{ not json');
    expect(() =>
      buildConfig(['--config', './bad.json'], { readFile, env: {} })
    ).toThrow(CliError);
  });

  it('throws CliError when the config file is not a JSON object', () => {
    const readFile = jest.fn().mockReturnValue('[1, 2, 3]');
    expect(() =>
      buildConfig(['--config', './arr.json'], { readFile, env: {} })
    ).toThrow(CliError);
  });

  it('throws ConfigValidationError for an invalid resolved config', () => {
    // Missing fileUrl and token → validation fails.
    expect(() => buildConfig([], { env: {} })).toThrow(ConfigValidationError);
  });
});
