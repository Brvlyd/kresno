/**
 * Asset Downloader
 * Downloads and manages image assets from Figma
 */

import { ParsedNode } from '../types/internal-models';
import { ImageUrls } from '../types/figma-api';
import { generateAssetFilename } from '../utils/name-sanitizer';
import { resolveFilenameCollision } from '../utils/filename-collision';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Default directory where downloaded assets are saved when no output
 * directory is configured. Resolves to the Next.js public directory so
 * imported images are statically served (see Requirement 6.3).
 */
export const DEFAULT_ASSETS_DIR = path.join('public', 'figma-assets');

/**
 * Default image export format. Figma assets are downloaded as PNG unless a
 * different format is configured (Requirement 6.2).
 */
export const DEFAULT_IMAGE_FORMAT = 'png';

/**
 * Default export resolution. Images are exported at 2x for crisp rendering on
 * retina/high-DPI displays (Requirement 6.2). The scale is applied upstream at
 * the Figma getImages API request stage; it is documented here so the
 * downloader's defaults stay aligned with the export pipeline.
 */
export const DEFAULT_IMAGE_SCALE = 2;

/**
 * Maximum number of asset downloads that may run concurrently.
 * Bounds parallelism so a large file does not open hundreds of sockets.
 */
export const DEFAULT_MAX_CONCURRENCY = 5;

/**
 * Information about a successfully downloaded asset
 */
export interface AssetInfo {
  nodeId: string;
  nodeName: string;
  fileName: string;
  filePath: string;
  size: number;
}

/**
 * Information about a failed asset download
 */
export interface FailedAsset {
  nodeId: string;
  nodeName: string;
  error: string;
}

/**
 * Result of asset download operation
 */
export interface DownloadResult {
  successful: AssetInfo[];
  failed: FailedAsset[];
}

/**
 * An image resource identified for export via the Figma getImages API.
 * Carries the node ID required for the API request plus the intended
 * destination filename/metadata used when the downloaded image is saved.
 */
export interface ImageExportItem {
  /** Figma node ID, used in the getImages API request */
  nodeId: string;
  /** Original node name (preserved for reporting and alt text) */
  nodeName: string;
  /** Intended (sanitized, collision-free) filename for the downloaded asset */
  fileName: string;
}

/**
 * Asset Downloader Class
 * Handles downloading and managing image assets from Figma
 */
export class AssetDownloader {
  /**
   * Maximum number of concurrent downloads (concurrency limit of 5).
   * Requirement 6 (Asset Download): parallel downloads with a bounded fan-out.
   */
  private readonly maxConcurrency = DEFAULT_MAX_CONCURRENCY;

  /**
   * Default export format used when callers do not specify one.
   * Documented contract: PNG (Requirement 6.2).
   */
  readonly defaultFormat = DEFAULT_IMAGE_FORMAT;

  /**
   * Default export scale used when callers do not specify one.
   * Documented contract: 2x resolution (Requirement 6.2). The scale itself is
   * applied at the getImages API request stage; exposed here so the
   * downloader's defaults remain the single source of truth.
   */
  readonly defaultScale = DEFAULT_IMAGE_SCALE;

  /**
   * Download assets for image nodes
   * Task 8.7: Parallel download with error handling
   * Requirements: 6.2, 6.3, 6.5
   *
   * @param nodes      Parsed node tree to scan for image resources.
   * @param imageUrls  Map of node ID to the exported image URL (PNG @ 2x by
   *                   default, produced by the getImages API stage).
   * @param outputDir  Destination directory for downloaded assets. Defaults to
   *                   {@link DEFAULT_ASSETS_DIR} (`public/figma-assets`) when
   *                   not supplied, so images land in the Next.js public dir.
   */
  async downloadAssets(
    nodes: ParsedNode[],
    imageUrls: ImageUrls,
    outputDir: string = DEFAULT_ASSETS_DIR
  ): Promise<DownloadResult> {
    const successful: AssetInfo[] = [];
    const failed: FailedAsset[] = [];

    // Ensure output directory exists
    this.ensureDirectoryExists(outputDir);

    // Collect all image nodes
    const imageNodes = this.collectImageNodes(nodes);

    // Track used filenames for collision detection
    const usedFilenames = new Set<string>();

    // Download images in batches with concurrency limit
    for (let i = 0; i < imageNodes.length; i += this.maxConcurrency) {
      const batch = imageNodes.slice(i, i + this.maxConcurrency);

      const batchPromises = batch.map(async (node) => {
        const imageUrl = imageUrls[node.id];

        if (!imageUrl) {
          failed.push({
            nodeId: node.id,
            nodeName: node.name,
            error: 'No image URL provided for this node',
          });
          return;
        }

        try {
          // Generate filename (PNG by default — Requirement 6.2)
          const baseFilename = this.generateFilename(node.name, DEFAULT_IMAGE_FORMAT);
          const uniqueFilename = this.handleDuplicates(baseFilename, usedFilenames);
          usedFilenames.add(uniqueFilename);

          const filePath = path.join(outputDir, uniqueFilename);

          // Download image
          const response = await fetch(imageUrl);

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          const buffer = await response.arrayBuffer();
          const nodeBuffer = Buffer.from(buffer);

          // Write to file
          fs.writeFileSync(filePath, nodeBuffer);

          successful.push({
            nodeId: node.id,
            nodeName: node.name,
            fileName: uniqueFilename,
            filePath,
            size: nodeBuffer.length,
          });
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          failed.push({
            nodeId: node.id,
            nodeName: node.name,
            error: `Failed to download: ${errorMessage}`,
          });
        }
      });

      // Wait for batch to complete before moving to next batch
      await Promise.all(batchPromises);
    }

    return { successful, failed };
  }

  /**
   * Identify all image nodes within a parsed node tree.
   *
   * Recursively traverses the tree (depth-first, pre-order) and collects every
   * node that represents an image resource. A node is considered an image when
   * its parsed `nodeType` is `'image'` (the Design_Parser classifies nodes with
   * IMAGE-type fills / image content as `'image'`). Each identified node retains
   * its associated node ID, which the Figma getImages API requires for export.
   *
   * Task 8.1: Identify image nodes and extract image resources with node IDs
   * Requirement 6.1 / Property 18: Image Resource Identification
   */
  identifyImageNodes(nodes: ParsedNode[]): ParsedNode[] {
    const imageNodes: ParsedNode[] = [];

    const traverse = (node: ParsedNode) => {
      if (this.isImageNode(node)) {
        imageNodes.push(node);
      }

      if (node.children) {
        for (const child of node.children) {
          traverse(child);
        }
      }
    };

    for (const node of nodes) {
      traverse(node);
    }

    return imageNodes;
  }

  /**
   * Extract the node IDs of all image nodes in the tree.
   *
   * Convenience helper that returns just the identifiers required for the
   * Figma getImages API request (`getImages(fileKey, nodeIds, options)`).
   *
   * Task 8.1: Extract image resources with node IDs
   * Requirement 6.1
   */
  getImageNodeIds(nodes: ParsedNode[]): string[] {
    return this.identifyImageNodes(nodes).map((node) => node.id);
  }

  /**
   * Build the list of images to export for the Figma getImages API request.
   *
   * Identifies all image nodes, then derives a sanitized, collision-free
   * destination filename for each. The resulting list pairs the node ID
   * (needed for the API request) with the intended filename/metadata so the
   * downloader can map exported URLs back to their destination files.
   *
   * Task 8.1: Build list of images to export for API request
   * Requirement 6.1
   *
   * @param nodes  The parsed node tree to scan for image resources.
   * @param format The target image format/extension (default: `'png'`).
   */
  buildExportList(nodes: ParsedNode[], format: string = DEFAULT_IMAGE_FORMAT): ImageExportItem[] {
    const imageNodes = this.identifyImageNodes(nodes);
    const usedFilenames = new Set<string>();

    return imageNodes.map((node) => {
      const baseFilename = this.generateFilename(node.name, format);
      const fileName = this.handleDuplicates(baseFilename, usedFilenames);
      usedFilenames.add(fileName);

      return {
        nodeId: node.id,
        nodeName: node.name,
        fileName,
      };
    });
  }

  /**
   * Determine whether a parsed node represents an image resource to export.
   */
  private isImageNode(node: ParsedNode): boolean {
    return node.nodeType === 'image';
  }

  /**
   * Recursively collect all image nodes from the tree.
   * Internal alias retained for the download pipeline; delegates to the
   * public identification method.
   */
  private collectImageNodes(nodes: ParsedNode[]): ParsedNode[] {
    return this.identifyImageNodes(nodes);
  }

  /**
   * Generate a valid filename from node name
   * Task 8.3: Filename generation and sanitization
   * Requirement 6.4: Generate descriptive filenames based on node names
   *
   * Delegates to the pure `generateAssetFilename` helper so the sanitization
   * rules live in one shared, independently testable location.
   */
  generateFilename(nodeName: string, format: string): string {
    return generateAssetFilename(nodeName, format);
  }

  /**
   * Handle filename collisions by appending numeric suffixes
   * Task 8.5: Filename collision resolution
   * Requirement 6.6: Handle duplicate names with numeric suffixes
   *
   * Delegates to the pure `resolveFilenameCollision` helper so the collision
   * rules live in one shared, independently testable location. Note this is a
   * pure check: callers must add the returned name to `existingFiles` to keep
   * subsequent results unique.
   */
  handleDuplicates(filename: string, existingFiles: Set<string>): string {
    return resolveFilenameCollision(filename, existingFiles);
  }

  /**
   * Ensure directory exists, create if it doesn't
   */
  private ensureDirectoryExists(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }
}
