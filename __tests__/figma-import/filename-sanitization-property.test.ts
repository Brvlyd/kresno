/**
 * Property-Based Tests for Filename Sanitization
 * Task 8.4: Write property test for filename sanitization
 *
 * **Validates: Requirements 6.4**
 * Property 19: For any node name, the Asset_Downloader SHALL generate a valid
 * filename by converting to lowercase, replacing spaces with hyphens, and
 * removing special characters.
 */

import {
  generateAssetFilename,
  sanitizeFileName,
} from '../../lib/figma-import/utils/name-sanitizer';
import * as fc from 'fast-check';

// Characters that are reserved/invalid on common filesystems (Windows/macOS/Linux).
const RESERVED_CHARS_REGEX = /[<>:"/\\|?*]/;
// Any whitespace character.
const WHITESPACE_REGEX = /\s/;

/**
 * An arbitrary that produces "interesting" node names. It mixes:
 *  - arbitrary unicode strings (fast-check default `fc.string` covers ASCII;
 *    we also fold in unicode + reserved characters explicitly)
 *  - filesystem-reserved characters (< > : " / \ | ? *)
 *  - whitespace and separator characters
 *  - empty / whitespace-only strings
 */
const nodeNameArbitrary = fc.oneof(
  // Plain arbitrary strings (includes ASCII letters, digits, punctuation).
  fc.string(),
  // Strings drawn from a unit set rich in reserved chars, separators, and unicode.
  fc.array(
    fc.constantFrom(
      ...'abcXYZ0129'.split(''),
      ...'<>:"/\\|?*'.split(''),
      ...' \t\n_-.#@!$%^&()'.split(''),
      'é', 'ü', 'ñ', '中', '文', '🚀', 'Ω', 'ß'
    ),
    { maxLength: 30 }
  ).map((chars) => chars.join('')),
  // Explicit edge cases.
  fc.constantFrom('', '   ', '\t\n', '---', '___', '!@#$%^&*()', '/\\:*?"<>|')
);

// Valid image formats supported by the importer.
const validFormatArbitrary = fc.constantFrom('png', 'jpg', 'jpeg', 'svg', 'gif', 'webp');

/**
 * Splits a generated filename into its base (everything before the final dot)
 * and extension. When no dot is present the whole string is the base.
 */
function splitFilename(filename: string): { base: string; ext: string | null } {
  const idx = filename.lastIndexOf('.');
  if (idx === -1) {
    return { base: filename, ext: null };
  }
  return { base: filename.slice(0, idx), ext: filename.slice(idx + 1) };
}

describe('Property-Based Test: Filename Sanitization (Property 19)', () => {
  /**
   * Property 19: Filename Sanitization
   * **Validates: Requirements 6.4**
   *
   * For any node name and any valid format, generateAssetFilename produces a
   * filesystem-safe filename that satisfies all sanitization invariants.
   */
  it('property test: generated filenames satisfy all sanitization invariants', () => {
    fc.assert(
      fc.property(nodeNameArbitrary, validFormatArbitrary, (nodeName, format) => {
        const result = generateAssetFilename(nodeName, format);

        // Invariant: non-empty output.
        expect(result.length).toBeGreaterThan(0);

        // Invariant: never contains filesystem-reserved characters.
        expect(result).not.toMatch(RESERVED_CHARS_REGEX);

        // Invariant: never contains whitespace.
        expect(result).not.toMatch(WHITESPACE_REGEX);

        // Invariant: output is lowercase.
        expect(result).toBe(result.toLowerCase());

        const { base, ext } = splitFilename(result);

        // Invariant: a valid format always yields the normalized extension.
        expect(ext).toBe(format.toLowerCase());

        // Invariant: base is non-empty (falls back to 'unnamed' when empty).
        expect(base.length).toBeGreaterThan(0);

        // Invariant: base has no leading or trailing hyphen.
        expect(base.startsWith('-')).toBe(false);
        expect(base.endsWith('-')).toBe(false);

        // Invariant: base has no consecutive hyphens.
        expect(base).not.toMatch(/--/);

        // Invariant: base only contains lowercase letters, digits, and hyphens.
        expect(base).toMatch(/^[a-z0-9-]+$/);
      }),
      { numRuns: 1000 }
    );
  });

  /**
   * Determinism: the same input always maps to the same output.
   */
  it('property test: filename generation is deterministic', () => {
    fc.assert(
      fc.property(nodeNameArbitrary, validFormatArbitrary, (nodeName, format) => {
        const a = generateAssetFilename(nodeName, format);
        const b = generateAssetFilename(nodeName, format);
        const c = generateAssetFilename(nodeName, format);
        expect(a).toBe(b);
        expect(b).toBe(c);
      }),
      { numRuns: 500 }
    );
  });

  /**
   * sanitizeFileName (the base sanitizer) upholds the same character invariants
   * independent of any extension handling.
   */
  it('property test: sanitizeFileName never emits reserved chars or whitespace and is non-empty', () => {
    fc.assert(
      fc.property(nodeNameArbitrary, (nodeName) => {
        const result = sanitizeFileName(nodeName);

        expect(result.length).toBeGreaterThan(0);
        expect(result).not.toMatch(RESERVED_CHARS_REGEX);
        expect(result).not.toMatch(WHITESPACE_REGEX);
        expect(result).toBe(result.toLowerCase());
        expect(result.startsWith('-')).toBe(false);
        expect(result.endsWith('-')).toBe(false);
        expect(result).not.toMatch(/--/);
        // Only lowercase letters, digits, and hyphens remain.
        expect(result).toMatch(/^[a-z0-9-]+$/);
      }),
      { numRuns: 1000 }
    );
  });

  /**
   * When a valid format is supplied, the output always ends with the normalized
   * extension (lowercased), regardless of the node name.
   */
  it('property test: output always carries the normalized extension for a valid format', () => {
    fc.assert(
      fc.property(
        nodeNameArbitrary,
        fc.constantFrom('PNG', 'Png', 'png', 'JPG', 'svg', 'WEBP'),
        (nodeName, format) => {
          const result = generateAssetFilename(nodeName, format);
          expect(result.endsWith(`.${format.toLowerCase()}`)).toBe(true);
        }
      ),
      { numRuns: 500 }
    );
  });
});
