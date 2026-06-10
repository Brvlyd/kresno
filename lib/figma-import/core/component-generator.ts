/**
 * Component Generator
 * Generates React/Next.js components from parsed Figma data
 */

import { ParsedFrame, ParsedNode, ParsedComponent } from '../types/internal-models';
import { sanitizeComponentName, toCamelCase, toKebabCase } from '../utils/name-sanitizer';

/**
 * Generated component result
 */
export interface GeneratedComponent {
  name: string;
  filePath: string;
  content: string;
  dependencies: string[];
}

/**
 * Generator options
 */
export interface GeneratorOptions {
  namingConvention: 'pascal' | 'kebab' | 'camel';
  useTailwind: boolean;
  outputDir: string;
}

/**
 * Component Generator Class
 * Generates React components from parsed Figma frames
 */
export class ComponentGenerator {
  private componentMap: Map<string, string> = new Map();

  /**
   * Generate a React component from a parsed frame
   * Task 10.1: Generate functional React components with TypeScript
   * Requirements: 7.1, 7.2, 7.4, 7.5
   */
  generate(frame: ParsedFrame, options: GeneratorOptions): GeneratedComponent {
    const componentName = this.applyNamingConvention(frame.sanitizedName, options.namingConvention);
    
    // Store component mapping for instances
    if (frame.nodeType === 'component') {
      this.componentMap.set(frame.id, componentName);
    }

    // Generate props interface
    const propsInterface = this.generatePropsInterface(frame, componentName);

    // Generate component body
    const componentBody = this.generateComponentBody(frame, options);

    // Collect dependencies
    const dependencies = this.collectDependencies(frame);

    // Resolve referenced component instances to their generated component names
    // (Task 10.9 / Requirement 9.2). These become named imports so the file
    // compiles, and are surfaced as dependencies. The component being generated
    // is excluded to avoid a self-import.
    const referencedComponents = this.collectInstanceComponentNames(frame, componentName);
    for (const ref of referencedComponents) {
      if (!dependencies.includes(ref)) {
        dependencies.push(ref);
      }
    }

    // Generate imports
    const imports = this.generateImports(dependencies, options.useTailwind, referencedComponents, options);

    // Combine into full component content
    const content = `${imports}\n\n${propsInterface}\n\n${componentBody}`;

    // Generate file path
    const fileName = options.namingConvention === 'kebab' 
      ? `${toKebabCase(componentName)}.tsx`
      : `${componentName}.tsx`;
    const filePath = `${options.outputDir}/${fileName}`;

    return {
      name: componentName,
      filePath,
      content,
      dependencies,
    };
  }

  /**
   * Apply naming convention to component name
   */
  private applyNamingConvention(name: string, convention: 'pascal' | 'kebab' | 'camel'): string {
    switch (convention) {
      case 'pascal':
        return sanitizeComponentName(name);
      case 'kebab':
        return toKebabCase(name);
      case 'camel':
        return toCamelCase(name);
      default:
        return sanitizeComponentName(name);
    }
  }

  /**
   * Generate TypeScript props interface
   * Task 10.7: Generate props for variants
   * Requirement 7.7: Generate props for variant switching
   *
   * When the frame carries variant metadata (variant properties with sets of
   * possible values), each variant property is emitted as an optional prop
   * typed as a string-literal union of its possible values, e.g.
   *   variant?: 'primary' | 'secondary';
   *   size?: 'sm' | 'md' | 'lg';
   * Property names are sanitized to valid TS identifiers and values are escaped
   * so they remain valid string-literal members. Components without variants
   * keep the default props (className?, children?).
   */
  generatePropsInterface(frame: ParsedFrame, componentName: string): string {
    const props: string[] = [];

    // Add variant props if the frame carries variant metadata.
    if (frame.variants && frame.variants.length > 0) {
      for (const variant of frame.variants) {
        const propName = this.sanitizeVariantPropertyName(variant.propertyName);
        if (!propName) {
          continue;
        }

        // Convert each value into a string-literal member, de-duplicating while
        // preserving order, and dropping values that sanitize to empty.
        const seen = new Set<string>();
        const members: string[] = [];
        for (const value of variant.values || []) {
          const literal = this.toStringLiteralMember(value);
          if (literal === null || seen.has(literal)) {
            continue;
          }
          seen.add(literal);
          members.push(literal);
        }

        if (members.length === 0) {
          continue;
        }

        props.push(`  ${propName}?: ${members.join(' | ')};`);
      }
    }

    // Add common props
    props.push('  className?: string;');
    props.push('  children?: React.ReactNode;');

    return `interface ${componentName}Props {\n${props.join('\n')}\n}\n`;
  }

  /**
   * Sanitize a variant property name into a valid TypeScript identifier.
   * Uses camelCase conversion (stripping invalid characters). If the result is
   * not a valid identifier (e.g. empty or starting with a digit), the name is
   * emitted as a quoted property key, which is valid in a TS interface.
   * Returns an empty string when no usable property name can be produced.
   */
  private sanitizeVariantPropertyName(name: string): string {
    const camel = toCamelCase(name ?? '');

    if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(camel)) {
      return camel;
    }

    // Fall back to a quoted property key when a bare identifier is not possible
    // but there is still meaningful (non-empty) content to represent.
    const escaped = this.escapeStringLiteralContent(name ?? '');
    return escaped.length > 0 ? `'${escaped}'` : '';
  }

  /**
   * Convert a variant value into a single-quoted string-literal union member.
   * The content is escaped so embedded quotes/backslashes keep the literal
   * valid. Returns null when the value is empty (nothing meaningful to emit).
   */
  private toStringLiteralMember(value: string): string | null {
    if (value === undefined || value === null) {
      return null;
    }
    const trimmed = String(value).trim();
    if (trimmed.length === 0) {
      return null;
    }
    return `'${this.escapeStringLiteralContent(trimmed)}'`;
  }

  /**
   * Escape characters that would otherwise break a single-quoted TS string
   * literal (backslashes and single quotes).
   */
  private escapeStringLiteralContent(value: string): string {
    return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  }

  /**
   * Generate component body with JSX
   */
  private generateComponentBody(frame: ParsedFrame, options: GeneratorOptions): string {
    const componentName = this.applyNamingConvention(frame.sanitizedName, options.namingConvention);
    
    // Generate JSX for children
    const childrenJsx = this.generateChildrenJsx(frame.children, options, 1);

    // Generate className
    const className = options.useTailwind 
      ? this.generateTailwindClasses(frame)
      : frame.styles.className;

    return `export const ${componentName}: React.FC<${componentName}Props> = ({ className, children }) => {
  return (
    <div className={\`${className} \${className || ''}\`}>
      ${childrenJsx}
    </div>
  );
};`;
  }

  /**
   * Generate JSX for children nodes
   * Task 10.5: Preserve component hierarchy
   * Requirement 7.6: Preserve hierarchy through nested structures
   */
  private generateChildrenJsx(children: ParsedNode[], options: GeneratorOptions, indent: number): string {
    if (!children || children.length === 0) {
      return '{children}';
    }

    const indentation = '  '.repeat(indent);
    const lines: string[] = [];

    for (const child of children) {
      const jsx = this.generateNodeJsx(child, options, indent);
      lines.push(`${indentation}${jsx}`);
    }

    return lines.join('\n');
  }

  /**
   * Generate JSX for a single node
   */
  private generateNodeJsx(node: ParsedNode, options: GeneratorOptions, indent: number): string {
    // Handle text nodes
    // Requirement 7.4: Generate semantic HTML elements based on node types.
    // Use the node's resolved htmlTag (h1-h6, span, p, etc.) instead of always
    // emitting <p>, falling back to <p> when no tag was resolved.
    if (node.nodeType === 'text') {
      const tag = node.htmlTag || 'p';
      const className = options.useTailwind
        ? this.generateTailwindClassesForNode(node)
        : node.styles.className;
      return `<${tag} className="${className}">${node.content || ''}</${tag}>`;
    }

    // Handle image nodes
    if (node.nodeType === 'image') {
      return this.generateImageJsx(node, options);
    }

    // Handle component instances
    // Task 10.9 / Requirement 9.2: reference the base component by its generated
    // name (e.g. <Button />) using the component ID -> name mapping. The tag is
    // left self-closing so instance override props (Task 10.11) can extend it.
    if (node.nodeType === 'instance') {
      const referencedName = this.resolveInstanceComponentName(node);
      if (referencedName) {
        // Task 10.11 / Requirement 9.3: pass overridden values to the base
        // component as JSX props. Instances with no overrides stay self-closing
        // with no props (e.g. <Button />).
        const overrideProps = this.generateInstanceOverrideProps(node);
        return overrideProps
          ? `<${referencedName} ${overrideProps} />`
          : `<${referencedName} />`;
      }
      // Unresolved instance (no mapping): degrade to a clearly-named, valid
      // fallback element rather than emitting invalid code.
      const safeName = this.escapeAttribute(node.name && node.name.trim().length > 0 ? node.name : 'Instance');
      return `<div className="unresolved-instance" data-instance="${safeName}">{/* Unresolved component instance */}</div>`;
    }

    // Handle container nodes (frames, groups, etc.)
    const className = options.useTailwind
      ? this.generateTailwindClassesForNode(node)
      : node.styles.className;

    const childrenJsx = node.children && node.children.length > 0
      ? `\n${this.generateChildrenJsx(node.children, options, indent + 1)}\n${'  '.repeat(indent)}`
      : '';

    return `<${node.htmlTag} className="${className}">${childrenJsx}</${node.htmlTag}>`;
  }

  /**
   * Generate Next.js Image component JSX
   * Task 10.3: Use Next.js Image component
   * Requirement 7.3: Use Next.js Image component for images with correct
   * src, alt, width, and height props.
   *
   * Hardening:
   * - Missing imagePath falls back to a placeholder asset.
   * - Missing/invalid dimensions fall back to sensible defaults (no NaN/undefined).
   * - The alt text is derived from the node name and escaped so the generated
   *   JSX attribute stays valid even when the name contains quotes or other
   *   special characters.
   */
  private generateImageJsx(node: ParsedNode, options: GeneratorOptions): string {
    // src: prefer the resolved image asset path, fall back to a placeholder.
    const imagePath = node.imagePath && node.imagePath.trim().length > 0
      ? node.imagePath
      : '/placeholder.png';

    // alt: descriptive text derived from the node name, escaped for JSX.
    const alt = this.escapeAttribute(node.name && node.name.trim().length > 0 ? node.name : 'Image');

    // Extract dimensions from layout, guarding against NaN/undefined/<=0.
    const width = this.resolveDimension(node.layout.width);
    const height = this.resolveDimension(node.layout.height);

    const className = this.escapeAttribute(node.styles.className || '');

    return `<Image
      src="${this.escapeAttribute(imagePath)}"
      alt="${alt}"
      width={${width}}
      height={${height}}
      className="${className}"
    />`;
  }

  /**
   * Resolve a layout dimension to a valid positive integer for the Next.js
   * Image component. Returns a sensible fallback when the value is missing,
   * not finite (NaN/Infinity), or non-positive.
   */
  private resolveDimension(value: number | undefined, fallback = 100): number {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
      // Clamp to a minimum of 1 so fractional values in (0, 0.5) that would
      // otherwise round to 0 still yield a positive integer (Requirement 7.3).
      return Math.max(1, Math.round(value));
    }
    return fallback;
  }

  /**
   * Escape a string for safe use inside a double-quoted JSX attribute value.
   * Prevents generated JSX from being broken by quotes or angle brackets in
   * Figma node names.
   */
  private escapeAttribute(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  /**
   * Generate Tailwind classes for a frame
   */
  private generateTailwindClasses(frame: ParsedFrame): string {
    const classes: string[] = [];

    // Add layout classes based on frame.layout
    if (frame.layout.display === 'flex') {
      classes.push('flex');
      
      if (frame.layout.flexDirection === 'column') {
        classes.push('flex-col');
      } else if (frame.layout.flexDirection === 'row') {
        classes.push('flex-row');
      }

      if (frame.layout.justifyContent) {
        const justifyMap: Record<string, string> = {
          'flex-start': 'justify-start',
          'center': 'justify-center',
          'flex-end': 'justify-end',
          'space-between': 'justify-between',
          'space-around': 'justify-around',
        };
        if (justifyMap[frame.layout.justifyContent]) {
          classes.push(justifyMap[frame.layout.justifyContent]);
        }
      }

      if (frame.layout.alignItems) {
        const alignMap: Record<string, string> = {
          'flex-start': 'items-start',
          'center': 'items-center',
          'flex-end': 'items-end',
          'stretch': 'items-stretch',
        };
        if (alignMap[frame.layout.alignItems]) {
          classes.push(alignMap[frame.layout.alignItems]);
        }
      }

      if (frame.layout.gap !== undefined) {
        const gapRem = Math.round(frame.layout.gap / 4);
        classes.push(`gap-${gapRem}`);
      }
    }

    // Add padding if present
    if (frame.layout.padding) {
      const { top, right, bottom, left } = frame.layout.padding;
      if (top === right && right === bottom && bottom === left) {
        const pRem = Math.round(top / 4);
        classes.push(`p-${pRem}`);
      } else {
        // Individual padding (simplified)
        classes.push('p-4'); // Default fallback
      }
    }

    return classes.join(' ');
  }

  /**
   * Generate Tailwind classes for a node
   */
  private generateTailwindClassesForNode(node: ParsedNode): string {
    const classes: string[] = [];

    // Add basic layout classes
    if (node.layout.display === 'flex') {
      classes.push('flex');
    } else if (node.layout.display === 'block') {
      classes.push('block');
    }

    return classes.join(' ');
  }

  /**
   * Collect dependencies (imported components, images, etc.)
   */
  private collectDependencies(frame: ParsedFrame): string[] {
    const deps: string[] = ['React'];

    // Check if we need Next.js Image
    if (this.hasImageNodes(frame.children)) {
      deps.push('next/image');
    }

    return deps;
  }

  /**
   * Check if tree has image nodes
   */
  private hasImageNodes(nodes: ParsedNode[]): boolean {
    for (const node of nodes) {
      if (node.nodeType === 'image') {
        return true;
      }
      if (node.children && this.hasImageNodes(node.children)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Generate import statements
   *
   * In addition to framework imports (React, next/image), emits a named import
   * for each referenced component instance (Task 10.9 / Requirement 9.2) so the
   * generated file compiles, e.g. `import { Button } from './Button';`. The
   * import path file base follows the configured naming convention.
   */
  private generateImports(
    dependencies: string[],
    useTailwind: boolean,
    referencedComponents: string[] = [],
    options?: GeneratorOptions
  ): string {
    const imports: string[] = [];

    if (dependencies.includes('React')) {
      imports.push("import React from 'react';");
    }

    if (dependencies.includes('next/image')) {
      imports.push("import Image from 'next/image';");
    }

    // Named imports for referenced component instances.
    for (const name of referencedComponents) {
      const fileBase = this.componentFileBaseName(name, options?.namingConvention ?? 'pascal');
      imports.push(`import { ${name} } from './${fileBase}';`);
    }

    if (!useTailwind) {
      // Would import CSS module here
      // imports.push("import styles from './ComponentName.module.css';");
    }

    return imports.join('\n');
  }

  /**
   * Compute the file base name used for importing a generated component,
   * matching the file naming used by generate(): kebab-case files use the
   * kebab form, otherwise the component name is used as-is.
   */
  private componentFileBaseName(name: string, convention: 'pascal' | 'kebab' | 'camel'): string {
    return convention === 'kebab' ? toKebabCase(name) : name;
  }

  /**
   * Resolve component instances to their base components
   * Task 10.9: Handle component definitions and instances
   * Requirements: 9.1, 9.2, 9.4
   *
   * Builds the mapping between Figma component IDs and generated component
   * names (Requirement 9.4) and persists it into the generator's internal
   * componentMap so subsequent generate() calls can resolve instance nodes
   * (Requirement 9.2). The returned map is a snapshot of the resolved entries.
   */
  resolveComponentReferences(components: ParsedComponent[]): Map<string, string> {
    const mapping = new Map<string, string>();

    for (const component of components) {
      const componentName = sanitizeComponentName(component.sanitizedName);
      mapping.set(component.id, componentName);
      // Persist for instance resolution during JSX generation.
      this.componentMap.set(component.id, componentName);
    }

    return mapping;
  }

  /**
   * Resolve a single instance node to the generated name of its base component
   * using the component ID -> name mapping. Returns null when the instance has
   * no componentId or the id is not present in the mapping.
   */
  private resolveInstanceComponentName(node: ParsedNode): string | null {
    if (!node.componentId) {
      return null;
    }
    return this.componentMap.get(node.componentId) ?? null;
  }

  /**
   * Generate JSX override props for a component instance.
   * Task 10.11 / Requirement 9.3: for an instance with property overrides,
   * emit props that pass the overridden values to the base component, e.g.
   *   <Button variant="primary" label="Save" disabled={true} count={3} />
   *
   * Rendering rules by value type:
   * - string  -> prop="value" (escaped so the JSX attribute stays valid)
   * - number  -> prop={value} (non-finite values such as NaN/Infinity skipped)
   * - boolean -> prop={value}
   *
   * Prop names are sanitized to valid JSX attribute identifiers; names that
   * cannot be sanitized (empty/invalid) are skipped, as are null/undefined
   * values. Duplicate sanitized names keep only their first occurrence.
   * Returns an empty string when there are no usable overrides, so the caller
   * keeps emitting a bare `<Button />`.
   */
  private generateInstanceOverrideProps(node: ParsedNode): string {
    const overrides = node.overrides;
    if (!overrides) {
      return '';
    }

    const parts: string[] = [];
    const seen = new Set<string>();

    for (const [rawName, value] of Object.entries(overrides)) {
      const propName = this.sanitizeJsxPropName(rawName);
      if (!propName || seen.has(propName)) {
        continue;
      }
      if (value === undefined || value === null) {
        continue;
      }

      if (typeof value === 'string') {
        seen.add(propName);
        parts.push(`${propName}="${this.escapeAttribute(value)}"`);
      } else if (typeof value === 'number') {
        if (!Number.isFinite(value)) {
          continue;
        }
        seen.add(propName);
        parts.push(`${propName}={${value}}`);
      } else if (typeof value === 'boolean') {
        seen.add(propName);
        parts.push(`${propName}={${value}}`);
      }
    }

    return parts.join(' ');
  }

  /**
   * Sanitize an override property name into a valid JSX attribute identifier
   * (a valid JS identifier suitable as a React component prop). Uses camelCase
   * conversion and returns an empty string when no valid identifier can be
   * produced, signalling the caller to skip the prop.
   */
  private sanitizeJsxPropName(name: string): string {
    const camel = toCamelCase(name ?? '');
    return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(camel) ? camel : '';
  }

  /**
   * Collect the set of generated component names referenced by instance nodes
   * within a frame's subtree. Used to emit named imports for instances so the
   * generated file compiles. The component currently being generated is
   * excluded to prevent a self-import. Results are de-duplicated and ordered.
   */
  private collectInstanceComponentNames(frame: ParsedFrame, currentComponentName: string): string[] {
    const names = new Set<string>();

    const visit = (nodes: ParsedNode[] | undefined): void => {
      if (!nodes) {
        return;
      }
      for (const node of nodes) {
        if (node.nodeType === 'instance') {
          const referencedName = this.resolveInstanceComponentName(node);
          if (referencedName && referencedName !== currentComponentName) {
            names.add(referencedName);
          }
        }
        visit(node.children);
      }
    };

    visit(frame.children);

    return Array.from(names);
  }
}
