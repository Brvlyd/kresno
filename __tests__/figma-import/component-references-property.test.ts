/**
 * Property-Based Tests for Component References
 * Task 10.10: Write property test for component references
 *
 * **Property 29: Component Definition Generation**
 *   For any Figma component definition node, the Component_Generator SHALL
 *   generate a reusable React component that can be imported and used by other
 *   generated components.
 *
 * **Property 30: Component Instance Reference**
 *   For any component instance node, the generated code SHALL import and
 *   reference the base component by its generated component name.
 *
 * **Property 32: Component ID Mapping**
 *   For any Figma component, the Component_Generator SHALL maintain a mapping
 *   between the Figma component ID and the generated component name for
 *   reference resolution.
 *
 * **Validates: Requirements 9.1, 9.2, 9.4**
 */

import * as fc from 'fast-check';
import {
  ComponentGenerator,
  GeneratorOptions,
} from '../../lib/figma-import/core/component-generator';
import {
  ParsedComponent,
  ParsedFrame,
  ParsedNode,
} from '../../lib/figma-import/types/internal-models';
import {
  sanitizeComponentName,
  toKebabCase,
} from '../../lib/figma-import/utils/name-sanitizer';

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

const defaultOptions: GeneratorOptions = {
  namingConvention: 'pascal',
  useTailwind: true,
  outputDir: './components',
};

// A pool of words that always sanitize to valid PascalCase identifiers.
const wordArb = fc.constantFrom(
  'Button',
  'Card',
  'Header',
  'Footer',
  'Icon',
  'Modal',
  'List',
  'Item',
  'Panel',
  'Badge',
  'Avatar',
  'Menu',
  'Tab',
  'Input',
  'Label'
);

// A human-readable name (e.g. "Icon Button") whose sanitized form is a valid
// PascalCase identifier (e.g. "IconButton").
const nameArb: fc.Arbitrary<string> = fc
  .array(wordArb, { minLength: 1, maxLength: 3 })
  .map((words) => words.join(' '));

/** Build a list of component definitions with guaranteed-unique ids. */
function buildComponents(names: string[]): ParsedComponent[] {
  return names.map((name, index) => ({
    id: `comp-${index}`,
    name,
    sanitizedName: name,
    hasVariants: false,
    frame: {} as ParsedFrame,
  }));
}

/** Build an instance node that references a given Figma component id. */
function makeInstanceNode(
  id: string,
  name: string,
  componentId: string
): ParsedNode {
  return {
    id,
    name,
    sanitizedName: sanitizeComponentName(name),
    nodeType: 'instance',
    componentId,
    htmlTag: 'div',
    layout: { display: 'flex' },
    styles: { className: 'instance', cssProperties: {} },
  };
}

const PASCAL_IDENTIFIER = /^[A-Z][A-Za-z0-9]*$/;

// ---------------------------------------------------------------------------
// Property 32: Component ID Mapping
// ---------------------------------------------------------------------------

describe('Property 32: Component ID Mapping', () => {
  it('maps every component id to a valid PascalCase identifier', () => {
    fc.assert(
      fc.property(
        fc.array(nameArb, { minLength: 1, maxLength: 8 }),
        (names) => {
          const components = buildComponents(names);
          const generator = new ComponentGenerator();
          const mapping = generator.resolveComponentReferences(components);

          const ids = components.map((c) => c.id);

          // Keys are exactly the component ids (ids are unique by construction).
          expect(mapping.size).toBe(ids.length);
          expect(new Set(mapping.keys())).toEqual(new Set(ids));

          // Each value is a valid PascalCase identifier and matches the
          // sanitized component name.
          for (const component of components) {
            const generatedName = mapping.get(component.id);
            expect(generatedName).toBeDefined();
            expect(generatedName as string).toMatch(PASCAL_IDENTIFIER);
            expect(generatedName).toBe(
              sanitizeComponentName(component.sanitizedName)
            );
          }
        }
      ),
      { numRuns: 300 }
    );
  });

  it('produces a deterministic mapping for the same input', () => {
    fc.assert(
      fc.property(
        fc.array(nameArb, { minLength: 1, maxLength: 8 }),
        (names) => {
          const components = buildComponents(names);

          const mapA = new ComponentGenerator().resolveComponentReferences(
            components
          );
          const mapB = new ComponentGenerator().resolveComponentReferences(
            components
          );

          expect(Array.from(mapA.entries()).sort()).toEqual(
            Array.from(mapB.entries()).sort()
          );
        }
      ),
      { numRuns: 300 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 29: Component Definition Generation
// ---------------------------------------------------------------------------

describe('Property 29: Component Definition Generation', () => {
  it('generates a reusable exported React.FC for a component definition', () => {
    fc.assert(
      fc.property(nameArb, (name) => {
        const generator = new ComponentGenerator();
        const expectedName = sanitizeComponentName(name);

        const frame: ParsedFrame = {
          id: 'comp-def',
          name,
          sanitizedName: name,
          nodeType: 'component',
          layout: { display: 'flex' },
          styles: { className: 'def', cssProperties: {} },
          children: [],
        };

        const result = generator.generate(frame, defaultOptions);

        // Reusable: a named export typed as React.FC<NameProps> plus its props
        // interface, which other generated files can import and use.
        expect(result.name).toBe(expectedName);
        expect(result.content).toContain(
          `export const ${expectedName}: React.FC<${expectedName}Props>`
        );
        expect(result.content).toContain(`interface ${expectedName}Props`);

        // The definition is registered for instance resolution (Requirement 9.4).
        const mapping = generator.resolveComponentReferences([
          {
            id: 'comp-def',
            name,
            sanitizedName: name,
            hasVariants: false,
            frame: {} as ParsedFrame,
          },
        ]);
        expect(mapping.get('comp-def')).toBe(expectedName);
      }),
      { numRuns: 300 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 30: Component Instance Reference
// ---------------------------------------------------------------------------

describe('Property 30: Component Instance Reference', () => {
  it('references and imports each mapped component, and degrades unmapped instances', () => {
    const inputArb = fc
      .array(nameArb, { minLength: 1, maxLength: 5 })
      .chain((defNames) => {
        const indexArb = fc.integer({ min: 0, max: defNames.length - 1 });
        return fc.record({
          defNames: fc.constant(defNames),
          instanceIndices: fc.array(indexArb, { minLength: 1, maxLength: 6 }),
          includeUnmapped: fc.boolean(),
        });
      });

    fc.assert(
      fc.property(inputArb, ({ defNames, instanceIndices, includeUnmapped }) => {
        const generator = new ComponentGenerator();
        const components = buildComponents(defNames);
        generator.resolveComponentReferences(components);

        // Mapped instance children referencing existing component definitions.
        const children: ParsedNode[] = instanceIndices.map((idx, i) =>
          makeInstanceNode(
            `inst-${i}`,
            `${components[idx].name} Instance`,
            components[idx].id
          )
        );

        // Optionally add an instance whose componentId is NOT in the mapping.
        if (includeUnmapped) {
          children.push(
            makeInstanceNode(
              'inst-phantom',
              'Phantom Widget',
              'phantom-unmapped-id'
            )
          );
        }

        // Container frame whose generated name cannot collide with any pooled
        // component name, so self-import exclusion never interferes.
        const frame: ParsedFrame = {
          id: 'root-1',
          name: 'Outer Shell Wrapper',
          sanitizedName: 'OuterShellWrapper',
          nodeType: 'frame',
          layout: { display: 'flex' },
          styles: { className: 'root', cssProperties: {} },
          children,
        };

        const result = generator.generate(frame, defaultOptions);

        // The set of distinct mapped names that were referenced.
        const referencedNames = new Set(
          instanceIndices.map((idx) =>
            sanitizeComponentName(components[idx].name)
          )
        );

        for (const refName of referencedNames) {
          // JSX reference to the base component.
          expect(result.content).toContain(`<${refName}`);
          // Named import so the generated file compiles.
          expect(result.content).toContain(
            `import { ${refName} } from './${refName}';`
          );
          // Surfaced as a dependency.
          expect(result.dependencies).toContain(refName);
        }

        if (includeUnmapped) {
          // Unresolved instance degrades to a valid fallback element.
          expect(result.content).toContain('unresolved-instance');
          // No phantom import for the unmapped component.
          expect(result.content).not.toContain('PhantomWidget }');
          expect(result.content).not.toMatch(/from '\.\/[Pp]hantom/);
        }
      }),
      { numRuns: 300 }
    );
  });

  it('emits no self-import when a component instances itself', () => {
    fc.assert(
      fc.property(nameArb, (name) => {
        const generator = new ComponentGenerator();
        const expectedName = sanitizeComponentName(name);

        generator.resolveComponentReferences([
          {
            id: 'comp-self',
            name,
            sanitizedName: name,
            hasVariants: false,
            frame: {} as ParsedFrame,
          },
        ]);

        const frame: ParsedFrame = {
          id: 'comp-self',
          name,
          sanitizedName: name,
          nodeType: 'component',
          layout: { display: 'flex' },
          styles: { className: 'self', cssProperties: {} },
          children: [
            makeInstanceNode('inst-self', `${name} Self`, 'comp-self'),
          ],
        };

        const result = generator.generate(frame, defaultOptions);

        // Still references itself in JSX...
        expect(result.content).toContain(`<${expectedName}`);
        // ...but does NOT import itself.
        expect(result.content).not.toContain(
          `import { ${expectedName} } from './${expectedName}';`
        );
      }),
      { numRuns: 300 }
    );
  });

  it('uses a kebab-case file base for imports under the kebab convention', () => {
    fc.assert(
      fc.property(nameArb, (name) => {
        const generator = new ComponentGenerator();
        const refName = sanitizeComponentName(name);
        const fileBase = toKebabCase(refName);

        generator.resolveComponentReferences([
          {
            id: 'comp-k',
            name,
            sanitizedName: name,
            hasVariants: false,
            frame: {} as ParsedFrame,
          },
        ]);

        const frame: ParsedFrame = {
          id: 'root-k',
          name: 'Outer Shell Wrapper',
          sanitizedName: 'OuterShellWrapper',
          nodeType: 'frame',
          layout: { display: 'flex' },
          styles: { className: 'root', cssProperties: {} },
          children: [makeInstanceNode('inst-k', `${name} Instance`, 'comp-k')],
        };

        const result = generator.generate(frame, {
          ...defaultOptions,
          namingConvention: 'kebab',
        });

        // JSX tag stays PascalCase (React requirement); import path is kebab.
        expect(result.content).toContain(`<${refName}`);
        expect(result.content).toContain(
          `import { ${refName} } from './${fileBase}';`
        );
      }),
      { numRuns: 200 }
    );
  });
});
