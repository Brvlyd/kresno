/**
 * Internal data models for parsed design representation
 * These models bridge Figma API responses and generated code
 */

export interface ParsedDesign {
  metadata: FileMetadata;
  pages: ParsedPage[];
  componentLibrary: ComponentLibrary;
  styleGuide: StyleGuide;
}

export interface FileMetadata {
  fileName: string;
  fileKey: string;
  lastModified: Date;
  version: string;
}

export interface ParsedPage {
  id: string;
  name: string;
  frames: ParsedFrame[];
}

export interface ParsedFrame {
  id: string;
  name: string;
  sanitizedName: string; // Valid as component name
  nodeType: 'frame' | 'component' | 'instance';
  componentId?: string; // For instances
  layout: LayoutInfo;
  styles: StyleInfo;
  children: ParsedNode[];
  // Variant properties when this frame represents a component with variants.
  // Each entry maps a variant property name to its set of possible values.
  // Used by the Component_Generator to emit union-typed props (Requirement 7.7).
  variants?: VariantProperty[];
}

export interface ParsedNode {
  id: string;
  name: string;
  sanitizedName: string;
  nodeType: 'frame' | 'group' | 'component' | 'instance' | 'container' | 'text' | 'image' | 'shape';
  componentId?: string; // For instance nodes: links to the source component definition
  htmlTag: string; // div, p, img, span, etc.
  content?: string; // For text nodes
  imagePath?: string; // For image nodes
  layout: LayoutInfo;
  styles: StyleInfo;
  children?: ParsedNode[];
  // For instance nodes: overridable property name/value pairs that differ from
  // the base component (e.g. overridden text, variant prop values). Rendered by
  // the Component_Generator as JSX props on the instance reference so the
  // overridden values are passed to the base component (Requirement 9.3).
  overrides?: Record<string, string | number | boolean>;
}

export interface LayoutInfo {
  display: 'flex' | 'block' | 'inline-block' | 'none';
  flexDirection?: 'row' | 'column';
  justifyContent?: 'flex-start' | 'center' | 'flex-end' | 'space-between' | 'space-around';
  alignItems?: 'flex-start' | 'center' | 'flex-end' | 'stretch';
  gap?: number;
  padding?: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  width?: number;
  height?: number;
  position?: 'relative' | 'absolute' | 'fixed';
  top?: number;
  left?: number;
  right?: number;
  bottom?: number;
}

export interface StyleInfo {
  className: string;
  cssProperties: Record<string, string>;
  tailwindClasses?: string[];
}

export interface ComponentLibrary {
  components: Map<string, ParsedComponent>;
}

export interface ParsedComponent {
  id: string;
  name: string;
  sanitizedName: string;
  hasVariants: boolean;
  variants?: VariantProperty[];
  frame: ParsedFrame;
}

export interface VariantProperty {
  propertyName: string;
  values: string[];
}

export interface StyleGuide {
  colors: Map<string, ColorDefinition>;
  typography: Map<string, TypographyDefinition>;
  effects: Map<string, EffectDefinition>;
}

export interface ColorDefinition {
  name: string;
  value: string; // CSS color value (rgb, rgba, hex)
  originalColor: {
    r: number;
    g: number;
    b: number;
    a: number;
  };
}

export interface TypographyDefinition {
  name: string;
  cssClassName: string;
  properties: TypographyStyle;
}

export interface TypographyStyle {
  fontFamily: string;
  fontSize: string; // With unit (px, rem)
  fontWeight: number;
  lineHeight: string; // With unit or unitless
  letterSpacing: string; // With unit
  textAlign: 'left' | 'center' | 'right' | 'justify';
  color: string;
  textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
  textDecoration?: 'none' | 'underline' | 'line-through';
}

export interface EffectDefinition {
  name: string;
  type: 'SHADOW' | 'BLUR';
  cssValue: string;
}

export interface ValidationResult {
  isValid: boolean;
  warnings: ValidationMessage[];
  errors: ValidationMessage[];
}

export interface ValidationMessage {
  nodeId?: string;
  nodeName?: string;
  message: string;
  severity: 'warning' | 'error';
}
