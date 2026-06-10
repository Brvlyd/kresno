/**
 * Property-Based Tests for Conditional CSS Modules Output
 * Task 12.2: Write property test for CSS modules output
 *
 * **Property 34: Conditional CSS Modules Output**
 * **Validates: Requirements 10.4**
 *
 * For any design when Tailwind CSS is disabled in configuration, all generated
 * styles SHALL use CSS modules with generated `.module.css` files.
 *
 * These tests generate random frames (with nested nodes, random classNames
 * including ones requiring sanitization, random cssProperties, and random
 * layout) and verify that the CSS-modules output produced by
 * {@link StylesheetGenerator.generateCssModule} is:
 *   - written to a `*.module.css` file,
 *   - syntactically valid CSS (balanced braces, well-formed selectors, every
 *     declaration ends with `;` and matches `property: value`),
 *   - injection-safe (braces/semicolons inside values never create extra rules),
 *   - complete (every provided cssProperty appears, normalized to kebab-case),
 *   - deterministic (same frame -> same content).
 */

import * as fc from 'fast-check';
import { StylesheetGenerator } from '../../lib/figma-import/core/stylesheet-generator';
import {
  ParsedFrame,
  ParsedNode,
  LayoutInfo,
  StyleInfo,
} from '../../lib/figma-import/types/internal-models';

// --------------------------------------------------------------------------
// Oracles: replicate the generator's sanitization so the test can compute the
// expected number of selectors and the expected kebab-cased property names
// WITHOUT calling the generator. These mirror the private helpers in
// stylesheet-generator.ts.
// --------------------------------------------------------------------------

/** Mirror of StylesheetGenerator#sanitizeClassName. */
function sanitizeClassName(name: string | undefined): string {
  if (!name) {
    return '';
  }
  let sanitized = name
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  if (sanitized.length === 0) {
    return '';
  }
  if (/^\d/.test(sanitized)) {
    sanitized = `_${sanitized}`;
  }
  return sanitized;
}

/** Mirror of StylesheetGenerator#toCssPropertyName. */
function toCssPropertyName(key: string): string {
  return String(key ?? '')
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/\s+/g, '-')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Mirror of StylesheetGenerator#sanitizeValue. */
function sanitizeValue(value: string): string {
  return String(value ?? '')
    .replace(/[;{}\r\n]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// --------------------------------------------------------------------------
// CSS validation helper (balanced braces + well-formed selectors/declarations).
// --------------------------------------------------------------------------

interface ParsedRule {
  selector: string;
  declarations: string[];
}

/**
 * Validate the generated CSS and return the list of parsed rules. Throws (via
 * expect) when anything is malformed.
 */
function validateCssAndCollectRules(css: string): ParsedRule[] {
  // Braces must be balanced.
  const open = (css.match(/\{/g) || []).length;
  const close = (css.match(/\}/g) || []).length;
  expect(open).toBe(close);

  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const ruleRegex = /([^{}]*)\{([^{}]*)\}/g;
  const rules: ParsedRule[] = [];
  let match: RegExpExecArray | null;

  while ((match = ruleRegex.exec(withoutComments)) !== null) {
    const selector = match[1].trim();
    const body = match[2].trim();

    // Every selector must be a single well-formed class selector.
    expect(selector).toMatch(/^\.[a-zA-Z_][\w-]*$/);

    const declarations: string[] = [];
    if (body.length > 0) {
      // The body must end with a semicolon after trimming.
      expect(body.endsWith(';')).toBe(true);
      const decls = body
        .split(';')
        .map((d) => d.trim())
        .filter((d) => d.length > 0);
      for (const decl of decls) {
        // Each declaration must look like `property: value`.
        expect(decl).toMatch(/^[a-z-]+\s*:\s*.+$/);
      }
      declarations.push(...decls);
    }

    rules.push({ selector: selector.slice(1), declarations });
  }

  return rules;
}

// --------------------------------------------------------------------------
// Arbitraries
// --------------------------------------------------------------------------

const SAFE_NAME_CHARS =
  'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_'.split('');
const SPECIAL_NAME_CHARS = ' !@#$%^&*().+/<>?,~`:;{}[]'.split('');
const ALNUM_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789'.split('');
const SAFE_VALUE_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789#(),.%- '.split('');
const INJECTION_CHARS = [';', '{', '}'];

// Property names: a realistic mix of kebab-case and camelCase identifiers, all
// of which normalize to a non-empty kebab-case property name.
const PROP_NAMES = [
  'color',
  'backgroundColor',
  'border-radius',
  'fontWeight',
  'margin',
  'paddingLeft',
  'boxShadow',
  'opacity',
  'zIndex',
  'textAlign',
  'line-height',
  'letterSpacing',
  'border',
  'fontSize',
];

/**
 * A className that always sanitizes to a non-empty, valid CSS class identifier.
 * The first character is always "safe" so something survives sanitization, and
 * the remainder mixes safe and special characters so sanitization is exercised.
 */
const classNameArb: fc.Arbitrary<string> = fc
  .tuple(
    fc.constantFrom(...SAFE_NAME_CHARS),
    fc.array(fc.oneof(fc.constantFrom(...SAFE_NAME_CHARS), fc.constantFrom(...SPECIAL_NAME_CHARS)), {
      minLength: 0,
      maxLength: 12,
    })
  )
  .map(([head, rest]) => head + rest.join(''));

/**
 * A CSS value that always survives sanitization (non-empty) yet may contain
 * injection characters (`;`, `{`, `}`) so the no-injection property is tested.
 * The leading alphanumeric character guarantees a non-empty sanitized value.
 */
const cssValueArb: fc.Arbitrary<string> = fc
  .tuple(
    fc.constantFrom(...ALNUM_CHARS),
    fc.array(fc.constantFrom(...SAFE_VALUE_CHARS), { minLength: 0, maxLength: 14 }),
    fc.array(fc.constantFrom(...INJECTION_CHARS), { minLength: 0, maxLength: 5 })
  )
  .map(([head, body, injection]) => head + body.join('') + injection.join(''));

/** Random cssProperties map keyed by realistic property names. */
const cssPropertiesArb: fc.Arbitrary<Record<string, string>> = fc.dictionary(
  fc.constantFrom(...PROP_NAMES),
  cssValueArb,
  { minKeys: 0, maxKeys: 6 }
);

const paddingArb = fc.record({
  top: fc.integer({ min: 0, max: 64 }),
  right: fc.integer({ min: 0, max: 64 }),
  bottom: fc.integer({ min: 0, max: 64 }),
  left: fc.integer({ min: 0, max: 64 }),
});

/** Random layout. Only defined fields are included on the returned object. */
const layoutArb: fc.Arbitrary<LayoutInfo> = fc
  .record({
    display: fc.constantFrom('flex', 'block', 'inline-block', 'none'),
    flexDirection: fc.option(fc.constantFrom('row', 'column'), { nil: undefined }),
    justifyContent: fc.option(
      fc.constantFrom('flex-start', 'center', 'flex-end', 'space-between', 'space-around'),
      { nil: undefined }
    ),
    alignItems: fc.option(fc.constantFrom('flex-start', 'center', 'flex-end', 'stretch'), {
      nil: undefined,
    }),
    gap: fc.option(fc.integer({ min: 0, max: 64 }), { nil: undefined }),
    padding: fc.option(paddingArb, { nil: undefined }),
    width: fc.option(fc.integer({ min: 0, max: 1000 }), { nil: undefined }),
    height: fc.option(fc.integer({ min: 0, max: 1000 }), { nil: undefined }),
    position: fc.option(fc.constantFrom('relative', 'absolute', 'fixed'), { nil: undefined }),
  })
  .map((raw) => {
    const layout: LayoutInfo = { display: raw.display as LayoutInfo['display'] };
    if (raw.flexDirection) layout.flexDirection = raw.flexDirection as LayoutInfo['flexDirection'];
    if (raw.justifyContent) layout.justifyContent = raw.justifyContent as LayoutInfo['justifyContent'];
    if (raw.alignItems) layout.alignItems = raw.alignItems as LayoutInfo['alignItems'];
    if (typeof raw.gap === 'number') layout.gap = raw.gap;
    if (raw.padding) layout.padding = raw.padding;
    if (typeof raw.width === 'number') layout.width = raw.width;
    if (typeof raw.height === 'number') layout.height = raw.height;
    if (raw.position) layout.position = raw.position as LayoutInfo['position'];
    return layout;
  });

const stylesArb: fc.Arbitrary<StyleInfo> = fc.record({
  className: classNameArb,
  cssProperties: cssPropertiesArb,
});

let nodeIdCounter = 0;
function nextId(): string {
  nodeIdCounter += 1;
  return `n:${nodeIdCounter}`;
}

const NODE_TYPES = ['container', 'text', 'image', 'shape'] as const;

/** Recursive ParsedNode arbitrary (bounded depth via fast-check letrec). */
const { node: nodeArb } = fc.letrec<{ node: ParsedNode }>((tie) => ({
  node: fc.record({
    name: fc.constantFrom('Node', 'Item', 'Box', 'Label', 'Group'),
    nodeType: fc.constantFrom(...NODE_TYPES),
    htmlTag: fc.constantFrom('div', 'span', 'p', 'section'),
    layout: layoutArb,
    styles: stylesArb,
    children: fc.oneof(
      { weight: 3, arbitrary: fc.constant<ParsedNode[]>([]) },
      { weight: 1, arbitrary: fc.array(tie('node'), { minLength: 1, maxLength: 3 }) }
    ),
  }).map((raw): ParsedNode => {
    const id = nextId();
    return {
      id,
      name: raw.name,
      sanitizedName: raw.name,
      nodeType: raw.nodeType,
      htmlTag: raw.htmlTag,
      layout: raw.layout,
      styles: raw.styles,
      children: raw.children,
    };
  }),
}));

const frameArb: fc.Arbitrary<ParsedFrame> = fc
  .record({
    name: fc.constantFrom('My Button', 'Card', 'Hero Section', 'Nav Bar', 'Footer'),
    nodeType: fc.constantFrom('frame', 'component', 'instance'),
    layout: layoutArb,
    styles: stylesArb,
    children: fc.array(nodeArb, { minLength: 0, maxLength: 4 }),
  })
  .map((raw): ParsedFrame => {
    const id = nextId();
    return {
      id,
      name: raw.name,
      sanitizedName: raw.name,
      nodeType: raw.nodeType,
      layout: raw.layout,
      styles: raw.styles,
      children: raw.children,
    };
  });

// --------------------------------------------------------------------------
// Tree helpers
// --------------------------------------------------------------------------

/** Collect every node (frame + descendants) in the tree. */
function collectAll(frame: ParsedFrame): Array<ParsedFrame | ParsedNode> {
  const out: Array<ParsedFrame | ParsedNode> = [];
  const visit = (node: ParsedFrame | ParsedNode): void => {
    out.push(node);
    if (node.children) {
      for (const child of node.children) {
        visit(child);
      }
    }
  };
  visit(frame);
  return out;
}

// --------------------------------------------------------------------------
// Tests
// --------------------------------------------------------------------------

describe('Property 34: Conditional CSS Modules Output (Tailwind disabled)', () => {
  let generator: StylesheetGenerator;

  beforeEach(() => {
    generator = new StylesheetGenerator();
  });

  it('always emits a .module.css filename and syntactically valid CSS', () => {
    fc.assert(
      fc.property(frameArb, (frame) => {
        const result = generator.generateCssModule(frame);

        // Requirement 10.4: CSS modules output is a `*.module.css` file.
        expect(result.fileName.endsWith('.module.css')).toBe(true);

        // Valid CSS: balanced braces, well-formed selectors and declarations.
        validateCssAndCollectRules(result.content);
      })
    );
  });

  it('emits exactly one selector per unique sanitized non-empty className (no injection)', () => {
    fc.assert(
      fc.property(frameArb, (frame) => {
        const result = generator.generateCssModule(frame);
        const rules = validateCssAndCollectRules(result.content);

        // Expected selector set: unique, non-empty sanitized classNames in the tree.
        const expectedSelectors = new Set<string>();
        for (const node of collectAll(frame)) {
          const sanitized = sanitizeClassName(node.styles?.className);
          if (sanitized.length > 0) {
            expectedSelectors.add(sanitized);
          }
        }

        // No injected braces/semicolons inside values produced extra rules.
        expect(rules.length).toBe(expectedSelectors.size);

        const actualSelectors = new Set(rules.map((r) => r.selector));
        expect(actualSelectors).toEqual(expectedSelectors);
      })
    );
  });

  it('includes every provided cssProperty with its name normalized to kebab-case', () => {
    fc.assert(
      fc.property(frameArb, (frame) => {
        const result = generator.generateCssModule(frame);
        // Validate structure first.
        validateCssAndCollectRules(result.content);

        for (const node of collectAll(frame)) {
          const sanitizedClass = sanitizeClassName(node.styles?.className);
          if (sanitizedClass.length === 0) {
            // Nodes with no usable class name are intentionally skipped.
            continue;
          }
          const cssProperties = node.styles?.cssProperties ?? {};
          for (const [rawProp, rawValue] of Object.entries(cssProperties)) {
            const prop = toCssPropertyName(rawProp);
            const value = sanitizeValue(rawValue);
            if (prop.length === 0 || value.length === 0) {
              continue;
            }
            // The kebab-cased property name appears as a declaration. Declarations
            // are indented, so the property name is preceded by whitespace; this
            // avoids matching it as a suffix of a longer property name.
            const declRegex = new RegExp(`\\s${prop}\\s*:`);
            expect(result.content).toMatch(declRegex);
          }
        }
      })
    );
  });

  it('is deterministic: the same frame always yields identical content', () => {
    fc.assert(
      fc.property(frameArb, (frame) => {
        const first = generator.generateCssModule(frame);
        const second = generator.generateCssModule(frame);
        const third = new StylesheetGenerator().generateCssModule(frame);

        expect(second.content).toBe(first.content);
        expect(second.fileName).toBe(first.fileName);
        expect(third.content).toBe(first.content);
      })
    );
  });
});
