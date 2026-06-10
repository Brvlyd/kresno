/**
 * Tests for ConfigLoader
 */

import {
  ConfigLoader,
  ConfigValidationError,
  ConfigLoadOptions,
  DEFAULT_OUTPUT_DIR,
  DEFAULT_USE_TAILWIND,
  DEFAULT_NAMING_CONVENTION,
  FIGMA_TOKEN_ENV_VAR,
} from '../../lib/figma-import/core/config-loader';
import {
  DEFAULT_ASSETS_DIR,
  DEFAULT_IMAGE_FORMAT,
  DEFAULT_IMAGE_SCALE,
} from '../../lib/figma-import/core/asset-downloader';
import { ImportConfig } from '../../lib/figma-import/types/config';

const VALID_URL = 'https://www.figma.com/file/ABC123/MyDesign';

describe('ConfigLoader', () => {
  let loader: ConfigLoader;

  beforeEach(() => {
    loader = new ConfigLoader();
  });

  describe('resolve - defaults', () => {
    it('applies all documented defaults when only required fields are provided', () => {
      const config = loader.resolve({
        file: { fileUrl: VALID_URL, token: 'figd_token' },
        env: {},
      });

      expect(config.outputDir).toBe(DEFAULT_OUTPUT_DIR);
      expect(config.assetsDir).toBe(DEFAULT_ASSETS_DIR);
      expect(config.useTailwind).toBe(DEFAULT_USE_TAILWIND);
      expect(config.namingConvention).toBe(DEFAULT_NAMING_CONVENTION);
      expect(config.imageFormat).toBe(DEFAULT_IMAGE_FORMAT);
      expect(config.imageScale).toBe(DEFAULT_IMAGE_SCALE);
    });

    it('preserves provided optional values instead of overwriting with defaults', () => {
      const config = loader.resolve({
        file: {
          fileUrl: VALID_URL,
          token: 'figd_token',
          outputDir: 'src/ui',
          assetsDir: 'assets',
          useTailwind: false,
          namingConvention: 'kebab',
          imageFormat: 'svg',
          imageScale: 1,
        },
        env: {},
      });

      expect(config.outputDir).toBe('src/ui');
      expect(config.assetsDir).toBe('assets');
      expect(config.useTailwind).toBe(false);
      expect(config.namingConvention).toBe('kebab');
      expect(config.imageFormat).toBe('svg');
      expect(config.imageScale).toBe(1);
    });

    it('treats useTailwind=false as an explicit value, not missing', () => {
      const config = loader.resolve({
        file: { fileUrl: VALID_URL, token: 'figd_token', useTailwind: false },
        env: {},
      });
      expect(config.useTailwind).toBe(false);
    });
  });

  describe('resolve - precedence', () => {
    it('CLI overrides beat config file values', () => {
      const config = loader.resolve({
        file: {
          fileUrl: VALID_URL,
          token: 'file_token',
          namingConvention: 'pascal',
          imageScale: 2,
        },
        cli: {
          token: 'cli_token',
          namingConvention: 'camel',
          imageScale: 3,
        },
        env: {},
      });

      expect(config.token).toBe('cli_token');
      expect(config.namingConvention).toBe('camel');
      expect(config.imageScale).toBe(3);
    });

    it('falls back to file values when CLI omits a field', () => {
      const config = loader.resolve({
        file: { fileUrl: VALID_URL, token: 'file_token' },
        cli: { outputDir: 'cli/out' },
        env: {},
      });

      expect(config.token).toBe('file_token');
      expect(config.outputDir).toBe('cli/out');
    });
  });

  describe('resolve - token env fallback', () => {
    it('uses the FIGMA_TOKEN env var when token is not otherwise provided', () => {
      const config = loader.resolve({
        file: { fileUrl: VALID_URL },
        env: { [FIGMA_TOKEN_ENV_VAR]: 'env_token' },
      });
      expect(config.token).toBe('env_token');
    });

    it('prefers explicit token over the env var', () => {
      const config = loader.resolve({
        file: { fileUrl: VALID_URL, token: 'file_token' },
        env: { [FIGMA_TOKEN_ENV_VAR]: 'env_token' },
      });
      expect(config.token).toBe('file_token');
    });
  });

  describe('load - validation', () => {
    const base: ConfigLoadOptions = {
      file: { fileUrl: VALID_URL, token: 'figd_token' },
      env: {},
    };

    it('returns a fully-resolved config for valid input', () => {
      const config: ImportConfig = loader.load(base);
      expect(config.fileUrl).toBe(VALID_URL);
      expect(config.token).toBe('figd_token');
      expect(config.namingConvention).toBe('pascal');
    });

    it('throws ConfigValidationError when fileUrl is missing', () => {
      expect(() => loader.load({ file: { token: 'figd_token' }, env: {} })).toThrow(
        ConfigValidationError
      );
    });

    it('throws when fileUrl is not a valid Figma URL', () => {
      expect(() =>
        loader.load({
          file: { fileUrl: 'https://example.com/x', token: 'figd_token' },
          env: {},
        })
      ).toThrow(/not a valid Figma file URL/);
    });

    it('throws when token is missing from all sources', () => {
      expect(() => loader.load({ file: { fileUrl: VALID_URL }, env: {} })).toThrow(
        new RegExp(FIGMA_TOKEN_ENV_VAR)
      );
    });

    it('throws when namingConvention is invalid', () => {
      expect(() =>
        loader.load({
          file: { ...base.file, namingConvention: 'snake' as never },
          env: {},
        })
      ).toThrow(/namingConvention/);
    });

    it('throws when imageFormat is invalid', () => {
      expect(() =>
        loader.load({
          file: { ...base.file, imageFormat: 'gif' as never },
          env: {},
        })
      ).toThrow(/imageFormat/);
    });

    it('throws when imageScale is out of range', () => {
      expect(() =>
        loader.load({ file: { ...base.file, imageScale: 10 }, env: {} })
      ).toThrow(/imageScale/);
    });

    it('throws when imageScale is not a finite number', () => {
      expect(() =>
        loader.load({ file: { ...base.file, imageScale: NaN }, env: {} })
      ).toThrow(/imageScale/);
    });

    it('aggregates multiple validation errors', () => {
      try {
        loader.load({
          file: { imageScale: -1, namingConvention: 'bad' as never },
          env: {},
        });
        fail('expected ConfigValidationError');
      } catch (err) {
        expect(err).toBeInstanceOf(ConfigValidationError);
        const e = err as ConfigValidationError;
        // missing fileUrl, missing token, bad naming, bad scale
        expect(e.errors.length).toBeGreaterThanOrEqual(4);
      }
    });
  });
});

/**
 * Task 13.3 - Unit tests for configuration loading.
 *
 * Covers the config-file / CLI-argument / override / environment-variable
 * matrix end-to-end through ConfigLoader.load() and .resolve().
 *
 * Requirements: 10.1 (config object for output directory paths),
 *               10.2 (component naming-convention configuration).
 */
describe('ConfigLoader - configuration loading matrix (Task 13.3)', () => {
  let loader: ConfigLoader;

  beforeEach(() => {
    loader = new ConfigLoader();
  });

  describe('loading from a config file', () => {
    it('produces a fully-resolved config from a complete config file object (Req 10.1, 10.2)', () => {
      const fileConfig: Partial<ImportConfig> = {
        fileUrl: VALID_URL,
        token: 'figd_file_token',
        outputDir: 'src/generated/components',
        assetsDir: 'src/generated/assets',
        useTailwind: false,
        namingConvention: 'kebab',
        imageFormat: 'jpg',
        imageScale: 1,
      };

      const config = loader.load({ file: fileConfig, env: {} });

      expect(config).toEqual<ImportConfig>({
        fileUrl: VALID_URL,
        token: 'figd_file_token',
        outputDir: 'src/generated/components',
        assetsDir: 'src/generated/assets',
        useTailwind: false,
        namingConvention: 'kebab',
        imageFormat: 'jpg',
        imageScale: 1,
      });
    });

    it('fills missing optional fields with defaults when the config file only sets required fields (Req 10.1)', () => {
      const config = loader.load({
        file: { fileUrl: VALID_URL, token: 'figd_file_token' },
        env: {},
      });

      expect(config.outputDir).toBe(DEFAULT_OUTPUT_DIR);
      expect(config.assetsDir).toBe(DEFAULT_ASSETS_DIR);
      expect(config.useTailwind).toBe(DEFAULT_USE_TAILWIND);
      expect(config.namingConvention).toBe(DEFAULT_NAMING_CONVENTION);
      expect(config.imageFormat).toBe(DEFAULT_IMAGE_FORMAT);
      expect(config.imageScale).toBe(DEFAULT_IMAGE_SCALE);
    });

    it('reads the output directory path from the config file (Req 10.1)', () => {
      const config = loader.load({
        file: { fileUrl: VALID_URL, token: 'figd_file_token', outputDir: 'app/ui/figma' },
        env: {},
      });
      expect(config.outputDir).toBe('app/ui/figma');
    });

    it('reads the naming convention from the config file (Req 10.2)', () => {
      const config = loader.load({
        file: { fileUrl: VALID_URL, token: 'figd_file_token', namingConvention: 'camel' },
        env: {},
      });
      expect(config.namingConvention).toBe('camel');
    });
  });

  describe('loading from CLI arguments', () => {
    it('produces a fully-resolved config from CLI arguments alone (Req 10.1, 10.2)', () => {
      const cliArgs: Partial<ImportConfig> = {
        fileUrl: VALID_URL,
        token: 'figd_cli_token',
        outputDir: 'cli/components',
        assetsDir: 'cli/assets',
        useTailwind: true,
        namingConvention: 'pascal',
        imageFormat: 'png',
        imageScale: 4,
      };

      const config = loader.load({ cli: cliArgs, env: {} });

      expect(config).toEqual<ImportConfig>({
        fileUrl: VALID_URL,
        token: 'figd_cli_token',
        outputDir: 'cli/components',
        assetsDir: 'cli/assets',
        useTailwind: true,
        namingConvention: 'pascal',
        imageFormat: 'png',
        imageScale: 4,
      });
    });

    it('applies defaults for fields the CLI omits (Req 10.1)', () => {
      const config = loader.load({
        cli: { fileUrl: VALID_URL, token: 'figd_cli_token' },
        env: {},
      });

      expect(config.outputDir).toBe(DEFAULT_OUTPUT_DIR);
      expect(config.assetsDir).toBe(DEFAULT_ASSETS_DIR);
      expect(config.namingConvention).toBe(DEFAULT_NAMING_CONVENTION);
    });

    it('reads the naming convention from CLI arguments (Req 10.2)', () => {
      const config = loader.load({
        cli: { fileUrl: VALID_URL, token: 'figd_cli_token', namingConvention: 'kebab' },
        env: {},
      });
      expect(config.namingConvention).toBe('kebab');
    });
  });

  describe('CLI arguments override config file values', () => {
    it('CLI values win over config file values across token, namingConvention, outputDir, imageScale, and useTailwind (Req 10.1, 10.2)', () => {
      const file: Partial<ImportConfig> = {
        fileUrl: VALID_URL,
        token: 'figd_file_token',
        outputDir: 'file/components',
        assetsDir: 'file/assets',
        useTailwind: false,
        namingConvention: 'pascal',
        imageFormat: 'svg',
        imageScale: 1,
      };
      const cli: Partial<ImportConfig> = {
        token: 'figd_cli_token',
        outputDir: 'cli/components',
        useTailwind: true,
        namingConvention: 'camel',
        imageScale: 3,
      };

      const config = loader.load({ file, cli, env: {} });

      // Overridden by CLI
      expect(config.token).toBe('figd_cli_token');
      expect(config.outputDir).toBe('cli/components');
      expect(config.useTailwind).toBe(true);
      expect(config.namingConvention).toBe('camel');
      expect(config.imageScale).toBe(3);

      // Not overridden -> retained from file
      expect(config.fileUrl).toBe(VALID_URL);
      expect(config.assetsDir).toBe('file/assets');
      expect(config.imageFormat).toBe('svg');
    });

    it('CLI useTailwind=true overrides config file useTailwind=false (Req 10.1)', () => {
      const config = loader.load({
        file: { fileUrl: VALID_URL, token: 'figd_token', useTailwind: false },
        cli: { useTailwind: true },
        env: {},
      });
      expect(config.useTailwind).toBe(true);
    });

    it('CLI useTailwind=false overrides config file useTailwind=true (Req 10.1)', () => {
      const config = loader.load({
        file: { fileUrl: VALID_URL, token: 'figd_token', useTailwind: true },
        cli: { useTailwind: false },
        env: {},
      });
      expect(config.useTailwind).toBe(false);
    });

    it('CLI naming convention overrides config file naming convention (Req 10.2)', () => {
      const config = loader.load({
        file: { fileUrl: VALID_URL, token: 'figd_token', namingConvention: 'pascal' },
        cli: { namingConvention: 'kebab' },
        env: {},
      });
      expect(config.namingConvention).toBe('kebab');
    });
  });

  describe('environment variable for token', () => {
    it('uses the FIGMA_TOKEN environment variable when no token is given via CLI or file', () => {
      const config = loader.load({
        file: { fileUrl: VALID_URL },
        env: { [FIGMA_TOKEN_ENV_VAR]: 'figd_env_token' },
      });
      expect(config.token).toBe('figd_env_token');
    });

    it('a config-file token takes precedence over the environment variable', () => {
      const config = loader.load({
        file: { fileUrl: VALID_URL, token: 'figd_file_token' },
        env: { [FIGMA_TOKEN_ENV_VAR]: 'figd_env_token' },
      });
      expect(config.token).toBe('figd_file_token');
    });

    it('a CLI token takes precedence over both the config file and the environment variable', () => {
      const config = loader.load({
        file: { fileUrl: VALID_URL, token: 'figd_file_token' },
        cli: { token: 'figd_cli_token' },
        env: { [FIGMA_TOKEN_ENV_VAR]: 'figd_env_token' },
      });
      expect(config.token).toBe('figd_cli_token');
    });

    it('fails validation when the env var is the only token source but is absent', () => {
      expect(() =>
        loader.load({ file: { fileUrl: VALID_URL }, env: {} })
      ).toThrow(new RegExp(FIGMA_TOKEN_ENV_VAR));
    });
  });
});
