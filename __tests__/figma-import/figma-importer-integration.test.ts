/**
 * Integration test for the complete Figma import workflow (Task 16.2).
 *
 * Unlike the unit tests in figma-importer.test.ts (which mock every
 * collaborator), this suite exercises the orchestrator end-to-end against the
 * REAL collaborators:
 *   - DesignParser            (validate + parse the fixture Figma file)
 *   - StyleExtractor          (real instance, injected)
 *   - ComponentGenerator      (emit .tsx for every frame)
 *   - StylesheetGenerator     (emit .module.css when Tailwind is disabled)
 *   - AssetDownloader         (identify image nodes + download via fetch)
 *   - ConfigLoader            (validate the import configuration)
 *   - SummaryReportGenerator  (aggregate counts / files / errors + persist)
 *
 * Only the genuine I/O boundaries are faked:
 *   - the network boundary `FigmaApiClient` is mocked so no real Figma API
 *     calls are made (authenticate / extractFileKey / getFile / getImages),
 *   - `global.fetch` is mocked so the asset downloader performs no real network
 *     download,
 *   - the `fs` module is mocked (jest.mock('fs')) so nothing is written to
 *     disk, and the generated component/stylesheet writes are captured in an
 *     in-memory map via an injected `writeFile`,
 *   - the summary report is persisted through an injected capturing
 *     `FileWriter` so `import-summary.json` never touches disk.
 *
 * The test drives a realistic fixture file (document -> page -> a FRAME and a
 * COMPONENT, with a text node carrying a TypeStyle, an image node with an
 * IMAGE-type Paint fill, and nested auto-layout frames) through the whole
 * pipeline and asserts the generated artefacts and the summary report.
 *
 * _Requirements: All requirements_
 */

import * as path from 'path';
import * as fs from 'fs';

import { FigmaImporter } from '../../lib/figma-import/core/figma-importer';
import { FigmaApiClient } from '../../lib/figma-import/core/figma-api-client';
import { DesignParser } from '../../lib/figma-import/core/design-parser';
import { StyleExtractor } from '../../lib/figma-import/core/style-extractor';
import { ComponentGenerator } from '../../lib/figma-import/core/component-generator';
import { StylesheetGenerator } from '../../lib/figma-import/core/stylesheet-generator';
import { AssetDownloader } from '../../lib/figma-import/core/asset-downloader';
import { ConfigLoader } from '../../lib/figma-import/core/config-loader';
import { SummaryReportGenerator } from '../../lib/figma-import/core/summary-report';
import { ImportConfig } from '../../lib/figma-import/types/config';
import { FigmaFile } from '../../lib/figma-import/types/figma-api';

// ---------------------------------------------------------------------------
// I/O boundary mocks: fs (disk) and fetch (network download).
// ---------------------------------------------------------------------------
jest.mock('fs');
const mockFs = fs as jest.Mocked<typeof fs>;

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

// ---------------------------------------------------------------------------
// Fixture: a realistic Figma file.
// ---------------------------------------------------------------------------

/** A reusable solid Paint (blue) used for text/fills. */
const solidBlue = () => ({
  type: 'SOLID' as const,
  visible: true,
  opacity: 1,
  color: { r: 0.1, g: 0.3, b: 0.85, a: 1 },
});

/** A TypeStyle for the heading text node. */
const headingTypeStyle = () => ({
  fontFamily: 'Inter',
  fontPostScriptName: 'Inter-Bold',
  fontWeight: 700,
  fontSize: 32,
  textAlignHorizontal: 'LEFT' as const,
  textAlignVertical: 'TOP' as const,
  letterSpacing: 0.5,
  lineHeightPx: 40,
  lineHeightPercent: 125,
  fills: [solidBlue()],
});

/** A TypeStyle for body/label text nodes. */
const bodyTypeStyle = () => ({
  fontFamily: 'Inter',
  fontWeight: 400,
  fontSize: 16,
  textAlignHorizontal: 'CENTER' as const,
  textAlignVertical: 'CENTER' as const,
  letterSpacing: 0,
  lineHeightPx: 24,
  lineHeightPercent: 150,
  fills: [solidBlue()],
});

const rect = (x: number, y: number, width: number, height: number) => ({
  x,
  y,
  width,
  height,
});

/**
 * Build a fresh fixture Figma file each call (so stateful collaborators never
 * observe a mutated input across runs).
 *
 * Structure:
 *   DOCUMENT
 *     CANVAS "Page 1"
 *       FRAME "Hero Card" (auto-layout VERTICAL)
 *         TEXT  "Heading"      (TypeStyle)
 *         IMAGE "Hero Image"   (IMAGE-type Paint fill)  id 10:5
 *         FRAME "Action Bar"   (nested, auto-layout HORIZONTAL)
 *           TEXT "Action Label"
 *       COMPONENT "Primary Button" (auto-layout HORIZONTAL)
 *         TEXT "Button Text"
 */
function buildFixtureFile(): FigmaFile {
  const heroImageNode = {
    id: '10:5',
    name: 'Hero Image',
    type: 'IMAGE',
    visible: true,
    absoluteBoundingBox: rect(0, 60, 600, 320),
    // An IMAGE-type Paint fill (the realistic way Figma expresses an image).
    fills: [
      {
        type: 'IMAGE',
        visible: true,
        opacity: 1,
        scaleMode: 'FILL',
        imageRef: 'abcdef1234567890',
      },
    ],
  };

  const headingNode = {
    id: '10:2',
    name: 'Heading',
    type: 'TEXT',
    visible: true,
    characters: 'Welcome to SITOMAS',
    style: headingTypeStyle(),
    fills: [solidBlue()],
    absoluteBoundingBox: rect(0, 0, 600, 40),
  };

  const actionLabelNode = {
    id: '10:8',
    name: 'Action Label',
    type: 'TEXT',
    visible: true,
    characters: 'Get Started',
    style: bodyTypeStyle(),
    fills: [solidBlue()],
    absoluteBoundingBox: rect(0, 0, 120, 24),
  };

  const actionBarFrame = {
    id: '10:7',
    name: 'Action Bar',
    type: 'FRAME',
    visible: true,
    layoutMode: 'HORIZONTAL',
    primaryAxisAlignItems: 'CENTER',
    counterAxisAlignItems: 'CENTER',
    itemSpacing: 12,
    paddingLeft: 8,
    paddingRight: 8,
    paddingTop: 8,
    paddingBottom: 8,
    absoluteBoundingBox: rect(0, 400, 600, 48),
    fills: [solidBlue()],
    children: [actionLabelNode],
  };

  const heroCardFrame = {
    id: '10:1',
    name: 'Hero Card',
    type: 'FRAME',
    visible: true,
    layoutMode: 'VERTICAL',
    primaryAxisAlignItems: 'MIN',
    counterAxisAlignItems: 'CENTER',
    itemSpacing: 16,
    paddingLeft: 24,
    paddingRight: 24,
    paddingTop: 24,
    paddingBottom: 24,
    absoluteBoundingBox: rect(0, 0, 600, 480),
    fills: [solidBlue()],
    children: [headingNode, heroImageNode, actionBarFrame],
  };

  const buttonTextNode = {
    id: '20:2',
    name: 'Button Text',
    type: 'TEXT',
    visible: true,
    characters: 'Submit',
    style: bodyTypeStyle(),
    fills: [solidBlue()],
    absoluteBoundingBox: rect(0, 0, 80, 24),
  };

  const primaryButtonComponent = {
    id: '20:1',
    name: 'Primary Button',
    type: 'COMPONENT',
    visible: true,
    layoutMode: 'HORIZONTAL',
    primaryAxisAlignItems: 'CENTER',
    counterAxisAlignItems: 'CENTER',
    itemSpacing: 8,
    paddingLeft: 16,
    paddingRight: 16,
    paddingTop: 8,
    paddingBottom: 8,
    absoluteBoundingBox: rect(0, 520, 160, 40),
    fills: [solidBlue()],
    children: [buttonTextNode],
  };

  const canvas = {
    id: '0:1',
    name: 'Page 1',
    type: 'CANVAS',
    visible: true,
    backgroundColor: { r: 1, g: 1, b: 1, a: 1 },
    children: [heroCardFrame, primaryButtonComponent],
  };

  const document = {
    id: '0:0',
    name: 'Document',
    type: 'DOCUMENT',
    visible: true,
    children: [canvas],
  };

  return {
    name: 'Hero Design',
    lastModified: '2024-06-01T12:00:00Z',
    thumbnailUrl: 'https://figma.example/thumb.png',
    version: '42',
    document,
    components: {
      '20:1': {
        key: 'comp-key-1',
        name: 'Primary Button',
        description: 'A primary call-to-action button',
      },
    },
    componentSets: {},
    styles: {},
    schemaVersion: 0,
  } as unknown as FigmaFile;
}

// ---------------------------------------------------------------------------
// Test harness
// ---------------------------------------------------------------------------

const FILE_KEY = 'ABC123XYZ';
const IMAGE_NODE_ID = '10:5';
const IMAGE_URL = 'https://figma-cdn.example/hero-image.png';

interface Harness {
  result: Awaited<ReturnType<FigmaImporter['import']>>;
  /** path -> content for every component/stylesheet written by the importer. */
  componentWrites: Map<string, string>;
  /** path -> content for the persisted summary report (import-summary.json). */
  reportWrites: Map<string, string>;
  apiClient: jest.Mocked<FigmaApiClient>;
}

const baseConfig = (overrides: Partial<ImportConfig> = {}): ImportConfig => ({
  fileUrl: 'https://www.figma.com/file/ABC123XYZ/Hero-Design',
  token: 'figd_integration_token',
  outputDir: 'out/components',
  assetsDir: 'out/assets',
  useTailwind: false,
  namingConvention: 'pascal',
  imageFormat: 'png',
  imageScale: 2,
  ...overrides,
});

/**
 * Run a complete import against the real collaborators with only the network
 * and disk boundaries faked.
 */
async function runImport(config: ImportConfig): Promise<Harness> {
  // --- Mock the network boundary (FigmaApiClient) ---
  const apiClient = {
    authenticate: jest.fn().mockResolvedValue(undefined),
    extractFileKey: jest.fn().mockReturnValue(FILE_KEY),
    getFile: jest.fn().mockResolvedValue(buildFixtureFile()),
    getImages: jest.fn().mockResolvedValue({ [IMAGE_NODE_ID]: IMAGE_URL }),
  } as unknown as jest.Mocked<FigmaApiClient>;

  // --- Capture component/stylesheet writes in memory (no disk) ---
  const componentWrites = new Map<string, string>();
  const writeFile = jest.fn((filePath: string, content: string) => {
    componentWrites.set(filePath, content);
  });

  // --- Capture the persisted summary report in memory (no disk) ---
  const reportWrites = new Map<string, string>();
  const summaryReportGenerator = new SummaryReportGenerator(
    (filePath: string, content: string) => {
      reportWrites.set(filePath, content);
    }
  );

  const importer = new FigmaImporter({
    apiClient,
    // REAL collaborators below.
    parser: new DesignParser(),
    styleExtractor: new StyleExtractor(),
    componentGenerator: new ComponentGenerator(),
    stylesheetGenerator: new StylesheetGenerator(),
    assetDownloader: new AssetDownloader(),
    configLoader: new ConfigLoader(),
    summaryReportGenerator,
    writeFile,
    // Persist the report through the injected capturing writer (Req 11.6).
    writeSummaryReport: true,
  });

  const result = await importer.import(config);

  return { result, componentWrites, reportWrites, apiClient };
}

beforeEach(() => {
  jest.clearAllMocks();
  // fs is fully mocked; provide sane defaults for the asset downloader.
  mockFs.existsSync.mockReturnValue(true);
  mockFs.mkdirSync.mockImplementation(() => '' as unknown as undefined);
  mockFs.writeFileSync.mockImplementation(() => {});

  // Every asset download succeeds with a small fake PNG payload.
  mockFetch.mockImplementation(async () => ({
    ok: true,
    status: 200,
    statusText: 'OK',
    arrayBuffer: async () => new ArrayBuffer(2048),
  }));
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('FigmaImporter integration (complete workflow)', () => {
  describe('CSS modules output (useTailwind: false)', () => {
    it('imports the fixture file end-to-end and produces correct artefacts', async () => {
      const config = baseConfig({ useTailwind: false });
      const { result, componentWrites, apiClient } = await runImport(config);

      // ---- overall success + accurate counts ----
      expect(result.success).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.warnings).toEqual([]);
      // Two top-level frames (1 FRAME + 1 COMPONENT) -> two components.
      expect(result.componentsGenerated).toBe(2);
      // One image node (Hero Image) downloaded.
      expect(result.assetsDownloaded).toBe(1);
      expect(result.duration).toBeGreaterThanOrEqual(0);

      // ---- the workflow drove the (mocked) network boundary correctly ----
      expect(apiClient.authenticate).toHaveBeenCalledWith('figd_integration_token');
      expect(apiClient.extractFileKey).toHaveBeenCalledWith(config.fileUrl);
      expect(apiClient.getFile).toHaveBeenCalledWith(FILE_KEY);
      expect(apiClient.getImages).toHaveBeenCalledWith(FILE_KEY, [IMAGE_NODE_ID], {
        format: 'png',
        scale: 2,
      });

      // ---- a .tsx file per frame with valid-looking React content ----
      const heroPath = 'out/components/HeroCard.tsx';
      const buttonPath = 'out/components/PrimaryButton.tsx';
      expect(componentWrites.has(heroPath)).toBe(true);
      expect(componentWrites.has(buttonPath)).toBe(true);

      for (const tsxPath of [heroPath, buttonPath]) {
        const content = componentWrites.get(tsxPath)!;
        expect(content).toContain("import React from 'react';");
        expect(content).toMatch(/export const \w+: React\.FC/);
        expect(content).toMatch(/interface \w+Props \{/);
      }

      // The Hero Card contains an image -> uses the Next.js Image component.
      const heroContent = componentWrites.get(heroPath)!;
      expect(heroContent).toContain("import Image from 'next/image';");
      expect(heroContent).toContain('<Image');
      expect(heroContent).toContain('export const HeroCard');

      // ---- a .module.css per frame when Tailwind is disabled ----
      const heroCssPath = path.join('out/components', 'HeroCard.module.css');
      const buttonCssPath = path.join('out/components', 'PrimaryButton.module.css');
      expect(componentWrites.has(heroCssPath)).toBe(true);
      expect(componentWrites.has(buttonCssPath)).toBe(true);

      // At least one valid-looking CSS file: header + a class rule + declaration.
      const heroCss = componentWrites.get(heroCssPath)!;
      expect(heroCss).toContain('/* HeroCard.module.css - generated from Figma */');
      expect(heroCss).toContain('.herocard {');
      expect(heroCss).toContain('display: block;');
      // Balanced braces => syntactically well-formed.
      expect((heroCss.match(/\{/g) || []).length).toBe(
        (heroCss.match(/\}/g) || []).length
      );

      // ---- the image node produced a download attempt ----
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(IMAGE_URL);

      // ---- the summary report file list contains every artefact ----
      const assetPath = path.join('out/assets', 'hero-image.png');
      expect(result.files).toEqual(
        expect.arrayContaining([
          heroPath,
          buttonPath,
          heroCssPath,
          buttonCssPath,
          assetPath,
        ])
      );
      // Exactly: 2 components + 2 stylesheets + 1 asset = 5 files (deduped).
      expect(result.files).toHaveLength(5);
    });

    it('persists an import-summary.json whose counts match the result (Req 11.6)', async () => {
      const config = baseConfig({ useTailwind: false });
      const { result, reportWrites } = await runImport(config);

      const reportPath = path.join('out/components', 'import-summary.json');
      expect(reportWrites.has(reportPath)).toBe(true);

      const report = JSON.parse(reportWrites.get(reportPath)!);
      expect(report.success).toBe(true);
      expect(report.componentsGenerated).toBe(result.componentsGenerated);
      expect(report.assetsDownloaded).toBe(result.assetsDownloaded);
      expect(report.files).toEqual(result.files);
      expect(report.errors).toEqual(result.errors);
      expect(report.warnings).toEqual(result.warnings);
      expect(report.fileName).toBe('Hero Design');
    });
  });

  describe('Tailwind output (useTailwind: true)', () => {
    it('imports end-to-end without emitting CSS module files', async () => {
      const config = baseConfig({ useTailwind: true });
      const { result, componentWrites, apiClient } = await runImport(config);

      expect(result.success).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.componentsGenerated).toBe(2);
      expect(result.assetsDownloaded).toBe(1);

      // Components are still generated...
      const heroPath = 'out/components/HeroCard.tsx';
      const buttonPath = 'out/components/PrimaryButton.tsx';
      expect(componentWrites.has(heroPath)).toBe(true);
      expect(componentWrites.has(buttonPath)).toBe(true);

      const heroContent = componentWrites.get(heroPath)!;
      expect(heroContent).toContain("import React from 'react';");
      expect(heroContent).toMatch(/interface \w+Props \{/);

      // ...but NO .module.css files are written in the Tailwind branch.
      const cssWrites = Array.from(componentWrites.keys()).filter((p) =>
        p.endsWith('.module.css')
      );
      expect(cssWrites).toEqual([]);

      // The summary file list contains only the two components and the asset.
      const assetPath = path.join('out/assets', 'hero-image.png');
      expect(result.files).toEqual(
        expect.arrayContaining([heroPath, buttonPath, assetPath])
      );
      expect(result.files).toHaveLength(3);

      // Network boundary still exercised identically.
      expect(apiClient.getImages).toHaveBeenCalledWith(FILE_KEY, [IMAGE_NODE_ID], {
        format: 'png',
        scale: 2,
      });
    });
  });

  describe('does not hit the real Figma API or real disk', () => {
    it('performs no real network or disk writes beyond the mocked boundaries', async () => {
      await runImport(baseConfig({ useTailwind: false }));

      // The only fetch calls are the mocked asset downloads (1 image).
      expect(mockFetch).toHaveBeenCalledTimes(1);
      // fs.writeFileSync is only ever the mocked asset writer (component and
      // report writes are captured via injected writers, not fs).
      const realDiskComponentWrite = mockFs.writeFileSync.mock.calls.find(
        ([p]) => String(p).endsWith('.tsx') || String(p).endsWith('import-summary.json')
      );
      expect(realDiskComponentWrite).toBeUndefined();
    });
  });
});
