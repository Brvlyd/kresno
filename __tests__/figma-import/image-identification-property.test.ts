/**
 * Property-Based Test for Image Resource Identification
 * Task 8.2: Write property test for image resource identification
 *
 * **Validates: Requirements 6.1**
 * Property 18: For any node containing an image fill, the Asset_Downloader SHALL
 * identify the image resource and its associated node ID for export.
 *
 * Strategy: generate random parsed node trees containing a mix of image and
 * non-image nodes at arbitrary nesting depths, then verify that
 * `identifyImageNodes` returns exactly the image nodes (count + identity),
 * `getImageNodeIds` preserves their IDs, and no non-image node is ever included.
 */

import { AssetDownloader } from '../../lib/figma-import/core/asset-downloader';
import { ParsedNode } from '../../lib/figma-import/types/internal-models';
import * as fc from 'fast-check';

describe('AssetDownloader - Property: Image Resource Identification', () => {
  let downloader: AssetDownloader;

  beforeEach(() => {
    downloader = new AssetDownloader();
  });

  // All valid internal node types, including 'image'.
  const nodeTypeArb = fc.constantFrom<ParsedNode['nodeType']>(
    'frame',
    'group',
    'component',
    'instance',
    'container',
    'text',
    'image',
    'shape'
  );

  /**
   * Raw (id-less) node shape used purely for tree-structure generation.
   * IDs are assigned afterwards so every node in the tree is guaranteed unique,
   * which makes ID-based assertions meaningful.
   */
  interface RawNode {
    nodeType: ParsedNode['nodeType'];
    name: string;
    children: RawNode[];
  }

  // Recursive generator for a node with children up to a bounded depth.
  const rawNodeArb = (depth: number): fc.Arbitrary<RawNode> => {
    if (depth <= 0) {
      return fc.record({
        nodeType: nodeTypeArb,
        name: fc.string(),
        children: fc.constant<RawNode[]>([]),
      });
    }
    return fc.record({
      nodeType: nodeTypeArb,
      name: fc.string(),
      children: fc.array(rawNodeArb(depth - 1), { maxLength: 3 }),
    });
  };

  // A forest (array of root nodes) with arbitrary depth and breadth.
  const forestArb = fc.array(rawNodeArb(4), { maxLength: 4 });

  /** Assign unique sequential IDs and materialize full ParsedNode objects. */
  const toParsedNodes = (raws: RawNode[]): ParsedNode[] => {
    let counter = 0;
    const convert = (raw: RawNode): ParsedNode => {
      const id = `node-${counter++}`;
      const childNodes = raw.children.map(convert);
      return {
        id,
        name: raw.name,
        sanitizedName: raw.name,
        nodeType: raw.nodeType,
        htmlTag: raw.nodeType === 'image' ? 'img' : 'div',
        layout: { display: 'block' },
        styles: { className: 'c', cssProperties: {} },
        children: childNodes.length > 0 ? childNodes : undefined,
      };
    };
    return raws.map(convert);
  };

  /** Reference implementation: collect every image node, depth-first pre-order. */
  const collectImageNodes = (nodes: ParsedNode[]): ParsedNode[] => {
    const out: ParsedNode[] = [];
    const walk = (node: ParsedNode) => {
      if (node.nodeType === 'image') {
        out.push(node);
      }
      node.children?.forEach(walk);
    };
    nodes.forEach(walk);
    return out;
  };

  it('property: identifyImageNodes returns exactly the image nodes (count and identity), regardless of depth', () => {
    fc.assert(
      fc.property(forestArb, (raws) => {
        const nodes = toParsedNodes(raws);
        const expected = collectImageNodes(nodes);

        const result = downloader.identifyImageNodes(nodes);

        // Same count of image nodes...
        expect(result).toHaveLength(expected.length);
        // ...and same identities (exact object references, in the same order).
        expect(result).toEqual(expected);
      }),
      { numRuns: 200 }
    );
  });

  it('property: getImageNodeIds preserves the IDs of every image node', () => {
    fc.assert(
      fc.property(forestArb, (raws) => {
        const nodes = toParsedNodes(raws);
        const expectedIds = collectImageNodes(nodes).map((node) => node.id);

        const ids = downloader.getImageNodeIds(nodes);

        // IDs match the image nodes exactly (count, identity, and order).
        expect(ids).toEqual(expectedIds);
        // IDs are unique because the tree assigns unique IDs.
        expect(new Set(ids).size).toBe(ids.length);
      }),
      { numRuns: 200 }
    );
  });

  it('property: non-image nodes are never included in the result', () => {
    fc.assert(
      fc.property(forestArb, (raws) => {
        const nodes = toParsedNodes(raws);

        const result = downloader.identifyImageNodes(nodes);

        // Every returned node must be an image node.
        result.forEach((node) => {
          expect(node.nodeType).toBe('image');
        });
      }),
      { numRuns: 200 }
    );
  });
});
