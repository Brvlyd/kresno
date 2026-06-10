/**
 * Tests for AssetDownloader
 */

import {
  AssetDownloader,
  DEFAULT_ASSETS_DIR,
  DEFAULT_IMAGE_FORMAT,
  DEFAULT_IMAGE_SCALE,
} from '../../lib/figma-import/core/asset-downloader';
import { ParsedNode } from '../../lib/figma-import/types/internal-models';
import { ImageUrls } from '../../lib/figma-import/types/figma-api';
import * as fs from 'fs';
import * as path from 'path';

// Mock fs module
jest.mock('fs');
const mockFs = fs as jest.Mocked<typeof fs>;

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

describe('AssetDownloader', () => {
  let downloader: AssetDownloader;
  const testOutputDir = '/test/output';

  beforeEach(() => {
    downloader = new AssetDownloader();
    mockFetch.mockReset();
    mockFs.existsSync.mockReturnValue(true);
    mockFs.writeFileSync.mockImplementation(() => {});
    mockFs.mkdirSync.mockImplementation(() => '');
  });

  describe('generateFilename', () => {
    it('should convert to lowercase with hyphens', () => {
      const filename = downloader.generateFilename('My Image File', 'png');
      expect(filename).toBe('my-image-file.png');
    });

    it('should handle underscores', () => {
      const filename = downloader.generateFilename('my_image_file', 'png');
      expect(filename).toBe('my-image-file.png');
    });

    it('should remove special characters', () => {
      const filename = downloader.generateFilename('My Image! @#$% File', 'png');
      expect(filename).toBe('my-image-file.png');
    });

    it('should handle multiple spaces', () => {
      const filename = downloader.generateFilename('My    Image    File', 'png');
      expect(filename).toBe('my-image-file.png');
    });

    it('should remove consecutive hyphens', () => {
      const filename = downloader.generateFilename('My---Image---File', 'png');
      expect(filename).toBe('my-image-file.png');
    });

    it('should remove leading/trailing hyphens', () => {
      const filename = downloader.generateFilename('-My Image File-', 'png');
      expect(filename).toBe('my-image-file.png');
    });

    it('should use "unnamed" for empty name', () => {
      const filename = downloader.generateFilename('', 'png');
      expect(filename).toBe('unnamed.png');
    });

    it('should use "unnamed" for name with only special characters', () => {
      const filename = downloader.generateFilename('!@#$%^&*()', 'png');
      expect(filename).toBe('unnamed.png');
    });

    it('should handle different formats', () => {
      const filename1 = downloader.generateFilename('My Image', 'jpg');
      expect(filename1).toBe('my-image.jpg');

      const filename2 = downloader.generateFilename('My Image', 'svg');
      expect(filename2).toBe('my-image.svg');
    });
  });

  describe('handleDuplicates', () => {
    it('should return original filename if no collision', () => {
      const existingFiles = new Set<string>();
      const result = downloader.handleDuplicates('image.png', existingFiles);
      expect(result).toBe('image.png');
    });

    it('should append -1 for first duplicate', () => {
      const existingFiles = new Set(['image.png']);
      const result = downloader.handleDuplicates('image.png', existingFiles);
      expect(result).toBe('image-1.png');
    });

    it('should append -2 for second duplicate', () => {
      const existingFiles = new Set(['image.png', 'image-1.png']);
      const result = downloader.handleDuplicates('image.png', existingFiles);
      expect(result).toBe('image-2.png');
    });

    it('should increment counter until unique filename found', () => {
      const existingFiles = new Set(['image.png', 'image-1.png', 'image-2.png', 'image-3.png']);
      const result = downloader.handleDuplicates('image.png', existingFiles);
      expect(result).toBe('image-4.png');
    });

    it('should handle filenames without extension', () => {
      const existingFiles = new Set(['image']);
      const result = downloader.handleDuplicates('image', existingFiles);
      expect(result).toBe('image-1');
    });
  });

  describe('downloadAssets', () => {
    it('should download image assets successfully', async () => {
      const nodes: ParsedNode[] = [
        {
          id: '1:1',
          name: 'Image 1',
          sanitizedName: 'Image1',
          nodeType: 'image',
          htmlTag: 'img',
          layout: { display: 'block' },
          styles: { className: 'image1', cssProperties: {} },
        },
      ];

      const imageUrls: ImageUrls = {
        '1:1': 'https://example.com/image1.png',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(1024),
      } as Response);

      const result = await downloader.downloadAssets(nodes, imageUrls, testOutputDir);

      expect(result.successful).toHaveLength(1);
      expect(result.failed).toHaveLength(0);
      expect(result.successful[0].nodeName).toBe('Image 1');
      expect(result.successful[0].fileName).toBe('image-1.png');
    });

    it('should handle download failures gracefully', async () => {
      const nodes: ParsedNode[] = [
        {
          id: '1:1',
          name: 'Image 1',
          sanitizedName: 'Image1',
          nodeType: 'image',
          htmlTag: 'img',
          layout: { display: 'block' },
          styles: { className: 'image1', cssProperties: {} },
        },
      ];

      const imageUrls: ImageUrls = {
        '1:1': 'https://example.com/image1.png',
      };

      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await downloader.downloadAssets(nodes, imageUrls, testOutputDir);

      expect(result.successful).toHaveLength(0);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].error).toContain('Network error');
    });

    it('should handle missing image URLs', async () => {
      const nodes: ParsedNode[] = [
        {
          id: '1:1',
          name: 'Image 1',
          sanitizedName: 'Image1',
          nodeType: 'image',
          htmlTag: 'img',
          layout: { display: 'block' },
          styles: { className: 'image1', cssProperties: {} },
        },
      ];

      const imageUrls: ImageUrls = {};

      const result = await downloader.downloadAssets(nodes, imageUrls, testOutputDir);

      expect(result.successful).toHaveLength(0);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].error).toContain('No image URL provided');
    });

    it('should handle HTTP errors', async () => {
      const nodes: ParsedNode[] = [
        {
          id: '1:1',
          name: 'Image 1',
          sanitizedName: 'Image1',
          nodeType: 'image',
          htmlTag: 'img',
          layout: { display: 'block' },
          styles: { className: 'image1', cssProperties: {} },
        },
      ];

      const imageUrls: ImageUrls = {
        '1:1': 'https://example.com/image1.png',
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      } as Response);

      const result = await downloader.downloadAssets(nodes, imageUrls, testOutputDir);

      expect(result.successful).toHaveLength(0);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].error).toContain('HTTP 404');
    });

    it('should collect image nodes from nested structures', async () => {
      const nodes: ParsedNode[] = [
        {
          id: '1:1',
          name: 'Frame',
          sanitizedName: 'Frame',
          nodeType: 'frame',
          htmlTag: 'div',
          layout: { display: 'block' },
          styles: { className: 'frame', cssProperties: {} },
          children: [
            {
              id: '2:1',
              name: 'Nested Image',
              sanitizedName: 'NestedImage',
              nodeType: 'image',
              htmlTag: 'img',
              layout: { display: 'block' },
              styles: { className: 'nested-image', cssProperties: {} },
            },
          ],
        },
      ];

      const imageUrls: ImageUrls = {
        '2:1': 'https://example.com/nested.png',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(512),
      } as Response);

      const result = await downloader.downloadAssets(nodes, imageUrls, testOutputDir);

      expect(result.successful).toHaveLength(1);
      expect(result.successful[0].nodeName).toBe('Nested Image');
    });

    it('should handle filename collisions', async () => {
      const nodes: ParsedNode[] = [
        {
          id: '1:1',
          name: 'Image',
          sanitizedName: 'Image',
          nodeType: 'image',
          htmlTag: 'img',
          layout: { display: 'block' },
          styles: { className: 'image', cssProperties: {} },
        },
        {
          id: '1:2',
          name: 'Image',
          sanitizedName: 'Image',
          nodeType: 'image',
          htmlTag: 'img',
          layout: { display: 'block' },
          styles: { className: 'image', cssProperties: {} },
        },
      ];

      const imageUrls: ImageUrls = {
        '1:1': 'https://example.com/image1.png',
        '1:2': 'https://example.com/image2.png',
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          arrayBuffer: async () => new ArrayBuffer(512),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          arrayBuffer: async () => new ArrayBuffer(512),
        } as Response);

      const result = await downloader.downloadAssets(nodes, imageUrls, testOutputDir);

      expect(result.successful).toHaveLength(2);
      expect(result.successful[0].fileName).toBe('image.png');
      expect(result.successful[1].fileName).toBe('image-1.png');
    });

    it('should create output directory if it does not exist', async () => {
      mockFs.existsSync.mockReturnValue(false);

      const nodes: ParsedNode[] = [
        {
          id: '1:1',
          name: 'Image',
          sanitizedName: 'Image',
          nodeType: 'image',
          htmlTag: 'img',
          layout: { display: 'block' },
          styles: { className: 'image', cssProperties: {} },
        },
      ];

      const imageUrls: ImageUrls = {
        '1:1': 'https://example.com/image.png',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(512),
      } as Response);

      await downloader.downloadAssets(nodes, imageUrls, testOutputDir);

      expect(mockFs.mkdirSync).toHaveBeenCalledWith(testOutputDir, { recursive: true });
    });

    it('should download assets in batches with concurrency limit', async () => {
      // Create 10 image nodes
      const nodes: ParsedNode[] = Array.from({ length: 10 }, (_, i) => ({
        id: `1:${i + 1}`,
        name: `Image ${i + 1}`,
        sanitizedName: `Image${i + 1}`,
        nodeType: 'image',
        htmlTag: 'img',
        layout: { display: 'block' },
        styles: { className: `image${i + 1}`, cssProperties: {} },
      }));

      const imageUrls: ImageUrls = Object.fromEntries(
        nodes.map((node) => [node.id, `https://example.com/${node.id}.png`])
      );

      // Mock all fetches to succeed
      for (let i = 0; i < 10; i++) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          arrayBuffer: async () => new ArrayBuffer(512),
        } as Response);
      }

      const result = await downloader.downloadAssets(nodes, imageUrls, testOutputDir);

      expect(result.successful).toHaveLength(10);
      expect(result.failed).toHaveLength(0);
    });
  });

  describe('identifyImageNodes', () => {
    it('should identify top-level image nodes and ignore non-image nodes', () => {
      const nodes: ParsedNode[] = [
        {
          id: '1:1',
          name: 'Logo',
          sanitizedName: 'Logo',
          nodeType: 'image',
          htmlTag: 'img',
          layout: { display: 'block' },
          styles: { className: 'logo', cssProperties: {} },
        },
        {
          id: '1:2',
          name: 'Container',
          sanitizedName: 'Container',
          nodeType: 'frame',
          htmlTag: 'div',
          layout: { display: 'block' },
          styles: { className: 'container', cssProperties: {} },
        },
      ];

      const result = downloader.identifyImageNodes(nodes);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('1:1');
    });

    it('should identify image nodes nested at arbitrary depth', () => {
      const nodes: ParsedNode[] = [
        {
          id: '1:1',
          name: 'Frame',
          sanitizedName: 'Frame',
          nodeType: 'frame',
          htmlTag: 'div',
          layout: { display: 'block' },
          styles: { className: 'frame', cssProperties: {} },
          children: [
            {
              id: '2:1',
              name: 'Group',
              sanitizedName: 'Group',
              nodeType: 'group',
              htmlTag: 'div',
              layout: { display: 'block' },
              styles: { className: 'group', cssProperties: {} },
              children: [
                {
                  id: '3:1',
                  name: 'Deep Image',
                  sanitizedName: 'DeepImage',
                  nodeType: 'image',
                  htmlTag: 'img',
                  layout: { display: 'block' },
                  styles: { className: 'deep-image', cssProperties: {} },
                },
              ],
            },
          ],
        },
      ];

      const result = downloader.identifyImageNodes(nodes);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('3:1');
      expect(result[0].name).toBe('Deep Image');
    });

    it('should return an empty array when there are no image nodes', () => {
      const nodes: ParsedNode[] = [
        {
          id: '1:1',
          name: 'Text',
          sanitizedName: 'Text',
          nodeType: 'text',
          htmlTag: 'p',
          layout: { display: 'block' },
          styles: { className: 'text', cssProperties: {} },
        },
      ];

      expect(downloader.identifyImageNodes(nodes)).toEqual([]);
    });
  });

  describe('getImageNodeIds', () => {
    it('should extract node IDs for all image nodes for the API request', () => {
      const nodes: ParsedNode[] = [
        {
          id: '1:1',
          name: 'Hero',
          sanitizedName: 'Hero',
          nodeType: 'image',
          htmlTag: 'img',
          layout: { display: 'block' },
          styles: { className: 'hero', cssProperties: {} },
        },
        {
          id: '1:2',
          name: 'Frame',
          sanitizedName: 'Frame',
          nodeType: 'frame',
          htmlTag: 'div',
          layout: { display: 'block' },
          styles: { className: 'frame', cssProperties: {} },
          children: [
            {
              id: '2:1',
              name: 'Icon',
              sanitizedName: 'Icon',
              nodeType: 'image',
              htmlTag: 'img',
              layout: { display: 'block' },
              styles: { className: 'icon', cssProperties: {} },
            },
          ],
        },
      ];

      expect(downloader.getImageNodeIds(nodes)).toEqual(['1:1', '2:1']);
    });
  });

  describe('buildExportList', () => {
    it('should build an export list pairing node IDs with intended filenames', () => {
      const nodes: ParsedNode[] = [
        {
          id: '1:1',
          name: 'Hero Banner',
          sanitizedName: 'HeroBanner',
          nodeType: 'image',
          htmlTag: 'img',
          layout: { display: 'block' },
          styles: { className: 'hero', cssProperties: {} },
        },
      ];

      const result = downloader.buildExportList(nodes);

      expect(result).toEqual([
        { nodeId: '1:1', nodeName: 'Hero Banner', fileName: 'hero-banner.png' },
      ]);
    });

    it('should resolve filename collisions across duplicate node names', () => {
      const nodes: ParsedNode[] = [
        {
          id: '1:1',
          name: 'Image',
          sanitizedName: 'Image',
          nodeType: 'image',
          htmlTag: 'img',
          layout: { display: 'block' },
          styles: { className: 'image', cssProperties: {} },
        },
        {
          id: '1:2',
          name: 'Image',
          sanitizedName: 'Image',
          nodeType: 'image',
          htmlTag: 'img',
          layout: { display: 'block' },
          styles: { className: 'image', cssProperties: {} },
        },
      ];

      const result = downloader.buildExportList(nodes);

      expect(result.map((item) => item.fileName)).toEqual(['image.png', 'image-1.png']);
      expect(result.map((item) => item.nodeId)).toEqual(['1:1', '1:2']);
    });

    it('should honor the requested image format extension', () => {
      const nodes: ParsedNode[] = [
        {
          id: '1:1',
          name: 'Vector Art',
          sanitizedName: 'VectorArt',
          nodeType: 'image',
          htmlTag: 'img',
          layout: { display: 'block' },
          styles: { className: 'vector', cssProperties: {} },
        },
      ];

      const result = downloader.buildExportList(nodes, 'svg');

      expect(result[0].fileName).toBe('vector-art.svg');
    });
  });

  // Task 8.9: Unit tests for asset download
  // Requirements: 6.2 (PNG @ 2x defaults), 6.3 (save to configured/public directory)
  describe('default export format and scale (Requirement 6.2)', () => {
    it('should expose PNG as the documented default image format', () => {
      expect(DEFAULT_IMAGE_FORMAT).toBe('png');
    });

    it('should expose 2x as the documented default image scale', () => {
      expect(DEFAULT_IMAGE_SCALE).toBe(2);
    });

    it('should default the downloader instance format to PNG', () => {
      expect(downloader.defaultFormat).toBe('png');
      expect(downloader.defaultFormat).toBe(DEFAULT_IMAGE_FORMAT);
    });

    it('should default the downloader instance scale to 2x', () => {
      expect(downloader.defaultScale).toBe(2);
      expect(downloader.defaultScale).toBe(DEFAULT_IMAGE_SCALE);
    });

    it('should produce .png filenames by default for downloaded assets', async () => {
      const nodes: ParsedNode[] = [
        {
          id: '1:1',
          name: 'Hero Banner',
          sanitizedName: 'HeroBanner',
          nodeType: 'image',
          htmlTag: 'img',
          layout: { display: 'block' },
          styles: { className: 'hero', cssProperties: {} },
        },
      ];

      const imageUrls: ImageUrls = {
        '1:1': 'https://example.com/hero.png',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(256),
      } as Response);

      const result = await downloader.downloadAssets(nodes, imageUrls, testOutputDir);

      expect(result.successful).toHaveLength(1);
      expect(result.successful[0].fileName.endsWith('.png')).toBe(true);
      expect(result.successful[0].fileName).toBe('hero-banner.png');
    });
  });

  describe('default assets directory (Requirement 6.3)', () => {
    it('should resolve the default assets directory to public/figma-assets', () => {
      expect(DEFAULT_ASSETS_DIR).toBe(path.join('public', 'figma-assets'));
    });

    it('should write downloads under the default public directory when outputDir is omitted', async () => {
      const nodes: ParsedNode[] = [
        {
          id: '1:1',
          name: 'Logo',
          sanitizedName: 'Logo',
          nodeType: 'image',
          htmlTag: 'img',
          layout: { display: 'block' },
          styles: { className: 'logo', cssProperties: {} },
        },
      ];

      const imageUrls: ImageUrls = {
        '1:1': 'https://example.com/logo.png',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(256),
      } as Response);

      // Omit outputDir so the downloader falls back to DEFAULT_ASSETS_DIR
      const result = await downloader.downloadAssets(nodes, imageUrls);

      const expectedPath = path.join(DEFAULT_ASSETS_DIR, 'logo.png');
      expect(result.successful).toHaveLength(1);
      expect(result.successful[0].filePath).toBe(expectedPath);
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(expectedPath, expect.anything());
    });
  });

  describe('successful download writes bytes to configured directory (Requirements 6.2, 6.3)', () => {
    it('should write the fetched bytes via fs.writeFileSync to a path under the configured directory', async () => {
      const nodes: ParsedNode[] = [
        {
          id: '1:1',
          name: 'Photo',
          sanitizedName: 'Photo',
          nodeType: 'image',
          htmlTag: 'img',
          layout: { display: 'block' },
          styles: { className: 'photo', cssProperties: {} },
        },
      ];

      const imageUrls: ImageUrls = {
        '1:1': 'https://example.com/photo.png',
      };

      // Distinctive byte payload so we can assert the exact bytes are written
      const payload = new Uint8Array([1, 2, 3, 4, 5]);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => payload.buffer,
      } as Response);

      const result = await downloader.downloadAssets(nodes, imageUrls, testOutputDir);

      const expectedPath = path.join(testOutputDir, 'photo.png');

      // The download must succeed and report the configured directory in its path
      expect(result.successful).toHaveLength(1);
      expect(result.successful[0].filePath).toBe(expectedPath);
      expect(result.successful[0].size).toBe(payload.length);

      // The fetched bytes are written to disk via fs.writeFileSync at the expected path
      const writeCall = mockFs.writeFileSync.mock.calls.find(
        ([writtenPath]) => writtenPath === expectedPath
      );
      expect(writeCall).toBeDefined();

      // The written buffer must contain the same bytes that were fetched
      const writtenBuffer = writeCall![1] as Buffer;
      expect(Buffer.isBuffer(writtenBuffer)).toBe(true);
      expect(Array.from(writtenBuffer)).toEqual(Array.from(payload));
    });

    it('should write every successful asset into the configured directory', async () => {
      const customDir = path.join('build', 'assets');
      const nodes: ParsedNode[] = [
        {
          id: '1:1',
          name: 'First',
          sanitizedName: 'First',
          nodeType: 'image',
          htmlTag: 'img',
          layout: { display: 'block' },
          styles: { className: 'first', cssProperties: {} },
        },
        {
          id: '1:2',
          name: 'Second',
          sanitizedName: 'Second',
          nodeType: 'image',
          htmlTag: 'img',
          layout: { display: 'block' },
          styles: { className: 'second', cssProperties: {} },
        },
      ];

      const imageUrls: ImageUrls = {
        '1:1': 'https://example.com/first.png',
        '1:2': 'https://example.com/second.png',
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          arrayBuffer: async () => new ArrayBuffer(128),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          arrayBuffer: async () => new ArrayBuffer(128),
        } as Response);

      const result = await downloader.downloadAssets(nodes, imageUrls, customDir);

      expect(result.successful).toHaveLength(2);
      for (const asset of result.successful) {
        expect(path.dirname(asset.filePath)).toBe(customDir);
      }
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        path.join(customDir, 'first.png'),
        expect.anything()
      );
      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        path.join(customDir, 'second.png'),
        expect.anything()
      );
    });
  });
});
