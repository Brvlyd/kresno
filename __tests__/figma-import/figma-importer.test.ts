/**
 * Tests for FigmaImporter (Orchestrator)
 *
 * These tests drive the orchestrator with mocked collaborators so the complete
 * workflow can be exercised without network or disk access. They cover:
 *   - the happy path (success + correct counts + file list),
 *   - configuration validation failure (success: false with errors),
 *   - authentication / file-fetch failure short-circuiting the run,
 *   - recoverable asset-download failures being collected without aborting.
 */

import * as path from 'path';

import { FigmaImporter } from '../../lib/figma-import/core/figma-importer';
import { FigmaApiClient } from '../../lib/figma-import/core/figma-api-client';
import { DesignParser } from '../../lib/figma-import/core/design-parser';
import { ComponentGenerator } from '../../lib/figma-import/core/component-generator';
import { StylesheetGenerator } from '../../lib/figma-import/core/stylesheet-generator';
import { AssetDownloader } from '../../lib/figma-import/core/asset-downloader';
import { ImportConfig } from '../../lib/figma-import/types/config';
import { ParsedDesign, ParsedFrame } from '../../lib/figma-import/types/internal-models';
import { FigmaFile } from '../../lib/figma-import/types/figma-api';

// ---------------------------------------------------------------------------
// Fixtures / helpers
// ---------------------------------------------------------------------------

const validConfig = (overrides: Partial<ImportConfig> = {}): ImportConfig => ({
  fileUrl: 'https://www.figma.com/file/ABC123/Test',
  token: 'figd_test_token',
  outputDir: 'out/components',
  assetsDir: 'out/assets',
  useTailwind: false,
  namingConvention: 'pascal',
  imageFormat: 'png',
  imageScale: 2,
  ...overrides,
});

const sampleFrame = (): ParsedFrame => ({
  id: 'frame-1',
  name: 'Card',
  sanitizedName: 'Card',
  nodeType: 'frame',
  layout: { display: 'block' },
  styles: { className: 'card', cssProperties: {} },
  children: [
    {
      id: '1:1',
      name: 'Hero',
      sanitizedName: 'Hero',
      nodeType: 'image',
      htmlTag: 'img',
      layout: { display: 'block' },
      styles: { className: 'hero', cssProperties: {} },
    },
  ],
});

const sampleDesign = (): ParsedDesign => ({
  metadata: {
    fileName: 'Test File',
    fileKey: '',
    lastModified: new Date('2024-01-01T00:00:00Z'),
    version: '1',
  },
  pages: [
    {
      id: 'page-1',
      name: 'Page 1',
      frames: [sampleFrame()],
    },
  ],
  componentLibrary: { components: new Map() },
  styleGuide: { colors: new Map(), typography: new Map(), effects: new Map() },
});

const sampleFigmaFile = (): FigmaFile =>
  ({
    name: 'Test File',
    lastModified: '2024-01-01T00:00:00Z',
    version: '1',
    document: { id: '0:0', name: 'Document', type: 'DOCUMENT', visible: true, children: [] },
    components: {},
    componentSets: {},
    styles: {},
    schemaVersion: 0,
  } as unknown as FigmaFile);

/**
 * Build a set of mocked collaborators with sensible happy-path defaults. Tests
 * override individual mocks as needed.
 */
function buildMocks() {
  const apiClient = {
    authenticate: jest.fn().mockResolvedValue(undefined),
    extractFileKey: jest.fn().mockReturnValue('ABC123'),
    getFile: jest.fn().mockResolvedValue(sampleFigmaFile()),
    getImages: jest.fn().mockResolvedValue({ '1:1': 'https://example.com/hero.png' }),
  } as unknown as jest.Mocked<FigmaApiClient>;

  const parser = {
    validateStructure: jest.fn().mockReturnValue({ isValid: true, warnings: [], errors: [] }),
    parse: jest.fn().mockReturnValue(sampleDesign()),
    getWarnings: jest.fn().mockReturnValue([]),
  } as unknown as jest.Mocked<DesignParser>;

  const componentGenerator = {
    resolveComponentReferences: jest.fn().mockReturnValue(new Map()),
    generate: jest.fn().mockReturnValue({
      name: 'Card',
      filePath: 'out/components/Card.tsx',
      content: '// Card component',
      dependencies: [],
    }),
  } as unknown as jest.Mocked<ComponentGenerator>;

  const stylesheetGenerator = {
    generateCssModule: jest.fn().mockReturnValue({
      fileName: 'Card.module.css',
      content: '/* Card */',
    }),
  } as unknown as jest.Mocked<StylesheetGenerator>;

  const assetDownloader = {
    getImageNodeIds: jest.fn().mockReturnValue(['1:1']),
    downloadAssets: jest.fn().mockResolvedValue({
      successful: [
        {
          nodeId: '1:1',
          nodeName: 'Hero',
          fileName: 'hero.png',
          filePath: 'out/assets/hero.png',
          size: 1024,
        },
      ],
      failed: [],
    }),
  } as unknown as jest.Mocked<AssetDownloader>;

  const writeFile = jest.fn();

  // Deterministic clock: first call = start, second = end (+100ms).
  let tick = 1000;
  const now = jest.fn(() => {
    const value = tick;
    tick += 100;
    return value;
  });

  return {
    apiClient,
    parser,
    componentGenerator,
    stylesheetGenerator,
    assetDownloader,
    writeFile,
    now,
  };
}

function makeImporter(mocks: ReturnType<typeof buildMocks>) {
  return new FigmaImporter({
    apiClient: mocks.apiClient,
    parser: mocks.parser,
    componentGenerator: mocks.componentGenerator,
    stylesheetGenerator: mocks.stylesheetGenerator,
    assetDownloader: mocks.assetDownloader,
    writeFile: mocks.writeFile,
    now: mocks.now,
    // Avoid touching disk for the persisted summary report.
    writeSummaryReport: false,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('FigmaImporter', () => {
  describe('happy path', () => {
    it('returns success with correct counts and a complete file list', async () => {
      const mocks = buildMocks();
      const importer = makeImporter(mocks);

      const result = await importer.import(validConfig());

      expect(result.success).toBe(true);
      expect(result.componentsGenerated).toBe(1);
      expect(result.assetsDownloaded).toBe(1);
      expect(result.errors).toEqual([]);
      expect(result.duration).toBeGreaterThanOrEqual(0);

      // File list contains the component, the downloaded asset, and the
      // generated CSS-module stylesheet (Tailwind disabled).
      expect(result.files).toEqual(
        expect.arrayContaining([
          'out/components/Card.tsx',
          'out/assets/hero.png',
          path.join('out/components', 'Card.module.css'),
        ])
      );
    });

    it('executes the workflow steps in order', async () => {
      const mocks = buildMocks();
      const importer = makeImporter(mocks);

      await importer.import(validConfig());

      expect(mocks.apiClient.authenticate).toHaveBeenCalledWith('figd_test_token');
      expect(mocks.apiClient.extractFileKey).toHaveBeenCalledWith(
        'https://www.figma.com/file/ABC123/Test'
      );
      expect(mocks.apiClient.getFile).toHaveBeenCalledWith('ABC123');
      expect(mocks.parser.validateStructure).toHaveBeenCalled();
      expect(mocks.parser.parse).toHaveBeenCalled();
      expect(mocks.apiClient.getImages).toHaveBeenCalledWith('ABC123', ['1:1'], {
        format: 'png',
        scale: 2,
      });
      expect(mocks.componentGenerator.generate).toHaveBeenCalledTimes(1);
      expect(mocks.assetDownloader.downloadAssets).toHaveBeenCalled();
      // Component + stylesheet written via the injected writer.
      expect(mocks.writeFile).toHaveBeenCalledWith('out/components/Card.tsx', '// Card component');
      expect(mocks.writeFile).toHaveBeenCalledWith(
        path.join('out/components', 'Card.module.css'),
        '/* Card */'
      );
    });

    it('does not generate stylesheets when Tailwind is enabled', async () => {
      const mocks = buildMocks();
      const importer = makeImporter(mocks);

      const result = await importer.import(validConfig({ useTailwind: true }));

      expect(result.success).toBe(true);
      expect(mocks.stylesheetGenerator.generateCssModule).not.toHaveBeenCalled();
      expect(result.files).not.toContain(path.join('out/components', 'Card.module.css'));
    });
  });

  describe('configuration validation failure', () => {
    it('returns success: false with errors and does not call the API', async () => {
      const mocks = buildMocks();
      const importer = makeImporter(mocks);

      // Missing fileUrl + token => real ConfigLoader.validate throws.
      const result = await importer.import(
        validConfig({ fileUrl: '', token: '' })
      );

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some((e) => e.includes('fileUrl'))).toBe(true);
      expect(result.componentsGenerated).toBe(0);
      expect(result.assetsDownloaded).toBe(0);

      // Workflow short-circuited before any API interaction.
      expect(mocks.apiClient.authenticate).not.toHaveBeenCalled();
      expect(mocks.parser.parse).not.toHaveBeenCalled();
    });
  });

  describe('fatal failures short-circuit the run', () => {
    it('returns success: false when authentication fails', async () => {
      const mocks = buildMocks();
      mocks.apiClient.authenticate.mockRejectedValueOnce(
        new Error('Authentication failed: Invalid or expired token.')
      );
      const importer = makeImporter(mocks);

      const result = await importer.import(validConfig());

      expect(result.success).toBe(false);
      expect(result.errors).toEqual([
        'Authentication failed: Invalid or expired token.',
      ]);
      expect(result.componentsGenerated).toBe(0);
      // Did not proceed to fetch the file.
      expect(mocks.apiClient.getFile).not.toHaveBeenCalled();
      expect(mocks.parser.parse).not.toHaveBeenCalled();
    });

    it('returns success: false when fetching the file fails', async () => {
      const mocks = buildMocks();
      mocks.apiClient.getFile.mockRejectedValueOnce(
        new Error('File not found: key "ABC123".')
      );
      const importer = makeImporter(mocks);

      const result = await importer.import(validConfig());

      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('File not found');
      expect(mocks.componentGenerator.generate).not.toHaveBeenCalled();
    });

    it('returns success: false when structure validation fails', async () => {
      const mocks = buildMocks();
      mocks.parser.validateStructure.mockReturnValueOnce({
        isValid: false,
        warnings: [],
        errors: [{ message: 'File must contain at least one canvas/page', severity: 'error' }],
      });
      const importer = makeImporter(mocks);

      const result = await importer.import(validConfig());

      expect(result.success).toBe(false);
      expect(result.errors).toContain('File must contain at least one canvas/page');
      expect(mocks.parser.parse).not.toHaveBeenCalled();
    });
  });

  describe('graceful degradation', () => {
    it('collects asset-download failures as errors without aborting the run', async () => {
      const mocks = buildMocks();
      mocks.assetDownloader.downloadAssets.mockResolvedValueOnce({
        successful: [],
        failed: [{ nodeId: '1:1', nodeName: 'Hero', error: 'Network error' }],
      });
      const importer = makeImporter(mocks);

      const result = await importer.import(validConfig());

      // The run completed end-to-end despite the failed download.
      expect(result.success).toBe(true);
      expect(result.componentsGenerated).toBe(1);
      expect(result.assetsDownloaded).toBe(0);
      // Failed-asset error surfaced in the result.
      expect(result.errors.some((e) => e.includes('Network error'))).toBe(true);
      expect(result.errors.some((e) => e.includes('Hero'))).toBe(true);
    });

    it('continues when image URL export fails and still generates components', async () => {
      const mocks = buildMocks();
      mocks.apiClient.getImages.mockRejectedValueOnce(new Error('rate limited'));
      const importer = makeImporter(mocks);

      const result = await importer.import(validConfig());

      expect(result.success).toBe(true);
      expect(result.componentsGenerated).toBe(1);
      expect(result.assetsDownloaded).toBe(0);
      expect(result.errors.some((e) => e.includes('rate limited'))).toBe(true);
      // Without image URLs the downloader is never invoked.
      expect(mocks.assetDownloader.downloadAssets).not.toHaveBeenCalled();
    });

    it('continues generating remaining components when one frame fails', async () => {
      const mocks = buildMocks();
      // Two frames; the first generate call throws, the second succeeds.
      const design = sampleDesign();
      const secondFrame = sampleFrame();
      secondFrame.id = 'frame-2';
      secondFrame.name = 'Banner';
      secondFrame.sanitizedName = 'Banner';
      secondFrame.children = [];
      design.pages[0].frames.push(secondFrame);
      mocks.parser.parse.mockReturnValueOnce(design);

      (mocks.componentGenerator.generate as jest.Mock)
        .mockImplementationOnce(() => {
          throw new Error('bad frame');
        })
        .mockImplementationOnce(() => ({
          name: 'Banner',
          filePath: 'out/components/Banner.tsx',
          content: '// Banner',
          dependencies: [],
        }));

      const importer = makeImporter(mocks);
      const result = await importer.import(validConfig());

      expect(result.success).toBe(true);
      expect(result.componentsGenerated).toBe(1);
      expect(result.errors.some((e) => e.includes('bad frame'))).toBe(true);
      expect(result.files).toContain('out/components/Banner.tsx');
    });
  });
});
