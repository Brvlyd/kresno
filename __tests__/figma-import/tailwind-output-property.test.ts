/**
 * Property-Based Test for Conditional Tailwind Output
 * Task 12.4: Write property test for Tailwind output
 *
 * **Validates: Requirements 10.3**
 * Property 33: For any design when Tailwind CSS is enabled, all generated
 * styles SHALL use Tailwind utility classes instead of CSS modules or inline
 * styles.
 *
 * Implementation under test:
 *   StylesheetGenerator.generateTailwindClasses(frame)
 *     -> { classNamesById, classListById }
 *   StylesheetGenerator.getClassesForNode(node) -> string[]
 *
 * Tokens are derived from a node's layout (via StyleExtractor.cssToTailwind),
 * merged with any pre-computed StyleInfo.tailwindClasses, validated so only
 * well-formed utility tokens (/^[a-z][a-z0-9-]*$/i) survive, and de-duplicated
 * per node while preserving order.
 */

import * as fc from 'fast-check';
import { StylesheetGenerator } from '../../lib/figma-import/core/stylesheet-generator';
import { ParsedFrame, ParsedNode, LayoutInfo } from '../../lib/figma-import/types/internal-models';

// ---------------------------------------------------------------------------
// Shared helpers (mirror the contract documented for getClassesForNode)
// ---------------------------------------------------------------------------

/** Regex defining a well-formed Tailwind utility token. */
const UTILITY_TOKEN = /^[a-z][a-z0-9-]*$/i;
/** Raw-CSS syntax that must never appear inside an emitted token. */
const RAW_CSS_SYNTAX = /[:;{}()#%\s]/;
/** A numeric pixel value such as `16px` must never appear in a token. */
const PX_VALUE = /\d+px/;

const JUSTIFY_MAP: Record<string, string> = {
  'flex-start': 'justify-start',
  center: 'justify-center',
  'flex-end': 'justify-end',
  'space-between': 'justify-between',
};

const ALIGN_MAP: Record<string, string> = {
  'flex-start': 'items-start',
  center: 'items-center',
  'flex-end': 'items-end',
};

const DISPLAY_MAP: Record<string, string> = {
  flex: 'flex',
  block: 'block',
  'inline-block': 'inline-block',
};

/**
 * Compute the layout-derived Tailwind tokens we expect to appear for a node.
 * Only the documented mappings are asserted; values without a mapping (e.g.
 * `space-around`, `stretch`, `display: none`) intentionally contribute nothing.
 */
function expectedLayoutClasses(layout: LayoutInfo): string[] {
  const expected: string[] = [];

  if (layout.display && DISPLAY_MAP[layout.display]) {
    expected.push(DISPLAY_MAP[layout.display]);
  }
  if (layout.flexDirection === 'row') expected.push('flex-row');
  if (layout.flexDirection === 'column') expected.push('flex-col');
  if (layout.justifyContent && JUSTIFY_MAP[layout.justifyContent]) {
    expected.push(JUSTIFY_MAP[layout.justifyContent]);
  }
  if (layout.alignItems && ALIGN_MAP[layout.alignItems]) {
    expected.push(ALIGN_MAP[layout.alignItems]);
  }
  if (typeof layout.gap === 'number') {
    expected.push(`gap-${Math.round(layout.gap / 4)}`);
  }
  if (layout.padding) {
    expected.push(`p-${Math.round(layout.padding.top / 4)}`);
  }

  return expected;
}

/** Collect a frame and every descendant node into a flat list. */
function collectNodes(frame: ParsedFrame): Array<ParsedFrame | ParsedNode> {
  const out: Array<ParsedFrame | ParsedNode> = [];
  const visit = (node: ParsedFrame | ParsedNode): void => {
    out.push(node);
    node.children?.forEach(visit);
  };
  visit(frame);
  return out;
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

const layoutArb: fc.Arbitrary<LayoutInfo> = fc.record({
  display: fc.constantFrom('flex', 'block', 'inline-block', 'none'),
  flexDirection: fc.option(fc.constantFrom('row', 'column'), { nil: undefined }),
  justifyContent: fc.option(
    fc.constantFrom('flex-start', 'center', 'flex-end', 'space-between', 'space-around'),
    { nil: undefined }
  ),
  alignItems: fc.option(
    fc.constantFrom('flex-start', 'center', 'flex-end', 'stretch'),
    { nil: undefined }
  ),
  gap: fc.option(fc.integer({ min: 0, max: 128 }), { nil: undefined }),
  padding: fc.option(
    fc.record({
      top: fc.integer({ min: 0, max: 64 }),
      right: fc.integer({ min: 0, max: 64 }),
      bottom: fc.integer({ min: 0, max: 64 }),
      left: fc.integer({ min: 0, max: 64 }),
    }),
    { nil: undefined }
  ),
}) as fc.Arbitrary<LayoutInfo>;

// Valid Tailwind utility tokens that must survive validation.
const validTokenArb = fc.constantFrom(
  'bg-red-500',
  'text-center',
  'rounded-lg',
  'shadow',
  'w-full',
  'uppercase',
  'border',
  'm-2',
  'text-sm',
  'grid'
);

// Raw-CSS / malformed tokens that must be dropped (each contains a forbidden
// character or starts with a digit, so none match the utility-token regex).
const invalidTokenArb = fc.constantFrom(
  'color: red;',
  'padding: 4px',
  '16px',
  '#fff',
  'rgb(0, 0, 0)',
  '100%',
  'foo bar',
  'flex; color:red',
  'width:100%',
  'a:b'
);

const explicitTokensArb = fc.array(fc.oneof(validTokenArb, invalidTokenArb), {
  maxLength: 6,
});

interface RawNode {
  name: string;
  layout: LayoutInfo;
  tailwind: string[];
  children: RawNode[];
}

function rawNodeArb(depth: number): fc.Arbitrary<RawNode> {
  const childrenArb: fc.Arbitrary<RawNode[]> =
    depth <= 0
      ? fc.constant([])
      : fc.array(rawNodeArb(depth - 1), { maxLength: 3 });

  return fc.record({
    name: fc.string({ minLength: 1, maxLength: 6 }),
    layout: layoutArb,
    tailwind: explicitTokensArb,
    children: childrenArb,
  });
}

const frameRawArb = rawNodeArb(3);

/**
 * Convert a generated raw tree into a real ParsedFrame, assigning unique ids
 * to every node and returning the full id list.
 */
function buildFrame(raw: RawNode): { frame: ParsedFrame; ids: string[] } {
  let counter = 0;
  const ids: string[] = [];

  const build = (r: RawNode, isFrame: boolean): ParsedFrame | ParsedNode => {
    const id = `node-${counter++}`;
    ids.push(id);
    const children = r.children.map((c) => build(c, false) as ParsedNode);
    const styles = {
      className: `cls-${id}`,
      cssProperties: {},
      tailwindClasses: r.tailwind,
    };

    if (isFrame) {
      return {
        id,
        name: r.name,
        sanitizedName: r.name || 'Frame',
        nodeType: 'frame',
        layout: r.layout,
        styles,
        children,
      } satisfies ParsedFrame;
    }

    return {
      id,
      name: r.name,
      sanitizedName: r.name || 'Node',
      nodeType: 'container',
      htmlTag: 'div',
      layout: r.layout,
      styles,
      children,
    } satisfies ParsedNode;
  };

  const frame = build(raw, true) as ParsedFrame;
  return { frame, ids };
}

// ---------------------------------------------------------------------------
// Property tests
// ---------------------------------------------------------------------------

describe('StylesheetGenerator - Property 33: Conditional Tailwind Output', () => {
  let generator: StylesheetGenerator;

  beforeEach(() => {
    generator = new StylesheetGenerator();
  });

  it('emits an entry for every node id in both maps', () => {
    fc.assert(
      fc.property(frameRawArb, (raw) => {
        const { frame, ids } = buildFrame(raw);
        const result = generator.generateTailwindClasses(frame);

        for (const id of ids) {
          expect(Object.prototype.hasOwnProperty.call(result.classListById, id)).toBe(true);
          expect(Object.prototype.hasOwnProperty.call(result.classNamesById, id)).toBe(true);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('emits only valid utility tokens with no raw CSS, no px values, and no duplicates', () => {
    fc.assert(
      fc.property(frameRawArb, (raw) => {
        const { frame } = buildFrame(raw);
        const result = generator.generateTailwindClasses(frame);

        for (const node of collectNodes(frame)) {
          const list = result.classListById[node.id];

          for (const token of list) {
            expect(token).toMatch(UTILITY_TOKEN);
            expect(token).not.toMatch(RAW_CSS_SYNTAX);
            expect(token).not.toMatch(PX_VALUE);
          }

          // De-duplicated per node.
          expect(new Set(list).size).toBe(list.length);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('keeps classNamesById in sync with classListById (join with space)', () => {
    fc.assert(
      fc.property(frameRawArb, (raw) => {
        const { frame } = buildFrame(raw);
        const result = generator.generateTailwindClasses(frame);

        for (const node of collectNodes(frame)) {
          expect(result.classNamesById[node.id]).toBe(
            result.classListById[node.id].join(' ')
          );
        }
      }),
      { numRuns: 100 }
    );
  });

  it('derives the expected layout utility classes from flexbox layout', () => {
    fc.assert(
      fc.property(frameRawArb, (raw) => {
        const { frame } = buildFrame(raw);
        const result = generator.generateTailwindClasses(frame);

        for (const node of collectNodes(frame)) {
          const list = result.classListById[node.id];
          for (const expected of expectedLayoutClasses(node.layout)) {
            expect(list).toContain(expected);
          }
        }
      }),
      { numRuns: 100 }
    );
  });

  it('keeps valid pre-computed tailwindClasses and drops raw-CSS tokens', () => {
    fc.assert(
      fc.property(frameRawArb, (raw) => {
        const { frame } = buildFrame(raw);
        const result = generator.generateTailwindClasses(frame);

        for (const node of collectNodes(frame)) {
          const list = result.classListById[node.id];
          const explicit = node.styles.tailwindClasses ?? [];

          for (const token of explicit) {
            const trimmed = token.trim();
            if (UTILITY_TOKEN.test(trimmed)) {
              expect(list).toContain(trimmed);
            } else {
              expect(list).not.toContain(token);
              expect(list).not.toContain(trimmed);
            }
          }
        }
      }),
      { numRuns: 100 }
    );
  });

  it('is deterministic: the same frame yields the same result', () => {
    fc.assert(
      fc.property(frameRawArb, (raw) => {
        const { frame } = buildFrame(raw);
        const first = generator.generateTailwindClasses(frame);
        const second = generator.generateTailwindClasses(frame);
        expect(second).toEqual(first);
      }),
      { numRuns: 100 }
    );
  });

  // A concrete example pinning the documented layout -> utility mapping.
  it('maps a fully-specified flex layout to the documented utilities', () => {
    const frame: ParsedFrame = {
      id: 'root',
      name: 'Card',
      sanitizedName: 'Card',
      nodeType: 'frame',
      layout: {
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 16,
        padding: { top: 16, right: 16, bottom: 16, left: 16 },
      },
      styles: {
        className: 'card',
        cssProperties: {},
        tailwindClasses: ['bg-red-500', 'color: red;', '16px'],
      },
      children: [],
    };

    const result = generator.generateTailwindClasses(frame);
    const list = result.classListById['root'];

    expect(list).toEqual(
      expect.arrayContaining([
        'flex',
        'flex-row',
        'justify-center',
        'items-center',
        'gap-4',
        'p-4',
        'bg-red-500',
      ])
    );
    // Raw-CSS tokens dropped.
    expect(list).not.toContain('color: red;');
    expect(list).not.toContain('16px');
    expect(result.classNamesById['root']).toBe(list.join(' '));
  });
});
