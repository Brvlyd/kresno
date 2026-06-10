/**
 * Property-Based Tests for Configuration Defaults
 * Task 13.2: Write property test for configuration defaults
 *
 * **Property 35: Configuration Defaults**
 * **Validates: Requirements 10.6**
 *
 * For any configuration with missing optional values, the Figma_Importer
 * (via ConfigLoader.resolve) SHALL apply the documented default values
 * (pascal naming, PNG format, 2x scale, etc.) while preserving any optional
 * value that was explicitly provided.
 */

import * as fc from 'fast-check';
import {
  ConfigLoader,
  DEFAULT_OUTPUT_DIR,
  DEFAULT_USE_TAILWIND,
  DEFAULT_NAMING_CONVENTION,
} from '../../lib/figma-import/core/config-loader';
import {
  DEFAULT_ASSETS_DIR,
  DEFAULT_IMAGE_FORMAT,
  DEFAULT_IMAGE_SCALE,
} from '../../lib/figma-import/core/asset-downloader';
import { ImportConfig } from '../../lib/figma-import/types/config';

const VALID_URL = 'https://www.figma.com/file/ABC123/MyDesign';

/**
 * The optional fields that ConfigLoader applies defaults for, paired with the
 * documented default constant each one falls back to. `fileUrl`/`token` are
 * required (or env-sourced) and are not part of the defaulting contract under
 * test here.
 */
const DEFAULTS = {
  outputDir: DEFAULT_OUTPUT_DIR,
  assetsDir: DEFAULT_ASSETS_DIR,
  useTailwind: DEFAULT_USE_TAILWIND,
  namingConvention: DEFAULT_NAMING_CONVENTION,
  imageFormat: DEFAULT_IMAGE_FORMAT,
  imageScale: DEFAULT_IMAGE_SCALE,
} as const;

type OptionalKey = keyof typeof DEFAULTS;

const OPTIONAL_KEYS = Object.keys(DEFAULTS) as OptionalKey[];

/**
 * Generators that produce explicit, non-default-equal values for each optional
 * field, so that "provided value preserved" is meaningfully distinguishable
 * from "default applied". Notably `useTailwind` can be `false` (the falsy value
 * that must NOT be treated as missing).
 */
const valueArb: { [K in OptionalKey]: fc.Arbitrary<ImportConfig[K]> } = {
  outputDir: fc
    .string({ minLength: 1, maxLength: 20 })
    .filter((s) => s.trim().length > 0)
    .map((s) => `out/${s.replace(/\s/g, '_')}`),
  assetsDir: fc
    .string({ minLength: 1, maxLength: 20 })
    .filter((s) => s.trim().length > 0)
    .map((s) => `assets/${s.replace(/\s/g, '_')}`),
  useTailwind: fc.boolean(),
  namingConvention: fc.constantFrom<ImportConfig['namingConvention']>(
    'pascal',
    'kebab',
    'camel'
  ),
  imageFormat: fc.constantFrom<ImportConfig['imageFormat']>('png', 'jpg', 'svg'),
  imageScale: fc.double({ min: 0.5, max: 4, noNaN: true }),
};

/**
 * Build a partial config from a record describing, per optional key, whether
 * that key is present (with a generated value) or absent.
 */
function buildPartial(
  selection: { [K in OptionalKey]: { present: boolean; value: ImportConfig[K] } }
): Partial<ImportConfig> {
  const partial: Partial<ImportConfig> = {};
  for (const key of OPTIONAL_KEYS) {
    if (selection[key].present) {
      // Assigning each key with its own typed value.
      (partial as Record<string, unknown>)[key] = selection[key].value;
    }
  }
  return partial;
}

/**
 * Arbitrary producing a per-key selection of present/absent + a candidate value.
 */
const selectionArb = fc.record(
  OPTIONAL_KEYS.reduce(
    (acc, key) => {
      acc[key] = fc.record({
        present: fc.boolean(),
        value: valueArb[key] as fc.Arbitrary<ImportConfig[OptionalKey]>,
      });
      return acc;
    },
    {} as Record<
      OptionalKey,
      fc.Arbitrary<{ present: boolean; value: ImportConfig[OptionalKey] }>
    >
  )
) as fc.Arbitrary<{
  [K in OptionalKey]: { present: boolean; value: ImportConfig[K] };
}>;

describe('Property-Based Test: Configuration Defaults (Property 35)', () => {
  let loader: ConfigLoader;

  beforeEach(() => {
    loader = new ConfigLoader();
  });

  /**
   * Property 35: Configuration Defaults
   * **Validates: Requirements 10.6**
   *
   * For any partial config (random subset of optional fields present/absent),
   * resolve() produces a complete config where:
   *  - every field is defined (no undefined),
   *  - omitted optional fields equal their documented default,
   *  - provided optional fields are preserved exactly (including useTailwind=false).
   */
  it('applies defaults for omitted fields and preserves provided fields', () => {
    fc.assert(
      fc.property(selectionArb, (selection) => {
        const filePartial = buildPartial(selection);
        const config = loader.resolve({
          file: { fileUrl: VALID_URL, token: 'figd_token', ...filePartial },
          env: {},
        });

        // No field in the resolved config is undefined.
        for (const key of Object.keys(config) as (keyof ImportConfig)[]) {
          expect(config[key]).toBeDefined();
        }

        // Each optional field is either the provided value or the default.
        for (const key of OPTIONAL_KEYS) {
          if (selection[key].present) {
            // Provided value preserved exactly (not overwritten by default).
            expect(config[key]).toBe(selection[key].value);
          } else {
            // Omitted -> documented default applied.
            expect(config[key]).toBe(DEFAULTS[key]);
          }
        }
      }),
      { numRuns: 1000 }
    );
  });

  /**
   * useTailwind=false must be treated as an explicit value, never as "missing".
   * This guards against `||`-style defaulting that would clobber the falsy
   * boolean with the default `true`.
   */
  it('treats useTailwind=false as explicitly provided, not missing', () => {
    fc.assert(
      fc.property(fc.constant(false), (provided) => {
        const config = loader.resolve({
          file: { fileUrl: VALID_URL, token: 'figd_token', useTailwind: provided },
          env: {},
        });
        expect(config.useTailwind).toBe(false);
      }),
      { numRuns: 10 }
    );
  });

  /**
   * Precedence: when both file and CLI provide the same optional field, the
   * resolved value equals the CLI value (CLI > file). When CLI omits a field
   * but file provides it, the file value wins over the default.
   */
  it('honors CLI > file > default precedence for optional fields', () => {
    fc.assert(
      fc.property(
        selectionArb,
        selectionArb,
        (fileSel, cliSel) => {
          const filePartial = buildPartial(fileSel);
          const cliPartial = buildPartial(cliSel);
          const config = loader.resolve({
            file: { fileUrl: VALID_URL, token: 'figd_token', ...filePartial },
            cli: cliPartial,
            env: {},
          });

          for (const key of OPTIONAL_KEYS) {
            if (cliSel[key].present) {
              // CLI wins regardless of file.
              expect(config[key]).toBe(cliSel[key].value);
            } else if (fileSel[key].present) {
              // File wins when CLI omits.
              expect(config[key]).toBe(fileSel[key].value);
            } else {
              // Neither provided -> default.
              expect(config[key]).toBe(DEFAULTS[key]);
            }
          }
        }
      ),
      { numRuns: 1000 }
    );
  });

  /**
   * Determinism: resolving the same inputs repeatedly yields identical configs.
   */
  it('is deterministic for identical inputs', () => {
    fc.assert(
      fc.property(selectionArb, (selection) => {
        const filePartial = buildPartial(selection);
        const options = {
          file: { fileUrl: VALID_URL, token: 'figd_token', ...filePartial },
          env: {} as Record<string, string | undefined>,
        };

        const a = loader.resolve(options);
        const b = loader.resolve(options);

        expect(a).toEqual(b);
      }),
      { numRuns: 500 }
    );
  });
});
