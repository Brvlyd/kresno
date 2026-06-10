/**
 * Property-Based Tests for Filename Collision Resolution
 * Task 8.6: Write property test for collision resolution
 *
 * **Validates: Requirements 6.6**
 * Property 21: Filename Collision Resolution
 *   For any set of nodes with duplicate names, the Asset_Downloader SHALL
 *   generate unique filenames by appending numeric suffixes (-1, -2, etc.)
 *   in order of processing.
 *
 * Implementation under test:
 *   resolveFilenameCollision(desiredFilename, usedNames)
 *   in lib/figma-import/utils/filename-collision.ts
 */

import { resolveFilenameCollision } from '../../lib/figma-import/utils/filename-collision';
import * as fc from 'fast-check';

/**
 * Smart generator for a structured filename made of a base name and an
 * extension. The base name is restricted to lowercase alphanumeric characters
 * (no '.' and no '-'), which keeps the file extension unambiguous and prevents
 * a suffixed name (e.g. "a-1.png") from ever colliding with a generated
 * original filename. A small pool of base names and extensions is used so that
 * duplicate filenames are produced frequently, exercising the collision logic.
 */
const filePartArb = fc.record({
  base: fc.constantFrom('a', 'b', 'c', 'logo', 'icon', 'photo', 'image', 'btn'),
  ext: fc.constantFrom('.png', '.jpg', '.svg', '.webp', ''),
});

type FilePart = { base: string; ext: string };

const filePart = (p: FilePart): string => `${p.base}${p.ext}`;

/**
 * A batch of (possibly duplicate) filenames. minLength 1 ensures we always have
 * at least one filename to process; the small input space guarantees collisions.
 */
const batchArb = fc.array(filePartArb, { minLength: 1, maxLength: 40 });

describe('Property-Based Test: Filename Collision Resolution (Property 21)', () => {
  /**
   * Property 21 (combined): Processing a batch of duplicate filenames yields a
   * fully unique set, preserves extensions, returns unchanged names when there
   * is no collision, and follows the -1, -2, -3 ... suffix pattern.
   *
   * **Validates: Requirements 6.6**
   */
  it('produces unique, extension-preserving, sequentially-suffixed filenames for duplicate batches', () => {
    fc.assert(
      fc.property(batchArb, (parts) => {
        const used = new Set<string>();
        const produced: string[] = [];
        // Tracks how many times each original filename has been seen so far,
        // which dictates the expected suffix for the next occurrence.
        const occurrences = new Map<string, number>();

        for (const part of parts) {
          const original = filePart(part);
          const wasUsed = used.has(original);

          const result = resolveFilenameCollision(original, used);

          // When a name is not already used, it is returned unchanged.
          if (!wasUsed) {
            expect(result).toBe(original);
          }

          // The produced filename preserves the original file extension.
          if (part.ext !== '') {
            expect(result.endsWith(part.ext)).toBe(true);
          } else {
            // No extension on input => no dot introduced on output.
            expect(result.includes('.')).toBe(false);
          }

          // Suffixes follow the -1, -2, -3 ... pattern inserted before the ext.
          const seen = occurrences.get(original) ?? 0;
          const expected =
            seen === 0 ? original : `${part.base}-${seen}${part.ext}`;
          expect(result).toBe(expected);
          occurrences.set(original, seen + 1);

          // The result must be unique relative to everything produced so far.
          expect(used.has(result)).toBe(false);

          used.add(result);
          produced.push(result);
        }

        // The final set of produced filenames are ALL unique.
        expect(new Set(produced).size).toBe(produced.length);
      }),
      { numRuns: 1000 }
    );
  });

  /**
   * Uniqueness holds for arbitrary string filenames, not just the structured
   * generator. Regardless of what filenames are processed, iteratively
   * resolving and recording each result never yields a collision.
   *
   * **Validates: Requirements 6.6**
   */
  it('guarantees global uniqueness for arbitrary filename batches', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 1, maxLength: 12 }), {
          minLength: 1,
          maxLength: 40,
        }),
        (names) => {
          const used = new Set<string>();
          for (const name of names) {
            const result = resolveFilenameCollision(name, used);
            // Never returns a name that is already in use.
            expect(used.has(result)).toBe(false);
            used.add(result);
          }
          // Every produced name is distinct.
          expect(used.size).toBe(names.length);
        }
      ),
      { numRuns: 1000 }
    );
  });

  /**
   * Determinism: for the same (desiredFilename, usedNames) input, the function
   * always returns the same result.
   *
   * **Validates: Requirements 6.6**
   */
  it('is deterministic for the same (name, usedNames) input', () => {
    fc.assert(
      fc.property(
        filePartArb,
        fc.array(filePartArb, { maxLength: 20 }),
        (target, others) => {
          const original = filePart(target);
          const usedNames = others.map(filePart);

          const a = resolveFilenameCollision(original, new Set(usedNames));
          const b = resolveFilenameCollision(original, new Set(usedNames));
          const c = resolveFilenameCollision(original, new Set(usedNames));

          expect(a).toBe(b);
          expect(b).toBe(c);
        }
      ),
      { numRuns: 500 }
    );
  });

  /**
   * The suffix pattern increments strictly (-1, -2, -3 ...) when the same name
   * is resolved repeatedly and each result is recorded as used.
   *
   * **Validates: Requirements 6.6**
   */
  it('appends strictly increasing numeric suffixes before the extension', () => {
    fc.assert(
      fc.property(
        filePartArb,
        fc.integer({ min: 1, max: 25 }),
        (part, repeats) => {
          const original = filePart(part);
          const used = new Set<string>();
          const results: string[] = [];

          for (let i = 0; i < repeats; i++) {
            const result = resolveFilenameCollision(original, used);
            used.add(result);
            results.push(result);
          }

          // First occurrence is unchanged; subsequent ones are base-i+ext.
          expect(results[0]).toBe(original);
          for (let i = 1; i < repeats; i++) {
            expect(results[i]).toBe(`${part.base}-${i}${part.ext}`);
          }

          // All unique.
          expect(new Set(results).size).toBe(results.length);
        }
      ),
      { numRuns: 500 }
    );
  });
});
