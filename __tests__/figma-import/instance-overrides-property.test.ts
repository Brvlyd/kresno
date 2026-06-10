/**
 * Property-Based Test for Instance Override Props
 * Task 10.12: Write property test for instance overrides
 *
 * **Validates: Requirements 9.3**
 * Property 31: Instance Override Props
 * For any component instance with property overrides, the Component_Generator
 * SHALL generate props that allow the overridden values to be passed to the
 * base component.
 *
 * Strategy: build a component mapping (via resolveComponentReferences) so an
 * instance node resolves to a known base component (`Button`). Then generate
 * frames containing a single instance with randomly-generated overrides and
 * assert the rendered `<Button ... />` reference is well-formed and faithfully
 * reflects the override rules:
 *  - string  -> prop="escapedValue"
 *  - number  -> prop={value} (non-finite values omitted)
 *  - boolean -> prop={value}
 *  - prop names sanitized to valid JSX identifiers, de-duplicated
 *  - no overrides -> <Button /> (self-closing, no extra props)
 */

import * as fc from 'fast-check';
import { ComponentGenerator, GeneratorOptions } from '../../lib/figma-import/core/component-generator';
import { ParsedFrame, ParsedNode } from '../../lib/figma-import/types/internal-models';
import { toCamelCase } from '../../lib/figma-import/utils/name-sanitizer';

const defaultOptions: GeneratorOptions = {
  namingConvention: 'pascal',
  useTailwind: true,
  outputDir: './components',
};

const BASE_COMPONENT_ID = 'comp-1';
const BASE_COMPONENT_NAME = 'Button';

/** Build a frame containing a single instance of the mapped base component. */
function makeFrameWithInstance(
  overrides: Record<string, string | number | boolean> | undefined
): ParsedFrame {
  const instance: ParsedNode = {
    id: '2:1',
    name: 'Button Instance',
    sanitizedName: 'ButtonInstance',
    nodeType: 'instance',
    componentId: BASE_COMPONENT_ID,
    htmlTag: 'div',
    layout: { display: 'flex' },
    styles: { className: 'instance', cssProperties: {} },
    overrides,
  };

  return {
    id: '1:1',
    name: 'Toolbar',
    sanitizedName: 'Toolbar',
    nodeType: 'frame',
    layout: { display: 'flex' },
    styles: { className: 'toolbar', cssProperties: {} },
    children: [instance],
  };
}

/** Extract the single `<Button ... />` instance reference from generated code. */
function extractInstanceTag(content: string): string {
  // String/number/boolean values escape `<` and `>`, so the tag never contains
  // raw angle brackets; `[^<>]` safely captures the whole self-closing tag.
  const match = content.match(/<Button\b[^<>]*\/>/);
  expect(match).not.toBeNull();
  return match![0];
}

interface ParsedAttr {
  name: string;
  isString: boolean;
  value: string;
}

/** Parse JSX attributes out of an extracted self-closing tag. */
function parseAttributes(tag: string): ParsedAttr[] {
  const inner = tag.replace(/^<Button\s*/, '').replace(/\s*\/>$/, '');
  const attrs: ParsedAttr[] = [];
  const re = /([A-Za-z_$][\w$]*)=(?:"([^"]*)"|\{([^}]*)\})/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(inner)) !== null) {
    if (m[2] !== undefined) {
      attrs.push({ name: m[1], isString: true, value: m[2] });
    } else {
      attrs.push({ name: m[1], isString: false, value: m[3] });
    }
  }
  return attrs;
}

// --- Independent re-derivation of the expected props ----------------------
// Mirrors the documented contract so we can assert the generator produces
// exactly the expected props (not a weaker subset).

function sanitizeJsxPropName(name: string): string {
  const camel = toCamelCase(name ?? '');
  return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(camel) ? camel : '';
}

function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function expectedAttributes(
  overrides: Record<string, string | number | boolean>
): ParsedAttr[] {
  const seen = new Set<string>();
  const out: ParsedAttr[] = [];
  for (const [rawName, value] of Object.entries(overrides)) {
    const propName = sanitizeJsxPropName(rawName);
    if (!propName || seen.has(propName)) continue;
    if (value === undefined || value === null) continue;

    if (typeof value === 'string') {
      seen.add(propName);
      out.push({ name: propName, isString: true, value: escapeAttribute(value) });
    } else if (typeof value === 'number') {
      if (!Number.isFinite(value)) continue;
      seen.add(propName);
      out.push({ name: propName, isString: false, value: `${value}` });
    } else if (typeof value === 'boolean') {
      seen.add(propName);
      out.push({ name: propName, isString: false, value: `${value}` });
    }
  }
  return out;
}

// --- Generators -----------------------------------------------------------

// Prop names: a mix of values that exercise sanitization and collisions
// (e.g. `my-label`, `myLabel`, `my label` all sanitize to `myLabel`; `!!!`/``
// collapse to `unnamed`) plus fully random strings.
const propNameArb = fc.oneof(
  fc.constantFrom(
    'label',
    'my-label',
    'myLabel',
    'my label',
    'variant',
    'disabled',
    'count',
    'data-id',
    '123',
    '',
    '!!!',
    '@@@',
    'class',
    'for'
  ),
  fc.string()
);

// String values, including ones that require escaping to stay valid in a
// double-quoted JSX attribute.
const stringValueArb = fc.oneof(
  fc.string(),
  fc.constantFrom(
    'Save',
    'he said "hi"',
    'a<b>c',
    '<script>',
    'tom & jerry',
    '"quoted"',
    'line1\nline2',
    ''
  )
);

// Numbers including non-finite values which must be omitted.
const numberValueArb = fc.oneof(
  fc.integer(),
  fc.double(),
  fc.constantFrom(NaN, Infinity, -Infinity)
);

const valueArb = fc.oneof(stringValueArb, numberValueArb, fc.boolean());

const overridesArb = fc.dictionary(propNameArb, valueArb, { maxKeys: 8 });

describe('ComponentGenerator - Property 31: Instance Override Props', () => {
  let generator: ComponentGenerator;

  beforeEach(() => {
    generator = new ComponentGenerator();
    // Establish the component ID -> name mapping so the instance resolves to
    // `<Button />` (a name that sanitizes to a valid PascalCase identifier).
    generator.resolveComponentReferences([
      {
        id: BASE_COMPONENT_ID,
        name: 'Button',
        sanitizedName: 'Button',
        hasVariants: false,
        frame: {} as ParsedFrame,
      },
    ]);
  });

  it('renders override props faithfully for arbitrary overrides', () => {
    fc.assert(
      fc.property(overridesArb, (overrides) => {
        const result = generator.generate(makeFrameWithInstance(overrides), defaultOptions);
        const tag = extractInstanceTag(result.content);

        // Self-closing, valid instance reference.
        expect(tag.startsWith('<Button')).toBe(true);
        expect(tag.endsWith('/>')).toBe(true);

        const actual = parseAttributes(tag);
        const expected = expectedAttributes(overrides);

        // Exact match (same props, order, kinds, and values) — not a subset.
        expect(actual).toEqual(expected);

        // Invariants on the rendered attributes.
        const names = actual.map((a) => a.name);
        // No duplicate prop names on the tag.
        expect(new Set(names).size).toBe(names.length);

        for (const attr of actual) {
          // Prop names are valid JSX attribute identifiers.
          expect(attr.name).toMatch(/^[A-Za-z_$][\w$]*$/);

          if (attr.isString) {
            // String values must not contain characters that would break the
            // double-quoted attribute (escaping keeps the JSX valid).
            expect(attr.value).not.toMatch(/[<>"]/);
          } else {
            // Numeric/boolean props render as {value}: numbers are finite, and
            // booleans are exactly true/false. Never quoted.
            const isBool = attr.value === 'true' || attr.value === 'false';
            const num = Number(attr.value);
            expect(isBool || Number.isFinite(num)).toBe(true);
          }
        }
      }),
      { numRuns: 200 }
    );
  });

  it('emits a bare <Button /> when there are no usable overrides', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant(undefined),
          fc.constant({} as Record<string, string | number | boolean>),
          // Only non-finite numeric overrides -> all skipped.
          fc.constant({ count: NaN, ratio: Infinity } as Record<string, number>)
        ),
        (overrides) => {
          const result = generator.generate(makeFrameWithInstance(overrides), defaultOptions);
          const tag = extractInstanceTag(result.content);
          expect(tag).toBe('<Button />');
        }
      ),
      { numRuns: 50 }
    );
  });

  it('escapes special characters in string overrides', () => {
    const result = generator.generate(
      makeFrameWithInstance({ label: 'a<b>"c"&d' }),
      defaultOptions
    );
    const tag = extractInstanceTag(result.content);
    expect(tag).toContain('label="a&lt;b&gt;&quot;c&quot;&amp;d"');
    expect(tag).not.toMatch(/label="[^"]*[<>][^"]*"/);
  });

  it('renders numeric and boolean overrides unquoted', () => {
    const result = generator.generate(
      makeFrameWithInstance({ count: 3, disabled: true, ratio: -1.5 }),
      defaultOptions
    );
    const tag = extractInstanceTag(result.content);
    expect(tag).toContain('count={3}');
    expect(tag).toContain('disabled={true}');
    expect(tag).toContain('ratio={-1.5}');
  });
});
