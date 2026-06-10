/**
 * Property-Based Test for React Component Generation
 * Task 10.2: Write property test for React component generation
 *
 * **Property 22: React Component Generation**
 * **Validates: Requirements 7.1, 7.2, 7.4, 7.5**
 *
 * For any frame or component node, the Component_Generator SHALL generate a
 * syntactically valid React functional component with proper TypeScript type
 * definitions, appropriate HTML elements, and className properties for styling.
 *
 * Strategy: generate random parsed component structures (frames with nested
 * children of various node types and arbitrary depth/breadth) and assert
 * structural invariants on the generated React/TypeScript output.
 */

import {
  ComponentGenerator,
  GeneratorOptions,
} from '../../lib/figma-import/core/component-generator';
import {
  ParsedFrame,
  ParsedNode,
  LayoutInfo,
  StyleInfo,
} from '../../lib/figma-import/types/internal-models';
import * as fc from 'fast-check';

// ---------------------------------------------------------------------------
// Generators
//
// NOTE (fast-check v4): `fc.stringOf` does not exist. Use
// `fc.string({ unit: fc.constantFrom(...) })` to build strings from a custom
// character set. Numeric generators use `noNaN: true` so NaN is never produced.
// ---------------------------------------------------------------------------

const LETTERS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const NAME_CHARS = (
  'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 -_'
).split('');
// Text content / className are inserted into the generated source verbatim, so
// keep them free of braces/parens/quotes that would otherwise affect structural
// balance. This keeps the property focused on the generator's own structure.
const SAFE_TEXT_CHARS = (
  'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 '
).split('');
const CLASS_NAME_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789- '.split('');

// A name that always sanitizes to a valid identifier: it starts with a letter,
// so PascalCase/camelCase/kebab-case conversions all yield a non-empty result.
const nameArb: fc.Arbitrary<string> = fc
  .tuple(
    fc.constantFrom(...LETTERS),
    fc.string({ unit: fc.constantFrom(...NAME_CHARS), maxLength: 15 })
  )
  .map(([first, rest]) => first + rest);

const safeTextArb = fc.string({
  unit: fc.constantFrom(...SAFE_TEXT_CHARS),
  maxLength: 20,
});

const classNameArb = fc.string({
  unit: fc.constantFrom(...CLASS_NAME_CHARS),
  maxLength: 15,
});

const idArb = fc
  .tuple(fc.integer({ min: 1, max: 9999 }), fc.integer({ min: 1, max: 9999 }))
  .map(([a, b]) => `${a}:${b}`);

const dimensionArb = fc.option(
  fc.double({ min: 0, max: 5000, noNaN: true }),
  { nil: undefined }
);

const layoutArb: fc.Arbitrary<LayoutInfo> = fc.record({
  display: fc.constantFrom('flex', 'block', 'inline-block', 'none'),
  flexDirection: fc.option(fc.constantFrom('row', 'column'), { nil: undefined }),
  justifyContent: fc.option(
    fc.constantFrom(
      'flex-start',
      'center',
      'flex-end',
      'space-between',
      'space-around'
    ),
    { nil: undefined }
  ),
  alignItems: fc.option(
    fc.constantFrom('flex-start', 'center', 'flex-end', 'stretch'),
    { nil: undefined }
  ),
  gap: fc.option(fc.double({ min: 0, max: 100, noNaN: true }), { nil: undefined }),
  width: dimensionArb,
  height: dimensionArb,
}) as fc.Arbitrary<LayoutInfo>;

const styleArb: fc.Arbitrary<StyleInfo> = fc.record({
  className: classNameArb,
  cssProperties: fc.constant({}),
});

const NODE_TYPES = [
  'text',
  'image',
  'container',
  'frame',
  'group',
  'shape',
  'instance',
] as const;

const HTML_TAGS = ['div', 'span', 'section', 'p', 'h1', 'h2', 'h3'];

// Build a node arbitrary with a bounded recursion depth so trees stay finite
// while still exercising arbitrary depth/breadth.
function nodeArb(depth: number): fc.Arbitrary<ParsedNode> {
  const childrenArb: fc.Arbitrary<ParsedNode[]> =
    depth <= 0
      ? fc.constant([] as ParsedNode[])
      : fc.array(nodeArb(depth - 1), { maxLength: 3 });

  return fc.record({
    id: idArb,
    name: nameArb,
    sanitizedName: nameArb,
    nodeType: fc.constantFrom(...NODE_TYPES),
    htmlTag: fc.constantFrom(...HTML_TAGS),
    content: safeTextArb,
    layout: layoutArb,
    styles: styleArb,
    children: childrenArb,
  }) as fc.Arbitrary<ParsedNode>;
}

const frameArb: fc.Arbitrary<ParsedFrame> = fc.record({
  id: idArb,
  name: nameArb,
  sanitizedName: nameArb,
  nodeType: fc.constantFrom('frame', 'component', 'instance'),
  layout: layoutArb,
  styles: styleArb,
  children: fc.array(nodeArb(3), { maxLength: 4 }),
}) as fc.Arbitrary<ParsedFrame>;

const optionsArb: fc.Arbitrary<GeneratorOptions> = fc.record({
  namingConvention: fc.constantFrom('pascal', 'kebab', 'camel'),
  useTailwind: fc.boolean(),
  outputDir: fc.constantFrom('./components', './src/ui', 'components/figma'),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function countChar(haystack: string, ch: string): number {
  let count = 0;
  for (const c of haystack) {
    if (c === ch) count++;
  }
  return count;
}

const VALID_IDENTIFIER = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;
const KEBAB_FILE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// ---------------------------------------------------------------------------
// Property 22: React Component Generation
// ---------------------------------------------------------------------------

describe('ComponentGenerator - Property 22: React Component Generation', () => {
  it('property: generate() always returns a component with non-empty name, filePath and content', () => {
    fc.assert(
      fc.property(frameArb, optionsArb, (frame, options) => {
        const generator = new ComponentGenerator();
        const result = generator.generate(frame, options);

        expect(result.name.length).toBeGreaterThan(0);
        expect(result.filePath.length).toBeGreaterThan(0);
        expect(result.content.length).toBeGreaterThan(0);
        expect(Array.isArray(result.dependencies)).toBe(true);
      }),
      { numRuns: 150 }
    );
  });

  it('property: content contains a React import, a Props interface and a typed FC export (Req 7.1, 7.2)', () => {
    fc.assert(
      fc.property(frameArb, optionsArb, (frame, options) => {
        const generator = new ComponentGenerator();
        const result = generator.generate(frame, options);
        const { content, name } = result;

        // React import (Requirement 7.1: React functional component)
        expect(content).toContain("import React from 'react';");

        // TypeScript props interface (Requirement 7.2: proper type definitions)
        expect(content).toContain(`interface ${name}Props`);

        // Functional component export typed with React.FC<XxxProps> (Req 7.1/7.2)
        expect(content).toContain(
          `export const ${name}: React.FC<${name}Props>`
        );

        // The props interface always declares the className prop used for
        // styling (Requirement 7.5: styles applied via className).
        expect(content).toContain('className?: string;');
      }),
      { numRuns: 150 }
    );
  });

  it('property: generated JSX is structurally balanced and uses a return block (Req 7.4)', () => {
    fc.assert(
      fc.property(frameArb, optionsArb, (frame, options) => {
        const generator = new ComponentGenerator();
        const { content } = generator.generate(frame, options);

        // Basic structural validity: balanced braces and parentheses.
        expect(countChar(content, '{')).toBe(countChar(content, '}'));
        expect(countChar(content, '(')).toBe(countChar(content, ')'));

        // A functional component body returns a JSX tree (Requirement 7.4:
        // semantic HTML elements rendered inside the component).
        expect(content).toContain('return (');
        expect(content).toContain('</div>');
      }),
      { numRuns: 150 }
    );
  });

  it('property: className styling is applied to the root element (Req 7.5)', () => {
    fc.assert(
      fc.property(frameArb, optionsArb, (frame, options) => {
        const generator = new ComponentGenerator();
        const { content } = generator.generate(frame, options);

        // Requirement 7.5: extracted styles are applied as className properties.
        expect(content).toContain('className=');
      }),
      { numRuns: 150 }
    );
  });

  it('property: component name is a valid JS identifier for pascal/camel; kebab uses kebab-case file path', () => {
    fc.assert(
      fc.property(frameArb, optionsArb, (frame, options) => {
        const generator = new ComponentGenerator();
        const result = generator.generate(frame, options);

        if (options.namingConvention === 'kebab') {
          // The file base is kebab-cased.
          const fileBase = result.filePath
            .split('/')
            .pop()!
            .replace(/\.tsx$/, '');
          expect(fileBase).toMatch(KEBAB_FILE);
          expect(fileBase).toBe(fileBase.toLowerCase());
        } else {
          // pascal/camel produce valid JavaScript identifiers.
          expect(result.name).toMatch(VALID_IDENTIFIER);
        }

        // The file path always targets the configured output dir as a .tsx file.
        expect(result.filePath.startsWith(options.outputDir)).toBe(true);
        expect(result.filePath.endsWith('.tsx')).toBe(true);
      }),
      { numRuns: 150 }
    );
  });

  it('property: generation is deterministic for identical input', () => {
    fc.assert(
      fc.property(frameArb, optionsArb, (frame, options) => {
        const a = new ComponentGenerator().generate(frame, options);
        const b = new ComponentGenerator().generate(frame, options);

        expect(b.content).toBe(a.content);
        expect(b.name).toBe(a.name);
        expect(b.filePath).toBe(a.filePath);
      }),
      { numRuns: 150 }
    );
  });
});
