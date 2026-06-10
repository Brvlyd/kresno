/**
 * Property-Based Tests for Component Variant Props
 * Task 10.8: Write property test for variant props
 *
 * **Validates: Requirements 7.7**
 * Property 25: Component Variant Props
 * For any Figma component with variants, the Component_Generator SHALL generate
 * a TypeScript props interface including union types for each variant property.
 *
 * Implementation under test:
 *   lib/figma-import/core/component-generator.ts
 *   ComponentGenerator.generatePropsInterface(frame, componentName)
 */

import * as fc from 'fast-check';
import { ComponentGenerator } from '../../lib/figma-import/core/component-generator';
import { toCamelCase, sanitizeComponentName } from '../../lib/figma-import/utils/name-sanitizer';
import { ParsedFrame, VariantProperty } from '../../lib/figma-import/types/internal-models';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const CLASSNAME_LINE = '  className?: string;';
const CHILDREN_LINE = '  children?: React.ReactNode;';

/**
 * Build a minimal ParsedFrame carrying the supplied variant metadata.
 * generatePropsInterface only reads `frame.variants`, but the rest of the
 * structure is filled in to satisfy the ParsedFrame type.
 */
function makeFrame(variants: VariantProperty[] | undefined): ParsedFrame {
  return {
    id: 'frame-1',
    name: 'Frame',
    sanitizedName: 'Frame',
    nodeType: 'component',
    layout: { display: 'flex' },
    styles: { className: 'frame', cssProperties: {} },
    children: [],
    variants,
  };
}

/**
 * Mirror of the generator's single-quoted string-literal escaping:
 * backslashes first, then single quotes.
 */
function escapeContent(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/**
 * Replicate the generator's value -> union-member transformation:
 * trim, drop empties, escape, de-duplicate preserving order.
 */
function expectedMembers(values: string[]): string[] {
  const seen = new Set<string>();
  const members: string[] = [];
  for (const value of values) {
    if (value === undefined || value === null) continue;
    const trimmed = String(value).trim();
    if (trimmed.length === 0) continue;
    const literal = `'${escapeContent(trimmed)}'`;
    if (seen.has(literal)) continue;
    seen.add(literal);
    members.push(literal);
  }
  return members;
}

/** The prop line the generator should emit for a variant, or null if dropped. */
function expectedVariantLine(variant: VariantProperty): string | null {
  const members = expectedMembers(variant.values || []);
  if (members.length === 0) return null;
  const propName = toCamelCase(variant.propertyName ?? '');
  return `  ${propName}?: ${members.join(' | ')};`;
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

// Variant values: mix of plain values, empties/whitespace, values needing
// escaping, and arbitrary strings. The small constant pools encourage
// duplicates so de-duplication is exercised.
const variantValueArb = fc.oneof(
  fc.constantFrom('primary', 'secondary', 'tertiary', 'sm', 'md', 'lg', 'default'),
  fc.constantFrom('', '   ', '\t', '  \n  '),
  fc.constantFrom("it's", "qu'ote", 'back\\slash', "both\\'mix", "'wrapped'"),
  fc.string({ minLength: 0, maxLength: 6 })
);

// Property names: includes names that require sanitization (spaces, hyphens,
// punctuation, leading digits, reserved words) plus arbitrary strings.
const propertyNameArb = fc.oneof(
  fc.constantFrom(
    'variant',
    'size',
    'color',
    'State',
    'my variant',
    'my-variant',
    'data type',
    '2cool',
    'class',
    'with.dot',
    'foo!@#bar'
  ),
  fc.string({ minLength: 1, maxLength: 8 })
);

const variantArb: fc.Arbitrary<VariantProperty> = fc.record({
  propertyName: propertyNameArb,
  values: fc.array(variantValueArb, { minLength: 1, maxLength: 6 }),
});

const variantsArb = fc.array(variantArb, { minLength: 1, maxLength: 4 });

// Component name: any valid PascalCase component identifier.
const componentNameArb = fc
  .string({ minLength: 1, maxLength: 10 })
  .map((s) => sanitizeComponentName(s));

// ---------------------------------------------------------------------------
// Shared structural assertions
// ---------------------------------------------------------------------------

function assertInterfaceShape(result: string, componentName: string): string[] {
  // Starts with the interface declaration.
  expect(result.startsWith(`interface ${componentName}Props {`)).toBe(true);

  // Ends with a closing brace.
  expect(result.trimEnd().endsWith('}')).toBe(true);

  const lines = result.split('\n');

  // First line is the declaration, the closing brace exists.
  expect(lines[0]).toBe(`interface ${componentName}Props {`);
  expect(lines).toContain('}');

  // Every property line (between decl and brace) ends with a semicolon.
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;
    if (trimmed.startsWith('interface ')) continue;
    if (trimmed === '}') continue;
    expect(trimmed.endsWith(';')).toBe(true);
  }

  // className? and children? are always present.
  expect(lines).toContain(CLASSNAME_LINE);
  expect(lines).toContain(CHILDREN_LINE);

  return lines;
}

/** Parse the single-quoted union members out of a variant prop line. */
function parseUnionMembers(line: string): string[] {
  const idx = line.indexOf('?: ');
  const rhs = line.slice(idx + 3).replace(/;$/, '');
  return rhs.split(' | ');
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Property-Based Test: Component Variant Props (Property 25)', () => {
  let generator: ComponentGenerator;

  beforeEach(() => {
    generator = new ComponentGenerator();
  });

  /**
   * Property 25: Component Variant Props
   * **Validates: Requirements 7.7**
   *
   * For any component with variant definitions, the generated props interface
   * contains a union-typed optional prop for each variant property (with a
   * sanitized name and de-duplicated, escaped, non-empty string-literal
   * members), is syntactically plausible, and always carries className?/children?.
   */
  it('generates union-typed props for each variant property', () => {
    fc.assert(
      fc.property(componentNameArb, variantsArb, (componentName, variants) => {
        const frame = makeFrame(variants);
        const result = generator.generatePropsInterface(frame, componentName);

        const lines = assertInterfaceShape(result, componentName);

        for (const variant of variants) {
          const expectedLine = expectedVariantLine(variant);

          if (expectedLine === null) {
            // A variant whose values are all empty/whitespace contributes no line.
            continue;
          }

          // The interface contains a line for this variant property.
          expect(lines).toContain(expectedLine);

          // Each union member is a single-quoted string literal and the
          // members within this prop are unique.
          const members = parseUnionMembers(expectedLine);
          const memberSet = new Set(members);
          expect(memberSet.size).toBe(members.length);
          for (const member of members) {
            expect(member.startsWith("'")).toBe(true);
            expect(member.endsWith("'")).toBe(true);
          }

          // Each union member corresponds to an actual provided value
          // (in escaped form) and there are no extras.
          const expected = expectedMembers(variant.values);
          expect(members).toEqual(expected);
        }
      }),
      { numRuns: 500 }
    );
  });

  /**
   * Every emitted union member must trace back to one of the originally
   * provided variant values (escaped + trimmed form), guaranteeing no
   * literals are invented.
   */
  it('only emits union members drawn from the provided values', () => {
    fc.assert(
      fc.property(componentNameArb, variantsArb, (componentName, variants) => {
        const frame = makeFrame(variants);
        const result = generator.generatePropsInterface(frame, componentName);

        for (const variant of variants) {
          const expectedLine = expectedVariantLine(variant);
          if (expectedLine === null) continue;

          // Allowed literal set derived from the provided values.
          const allowed = new Set(
            variant.values
              .filter((v) => v !== undefined && v !== null && String(v).trim().length > 0)
              .map((v) => `'${escapeContent(String(v).trim())}'`)
          );

          const members = parseUnionMembers(expectedLine);
          for (const member of members) {
            expect(allowed.has(member)).toBe(true);
          }
        }
      }),
      { numRuns: 500 }
    );
  });

  /**
   * Components with no variants (undefined or empty array) produce only the
   * default className?/children? props.
   */
  it('produces only className?/children? when there are no variants', () => {
    fc.assert(
      fc.property(
        componentNameArb,
        fc.oneof(fc.constant(undefined), fc.constant([] as VariantProperty[])),
        (componentName, variants) => {
          const frame = makeFrame(variants);
          const result = generator.generatePropsInterface(frame, componentName);

          const lines = assertInterfaceShape(result, componentName);

          // The only property lines are className? and children?.
          const propLines = lines
            .map((l) => l.trim())
            .filter((l) => l.length > 0 && !l.startsWith('interface ') && l !== '}');

          expect(propLines).toEqual([
            CLASSNAME_LINE.trim(),
            CHILDREN_LINE.trim(),
          ]);
        }
      ),
      { numRuns: 200 }
    );
  });
});
