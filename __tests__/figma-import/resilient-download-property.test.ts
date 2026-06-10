/**
 * Property-Based Tests for Resilient Asset Download
 * Task 8.8: Write property test for resilient download
 *
 * **Validates: Requirements 6.5**
 * Property 20: Resilient Asset Download
 * For any failed asset download, the Asset_Downloader SHALL log the error with
 * details and continue processing remaining assets without halting the import.
 *
 * Strategy: generate a random set of image nodes where each node is randomly
 * assigned a download outcome (success, network error, HTTP error, or missing
 * URL). `fetch` and `fs` are mocked so each node's outcome is deterministic,
 * then we assert the resilience invariants hold for ANY mix of outcomes.
 */

import { AssetDownloader } from '../../lib/figma-import/core/asset-downloader';
import { ParsedNode } from '../../lib/figma-import/types/internal-models';
import { ImageUrls } from '../../lib/figma-import/types/figma-api';
import * as fs from 'fs';
import * as fc from 'fast-check';

// Mock fs module (follows the pattern from asset-downloader.test.ts)
jest.mock('fs');
const mockFs = fs as jest.Mocked<typeof fs>;

// Mock fetch globally (follows the pattern from asset-downloader.test.ts)
const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

/** The four possible download outcomes assigned to each generated node. */
type Outcome = 'success' | 'network-error' | 'http-error' | 'missing-url';

const outcomeArb = fc.constantFrom<Outcome>(
  'success',
  'network-error',
  'http-error',
  'missing-url'
);

/**
 * Build an image ParsedNode for the given index. Every node is an `image` node
 * so the downloader treats all of them as downloadable assets.
 */
function makeImageNode(index: number): ParsedNode {
  const id = `node-${index}`;
  return {
    id,
    name: `Image ${index}`,
    sanitizedName: `Image${index}`,
    nodeType: 'image',
    htmlTag: 'img',
    layout: { display: 'block' },
    styles: { className: `image-${index}`, cssProperties: {} },
  };
}

/** Deterministic URL for a node id (only used for non missing-url nodes). */
function urlFor(id: string): string {
  return `https://example.com/${id}.png`;
}

describe('Property-Based Test: Resilient Asset Download (Property 20)', () => {
  const testOutputDir = '/test/output';

  beforeEach(() => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.writeFileSync.mockImplementation(() => {});
    mockFs.mkdirSync.mockImplementation(() => '');
  });

  it('resolves for any mix of outcomes, accounts for every node, and never lets one failure block other downloads', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(outcomeArb, { minLength: 0, maxLength: 25 }),
        async (outcomes) => {
          const downloader = new AssetDownloader();

          // Build nodes + their outcome map keyed by node id.
          const nodes: ParsedNode[] = outcomes.map((_, i) => makeImageNode(i));
          const outcomeById = new Map<string, Outcome>();
          nodes.forEach((node, i) => outcomeById.set(node.id, outcomes[i]));

          // Build imageUrls: every node gets a URL EXCEPT missing-url nodes.
          const imageUrls: ImageUrls = {};
          for (const node of nodes) {
            if (outcomeById.get(node.id) !== 'missing-url') {
              imageUrls[node.id] = urlFor(node.id);
            }
          }

          // Map URL -> outcome so the fetch mock can respond per node.
          const outcomeByUrl = new Map<string, Outcome>();
          for (const node of nodes) {
            const outcome = outcomeById.get(node.id)!;
            if (outcome !== 'missing-url') {
              outcomeByUrl.set(urlFor(node.id), outcome);
            }
          }

          // Configure the fetch mock for this run.
          mockFetch.mockReset();
          mockFetch.mockImplementation(async (url: string) => {
            const outcome = outcomeByUrl.get(url);
            if (outcome === 'network-error') {
              throw new Error('Network error');
            }
            if (outcome === 'http-error') {
              return {
                ok: false,
                status: 500,
                statusText: 'Internal Server Error',
              } as Response;
            }
            // success
            return {
              ok: true,
              arrayBuffer: async () => new ArrayBuffer(256),
            } as Response;
          });

          // Invariant: downloadAssets always resolves (never throws) regardless
          // of how many assets fail.
          const result = await downloader.downloadAssets(nodes, imageUrls, testOutputDir);

          // Partition the expected ids by designated outcome.
          const expectedSuccessIds = nodes
            .filter((n) => outcomeById.get(n.id) === 'success')
            .map((n) => n.id);
          const expectedFailedIds = nodes
            .filter((n) => outcomeById.get(n.id) !== 'success')
            .map((n) => n.id);

          const successfulIds = result.successful.map((a) => a.nodeId);
          const failedIds = result.failed.map((f) => f.nodeId);

          // Invariant: every node is accounted for exactly once.
          expect(result.successful.length + result.failed.length).toBe(nodes.length);

          // Invariant: each node designated to succeed appears in successful.
          for (const id of expectedSuccessIds) {
            expect(successfulIds).toContain(id);
          }

          // Invariant: each node designated to fail appears in failed with a
          // non-empty error message (the error is recorded/logged with detail).
          for (const id of expectedFailedIds) {
            expect(failedIds).toContain(id);
            const failure = result.failed.find((f) => f.nodeId === id);
            expect(failure).toBeDefined();
            expect(typeof failure!.error).toBe('string');
            expect(failure!.error.length).toBeGreaterThan(0);
          }

          // Invariant: a failure never prevents successful assets from being
          // downloaded — ALL designated successes are present, and each one had
          // its file written, no matter how many siblings failed.
          expect(successfulIds.sort()).toEqual([...expectedSuccessIds].sort());
          expect(result.successful.every((a) => a.size > 0)).toBe(true);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('guarantees survivors download even when failures are interleaved with successes', async () => {
    // Targeted scenario: alternate failing and succeeding nodes to confirm an
    // early/!batch failure does not abort the remaining work.
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 12 }),
        async (pairs) => {
          const downloader = new AssetDownloader();

          // Even index -> network error, odd index -> success.
          const nodes: ParsedNode[] = Array.from({ length: pairs * 2 }, (_, i) =>
            makeImageNode(i)
          );
          const imageUrls: ImageUrls = {};
          for (const node of nodes) {
            imageUrls[node.id] = urlFor(node.id);
          }

          const failingIds = new Set(
            nodes.filter((_, i) => i % 2 === 0).map((n) => n.id)
          );

          mockFetch.mockReset();
          mockFetch.mockImplementation(async (url: string) => {
            const id = url.replace('https://example.com/', '').replace('.png', '');
            if (failingIds.has(id)) {
              throw new Error('Network error');
            }
            return {
              ok: true,
              arrayBuffer: async () => new ArrayBuffer(128),
            } as Response;
          });

          const result = await downloader.downloadAssets(nodes, imageUrls, testOutputDir);

          // Half succeed, half fail — every survivor is present.
          expect(result.successful).toHaveLength(pairs);
          expect(result.failed).toHaveLength(pairs);

          const successfulIds = new Set(result.successful.map((a) => a.nodeId));
          for (const node of nodes) {
            if (!failingIds.has(node.id)) {
              expect(successfulIds.has(node.id)).toBe(true);
            }
          }
        }
      ),
      { numRuns: 50 }
    );
  });
});
