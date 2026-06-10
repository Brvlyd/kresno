/**
 * Stylesheet Generator
 * Produces stylesheets for generated components.
 *
 * This module owns the two mutually-exclusive output strategies described by
 * Requirement 10:
 *  - CSS Modules (`.module.css`) when Tailwind is disabled (Requirement 10.4),
 *    implemented here by {@link StylesheetGenerator.generateCssModule}.
 *  - Tailwind utility classes when Tailwind is enabled (Requirement 10.3),
 *    implemented by {@link StylesheetGenerator.generateTailwindClasses}.
 *
 * The CSS-modules path collects the className + cssProperties (and the parsed
 * layout) of a frame and every node in its subtree and emits syntactically
 * valid CSS rules. It reuses the parsed StyleInfo already produced by the
 * StyleExtractor rather than re-deriving styles from raw Figma data.
 */

import { ParsedFrame, ParsedNode, StyleInfo, LayoutInfo } from '../types/internal-models';
import { sanitizeComponentName, toCamelCase, toKebabCase } from '../utils/name-sanitizer';
import { StyleExtractor } from './style-extractor';

/**
 * The result of generating a stylesheet: a filename and its file content.
 * Mirrors the shape used by GeneratedComponent (name + content) so the
 * orchestrator can write both side by side.
 */
export interface GeneratedStylesheet {
  /** Filename to write (e.g. `Button.module.css`). */
  fileName: string;
  /** The stylesheet file contents (valid CSS). */
  content: string;
}

/**
 * Options controlling stylesheet generation.
 */
export interface StylesheetGeneratorOptions {
  /**
   * Naming convention used to derive the stylesheet filename so it matches the
   * generated component file base (defaults to `pascal`).
   */
  namingConvention?: 'pascal' | 'kebab' | 'camel';
}

/**
 * The result of generating Tailwind utility classes for a frame and its
 * descendant nodes (task 12.3 / Requirement 10.3).
 *
 * Both maps are keyed by Figma node id so the Component_Generator can look up
 * the classes for the node it is currently emitting and drop them straight into
 * the element's `className`:
 *
 * ```ts
 * const tw = new StylesheetGenerator().generateTailwindClasses(frame);
 * // when emitting <div ...> for `node`:
 * const className = tw.classNamesById[node.id] ?? '';
 * // => `<div className="flex flex-row justify-center items-center gap-4">`
 * ```
 */
export interface GeneratedTailwindClasses {
  /**
   * Map of node id -> a single space-joined Tailwind class string ready to be
   * assigned to a JSX `className` prop. Nodes with no classes map to `''`.
   */
  classNamesById: Record<string, string>;
  /**
   * Map of node id -> the de-duplicated, ordered list of individual Tailwind
   * utility tokens for that node. Useful when the caller wants to merge or
   * filter classes programmatically rather than use the joined string.
   */
  classListById: Record<string, string[]>;
}

/**
 * Generates stylesheets for components in either CSS-modules or Tailwind form.
 *
 * Task 12.1 implements the CSS-modules path ({@link generateCssModule}). The
 * Tailwind utility-class path ({@link generateTailwindClasses}, task 12.3)
 * reuses {@link StyleExtractor.cssToTailwind} for the CSS -> utility mapping.
 */
export class StylesheetGenerator {
  /**
   * Reused StyleExtractor instance. The Tailwind path delegates the actual
   * CSS-property -> utility-class mapping to {@link StyleExtractor.cssToTailwind}
   * (and, for raw Figma frames, {@link StyleExtractor.autoLayoutToFlexbox}) so
   * the mapping lives in exactly one place.
   */
  private readonly styleExtractor = new StyleExtractor();

  /**
   * Generate a CSS-modules stylesheet for a frame when Tailwind is disabled.
   * Task 12.1 / Requirement 10.4.
   *
   * Derives a `<ComponentName>.module.css` filename and emits one CSS rule per
   * unique className found across the frame and its descendant nodes. Each rule
   * merges the node's parsed layout with its explicit cssProperties (the latter
   * taking precedence). All extracted styles are included.
   *
   * The output is always syntactically valid CSS: selectors are sanitized to
   * valid class identifiers, property names are normalized to kebab-case,
   * values are sanitized so they cannot break out of the declaration, every
   * declaration ends with `;`, and braces are always balanced. A frame with no
   * styles produces an empty (still valid) stylesheet.
   */
  generateCssModule(
    frame: ParsedFrame,
    options: StylesheetGeneratorOptions = {}
  ): GeneratedStylesheet {
    const convention = options.namingConvention ?? 'pascal';
    const componentName = this.applyNamingConvention(frame.sanitizedName || frame.name, convention);
    const fileBase = convention === 'kebab' ? toKebabCase(componentName) : componentName;
    const fileName = `${fileBase}.module.css`;

    // Collect rules keyed by sanitized class name, merging declarations when the
    // same class appears on multiple nodes so no duplicate selectors are emitted.
    const ruleMap = new Map<string, Map<string, string>>();
    this.addRule(frame.styles, frame.layout, ruleMap);
    this.collectNodeRules(frame.children, ruleMap);

    const content = this.formatStylesheet(fileName, ruleMap);

    return { fileName, content };
  }

  /**
   * Generate Tailwind utility classes for a frame and every node in its
   * subtree when Tailwind is enabled. Task 12.3 / Requirement 10.3.
   *
   * For each node, the node's parsed {@link LayoutInfo} is converted into the
   * intermediate CSS-property record that {@link StyleExtractor.cssToTailwind}
   * understands and mapped to Tailwind utility tokens (flex, flex-row/col,
   * justify-*, items-*, gap-N, p-N). Any utility classes already attached to the
   * node's {@link StyleInfo.tailwindClasses} (e.g. produced earlier by the
   * StyleExtractor) are merged in as well. The combined list is validated so
   * only well-formed utility tokens survive (no raw CSS syntax, units, colons or
   * semicolons) and is de-duplicated per node while preserving order.
   *
   * The result maps each node id to both a ready-to-use `className` string and
   * the underlying token list so the Component_Generator can apply the classes
   * to the `className` of the corresponding element/component.
   */
  generateTailwindClasses(frame: ParsedFrame): GeneratedTailwindClasses {
    const classListById: Record<string, string[]> = {};

    const visit = (node: ParsedFrame | ParsedNode): void => {
      classListById[node.id] = this.getClassesForNode(node);
      if (node.children) {
        for (const child of node.children) {
          visit(child);
        }
      }
    };

    visit(frame);

    const classNamesById: Record<string, string> = {};
    for (const [id, list] of Object.entries(classListById)) {
      classNamesById[id] = list.join(' ');
    }

    return { classNamesById, classListById };
  }

  /**
   * Compute the de-duplicated list of Tailwind utility tokens for a single
   * node, derived from its layout (via {@link StyleExtractor.cssToTailwind}) and
   * any pre-computed {@link StyleInfo.tailwindClasses}. This is the per-node
   * helper referenced by {@link generateTailwindClasses}; callers that only have
   * one node (and not a whole frame) can use it directly to obtain the class
   * list for that node's `className`.
   */
  getClassesForNode(node: ParsedFrame | ParsedNode): string[] {
    const cssRecord = this.layoutToCssRecord(node.layout);
    const fromLayout = this.styleExtractor.cssToTailwind(cssRecord);
    const explicit = node.styles?.tailwindClasses ?? [];

    return this.dedupeValidTokens([...fromLayout, ...explicit]);
  }

  /**
   * Convert a parsed {@link LayoutInfo} into the intermediate CSS-property
   * record shape expected by {@link StyleExtractor.cssToTailwind} (camelCased
   * keys, string values with `px` units where the mapper parses them). Only
   * defined fields are emitted so unset properties never produce stray classes.
   */
  private layoutToCssRecord(layout: LayoutInfo | undefined): Record<string, string> {
    const css: Record<string, string> = {};
    if (!layout) {
      return css;
    }

    if (layout.display) css.display = layout.display;
    if (layout.flexDirection) css.flexDirection = layout.flexDirection;
    if (layout.justifyContent) css.justifyContent = layout.justifyContent;
    if (layout.alignItems) css.alignItems = layout.alignItems;
    if (typeof layout.gap === 'number') css.gap = `${layout.gap}px`;

    if (layout.padding) {
      const { top, right, bottom, left } = layout.padding;
      css.padding =
        top === right && right === bottom && bottom === left
          ? `${top}px`
          : `${top}px ${right}px ${bottom}px ${left}px`;
    }

    return css;
  }

  /**
   * Filter a list of candidate classes down to valid Tailwind utility tokens
   * and de-duplicate while preserving first-seen order. A valid token starts
   * with a letter and contains only letters, digits and hyphens, which excludes
   * raw CSS syntax (`:`, `;`, `{`, `}`), units like `16px`, colors (`#fff`,
   * `rgb(...)`) and whitespace-separated declarations.
   */
  private dedupeValidTokens(tokens: string[]): string[] {
    const seen = new Set<string>();
    const result: string[] = [];

    for (const token of tokens) {
      const trimmed = (token ?? '').trim();
      if (!this.isValidUtilityToken(trimmed) || seen.has(trimmed)) {
        continue;
      }
      seen.add(trimmed);
      result.push(trimmed);
    }

    return result;
  }

  /**
   * Determine whether a string is a well-formed Tailwind utility token: a
   * leading letter followed by letters, digits or hyphens. This rejects any
   * CSS-syntax leakage (semicolons, colons, braces, parentheses, `#`, `%`,
   * whitespace) and unit-bearing values such as `16px`.
   */
  private isValidUtilityToken(token: string): boolean {
    return /^[a-z][a-z0-9-]*$/i.test(token);
  }

  /**
   * Apply the naming convention to derive the component name used for the
   * stylesheet filename. Mirrors ComponentGenerator so the `.module.css` file
   * base lines up with the generated `.tsx` file.
   */
  private applyNamingConvention(
    name: string,
    convention: 'pascal' | 'kebab' | 'camel'
  ): string {
    switch (convention) {
      case 'kebab':
        return toKebabCase(name);
      case 'camel':
        return toCamelCase(name);
      case 'pascal':
      default:
        return sanitizeComponentName(name);
    }
  }

  /**
   * Recursively collect CSS rules for an array of nodes and their children.
   */
  private collectNodeRules(
    nodes: ParsedNode[] | undefined,
    ruleMap: Map<string, Map<string, string>>
  ): void {
    if (!nodes || nodes.length === 0) {
      return;
    }
    for (const node of nodes) {
      this.addRule(node.styles, node.layout, ruleMap);
      this.collectNodeRules(node.children, ruleMap);
    }
  }

  /**
   * Add (or merge into) a rule for a single node's styles. Nodes with no usable
   * class name are skipped so we never emit a `.` selector with no name.
   */
  private addRule(
    styles: StyleInfo | undefined,
    layout: LayoutInfo | undefined,
    ruleMap: Map<string, Map<string, string>>
  ): void {
    const className = this.sanitizeClassName(styles?.className);
    if (!className) {
      return;
    }

    const declarations = this.buildDeclarations(layout, styles?.cssProperties);

    const existing = ruleMap.get(className);
    if (existing) {
      // Merge declarations from a later node into the existing rule.
      for (const [prop, value] of declarations) {
        existing.set(prop, value);
      }
    } else {
      ruleMap.set(className, declarations);
    }
  }

  /**
   * Build the declaration map for a node, combining its parsed layout with its
   * explicit cssProperties. Layout-derived declarations are added first so that
   * any explicitly extracted cssProperties override them. Property names are
   * normalized to kebab-case and de-duplicated; empty values are dropped.
   */
  private buildDeclarations(
    layout: LayoutInfo | undefined,
    cssProperties: Record<string, string> | undefined
  ): Map<string, string> {
    const declarations = new Map<string, string>();

    const add = (rawProp: string, rawValue: string): void => {
      const prop = this.toCssPropertyName(rawProp);
      const value = this.sanitizeValue(rawValue);
      if (prop.length > 0 && value.length > 0) {
        declarations.set(prop, value);
      }
    };

    for (const [prop, value] of Object.entries(this.layoutToCss(layout))) {
      add(prop, value);
    }

    if (cssProperties) {
      for (const [prop, value] of Object.entries(cssProperties)) {
        add(prop, value);
      }
    }

    return declarations;
  }

  /**
   * Convert a parsed LayoutInfo into CSS declarations (kebab-cased properties
   * with units applied). Only defined fields are emitted.
   */
  private layoutToCss(layout: LayoutInfo | undefined): Record<string, string> {
    const css: Record<string, string> = {};
    if (!layout) {
      return css;
    }

    if (layout.display) css['display'] = layout.display;
    if (layout.flexDirection) css['flex-direction'] = layout.flexDirection;
    if (layout.justifyContent) css['justify-content'] = layout.justifyContent;
    if (layout.alignItems) css['align-items'] = layout.alignItems;
    if (typeof layout.gap === 'number') css['gap'] = `${layout.gap}px`;

    if (layout.padding) {
      const { top, right, bottom, left } = layout.padding;
      css['padding'] = `${top}px ${right}px ${bottom}px ${left}px`;
    }

    if (typeof layout.width === 'number') css['width'] = `${layout.width}px`;
    if (typeof layout.height === 'number') css['height'] = `${layout.height}px`;
    if (layout.position) css['position'] = layout.position;
    if (typeof layout.top === 'number') css['top'] = `${layout.top}px`;
    if (typeof layout.left === 'number') css['left'] = `${layout.left}px`;
    if (typeof layout.right === 'number') css['right'] = `${layout.right}px`;
    if (typeof layout.bottom === 'number') css['bottom'] = `${layout.bottom}px`;

    return css;
  }

  /**
   * Render the collected rules into a CSS-modules stylesheet string. Returns a
   * header comment plus one rule per class. An empty rule map yields just the
   * header comment, which is still valid CSS.
   */
  private formatStylesheet(
    fileName: string,
    ruleMap: Map<string, Map<string, string>>
  ): string {
    const header = `/* ${fileName} - generated from Figma */`;

    if (ruleMap.size === 0) {
      return header + '\n';
    }

    const rules: string[] = [];
    for (const [selector, declarations] of ruleMap) {
      rules.push(this.formatRule(selector, declarations));
    }

    return `${header}\n\n${rules.join('\n\n')}\n`;
  }

  /**
   * Format a single CSS rule. A rule with no declarations is emitted as an empty
   * (but valid) block.
   */
  private formatRule(selector: string, declarations: Map<string, string>): string {
    if (declarations.size === 0) {
      return `.${selector} {\n}`;
    }

    const lines = [`.${selector} {`];
    for (const [prop, value] of declarations) {
      lines.push(`  ${prop}: ${value};`);
    }
    lines.push('}');
    return lines.join('\n');
  }

  /**
   * Sanitize a className into a valid CSS class identifier. Invalid characters
   * are replaced with hyphens, runs collapsed, and a leading underscore added if
   * the result would otherwise start with a digit. Returns an empty string when
   * nothing usable remains (signalling the caller to skip the rule).
   */
  private sanitizeClassName(name: string | undefined): string {
    if (!name) {
      return '';
    }

    let sanitized = name
      .trim()
      .replace(/[^a-zA-Z0-9_-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    if (sanitized.length === 0) {
      return '';
    }

    // CSS class identifiers must not start with a digit.
    if (/^\d/.test(sanitized)) {
      sanitized = `_${sanitized}`;
    }

    return sanitized;
  }

  /**
   * Normalize a property name to kebab-case (handles camelCase inputs such as
   * `flexDirection` -> `flex-direction` and already-kebab inputs alike) and
   * strip any characters that are not valid in a CSS property name.
   */
  private toCssPropertyName(key: string): string {
    return String(key ?? '')
      .trim()
      .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
      .replace(/\s+/g, '-')
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  /**
   * Sanitize a declaration value so it cannot break out of the declaration.
   * Characters that would terminate a declaration or block (`;`, `{`, `}`) and
   * newlines are replaced with spaces, and whitespace is collapsed.
   */
  private sanitizeValue(value: string): string {
    return String(value ?? '')
      .replace(/[;{}\r\n]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
