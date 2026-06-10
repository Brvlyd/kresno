/**
 * Property-Based Test for Component Hierarchy Preservation
 * Task 10.6: Write property test for hierarchy preservation
 *
 * **Property 24: Component Hierarchy Preservation**
 * **Validates: Requirements 7.6**
 *
 * For any node tree with nested structure, the generated component code SHALL
 * preserve the hierarchy through nested JSX elements. This test generates random
 * nested node trees (containers/frames with children and text nodes with unique
 * content) and verifies that:
 *   - every text node's content appears in the generated JSX,
 *   - the relative nesting/order is preserved (pre-order: a parent's opening tag
 *     precedes its descendants' content, and siblings keep their order),
 *   - the number of container opening tags matches the number of container nodes
 *     (no dropped nodes),
 *   - JSX braces and parentheses remain balanced.
 */

import * as fc from 'fast-check';
import {
  ComponentGenerator,
  GeneratorOptions,
} from '../../lib/figma-import/core/component-generator';
import { ParsedFrame, ParsedNode } from '../../lib/figma-import/types/internal-models';

// ---------------------------------------------------------------------------
// Skeleton model + generator
//
// We first generate a lightweight tree "skeleton" describing only the shape
// (text leaf vs. container with children, arbitrary depth/breadth). The skeleton
// is then materialised into real ParsedNodes with globally unique, distinctive
// marker tokens so we can locate each node's contribution in the generated code
// and assert relative ordering.
// ---------------------------------------------------------------------------

type Skeleton =
  | { type: 'text' }
  | { type: 'container'; children: Skeleton[] };

// Recursive arbitrary for a single node. `maxDepth` bounds nesting depth while
// `maxLength` bounds breadth, so we explore a wide variety of trees without
// blowing up. fast-check biases toward the text (leaf) case as depth grows.
const skeletonArb: fc.Arbitrary<Skeleton> = fc.letrec<{ node: Skeleton }>((tie) => ({
  node: fc.oneof(
    { maxDepth: 4 },
    fc.record({ type: fc.constant('text' as const) }),
    fc.record({
      type: fc.constant('container' as const),
      children: fc.array(tie('node'), { minLength: 0, maxLength: 3 }),
    }),
  ),
})).node;

// A forest of top-level nodes (breadth at the root) with at least one node so
// the generated tree is meaningful.
const forestArb: fc.Arbitrary<Skeleton[]> = fc.array(skeletonArb, {
  minLength: 1,
  maxLength: 4,
});

// Distinctive marker tokens. The trailing "END" prevents substring collisions
// (e.g. TXTMARK5END is not a substring of TXTMARK50END) and the uppercase
// prefixes never appear in the generated boilerplate.
const textToken = (id: number): string => `TXTMARK${id}END`;
const containerToken = (id: number): string => `CONTMARK${id}END`;

interface BuiltForest {
  nodes: ParsedNode[];
  containerCount: number;
  textCount: number;
  textTokens: string[];
  containerTokens: string[];
}

function buildForest(skeletons: Skeleton[]): BuiltForest {
  let counter = 0;
  let containerCount = 0;
  let textCount = 0;
  const textTokens: string[] = [];
  const containerTokens: string[] = [];

  const build = (skel: Skeleton): ParsedNode => {
    const id = counter++;

    if (skel.type === 'text') {
      textCount++;
      const content = textToken(id);
      textTokens.push(content);
      return {
        id: `n${id}`,
        name: `Text${id}`,
        sanitizedName: `Text${id}`,
        nodeType: 'text',
        htmlTag: 'span',
        content,
        layout: { display: 'block' },
        styles: { className: '', cssProperties: {} },
      };
    }

    containerCount++;
    const className = containerToken(id);
    containerTokens.push(className);
    // Build children after assigning this container's id so a parent's marker
    // is always introduced before its descendants' markers (pre-order).
    const children = skel.children.map(build);
    return {
      id: `n${id}`,
      name: `Cont${id}`,
      sanitizedName: `Cont${id}`,
      nodeType: 'container',
      htmlTag: 'section',
      layout: { display: 'block' },
      styles: { className, cssProperties: {} },
      children,
    };
  };

  const nodes = skeletons.map(build);
  return { nodes, containerCount, textCount, textTokens, containerTokens };
}

// Pre-order token sequence mirroring how the generator emits JSX: for a
// container we record its opening marker (className) then recurse into children;
// for a text node we record its content marker.
function preorderTokens(nodes: ParsedNode[]): string[] {
  const tokens: string[] = [];
  for (const node of nodes) {
    if (node.nodeType === 'text') {
      tokens.push(node.content as string);
    } else {
      tokens.push(node.styles.className);
      if (node.children) {
        tokens.push(...preorderTokens(node.children));
      }
    }
  }
  return tokens;
}

function makeFrame(children: ParsedNode[]): ParsedFrame {
  return {
    id: 'frame-root',
    name: 'Root',
    sanitizedName: 'RootComponent',
    nodeType: 'frame',
    layout: { display: 'block' },
    // A className with no marker token so it never interferes with assertions.
    styles: { className: 'root-frame', cssProperties: {} },
    children,
  };
}

const countOccurrences = (haystack: string, needle: string): number =>
  haystack.split(needle).length - 1;

describe('ComponentGenerator - Property 24: Component Hierarchy Preservation', () => {
  const options: GeneratorOptions = {
    namingConvention: 'pascal',
    useTailwind: false,
    outputDir: 'out',
  };

  it('preserves nested hierarchy and ordering in generated JSX (Validates: Requirements 7.6)', () => {
    fc.assert(
      fc.property(forestArb, (skeletons) => {
        const built = buildForest(skeletons);
        const frame = makeFrame(built.nodes);

        const generator = new ComponentGenerator();
        const code = generator.generate(frame, options).content;

        // 1. Every text node's content appears in the generated JSX.
        for (const token of built.textTokens) {
          expect(code).toContain(token);
        }

        // 2. Relative nesting/order is preserved: the pre-order sequence of
        //    markers (parent opening tag before descendants, siblings in order)
        //    appears in strictly increasing positions in the generated code.
        const tokens = preorderTokens(built.nodes);
        let lastIndex = -1;
        for (const token of tokens) {
          const index = code.indexOf(token);
          // Token must exist and must come after the previous token, which
          // captures both sibling ordering (A before B) and the
          // descendant-after-ancestor-open relationship.
          expect(index).toBeGreaterThan(lastIndex);
          lastIndex = index;
        }

        // 3. No dropped nodes: container opening tags, container closing tags,
        //    and text element tags each match the number of nodes.
        const openContainers = countOccurrences(code, '<section className="');
        const closeContainers = countOccurrences(code, '</section>');
        const textElements = countOccurrences(code, '<span className="');
        expect(openContainers).toBe(built.containerCount);
        expect(closeContainers).toBe(built.containerCount);
        expect(textElements).toBe(built.textCount);

        // Each container marker appears exactly once (uniquely placed).
        for (const token of built.containerTokens) {
          expect(countOccurrences(code, token)).toBe(1);
        }

        // 4. JSX braces and parentheses remain balanced.
        expect(countOccurrences(code, '{')).toBe(countOccurrences(code, '}'));
        expect(countOccurrences(code, '(')).toBe(countOccurrences(code, ')'));
      }),
      { numRuns: 100 },
    );
  });

  it('preserves a known deeply nested structure (deterministic example)', () => {
    // Root
    //  ├─ Container A
    //  │   ├─ text "A1"
    //  │   └─ Container B
    //  │        └─ text "B1"
    //  └─ text "ROOT_TXT"
    const innerText: ParsedNode = {
      id: 'b-text',
      name: 'BText',
      sanitizedName: 'BText',
      nodeType: 'text',
      htmlTag: 'span',
      content: 'B1_CONTENT',
      layout: { display: 'block' },
      styles: { className: '', cssProperties: {} },
    };
    const containerB: ParsedNode = {
      id: 'b',
      name: 'ContB',
      sanitizedName: 'ContB',
      nodeType: 'container',
      htmlTag: 'section',
      layout: { display: 'block' },
      styles: { className: 'CONT_B', cssProperties: {} },
      children: [innerText],
    };
    const aText: ParsedNode = {
      id: 'a-text',
      name: 'AText',
      sanitizedName: 'AText',
      nodeType: 'text',
      htmlTag: 'span',
      content: 'A1_CONTENT',
      layout: { display: 'block' },
      styles: { className: '', cssProperties: {} },
    };
    const containerA: ParsedNode = {
      id: 'a',
      name: 'ContA',
      sanitizedName: 'ContA',
      nodeType: 'container',
      htmlTag: 'section',
      layout: { display: 'block' },
      styles: { className: 'CONT_A', cssProperties: {} },
      children: [aText, containerB],
    };
    const rootText: ParsedNode = {
      id: 'root-text',
      name: 'RootText',
      sanitizedName: 'RootText',
      nodeType: 'text',
      htmlTag: 'span',
      content: 'ROOT_TXT_CONTENT',
      layout: { display: 'block' },
      styles: { className: '', cssProperties: {} },
    };

    const frame = makeFrame([containerA, rootText]);
    const code = new ComponentGenerator().generate(frame, options).content;

    // Expected pre-order: CONT_A, A1, CONT_B, B1, ROOT_TXT
    const order = ['CONT_A', 'A1_CONTENT', 'CONT_B', 'B1_CONTENT', 'ROOT_TXT_CONTENT'];
    const indices = order.map((t) => code.indexOf(t));
    indices.forEach((idx) => expect(idx).toBeGreaterThanOrEqual(0));
    for (let i = 1; i < indices.length; i++) {
      expect(indices[i]).toBeGreaterThan(indices[i - 1]);
    }

    // B1's content sits inside Container B, which sits inside Container A:
    // ancestor open < descendant content < ancestor close.
    const contAOpen = code.indexOf('<section className="CONT_A">');
    const contAClose = code.lastIndexOf('</section>');
    const b1Index = code.indexOf('B1_CONTENT');
    expect(contAOpen).toBeGreaterThanOrEqual(0);
    expect(b1Index).toBeGreaterThan(contAOpen);
    expect(b1Index).toBeLessThan(contAClose);

    // Two containers => two opening and two closing section tags.
    expect(countOccurrences(code, '<section className="')).toBe(2);
    expect(countOccurrences(code, '</section>')).toBe(2);
  });
});
