/**
 * Property-Based Tests for RGBA to CSS Color Conversion
 * Task 6.10: Write property test for RGBA conversion
 * 
 * **Validates: Requirements 5.2**
 * Property 15: For any Figma RGBA color value (where channels are in 0-1 range),
 * the conversion to CSS SHALL produce a valid rgba() or rgb() string with 
 * channels scaled to 0-255 for RGB and 0-1 for alpha.
 */

import { StyleExtractor } from '../../lib/figma-import/core/style-extractor';
import { Color } from '../../lib/figma-import/types/figma-api';
import * as fc from 'fast-check';

describe('Property-Based Test: RGBA to CSS Color Conversion', () => {
  let extractor: StyleExtractor;

  beforeEach(() => {
    extractor = new StyleExtractor();
  });

  /**
   * Property 15: RGBA to CSS Color Conversion
   * **Validates: Requirements 5.2**
   * 
   * For any Figma RGBA color value (where channels are in 0-1 range),
   * the conversion to CSS SHALL produce a valid rgba() or rgb() string
   * with channels scaled to 0-255 for RGB and 0-1 for alpha.
   */
  it('property test: RGBA conversion should always produce valid CSS color strings', () => {
    fc.assert(
      fc.property(
        // Generate random RGBA colors with channels in 0-1 range (Figma format)
        fc.record({
          r: fc.double({ min: 0, max: 1, noNaN: true }),
          g: fc.double({ min: 0, max: 1, noNaN: true }),
          b: fc.double({ min: 0, max: 1, noNaN: true }),
          a: fc.double({ min: 0, max: 1, noNaN: true }),
        }),
        (color: Color) => {
          const result = extractor.rgbaToCSS(color);

          // Property 1: Result must be a non-empty string
          expect(typeof result).toBe('string');
          expect(result.length).toBeGreaterThan(0);

          // Property 2: RGB channels must be scaled to 0-255 range
          const expectedR = Math.round(color.r * 255);
          const expectedG = Math.round(color.g * 255);
          const expectedB = Math.round(color.b * 255);

          // Property 3: Alpha must remain in 0-1 range
          const expectedA = color.a;

          // Property 4: For fully opaque colors (a === 1), use rgb() format
          if (color.a === 1) {
            expect(result).toMatch(/^rgb\(\d+, \d+, \d+\)$/);
            expect(result).toBe(`rgb(${expectedR}, ${expectedG}, ${expectedB})`);
          } else {
            // Property 5: For transparent colors (a !== 1), use rgba() format with 3 decimal places
            expect(result).toMatch(/^rgba\(\d+, \d+, \d+, \d+\.\d{3}\)$/);
            expect(result).toBe(`rgba(${expectedR}, ${expectedG}, ${expectedB}, ${expectedA.toFixed(3)})`);
          }

          // Property 6: RGB values must be within valid range [0, 255]
          const rgbMatch = result.match(/rgba?\((\d+), (\d+), (\d+)/);
          expect(rgbMatch).not.toBeNull();
          if (rgbMatch) {
            const [, r, g, b] = rgbMatch;
            expect(parseInt(r)).toBeGreaterThanOrEqual(0);
            expect(parseInt(r)).toBeLessThanOrEqual(255);
            expect(parseInt(g)).toBeGreaterThanOrEqual(0);
            expect(parseInt(g)).toBeLessThanOrEqual(255);
            expect(parseInt(b)).toBeGreaterThanOrEqual(0);
            expect(parseInt(b)).toBeLessThanOrEqual(255);
          }

          // Property 7: If alpha is present, it must be within valid range [0, 1]
          if (!result.startsWith('rgb(')) {
            const alphaMatch = result.match(/rgba\(\d+, \d+, \d+, ([\d.]+)\)/);
            expect(alphaMatch).not.toBeNull();
            if (alphaMatch) {
              const alpha = parseFloat(alphaMatch[1]);
              expect(alpha).toBeGreaterThanOrEqual(0);
              expect(alpha).toBeLessThanOrEqual(1);
            }
          }
        }
      ),
      { numRuns: 1000 } // Run 1000 random tests
    );
  });

  it('property test: edge cases for RGBA conversion', () => {
    fc.assert(
      fc.property(
        // Test specific edge case values
        fc.constantFrom(
          { r: 0, g: 0, b: 0, a: 0 }, // Fully transparent black
          { r: 0, g: 0, b: 0, a: 1 }, // Fully opaque black
          { r: 1, g: 1, b: 1, a: 0 }, // Fully transparent white
          { r: 1, g: 1, b: 1, a: 1 }, // Fully opaque white
          { r: 0.5, g: 0.5, b: 0.5, a: 0.5 }, // Mid-gray, semi-transparent
          { r: 1, g: 0, b: 0, a: 1 }, // Pure red
          { r: 0, g: 1, b: 0, a: 1 }, // Pure green
          { r: 0, g: 0, b: 1, a: 1 }, // Pure blue
          { r: 1, g: 1, b: 0, a: 1 }, // Yellow
          { r: 1, g: 0, b: 1, a: 1 }, // Magenta
          { r: 0, g: 1, b: 1, a: 1 }, // Cyan
        ),
        (color: Color) => {
          const result = extractor.rgbaToCSS(color);

          // Verify the result is a valid CSS color string
          expect(result).toMatch(/^rgba?\(\d+, \d+, \d+(?:, \d+\.\d{3})?\)$/);

          // Verify correct scaling
          const expectedR = Math.round(color.r * 255);
          const expectedG = Math.round(color.g * 255);
          const expectedB = Math.round(color.b * 255);

          if (color.a === 1) {
            expect(result).toBe(`rgb(${expectedR}, ${expectedG}, ${expectedB})`);
          } else {
            expect(result).toBe(`rgba(${expectedR}, ${expectedG}, ${expectedB}, ${color.a.toFixed(3)})`);
          }
        }
      )
    );
  });

  it('property test: RGBA conversion is deterministic', () => {
    fc.assert(
      fc.property(
        fc.record({
          r: fc.double({ min: 0, max: 1, noNaN: true }),
          g: fc.double({ min: 0, max: 1, noNaN: true }),
          b: fc.double({ min: 0, max: 1, noNaN: true }),
          a: fc.double({ min: 0, max: 1, noNaN: true }),
        }),
        (color: Color) => {
          // Property: Calling rgbaToCSS multiple times with the same input
          // should always produce the same output (determinism)
          const result1 = extractor.rgbaToCSS(color);
          const result2 = extractor.rgbaToCSS(color);
          const result3 = extractor.rgbaToCSS(color);

          expect(result1).toBe(result2);
          expect(result2).toBe(result3);
        }
      ),
      { numRuns: 500 }
    );
  });
});
