/**
 * TypeScript interfaces for Figma API responses
 * Based on Figma REST API documentation
 */

export interface FigmaFile {
  name: string;
  lastModified: string;
  thumbnailUrl: string;
  version: string;
  document: DocumentNode;
  components: Record<string, ComponentMetadata>;
  componentSets: Record<string, ComponentSetMetadata>;
  styles: Record<string, StyleMetadata>;
  schemaVersion: number;
}

export interface ComponentMetadata {
  key: string;
  name: string;
  description: string;
  componentSetId?: string;
}

export interface ComponentSetMetadata {
  key: string;
  name: string;
  description: string;
}

export interface StyleMetadata {
  key: string;
  name: string;
  styleType: 'FILL' | 'TEXT' | 'EFFECT' | 'GRID';
  description: string;
}

export interface Node {
  id: string;
  name: string;
  type: NodeType;
  visible: boolean;
  children?: Node[];
}

export type NodeType =
  | 'DOCUMENT'
  | 'CANVAS'
  | 'FRAME'
  | 'GROUP'
  | 'COMPONENT'
  | 'COMPONENT_SET'
  | 'INSTANCE'
  | 'RECTANGLE'
  | 'ELLIPSE'
  | 'LINE'
  | 'VECTOR'
  | 'TEXT'
  | 'IMAGE'
  | 'BOOLEAN_OPERATION'
  | 'SLICE';

export interface DocumentNode extends Node {
  type: 'DOCUMENT';
  children: CanvasNode[];
}

export interface CanvasNode extends Node {
  type: 'CANVAS';
  children: SceneNode[];
  backgroundColor: Color;
}

export type SceneNode =
  | FrameNode
  | GroupNode
  | ComponentNode
  | InstanceNode
  | RectangleNode
  | EllipseNode
  | LineNode
  | VectorNode
  | TextNode
  | BooleanOperationNode
  | SliceNode;

export interface FrameNode extends Node {
  type: 'FRAME';
  children?: SceneNode[];
  backgroundColor?: Color;
  layoutMode?: 'NONE' | 'HORIZONTAL' | 'VERTICAL';
  primaryAxisSizingMode?: 'FIXED' | 'AUTO';
  counterAxisSizingMode?: 'FIXED' | 'AUTO';
  primaryAxisAlignItems?: 'MIN' | 'CENTER' | 'MAX' | 'SPACE_BETWEEN';
  counterAxisAlignItems?: 'MIN' | 'CENTER' | 'MAX';
  paddingLeft?: number;
  paddingRight?: number;
  paddingTop?: number;
  paddingBottom?: number;
  itemSpacing?: number;
  absoluteBoundingBox: Rectangle;
  fills?: Paint[];
  strokes?: Paint[];
  strokeWeight?: number;
  cornerRadius?: number;
  clipsContent?: boolean;
}

export interface GroupNode extends Node {
  type: 'GROUP';
  children: SceneNode[];
  absoluteBoundingBox: Rectangle;
}

export interface ComponentNode extends Node {
  type: 'COMPONENT';
  children?: SceneNode[];
  backgroundColor?: Color;
  layoutMode?: 'NONE' | 'HORIZONTAL' | 'VERTICAL';
  primaryAxisSizingMode?: 'FIXED' | 'AUTO';
  counterAxisSizingMode?: 'FIXED' | 'AUTO';
  primaryAxisAlignItems?: 'MIN' | 'CENTER' | 'MAX' | 'SPACE_BETWEEN';
  counterAxisAlignItems?: 'MIN' | 'CENTER' | 'MAX';
  paddingLeft?: number;
  paddingRight?: number;
  paddingTop?: number;
  paddingBottom?: number;
  itemSpacing?: number;
  absoluteBoundingBox: Rectangle;
  fills?: Paint[];
  strokes?: Paint[];
  strokeWeight?: number;
  cornerRadius?: number;
  clipsContent?: boolean;
}

export interface InstanceNode extends Node {
  type: 'INSTANCE';
  componentId: string;
  children?: SceneNode[];
  backgroundColor?: Color;
  layoutMode?: 'NONE' | 'HORIZONTAL' | 'VERTICAL';
  primaryAxisSizingMode?: 'FIXED' | 'AUTO';
  counterAxisSizingMode?: 'FIXED' | 'AUTO';
  primaryAxisAlignItems?: 'MIN' | 'CENTER' | 'MAX' | 'SPACE_BETWEEN';
  counterAxisAlignItems?: 'MIN' | 'CENTER' | 'MAX';
  paddingLeft?: number;
  paddingRight?: number;
  paddingTop?: number;
  paddingBottom?: number;
  itemSpacing?: number;
  absoluteBoundingBox: Rectangle;
  fills?: Paint[];
  strokes?: Paint[];
  strokeWeight?: number;
  cornerRadius?: number;
  clipsContent?: boolean;
}

export interface RectangleNode extends Node {
  type: 'RECTANGLE';
  absoluteBoundingBox: Rectangle;
  fills?: Paint[];
  strokes?: Paint[];
  strokeWeight?: number;
  cornerRadius?: number;
}

export interface EllipseNode extends Node {
  type: 'ELLIPSE';
  absoluteBoundingBox: Rectangle;
  fills?: Paint[];
  strokes?: Paint[];
  strokeWeight?: number;
}

export interface LineNode extends Node {
  type: 'LINE';
  absoluteBoundingBox: Rectangle;
  strokes?: Paint[];
  strokeWeight?: number;
}

export interface VectorNode extends Node {
  type: 'VECTOR';
  absoluteBoundingBox: Rectangle;
  fills?: Paint[];
  strokes?: Paint[];
  strokeWeight?: number;
}

export interface TextNode extends Node {
  type: 'TEXT';
  characters: string;
  style: TypeStyle;
  fills?: Paint[];
  absoluteBoundingBox: Rectangle;
}

export interface BooleanOperationNode extends Node {
  type: 'BOOLEAN_OPERATION';
  children: SceneNode[];
  absoluteBoundingBox: Rectangle;
  fills?: Paint[];
  strokes?: Paint[];
}

export interface SliceNode extends Node {
  type: 'SLICE';
  absoluteBoundingBox: Rectangle;
}

export interface Color {
  r: number; // 0-1
  g: number; // 0-1
  b: number; // 0-1
  a: number; // 0-1
}

export interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Paint {
  type: 'SOLID' | 'GRADIENT_LINEAR' | 'GRADIENT_RADIAL' | 'GRADIENT_ANGULAR' | 'GRADIENT_DIAMOND' | 'IMAGE' | 'EMOJI';
  visible?: boolean;
  opacity?: number;
  color?: Color;
  gradientStops?: GradientStop[];
  scaleMode?: 'FILL' | 'FIT' | 'TILE' | 'STRETCH';
  imageRef?: string;
}

export interface GradientStop {
  position: number; // 0-1
  color: Color;
}

export interface TypeStyle {
  fontFamily: string;
  fontPostScriptName?: string;
  fontWeight: number;
  fontSize: number;
  textAlignHorizontal: 'LEFT' | 'CENTER' | 'RIGHT' | 'JUSTIFIED';
  textAlignVertical: 'TOP' | 'CENTER' | 'BOTTOM';
  letterSpacing: number;
  lineHeightPx: number;
  lineHeightPercent: number;
  fills?: Paint[];
  textCase?: 'ORIGINAL' | 'UPPER' | 'LOWER' | 'TITLE';
  textDecoration?: 'NONE' | 'STRIKETHROUGH' | 'UNDERLINE';
}

export interface ImageUrls {
  [nodeId: string]: string; // URL to download image from Figma CDN
}

export interface ImageExportOptions {
  format: 'png' | 'jpg' | 'svg' | 'pdf';
  scale?: number;
  contentsOnly?: boolean;
}
