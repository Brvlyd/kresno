/**
 * Property-Based Test for Gradient to CSS Conversion
 * Task 6.14: Write property test for gradient conversion
 * 
 * **Validates: Requirements 5.5**
 * Property 17: For any gradient fill, the conversion SHALL produce valid CSS 
 * linear-gradient() or radial-gradient() syntax with correct color stops and angles.
 */

import { StyleExtractor } from '../../lib/figma-import/core/style-extractor';
import { Paint, Color, GradientStop } from '../../lib/figma-import/types/figma-api';
import * as fc from 'fast-check';

describe('StyleExtractor - Property: Gradient to CSS Conversion', () => {
  let extractor: StyleExtractor;

  beforeEach(() => {
    extractor = new StyleExtractor();
  });

  // Generator for valid RGBA color (0-1 range)
  const colorArb = fc.record({
    r: fc.double({ min: 0, max: 1, noNaN: true }),
    g: fc.double({ min: 0, max: 1, noNaN: true }),
    b: fc.double({ min: 0, max: 1, noNaN: true }),
    a: fc.double({ min: 0, max: 1, noNaN: true }),
  });

  // Generator for gradient stop (position 0-1, color)
  const gradientStopArb: fc.Arbitrary<GradientStop> = fc.record({
    position: fc.double({ min: 0, max: 1, noNaN: true }),
    color: colorArb,
  });

  // Generator for linear gradient paint
  const linearGradientArb = fc.record({
    type: fc.constant('GRADIENT_LINEAR' as const),
    gradientStops: fc.array(gradientStopArb, { minLength: 2, maxLength: 10 }),
    visible: fc.option(fc.boolean(), { nil: undefined }),
    opacity: fc.option(fc.double({ min: 0, max: 1 }), { nil: undefined }),
  });

  // Generator for radial gradient paint
  const radialGradientArb = fc.record({
    type: fc.constant('GRADIENT_RADIAL' as const),
    gradientStops: fc.array(gradientStopArb, { minLength: 2, maxLength: 10 }),
    visible: fc.option(fc.boolean(), { nil: undefined }),
    opacity: fc.option(fc.double({ min: 0, max: 1 }), { nil: undefined }),
  });

  // Generator for angular gradient paint
  const angularGradientArb = fc.record({
    type: fc.constant('GRADIENT_ANGULAR' as const),
    gradientStops: fc.array(gradientStopArb, { minLength: 2, maxLength: 10 }),
    visible: fc.option(fc.boolean(), { nil: undefined }),
    opacity: fc.option(fc.double({ min: 0, max: 1 }), { nil: undefined }),
  });

  // Generator for any gradient type
  const gradientArb = fc.oneof(
    linearGradientArb,
    radialGradientArb,
    angularGradientArb
  );

  it('property: linear gradient should produce valid linear-gradient() syntax', () => {
    fc.assert(
      fc.property(linearGradientArb, (paint) => {
        const result = extractor.gradientToCSS(paint);

        // Property 1: Result should be a non-null string
        expect(result).not.toBeNull();
        expect(typeof result).toBe('string');

        // Property 2: Should start with "linear-gradient("
        expect(result).toMatch(/^linear-gradient\(/);

        // Property 3: Should end with ")"
        expect(result).toMatch(/\)$/);

        // Property 4: Should contain angle specification
        expect(result).toMatch(/^linear-gradient\(\d+deg,/);

        // Property 5: Should contain color stops
        expect(result).toContain('rgb');

        // Property 6: Number of color stops should match input
        const colorStopMatches = result!.match(/rgb(a)?\([^)]+\)/g);
        expect(colorStopMatches).not.toBeNull();
        expect(colorStopMatches!.length).toBe(paint.gradientStops.length);

        // Property 7: Each color stop should have a position percentage
        const stopPattern = /rgb(a)?\([^)]+\)\s+\d+(\.\d+)?%/g;
        const stops = result!.match(stopPattern);
        expect(stops).not.toBeNull();
        expect(stops!.length).toBe(paint.gradientStops.length);
      }),
      { numRuns: 100 }
    );
  });

  it('property: radial gradient should produce valid radial-gradient() syntax', () => {
    fc.assert(
      fc.property(radialGradientArb, (paint) => {
        const result = extractor.gradientToCSS(paint);

        // Property 1: Result should be a non-null string
        expect(result).not.toBeNull();
        expect(typeof result).toBe('string');

        // Property 2: Should start with "radial-gradient("
        expect(result).toMatch(/^radial-gradient\(/);

        // Property 3: Should end with ")"
        expect(result).toMatch(/\)$/);

        // Property 4: Should contain "circle" shape specification
        expect(result).toMatch(/^radial-gradient\(circle,/);

        // Property 5: Should contain color stops
        expect(result).toContain('rgb');

        // Property 6: Number of color stops should match input
        const colorStopMatches = result!.match(/rgb(a)?\([^)]+\)/g);
        expect(colorStopMatches).not.toBeNull();
        expect(colorStopMatches!.length).toBe(paint.gradientStops.length);

        // Property 7: Each color stop should have a position percentage
        const stopPattern = /rgb(a)?\([^)]+\)\s+\d+(\.\d+)?%/g;
        const stops = result!.match(stopPattern);
        expect(stops).not.toBeNull();
        expect(stops!.length).toBe(paint.gradientStops.length);
      }),
      { numRuns: 100 }
    );
  });

  it('property: angular gradient should produce valid conic-gradient() syntax', () => {
    fc.assert(
      fc.property(angularGradientArb, (paint) => {
        const result = extractor.gradientToCSS(paint);

        // Property 1: Result should be a non-null string
        expect(result).not.toBeNull();
        expect(typeof result).toBe('string');

        // Property 2: Should start with "conic-gradient("
        expect(result).toMatch(/^conic-gradient\(/);

        // Property 3: Should end with ")"
        expect(result).toMatch(/\)$/);

        // Property 4: Should contain color stops
        expect(result).toContain('rgb');

        // Property 5: Number of color stops should match input
        const colorStopMatches = result!.match(/rgb(a)?\([^)]+\)/g);
        expect(colorStopMatches).not.toBeNull();
        expect(colorStopMatches!.length).toBe(paint.gradientStops.length);

        // Property 6: Each color stop should have a position percentage
        const stopPattern = /rgb(a)?\([^)]+\)\s+\d+(\.\d+)?%/g;
        const stops = result!.match(stopPattern);
        expect(stops).not.toBeNull();
        expect(stops!.length).toBe(paint.gradientStops.length);
      }),
      { numRuns: 100 }
    );
  });

  it('property: color stop positions should be correctly converted to percentages', () => {
    fc.assert(
      fc.property(gradientArb, (paint) => {
        const result = extractor.gradientToCSS(paint);
        expect(result).not.toBeNull();

        // Extract positions from the CSS gradient string
        const positionPattern = /(\d+\.\d+)%/g;
        const positions: number[] = [];
        let match;
        while ((match = positionPattern.exec(result!)) !== null) {
          positions.push(parseFloat(match[1]));
        }

        // Property: Number of positions should match number of gradient stops
        expect(positions.length).toBe(paint.gradientStops.length);

        // Property: Each position should be in valid range [0, 100]
        positions.forEach((pos) => {
          expect(pos).toBeGreaterThanOrEqual(0);
          expect(pos).toBeLessThanOrEqual(100);
        });

        // Property: Positions should match input stops (scaled to percentage)
        paint.gradientStops.forEach((stop, index) => {
          const expectedPosition = parseFloat((stop.position * 100).toFixed(1));
          expect(positions[index]).toBeCloseTo(expectedPosition, 1);
        });
      }),
      { numRuns: 100 }
    );
  });

  it('property: gradient with empty stops array should return null', () => {
    const emptyLinearGradient: Paint = {
      type: 'GRADIENT_LINEAR',
      gradientStops: [],
    };

    const result = extractor.gradientToCSS(emptyLinearGradient);
    expect(result).toBeNull();

    const emptyRadialGradient: Paint = {
      type: 'GRADIENT_RADIAL',
      gradientStops: [],
    };

    const result2 = extractor.gradientToCSS(emptyRadialGradient);
    expect(result2).toBeNull();
  });

  it('property: gradient without stops property should return null', () => {
    const noStopsGradient: Paint = {
      type: 'GRADIENT_LINEAR',
    };

    const result = extractor.gradientToCSS(noStopsGradient);
    expect(result).toBeNull();
  });

  it('property: color stops should be in correct order', () => {
    fc.assert(
      fc.property(gradientArb, (paint) => {
        const result = extractor.gradientToCSS(paint);
        expect(result).not.toBeNull();

        // Extract color values from gradient
        const colorPattern = /rgb(a)?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)\s+(\d+\.\d+)%/g;
        const extractedStops: Array<{ r: number; g: number; b: number; position: number }> = [];
        
        let match;
        while ((match = colorPattern.exec(result!)) !== null) {
          extractedStops.push({
            r: parseInt(match[2]),
            g: parseInt(match[3]),
            b: parseInt(match[4]),
            position: parseFloat(match[6]),
          });
        }

        // Property: Order of color stops should match input order
        expect(extractedStops.length).toBe(paint.gradientStops.length);
        
        paint.gradientStops.forEach((stop, index) => {
          const expectedR = Math.round(stop.color.r * 255);
          const expectedG = Math.round(stop.color.g * 255);
          const expectedB = Math.round(stop.color.b * 255);
          const expectedPos = parseFloat((stop.position * 100).toFixed(1));

          expect(extractedStops[index].r).toBe(expectedR);
          expect(extractedStops[index].g).toBe(expectedG);
          expect(extractedStops[index].b).toBe(expectedB);
          expect(extractedStops[index].position).toBeCloseTo(expectedPos, 1);
        });
      }),
      { numRuns: 50 }
    );
  });

  it('property: gradient conversion should be deterministic', () => {
    fc.assert(
      fc.property(gradientArb, (paint) => {
        // Property: Calling gradientToCSS multiple times with the same input
        // should always produce the same output (determinism)
        const result1 = extractor.gradientToCSS(paint);
        const result2 = extractor.gradientToCSS(paint);
        const result3 = extractor.gradientToCSS(paint);

        expect(result1).toBe(result2);
        expect(result2).toBe(result3);
      }),
      { numRuns: 100 }
    );
  });

  it('property: edge case gradients should be handled correctly', () => {
    // Test specific edge cases
    const edgeCases: Paint[] = [
      // Two-stop linear gradient (minimum)
      {
        type: 'GRADIENT_LINEAR',
        gradientStops: [
          { position: 0, color: { r: 0, g: 0, b: 0, a: 1 } },
          { position: 1, color: { r: 1, g: 1, b: 1, a: 1 } },
        ],
      },
      // Gradient with semi-transparent colors
      {
        type: 'GRADIENT_LINEAR',
        gradientStops: [
          { position: 0, color: { r: 1, g: 0, b: 0, a: 0.5 } },
          { position: 0.5, color: { r: 0, g: 1, b: 0, a: 0.3 } },
          { position: 1, color: { r: 0, g: 0, b: 1, a: 0.8 } },
        ],
      },
      // Gradient with many stops
      {
        type: 'GRADIENT_RADIAL',
        gradientStops: [
          { position: 0, color: { r: 1, g: 0, b: 0, a: 1 } },
          { position: 0.2, color: { r: 1, g: 0.5, b: 0, a: 1 } },
          { position: 0.4, color: { r: 1, g: 1, b: 0, a: 1 } },
          { position: 0.6, color: { r: 0, g: 1, b: 0, a: 1 } },
          { position: 0.8, color: { r: 0, g: 0, b: 1, a: 1 } },
          { position: 1, color: { r: 0.5, g: 0, b: 0.5, a: 1 } },
        ],
      },
      // Gradient with identical positions (edge case)
      {
        type: 'GRADIENT_LINEAR',
        gradientStops: [
          { position: 0.5, color: { r: 1, g: 0, b: 0, a: 1 } },
          { position: 0.5, color: { r: 0, g: 0, b: 1, a: 1 } },
        ],
      },
    ];

    edgeCases.forEach((paint) => {
      const result = extractor.gradientToCSS(paint);
      
      expect(result).not.toBeNull();
      expect(typeof result).toBe('string');
      
      // Should contain valid gradient syntax
      if (paint.type === 'GRADIENT_LINEAR') {
        expect(result).toMatch(/^linear-gradient\(/);
      } else if (paint.type === 'GRADIENT_RADIAL') {
        expect(result).toMatch(/^radial-gradient\(/);
      } else if (paint.type === 'GRADIENT_ANGULAR') {
        expect(result).toMatch(/^conic-gradient\(/);
      }

      // Should have correct number of color stops
      const colorStops = result!.match(/rgb(a)?\([^)]+\)/g);
      expect(colorStops).not.toBeNull();
      expect(colorStops!.length).toBe(paint.gradientStops!.length);
    });
  });

  it('property: solid paint should return null for gradientToCSS', () => {
    const solidPaint: Paint = {
      type: 'SOLID',
      color: { r: 0.5, g: 0.5, b: 0.5, a: 1 },
    };

    const result = extractor.gradientToCSS(solidPaint);
    expect(result).toBeNull();
  });

  it('property: all gradient types should produce parseable CSS', () => {
    fc.assert(
      fc.property(gradientArb, (paint) => {
        const result = extractor.gradientToCSS(paint);
        expect(result).not.toBeNull();

        // Property: Result should be parseable as CSS
        // A valid CSS gradient should:
        // 1. Start with gradient function name
        // 2. Have balanced parentheses
        // 3. Contain color stops with positions

        const openParens = (result!.match(/\(/g) || []).length;
        const closeParens = (result!.match(/\)/g) || []).length;
        expect(openParens).toBe(closeParens);

        // Should match general gradient pattern
        expect(result).toMatch(/^(linear|radial|conic)-gradient\(.+\)$/);
      }),
      { numRuns: 100 }
    );
  });
});
