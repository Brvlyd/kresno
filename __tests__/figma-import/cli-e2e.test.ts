/**
 * End-to-end test suite for the Figma import CLI (Task 17.3).
 *
 * Unlike cli.test.ts / cli-arg-parsing.test.ts (which exercise the pure arg
 * parsing surface) and figma-importer-integration.test.ts (which drives the
 * orchestrator with an injected, mocked apiClient), this suite exercises the
 * REAL CLI entry point `main(argv)` end-to-end:
 *
 *   argv -> buildConfig (real) -> new FigmaImporter() (real, default deps)
 *        -> the whole pipeline (real collaborators) -> console summary + exit code
 *
 * Only the genuine I/O boundaries are faked, exactly like the integration test:
 *   - the network boundary `FigmaApiClient` is module-mocked so authenticate /
 *     extractFileKey / getFile / getImages are controllable per test (and so
 *     `new FigmaImporter()` inside main() picks up the mock automatically),
 *   - `global.fetch` is mocked so the asset downloader performs no real network
 *     download,
 *   - the `fs` module is mocked (jest.mock('fs')) so component / stylesheet /
 *     asset / summary writes never touch disk. Generated file content is
 *     recovered from the captured fs.writeFileSync calls.
 *
 * console.log / console.error are captured via spies and process.exitCode is
 * saved/restored between tests.
 *
 * _Requirements: All requirements (10.1 CLI workflow + configuration)_
 */

import * as fs from 'fs';

import { main, getUsage } from '../../lib/figma-import/cli/cli';
import {
  FigmaApiClient,
  FigmaAuthenticationError,
  FigmaFileError,
} from '../../lib/figma-import/core/figma-api-client';
import { FigmaFile } from '../../lib/figma-import/types/figma-api';

// ---------------------------------------------------------------------------
// I/O boundary mocks: fs (disk), fetch (network download), FigmaApiClient
// (Figma REST API). FigmaApiClient is module-mocked while keeping its real
// error classes so the orchestrator's error handling behaves authentically.
// ---------------------------------------------------------------------------
jest.mock('fs');
const mockFs = fs as jest.Mocked<typeof fs>;

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

jest.mock('../../lib/figma-import/core/figma-api-client', () => {
  const actual = jest.requireActual(
    '../../lib/figma-import/core/figma-api-client'
  );
  return {
    ...actual,
    // Replace only the client class; keep the real error classes.
    FigmaApiClient: jest.fn(),
  };
});

const MockedFigmaApiClient = FigmaApiClient as unknown as jest.Mock;

// Per-test-controllable mock methods for the (single) api client instance that
// `new FigmaImporter()` constructs inside main().
let mockAuthenticate: jest.Mock;
let mockExtractFileKey: jest.Mock;
let mockGetFile: jest.Mock;
let mockGetImages: jest.Mock;

// ---------------------------------------------------------------------------
// Fixture: a realistic Figma file (adapted from the integration test).
//
//   DOCUMENT
//     CANVAS "Page 1"
//       FRAME "Hero Card" (auto-layout VERTICAL)
//         TEXT  "Heading"      (TypeStyle)
//         IMAGE "Hero Image"   (IMAGE-type Paint fill)  id 10:5
//         FRAME "Action Bar"   (nested, auto-layout HORIZONTAL)
//           TEXT "Action Label"
//       COMPONENT "Primary Button" (auto-layout HORIZONTAL)
//         TEXT "Button Text"
// ---------------------------------------------------------------------------

const solidBlue = () => ({
  type: 'SOLID' as const,
  visible: true,
  opacity: 1,
  color: { r: 0.1, g: 0.3, b: 0.85, a: 1 },
});

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

function buildFixtureFile(): FigmaFile {
  const heroImageNode = {
    id: '10:5',
    name: 'Hero Image',
    type: 'IMAGE',
    visible: true,
    absoluteBoundingBox: rect(0, 60, 600, 320),
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
const FILE_URL = 'https://www.figma.com/file/ABC123XYZ/Hero-Design';
const IMAGE_NODE_ID = '10:5';
const IMAGE_URL = 'https://figma-cdn.example/hero-image.png';
const TOKEN = 'figd_e2e_token';

let logSpy: jest.SpyInstance;
let errorSpy: jest.SpyInstance;
let savedExitCode: typeof process.exitCode;

/** Join all console.log output into a single string for easy assertions. */
function loggedOutput(): string {
  return logSpy.mock.calls.map((c) => c.join(' ')).join('\n');
}

/** Join all console.error output into a single string for easy assertions. */
function erroredOutput(): string {
  return errorSpy.mock.calls.map((c) => c.join(' ')).join('\n');
}

/**
 * Recover the content written to the file whose path ends with `suffix`.
 * Suffix matching keeps assertions independent of OS path separators (the
 * default output dir is built with path.join while the generator appends
 * "/<file>", so a written path can mix "\" and "/").
 */
function writtenContent(suffix: string): string | undefined {
  // Last write wins, mirroring real fs semantics.
  const calls = mockFs.writeFileSync.mock.calls.filter(([p]) =>
    String(p).endsWith(suffix)
  );
  if (calls.length === 0) return undefined;
  return String(calls[calls.length - 1][1]);
}

/** All file paths written via fs.writeFileSync that end with the suffix. */
function writtenPathsEndingWith(suffix: string): string[] {
  return mockFs.writeFileSync.mock.calls
    .map(([p]) => String(p))
    .filter((p) => p.endsWith(suffix));
}

beforeEach(() => {
  jest.clearAllMocks();

  // --- fs is fully mocked; provide sane defaults so the pipeline can run. ---
  mockFs.existsSync.mockReturnValue(false);
  mockFs.mkdirSync.mockImplementation(() => '' as unknown as undefined);
  mockFs.writeFileSync.mockImplementation(() => {});

  // --- Every asset download succeeds with a small fake payload. ---
  mockFetch.mockImplementation(async () => ({
    ok: true,
    status: 200,
    statusText: 'OK',
    arrayBuffer: async () => new ArrayBuffer(2048),
  }));

  // --- Default (happy-path) Figma API client behaviour. ---
  mockAuthenticate = jest.fn().mockResolvedValue(undefined);
  mockExtractFileKey = jest.fn().mockReturnValue(FILE_KEY);
  mockGetFile = jest.fn().mockResolvedValue(buildFixtureFile());
  mockGetImages = jest
    .fn()
    .mockResolvedValue({ [IMAGE_NODE_ID]: IMAGE_URL });

  MockedFigmaApiClient.mockImplementation(() => ({
    authenticate: mockAuthenticate,
    extractFileKey: mockExtractFileKey,
    getFile: mockGetFile,
    getImages: mockGetImages,
  }));

  logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

  // process.exitCode is process-global; save it and reset to a clean slate.
  savedExitCode = process.exitCode;
  process.exitCode = undefined;
});

afterEach(() => {
  logSpy.mockRestore();
  errorSpy.mockRestore();
  process.exitCode = savedExitCode;
});

// ---------------------------------------------------------------------------
// 1. Complete CLI workflow from command to output
// ---------------------------------------------------------------------------

describe('CLI end-to-end — complete workflow (Req 10.1)', () => {
  it('runs the full pipeline from argv to a success summary', async () => {
    await main(['--file-url', FILE_URL, '--token', TOKEN]);

    // The whole network boundary was driven in order.
    expect(mockAuthenticate).toHaveBeenCalledWith(TOKEN);
    expect(mockExtractFileKey).toHaveBeenCalledWith(FILE_URL);
    expect(mockGetFile).toHaveBeenCalledWith(FILE_KEY);
    expect(mockGetImages).toHaveBeenCalledWith(
      FILE_KEY,
      [IMAGE_NODE_ID],
      expect.objectContaining({ format: expect.any(String) })
    );

    // The summary surfaced via console.log and reports success + counts.
    const out = loggedOutput();
    expect(out).toContain('Figma import completed.');
    // Two top-level frames (FRAME + COMPONENT) -> two components.
    expect(out).toContain('Components generated: 2');
    // One image node (Hero Image) downloaded.
    expect(out).toContain('Assets downloaded:    1');

    // A successful run never sets a non-zero exit code.
    expect(process.exitCode).toBeFalsy();
    // No user-facing errors were printed on the happy path.
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('accepts the token from the FIGMA_TOKEN environment variable', async () => {
    const prev = process.env.FIGMA_TOKEN;
    process.env.FIGMA_TOKEN = 'figd_from_env';
    try {
      await main(['--file-url', FILE_URL]);
    } finally {
      if (prev === undefined) delete process.env.FIGMA_TOKEN;
      else process.env.FIGMA_TOKEN = prev;
    }

    expect(mockAuthenticate).toHaveBeenCalledWith('figd_from_env');
    expect(loggedOutput()).toContain('Figma import completed.');
    expect(process.exitCode).toBeFalsy();
  });
});

// ---------------------------------------------------------------------------
// 2. Various configuration combinations
// ---------------------------------------------------------------------------

describe('CLI end-to-end — configuration combinations', () => {
  it('emits CSS module stylesheets with --no-tailwind', async () => {
    await main(['--file-url', FILE_URL, '--token', TOKEN, '--no-tailwind']);

    expect(loggedOutput()).toContain('Figma import completed.');
    // CSS-modules branch writes a .module.css per frame alongside components.
    const cssFiles = writtenPathsEndingWith('.module.css');
    expect(cssFiles.length).toBeGreaterThanOrEqual(2);
    expect(process.exitCode).toBeFalsy();
  });

  it('does NOT emit CSS module stylesheets with --tailwind', async () => {
    await main(['--file-url', FILE_URL, '--token', TOKEN, '--tailwind']);

    expect(loggedOutput()).toContain('Figma import completed.');
    expect(writtenPathsEndingWith('.module.css')).toEqual([]);
    // Components are still generated in the Tailwind branch.
    expect(writtenPathsEndingWith('.tsx').length).toBe(2);
    expect(process.exitCode).toBeFalsy();
  });

  it('honours --naming pascal in the generated file names', async () => {
    await main([
      '--file-url',
      FILE_URL,
      '--token',
      TOKEN,
      '--tailwind',
      '--naming',
      'pascal',
    ]);

    const tsxFiles = writtenPathsEndingWith('.tsx');
    expect(tsxFiles.some((p) => p.endsWith('HeroCard.tsx'))).toBe(true);
    expect(tsxFiles.some((p) => p.endsWith('PrimaryButton.tsx'))).toBe(true);
    expect(process.exitCode).toBeFalsy();
  });

  it('honours --naming kebab in the generated file names', async () => {
    await main([
      '--file-url',
      FILE_URL,
      '--token',
      TOKEN,
      '--tailwind',
      '--naming',
      'kebab',
    ]);

    const tsxFiles = writtenPathsEndingWith('.tsx');
    expect(tsxFiles.some((p) => p.endsWith('hero-card.tsx'))).toBe(true);
    expect(tsxFiles.some((p) => p.endsWith('primary-button.tsx'))).toBe(true);
    expect(process.exitCode).toBeFalsy();
  });

  it('passes --image-format / --image-scale through to the image export request', async () => {
    await main([
      '--file-url',
      FILE_URL,
      '--token',
      TOKEN,
      '--image-format',
      'svg',
      '--image-scale',
      '3',
    ]);

    expect(mockGetImages).toHaveBeenCalledWith(FILE_KEY, [IMAGE_NODE_ID], {
      format: 'svg',
      scale: 3,
    });
    expect(process.exitCode).toBeFalsy();
  });

  it('honours a custom --output-dir for generated components', async () => {
    await main([
      '--file-url',
      FILE_URL,
      '--token',
      TOKEN,
      '--tailwind',
      '--output-dir',
      'custom/out',
      '--naming',
      'pascal',
    ]);

    const tsxFiles = writtenPathsEndingWith('.tsx');
    expect(tsxFiles.length).toBe(2);
    expect(tsxFiles.every((p) => p.includes('custom/out'))).toBe(true);
    expect(process.exitCode).toBeFalsy();
  });
});

// ---------------------------------------------------------------------------
// 3. Error scenarios
// ---------------------------------------------------------------------------

describe('CLI end-to-end — error scenarios', () => {
  it('reports an authentication failure (invalid token) and exits non-zero', async () => {
    mockAuthenticate.mockRejectedValue(
      new FigmaAuthenticationError(
        'Authentication failed: Invalid or expired token.'
      )
    );

    await main(['--file-url', FILE_URL, '--token', 'bad-token']);

    const out = loggedOutput();
    expect(out).toContain('Figma import failed.');
    expect(out).toContain('Invalid or expired token');
    expect(process.exitCode).toBe(1);
    // The workflow short-circuits before any file fetch.
    expect(mockGetFile).not.toHaveBeenCalled();
  });

  it('reports a missing/inaccessible file (getFile rejects) and exits non-zero', async () => {
    mockGetFile.mockRejectedValue(
      new FigmaFileError('File not found: The file does not exist.')
    );

    await main(['--file-url', FILE_URL, '--token', TOKEN]);

    const out = loggedOutput();
    expect(out).toContain('Figma import failed.');
    expect(out).toContain('File not found');
    expect(process.exitCode).toBe(1);
    // No components could be generated.
    expect(writtenPathsEndingWith('.tsx')).toEqual([]);
  });

  it('reports missing required arguments (no file-url/token) and never calls the API', async () => {
    const prev = process.env.FIGMA_TOKEN;
    delete process.env.FIGMA_TOKEN;
    try {
      await main([]);
    } finally {
      if (prev !== undefined) process.env.FIGMA_TOKEN = prev;
    }

    // Config validation aggregates the per-field problems to console.error...
    const errOut = erroredOutput();
    expect(errOut).toContain('Invalid Figma import configuration');
    expect(errOut).toContain('fileUrl is required');
    expect(errOut).toContain('token is required');
    // ...with a hint to consult --help.
    expect(errOut).toContain('--help');

    expect(process.exitCode).toBe(1);
    // The API is never touched when configuration is invalid.
    expect(mockAuthenticate).not.toHaveBeenCalled();
    expect(mockGetFile).not.toHaveBeenCalled();
  });

  it('reports an invalid file URL and never calls the API', async () => {
    await main(['--file-url', 'not-a-figma-url', '--token', TOKEN]);

    const errOut = erroredOutput();
    expect(errOut).toContain('Invalid Figma import configuration');
    expect(errOut).toContain('not a valid Figma file URL');
    expect(process.exitCode).toBe(1);
    expect(mockAuthenticate).not.toHaveBeenCalled();
  });

  it('prints usage for --help and does NOT set a non-zero exit code', async () => {
    await main(['--help']);

    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logSpy.mock.calls[0][0]).toBe(getUsage());
    expect(errorSpy).not.toHaveBeenCalled();
    expect(process.exitCode).toBeFalsy();
    // Help short-circuits before the pipeline runs.
    expect(mockAuthenticate).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 4. Verify generated code is structurally valid
// ---------------------------------------------------------------------------

describe('CLI end-to-end — generated code validity', () => {
  it('produces structurally valid React/TSX components', async () => {
    await main([
      '--file-url',
      FILE_URL,
      '--token',
      TOKEN,
      '--tailwind',
      '--naming',
      'pascal',
    ]);

    const heroPath = 'HeroCard.tsx';
    const buttonPath = 'PrimaryButton.tsx';

    for (const tsxPath of [heroPath, buttonPath]) {
      const content = writtenContent(tsxPath);
      expect(content).toBeDefined();
      const tsx = content as string;

      // React import + a typed function component + a props interface.
      expect(tsx).toContain("import React from 'react';");
      expect(tsx).toMatch(/export const \w+: React\.FC/);
      expect(tsx).toMatch(/interface \w+Props \{/);

      // Balanced braces / parens / angle-bracketed JSX tags => well-formed.
      expect((tsx.match(/\{/g) || []).length).toBe(
        (tsx.match(/\}/g) || []).length
      );
      expect((tsx.match(/\(/g) || []).length).toBe(
        (tsx.match(/\)/g) || []).length
      );
    }

    // The Hero Card contains an image -> Next.js Image component is imported.
    const heroContent = writtenContent(heroPath) as string;
    expect(heroContent).toContain("import Image from 'next/image';");
    expect(heroContent).toContain('<Image');
    expect(heroContent).toContain('export const HeroCard');
  });
});
