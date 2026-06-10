/**
 * Design Parser
 * Parses Figma node tree and extracts design structure
 */

import {
  FigmaFile,
  Node,
  NodeType,
  FrameNode,
  GroupNode,
  ComponentNode,
  InstanceNode,
  SceneNode,
} from '../types/figma-api';
import {
  ParsedDesign,
  ParsedPage,
  ParsedFrame,
  ParsedNode,
  ValidationResult,
  ValidationMessage,
} from '../types/internal-models';
import { sanitizeComponentName } from '../utils/name-sanitizer';

/**
 * Maps Figma node types to internal node types
 */
export type InternalNodeType =
  | 'frame'
  | 'group'
  | 'component'
  | 'instance'
  | 'container'
  | 'text'
  | 'image'
  | 'shape';

/**
 * Result of node type classification
 */
export interface NodeTypeClassification {
  internalType: InternalNodeType;
  isContainer: boolean;
  isComponent: boolean;
  isInstance: boolean;
}

/**
 * Design Parser Class
 * Responsible for parsing Figma file structure and extracting design data
 */
export class DesignParser {
  private warnings: ValidationMessage[] = [];
  private errors: ValidationMessage[] = [];

  /**
   * Parse a Figma file into internal representation
   */
  parse(figmaFile: FigmaFile): ParsedDesign {
    this.warnings = [];
    this.errors = [];

    // Validate structure before parsing
    const validation = this.validateStructure(figmaFile);
    if (!validation.isValid) {
      throw new Error(
        `Invalid Figma file structure: ${validation.errors.map((e) => e.message).join(', ')}`
      );
    }

    const pages: ParsedPage[] = [];

    // Parse canvas nodes as pages
    if (figmaFile.document.children) {
      for (const canvas of figmaFile.document.children) {
        const page = this.parsePage(canvas);
        if (page) {
          pages.push(page);
        }
      }
    }

    return {
      metadata: {
        fileName: figmaFile.name,
        fileKey: '', // Will be set by orchestrator
        lastModified: new Date(figmaFile.lastModified),
        version: figmaFile.version,
      },
      pages,
      componentLibrary: {
        components: new Map(),
      },
      styleGuide: {
        colors: new Map(),
        typography: new Map(),
        effects: new Map(),
      },
    };
  }

  /**
   * Validate Figma file structure
   */
  validateStructure(figmaFile: FigmaFile): ValidationResult {
    const warnings: ValidationMessage[] = [];
    const errors: ValidationMessage[] = [];

    // Check if file has at least one canvas
    if (!figmaFile.document.children || figmaFile.document.children.length === 0) {
      errors.push({
        message: 'Figma file must contain at least one canvas/page',
        severity: 'error',
      });
    }

    return {
      isValid: errors.length === 0,
      warnings,
      errors,
    };
  }

  /**
   * Classify a Figma node type into internal node type
   * Task 4.4: Identify frames, groups, components, and instances based on type field
   * Requirement 3.2: The Design_Parser SHALL identify frames, groups, components, and instances
   */
  classifyNodeType(node: Node): NodeTypeClassification {
    const figmaType = node.type;

    // Classify based on Figma node type
    switch (figmaType) {
      case 'FRAME':
        return {
          internalType: 'frame',
          isContainer: true,
          isComponent: false,
          isInstance: false,
        };

      case 'GROUP':
        return {
          internalType: 'group',
          isContainer: true,
          isComponent: false,
          isInstance: false,
        };

      case 'COMPONENT':
      case 'COMPONENT_SET':
        return {
          internalType: 'component',
          isContainer: true,
          isComponent: true,
          isInstance: false,
        };

      case 'INSTANCE':
        return {
          internalType: 'instance',
          isContainer: true,
          isComponent: false,
          isInstance: true,
        };

      case 'TEXT':
        return {
          internalType: 'text',
          isContainer: false,
          isComponent: false,
          isInstance: false,
        };

      case 'RECTANGLE':
      case 'ELLIPSE':
      case 'LINE':
      case 'VECTOR':
      case 'BOOLEAN_OPERATION':
        return {
          internalType: 'shape',
          isContainer: false,
          isComponent: false,
          isInstance: false,
        };

      case 'IMAGE':
        return {
          internalType: 'image',
          isContainer: false,
          isComponent: false,
          isInstance: false,
        };

      // Container types
      case 'CANVAS':
      case 'DOCUMENT':
        return {
          internalType: 'container',
          isContainer: true,
          isComponent: false,
          isInstance: false,
        };

      // Unsupported or unknown types
      default:
        this.warnings.push({
          nodeId: node.id,
          nodeName: node.name,
          message: `Unsupported node type: ${figmaType}`,
          severity: 'warning',
        });
        return {
          internalType: 'container',
          isContainer: false,
          isComponent: false,
          isInstance: false,
        };
    }
  }

  /**
   * Parse a canvas node as a page
   */
  private parsePage(canvas: Node): ParsedPage | null {
    if (canvas.type !== 'CANVAS') {
      return null;
    }

    const frames: ParsedFrame[] = [];

    // Parse child nodes as frames
    if (canvas.children) {
      for (const child of canvas.children) {
        const classification = this.classifyNodeType(child);
        
        // Only process frame-like nodes at the top level
        if (
          classification.internalType === 'frame' ||
          classification.internalType === 'component' ||
          classification.internalType === 'instance'
        ) {
          const frame = this.parseFrame(child as FrameNode | ComponentNode | InstanceNode);
          if (frame) {
            frames.push(frame);
          }
        }
      }
    }

    return {
      id: canvas.id,
      name: canvas.name,
      frames,
    };
  }

  /**
   * Parse a frame, component, or instance node
   */
  private parseFrame(
    node: FrameNode | ComponentNode | InstanceNode
  ): ParsedFrame | null {
    const classification = this.classifyNodeType(node);
    const sanitizedName = sanitizeComponentName(node.name);

    // Determine node type for ParsedFrame
    let nodeType: 'frame' | 'component' | 'instance';
    if (classification.internalType === 'component') {
      nodeType = 'component';
    } else if (classification.internalType === 'instance') {
      nodeType = 'instance';
    } else {
      nodeType = 'frame';
    }

    // Get component ID for instances
    const componentId =
      node.type === 'INSTANCE' ? (node as InstanceNode).componentId : undefined;

    // Parse children
    const children: ParsedNode[] = [];
    if (node.children) {
      for (const child of node.children) {
        const parsedChild = this.parseNode(child);
        if (parsedChild) {
          children.push(parsedChild);
        }
      }
    }

    return {
      id: node.id,
      name: node.name,
      sanitizedName,
      nodeType,
      componentId,
      layout: this.extractLayout(node),
      styles: this.extractStyles(node),
      children,
    };
  }

  /**
   * Parse a generic node
   */
  private parseNode(node: Node): ParsedNode | null {
    const classification = this.classifyNodeType(node);

    // Skip unsupported nodes (warning already logged)
    if (
      classification.internalType === 'container' &&
      !classification.isContainer
    ) {
      return null;
    }

    const sanitizedName = sanitizeComponentName(node.name);

    // Determine HTML tag based on node type
    const htmlTag = this.determineHtmlTag(classification.internalType);

    // Extract content for text nodes
    const content =
      classification.internalType === 'text' && 'characters' in node
        ? (node as any).characters
        : undefined;

    // Parse children if container
    const children: ParsedNode[] | undefined = classification.isContainer
      ? []
      : undefined;

    if (children && node.children) {
      for (const child of node.children) {
        const parsedChild = this.parseNode(child);
        if (parsedChild) {
          children.push(parsedChild);
        }
      }
    }

    return {
      id: node.id,
      name: node.name,
      sanitizedName,
      nodeType: classification.internalType,
      htmlTag,
      content,
      layout: this.extractLayout(node),
      styles: this.extractStyles(node),
      children,
    };
  }

  /**
   * Determine appropriate HTML tag for node type
   */
  private determineHtmlTag(nodeType: InternalNodeType): string {
    switch (nodeType) {
      case 'text':
        return 'p';
      case 'image':
        return 'img';
      case 'frame':
      case 'group':
      case 'component':
      case 'instance':
      case 'container':
      case 'shape':
        return 'div';
      default:
        return 'div';
    }
  }

  /**
   * Extract layout information from node
   * Placeholder - will be implemented in task 4.6
   */
  private extractLayout(node: Node): any {
    return {
      display: 'block',
    };
  }

  /**
   * Extract style information from node
   * Placeholder - will be implemented by StyleExtractor
   */
  private extractStyles(node: Node): any {
    return {
      className: sanitizeComponentName(node.name).toLowerCase(),
      cssProperties: {},
    };
  }

  /**
   * Get warnings collected during parsing
   */
  getWarnings(): ValidationMessage[] {
    return this.warnings;
  }

  /**
   * Get errors collected during parsing
   */
  getErrors(): ValidationMessage[] {
    return this.errors;
  }
}
