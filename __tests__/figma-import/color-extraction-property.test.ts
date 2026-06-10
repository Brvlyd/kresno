/**
 * Property-Based Test for Color Extraction Completeness
 * Task 6.8: Write property test for color extraction completeness
 * 
 * **Validates: Requirements 5.1, 5.3**
 * Property 14: For any node with fill or stroke colors, the Style_Extractor 
 * SHALL extract all color values including named color styles defined in the file.
 */

import { StyleExtractor } from '../../lib/figma-import/core/style-extractor';
import { Paint } from '../../lib/figma-import/types/figma-api';
import * as fc from 'fast-check';

describe('StyleExtractor - Property: Color Extraction Completeness', () => {
  let extractor: StyleExtractor;

  beforeEach(() => {
    extractor = new StyleExtractor();
  });

  // Generator for valid RGBA color (0-1 range)
  // Using noNaN: true to exclude NaN values which Figma API wouldn't produce
  const colorArb = fc.record({
    r: fc.double({ min: 0, max: 1, noNaN: true }),
    g: fc.double({ min: 0, max: 1, noNaN: true }),
    b: fc.double({ min: 0, max: 1, noNaN: true }),
    a: fc.double({ min: 0, max: 1, noNaN: true }),
  });

  // Generator for visible solid paint with color
  const solidPaintArb = fc.record({
    type: fc.constant('SOLID' as const),
    color: colorArb,
    visible: fc.option(fc.boolean(), { nil: undefined }),
  });

  // Generator for gradient paint (should be ignored by extractColors)
  const gradientPaintArb = fc.oneof(
    fc.record({
      type: fc.constant('GRADIENT_LINEAR' as const),
      gradientStops: fc.array(
        fc.record({
          position: fc.double({ min: 0, max: 1 }),
          color: colorArb,
        }),
        { minLength: 0, maxLength: 5 }
      ),
    }),
    fc.record({
      type: fc.constant('GRADIENT_RADIAL' as const),
      gradientStops: fc.array(
        fc.record({
          position: fc.double({ min: 0, max: 1 }),
          color: colorArb,
        }),
        { minLength: 0, maxLength: 5 }
      ),
    })
  );

  // Generator for paint array (mix of solid and gradient paints)
  const paintsArb: fc.Arbitrary<Paint[]> = fc.array(
    fc.oneof(solidPaintArb, gradientPaintArb),
    { minLength: 0, maxLength: 10 }
  );

  it('property: should extract all visible solid colors from fills', () => {
    fc.assert(
      fc.property(paintsArb, (fills) => {
        // Extract colors using the style extractor
        const extractedColors = extractor.extractColors(fills);

        // Count expected visible solid colors
        const expectedColors = fills.filter(
          (fill) =>
            fill.type === 'SOLID' &&
            fill.color &&
            fill.visible !== false
        );

        // Property: Number of extracted colors should match number of visible solid fills
        expect(extractedColors.length).toBe(expectedColors.length);

        // Property: Each extracted color should be a valid CSS color string
        extractedColors.forEach((color) => {
          expect(color).toMatch(/^(rgb|rgba)\(\d+,\s*\d+,\s*\d+/);
        });

        // Property: Each expected color should be present in extracted colors
        expectedColors.forEach((fill, index) => {
          if (fill.type === 'SOLID' && fill.color) {
            const expectedCss = extractor.rgbaToCSS(fill.color);
            expect(extractedColors[index]).toBe(expectedCss);
          }
        });
      }),
      { numRuns: 100 } // Run 100 random test cases
    );
  });

  it('property: should extract colors from both fills and strokes', () => {
    fc.assert(
      fc.property(paintsArb, paintsArb, (fills, strokes) => {
        // Extract colors from fills
        const fillColors = extractor.extractColors(fills);

        // Extract colors from strokes
        const strokeColors = extractor.extractColors(strokes);

        // Count expected visible solid colors in fills
        const expectedFillCount = fills.filter(
          (fill) => fill.type === 'SOLID' && fill.color && fill.visible !== false
        ).length;

        // Count expected visible solid colors in strokes
        const expectedStrokeCount = strokes.filter(
          (stroke) => stroke.type === 'SOLID' && stroke.color && stroke.visible !== false
        ).length;

        // Property: Extracted counts should match expected counts
        expect(fillColors.length).toBe(expectedFillCount);
        expect(strokeColors.length).toBe(expectedStrokeCount);

        // Property: Total colors extracted equals sum of fills and strokes
        const totalExtracted = fillColors.length + strokeColors.length;
        const totalExpected = expectedFillCount + expectedStrokeCount;
        expect(totalExtracted).toBe(totalExpected);
      }),
      { numRuns: 100 }
    );
  });

  it('property: should not extract colors from invisible fills', () => {
    fc.assert(
      fc.property(paintsArb, (fills) => {
        // Mark some fills as invisible
        const fillsWithVisibility = fills.map((fill) => ({
          ...fill,
          visible: fill.visible === false ? false : true,
        }));

        const extractedColors = extractor.extractColors(fillsWithVisibility);

        // Property: Extracted colors should only come from visible fills
        const invisibleSolidCount = fillsWithVisibility.filter(
          (fill) => fill.type === 'SOLID' && fill.color && fill.visible === false
        ).length;

        const visibleSolidCount = fillsWithVisibility.filter(
          (fill) => fill.type === 'SOLID' && fill.color && fill.visible !== false
        ).length;

        expect(extractedColors.length).toBe(visibleSolidCount);
        expect(extractedColors.length).toBeLessThanOrEqual(fills.length - invisibleSolidCount);
      }),
      { numRuns: 100 }
    );
  });

  it('property: should not extract colors from gradient fills', () => {
    fc.assert(
      fc.property(paintsArb, (paints) => {
        const extractedColors = extractor.extractColors(paints);

        // Property: No gradient colors should be in extracted colors
        const solidCount = paints.filter(
          (paint) => paint.type === 'SOLID' && paint.color && paint.visible !== false
        ).length;

        // Extracted colors should only be from solid fills, not gradients
        expect(extractedColors.length).toBe(solidCount);
      }),
      { numRuns: 100 }
    );
  });

  it('property: extracted colors should be valid CSS format', () => {
    fc.assert(
      fc.property(paintsArb, (fills) => {
        const extractedColors = extractor.extractColors(fills);

        // Property: All extracted colors should be valid CSS rgba() or rgb() strings
        extractedColors.forEach((color) => {
          // Should match either rgb(r, g, b) or rgba(r, g, b, a) format
          const rgbPattern = /^rgb\(\d{1,3},\s*\d{1,3},\s*\d{1,3}\)$/;
          const rgbaPattern = /^rgba\(\d{1,3},\s*\d{1,3},\s*\d{1,3},\s*[\d.]+\)$/;
          
          expect(color).toMatch(new RegExp(`(${rgbPattern.source})|(${rgbaPattern.source})`));
        });
      }),
      { numRuns: 100 }
    );
  });

  it('property: should preserve color order from fills array', () => {
    fc.assert(
      fc.property(
        fc.array(solidPaintArb, { minLength: 2, maxLength: 5 }),
        (fills) => {
          // Ensure all are visible
          const visibleFills = fills.map(fill => ({ ...fill, visible: true }));
          
          const extractedColors = extractor.extractColors(visibleFills);

          // Property: Order of extracted colors should match order of fills
          visibleFills.forEach((fill, index) => {
            if (fill.type === 'SOLID' && fill.color) {
              const expectedColor = extractor.rgbaToCSS(fill.color);
              expect(extractedColors[index]).toBe(expectedColor);
            }
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('property: should handle edge case colors correctly', () => {
    // Test specific edge cases within property test
    const edgeCases: Paint[] = [
      // Pure black
      { type: 'SOLID', color: { r: 0, g: 0, b: 0, a: 1 } },
      // Pure white
      { type: 'SOLID', color: { r: 1, g: 1, b: 1, a: 1 } },
      // Fully transparent
      { type: 'SOLID', color: { r: 0.5, g: 0.5, b: 0.5, a: 0 } },
      // Semi-transparent
      { type: 'SOLID', color: { r: 0.5, g: 0.5, b: 0.5, a: 0.5 } },
    ];

    const extractedColors = extractor.extractColors(edgeCases);

    // Property: Should extract all edge case colors
    expect(extractedColors.length).toBe(4);
    expect(extractedColors[0]).toBe('rgb(0, 0, 0)');
    expect(extractedColors[1]).toBe('rgb(255, 255, 255)');
    expect(extractedColors[2]).toMatch(/^rgba\(128,\s*128,\s*128,\s*0\.000\)$/);
    expect(extractedColors[3]).toMatch(/^rgba\(128,\s*128,\s*128,\s*0\.500\)$/);
  });
});
