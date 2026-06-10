/**
 * Style Extractor
 * Extracts and converts Figma styles to CSS/Tailwind
 */

import { Node, Color, Paint, TypeStyle, FrameNode } from '../types/figma-api';
import { TypographyStyle } from '../types/internal-models';

/**
 * Style Extractor Class
 * Responsible for extracting styles from Figma nodes and converting to CSS
 */
export class StyleExtractor {
  /**
   * Extract typography styles from a text node
   * Task 6.1: Extract font family, size, weight, line height, color, letter spacing, alignment
   * Requirement 4.1, 4.2: Extract all typography properties
   */
  extractTypography(style: TypeStyle, fills?: Paint[]): TypographyStyle {
    // Extract text color from fills
    let color = '#000000'; // Default black
    if (fills && fills.length > 0) {
      const firstFill = fills[0];
      if (firstFill.type === 'SOLID' && firstFill.color) {
        color = this.rgbaToCSS(firstFill.color);
      }
    }

    // Convert font size from px to rem (divide by 16)
    const fontSizeRem = `${(style.fontSize / 16).toFixed(3)}rem`;

    // Convert line height percentage to unitless value
    const lineHeight = (style.lineHeightPercent / 100).toFixed(2);

    // Convert letter spacing to em units
    const letterSpacing = `${(style.letterSpacing / style.fontSize).toFixed(3)}em`;

    return {
      fontFamily: style.fontFamily,
      fontSize: fontSizeRem,
      fontWeight: style.fontWeight,
      lineHeight,
      letterSpacing,
      textAlign: this.mapTextAlign(style.textAlignHorizontal),
      color,
      textTransform: style.textCase ? this.mapTextCase(style.textCase) : undefined,
      textDecoration: style.textDecoration ? this.mapTextDecoration(style.textDecoration) : undefined,
    };
  }

  /**
   * Map Figma text alignment to CSS text-align
   */
  private mapTextAlign(align: string): 'left' | 'center' | 'right' | 'justify' {
    switch (align) {
      case 'CENTER':
        return 'center';
      case 'RIGHT':
        return 'right';
      case 'JUSTIFIED':
        return 'justify';
      case 'LEFT':
      default:
        return 'left';
    }
  }

  /**
   * Map Figma text case to CSS text-transform
   */
  private mapTextCase(textCase: string): 'none' | 'uppercase' | 'lowercase' | 'capitalize' {
    switch (textCase) {
      case 'UPPER':
        return 'uppercase';
      case 'LOWER':
        return 'lowercase';
      case 'TITLE':
        return 'capitalize';
      case 'ORIGINAL':
      default:
        return 'none';
    }
  }

  /**
   * Map Figma text decoration to CSS text-decoration
   */
  private mapTextDecoration(decoration: string): 'none' | 'underline' | 'line-through' {
    switch (decoration) {
      case 'UNDERLINE':
        return 'underline';
      case 'STRIKETHROUGH':
        return 'line-through';
      case 'NONE':
      default:
        return 'none';
    }
  }

  /**
   * Extract fill colors from a node
   * Task 6.7: Extract all fill colors
   * Requirement 5.1: Extract all fill colors from Figma_Nodes
   */
  extractColors(fills?: Paint[]): string[] {
    if (!fills || fills.length === 0) {
      return [];
    }

    return fills
      .filter((fill) => fill.visible !== false && fill.type === 'SOLID' && fill.color)
      .map((fill) => this.rgbaToCSS(fill.color!));
  }

  /**
   * Convert Figma RGBA color (0-1 range) to CSS rgba string
   * Task 6.9: Convert RGBA to CSS color format
   * Requirement 5.2: Convert Figma RGBA color values to CSS-compatible formats
   */
  rgbaToCSS(color: Color): string {
    const r = Math.round(color.r * 255);
    const g = Math.round(color.g * 255);
    const b = Math.round(color.b * 255);
    const a = color.a;

    // If fully opaque, use rgb() for cleaner output
    if (a === 1) {
      return `rgb(${r}, ${g}, ${b})`;
    }

    return `rgba(${r}, ${g}, ${b}, ${a.toFixed(3)})`;
  }

  /**
   * Convert Figma RGBA to hex color (for fully opaque colors)
   */
  rgbaToHex(color: Color): string {
    const r = Math.round(color.r * 255);
    const g = Math.round(color.g * 255);
    const b = Math.round(color.b * 255);

    const toHex = (n: number) => {
      const hex = n.toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };

    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }

  /**
   * Convert gradient fills to CSS gradient syntax
   * Task 6.13: Implement gradient to CSS conversion
   * Requirement 5.5: Handle gradients by converting to CSS linear-gradient syntax
   */
  gradientToCSS(paint: Paint): string | null {
    if (!paint.gradientStops || paint.gradientStops.length === 0) {
      return null;
    }

    const stops = paint.gradientStops
      .map((stop) => {
        const color = this.rgbaToCSS(stop.color);
        const position = `${(stop.position * 100).toFixed(1)}%`;
        return `${color} ${position}`;
      })
      .join(', ');

    switch (paint.type) {
      case 'GRADIENT_LINEAR':
        // Default to top-to-bottom gradient (can be improved with angle calculation)
        return `linear-gradient(180deg, ${stops})`;
      case 'GRADIENT_RADIAL':
        return `radial-gradient(circle, ${stops})`;
      case 'GRADIENT_ANGULAR':
        return `conic-gradient(${stops})`;
      default:
        return null;
    }
  }

  /**
   * Convert Figma auto-layout to CSS flexbox
   * Task 6.15: Implement auto-layout to flexbox conversion
   * Requirement 8.1, 8.2, 8.3: Convert layout properties to CSS flexbox
   */
  autoLayoutToFlexbox(node: FrameNode): Record<string, string> {
    const styles: Record<string, string> = {};

    // Check if node has auto-layout
    if (!node.layoutMode || node.layoutMode === 'NONE') {
      return styles;
    }

    // Set display to flex
    styles.display = 'flex';

    // Set flex direction
    if (node.layoutMode === 'HORIZONTAL') {
      styles.flexDirection = 'row';
    } else if (node.layoutMode === 'VERTICAL') {
      styles.flexDirection = 'column';
    }

    // Set justify-content based on primaryAxisAlignItems
    if (node.primaryAxisAlignItems) {
      styles.justifyContent = this.mapPrimaryAxisAlign(node.primaryAxisAlignItems);
    }

    // Set align-items based on counterAxisAlignItems
    if (node.counterAxisAlignItems) {
      styles.alignItems = this.mapCounterAxisAlign(node.counterAxisAlignItems);
    }

    // Set gap from itemSpacing
    if (node.itemSpacing !== undefined) {
      styles.gap = `${node.itemSpacing}px`;
    }

    // Set padding
    const padding = this.extractPadding(node);
    if (padding) {
      styles.padding = padding;
    }

    return styles;
  }

  /**
   * Map Figma primary axis alignment to CSS justify-content
   */
  private mapPrimaryAxisAlign(align: string): string {
    switch (align) {
      case 'MIN':
        return 'flex-start';
      case 'CENTER':
        return 'center';
      case 'MAX':
        return 'flex-end';
      case 'SPACE_BETWEEN':
        return 'space-between';
      default:
        return 'flex-start';
    }
  }

  /**
   * Map Figma counter axis alignment to CSS align-items
   */
  private mapCounterAxisAlign(align: string): string {
    switch (align) {
      case 'MIN':
        return 'flex-start';
      case 'CENTER':
        return 'center';
      case 'MAX':
        return 'flex-end';
      default:
        return 'flex-start';
    }
  }

  /**
   * Extract padding from frame node
   */
  private extractPadding(node: FrameNode): string | null {
    const top = node.paddingTop ?? 0;
    const right = node.paddingRight ?? 0;
    const bottom = node.paddingBottom ?? 0;
    const left = node.paddingLeft ?? 0;

    // If all padding is 0, return null
    if (top === 0 && right === 0 && bottom === 0 && left === 0) {
      return null;
    }

    // If all sides are equal, use shorthand
    if (top === right && right === bottom && bottom === left) {
      return `${top}px`;
    }

    // If top/bottom and left/right are equal
    if (top === bottom && left === right) {
      return `${top}px ${right}px`;
    }

    // Full padding specification
    return `${top}px ${right}px ${bottom}px ${left}px`;
  }

  /**
   * Detect if a node uses absolute positioning
   * A node uses absolute positioning when:
   * 1. It has constraints that indicate absolute positioning (not parent-relative layout)
   * 2. It's not using auto-layout
   * 3. It has absolute positioning within its parent frame
   * 
   * For now, we consider a node to use absolute positioning if:
   * - It's a child of a frame that doesn't use auto-layout, OR
   * - It has explicit x,y coordinates (absoluteBoundingBox) and is not in an auto-layout container
   */
  isAbsolutePositioned(node: Node & { layoutMode?: string }, parent?: Node & { layoutMode?: string }): boolean {
    // If the parent exists, check its layout mode
    if (parent) {
      const parentLayoutMode = (parent as any).layoutMode;
      // If parent has auto-layout (HORIZONTAL or VERTICAL), children are NOT absolutely positioned
      if (parentLayoutMode === 'HORIZONTAL' || parentLayoutMode === 'VERTICAL') {
        return false;
      }
      // If parent doesn't have auto-layout or has NONE, children ARE absolutely positioned
      if (!parentLayoutMode || parentLayoutMode === 'NONE') {
        return true;
      }
    }

    // If no parent is provided, check the node itself
    const nodeLayoutMode = (node as any).layoutMode;
    // Container types (Frame, Component, Instance) without auto-layout default to absolute positioning
    const containerTypes = ['FRAME', 'COMPONENT', 'INSTANCE'];
    if (containerTypes.includes(node.type)) {
      // If it's a container without auto-layout, it doesn't mean it uses absolute positioning itself
      // It means its CHILDREN might use absolute positioning
      return false;
    }

    // Non-container nodes without a parent context are considered absolute
    return true;
  }

  /**
   * Generate CSS for absolute positioning
   * Task 6.19: Implement absolute positioning CSS generation
   * Requirement 8.5: Generate position: absolute with appropriate values
   */
  absolutePositioningToCSS(node: Node & { absoluteBoundingBox?: { x: number; y: number; width: number; height: number } }): Record<string, string> | null {
    if (!node.absoluteBoundingBox) {
      return null;
    }

    const { x, y, width, height } = node.absoluteBoundingBox;

    return {
      position: 'absolute',
      top: `${y}px`,
      left: `${x}px`,
      width: `${width}px`,
      height: `${height}px`,
    };
  }

  /**
   * Extract complete layout styles from a node
   * Combines auto-layout and absolute positioning detection
   * Task 6.19: Integrate absolute positioning with layout extraction
   */
  extractLayout(node: Node & { absoluteBoundingBox?: { x: number; y: number; width: number; height: number } }, parent?: Node): Record<string, string> {
    const styles: Record<string, string> = {};

    // First check if this is a frame-like node with auto-layout
    const isFrameNode = (n: any): n is FrameNode => {
      return n.type === 'FRAME' || n.type === 'COMPONENT' || n.type === 'INSTANCE';
    };

    if (isFrameNode(node)) {
      // Try to extract auto-layout styles
      const autoLayoutStyles = this.autoLayoutToFlexbox(node);
      Object.assign(styles, autoLayoutStyles);
    }

    // Check if the node should use absolute positioning
    if (this.isAbsolutePositioned(node, parent)) {
      const absoluteStyles = this.absolutePositioningToCSS(node);
      if (absoluteStyles) {
        Object.assign(styles, absoluteStyles);
      }
    }

    // Default to block display if no other layout is determined
    // But only if we haven't already set display (e.g., from flexbox)
    if (!styles.display) {
      styles.display = 'block';
    }

    return styles;
  }

  /**
   * Generate CSS custom properties from typography styles
   * Task 6.3: Implement CSS custom properties generation for typography
   * Requirement 4.3: Convert Figma text styles to CSS custom properties
   * Requirement 4.5: Ensure unique CSS class names without collisions
   * 
   * @param typographyStyles - Map of style names to typography definitions
   * @returns CSS string containing custom properties
   */
  generateTypographyCSS(typographyStyles: Map<string, TypographyStyle>): string {
    // Handle empty map case
    if (typographyStyles.size === 0) {
      return ':root {\n}';
    }

    const cssLines: string[] = [':root {'];
    const classDefinitions: string[] = [];
    const usedClassNames = new Set<string>();

    typographyStyles.forEach((style, name) => {
      // Sanitize name for CSS custom property (kebab-case)
      const sanitizedName = this.sanitizeForCSS(name);

      // Fall back to a safe default when the name sanitizes to an empty string
      // (e.g. names made up entirely of whitespace or special characters) so we
      // never produce invalid identifiers like `.text-` or `--font-family-`.
      let baseName = sanitizedName.length > 0 ? sanitizedName : 'style';

      // CSS identifiers (class names) must not start with a digit. Prefix a
      // fallback so the generated selector is always valid.
      if (/^\d/.test(baseName)) {
        baseName = `style-${baseName}`;
      }

      // Ensure uniqueness by appending suffix if needed
      let uniqueName = baseName;
      let counter = 1;
      while (usedClassNames.has(uniqueName)) {
        uniqueName = `${baseName}-${counter}`;
        counter++;
      }
      usedClassNames.add(uniqueName);

      // The font-family value comes from arbitrary Figma data and may contain
      // characters ({ } : ; etc.) that would break CSS syntax. Sanitize it to a
      // safe value before interpolating into the stylesheet.
      const fontFamily = this.formatFontFamilyValue(style.fontFamily);

      // Generate CSS custom properties
      cssLines.push(`  --font-family-${uniqueName}: ${fontFamily};`);
      cssLines.push(`  --font-size-${uniqueName}: ${style.fontSize};`);
      cssLines.push(`  --font-weight-${uniqueName}: ${style.fontWeight};`);
      cssLines.push(`  --line-height-${uniqueName}: ${style.lineHeight};`);
      cssLines.push(`  --letter-spacing-${uniqueName}: ${style.letterSpacing};`);
      cssLines.push(`  --text-color-${uniqueName}: ${style.color};`);

      // Generate utility class for this typography style
      const classLines = [
        ``,
        `.text-${uniqueName} {`,
        `  font-family: var(--font-family-${uniqueName});`,
        `  font-size: var(--font-size-${uniqueName});`,
        `  font-weight: var(--font-weight-${uniqueName});`,
        `  line-height: var(--line-height-${uniqueName});`,
        `  letter-spacing: var(--letter-spacing-${uniqueName});`,
        `  color: var(--text-color-${uniqueName});`,
        `  text-align: ${style.textAlign};`,
      ];

      if (style.textTransform && style.textTransform !== 'none') {
        classLines.push(`  text-transform: ${style.textTransform};`);
      }

      if (style.textDecoration && style.textDecoration !== 'none') {
        classLines.push(`  text-decoration: ${style.textDecoration};`);
      }

      classLines.push(`}`);
      classDefinitions.push(classLines.join('\n'));
    });

    cssLines.push('}');

    // Combine custom properties and class definitions
    return cssLines.join('\n') + '\n' + classDefinitions.join('\n');
  }

  /**
   * Sanitize a name for use in CSS (convert to kebab-case, remove invalid characters)
   * @param name - The name to sanitize
   * @returns Sanitized CSS-safe name
   */
  private sanitizeForCSS(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-') // Replace invalid characters with hyphens
      .replace(/-+/g, '-') // Replace multiple consecutive hyphens with single hyphen
      .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
  }

  /**
   * Format a font-family value so it is always syntactically valid CSS.
   *
   * Font-family values originate from arbitrary Figma data and may contain
   * characters such as `{`, `}`, `:`, `;`, or quotes that would break the
   * generated stylesheet (for example by prematurely closing the `:root`
   * block). We strip characters that are not valid in an unquoted CSS
   * font-family value and normalize whitespace/commas. When nothing usable
   * remains we fall back to a generic family so the property is never empty.
   */
  private formatFontFamilyValue(fontFamily: string): string {
    const safe = (fontFamily ?? '')
      .replace(/[^a-zA-Z0-9 ,_-]/g, '') // remove characters that could break CSS
      .replace(/\s+/g, ' ') // collapse runs of whitespace
      .replace(/\s*,\s*/g, ', ') // normalize spacing around commas
      .replace(/^[\s,]+|[\s,]+$/g, '') // trim leading/trailing spaces and commas
      .trim();

    return safe.length > 0 ? safe : 'sans-serif';
  }

  /**
   * Generate Tailwind utility classes from CSS styles
   * Task 6.17: Implement Tailwind layout classes generation
   * Requirement 8.4: Use Tailwind utility classes for layout when configured
   */
  cssToTailwind(cssStyles: Record<string, string>): string[] {
    const classes: string[] = [];

    // Map CSS properties to Tailwind classes
    for (const [property, value] of Object.entries(cssStyles)) {
      switch (property) {
        case 'display':
          if (value === 'flex') classes.push('flex');
          if (value === 'block') classes.push('block');
          if (value === 'inline-block') classes.push('inline-block');
          break;

        case 'flexDirection':
          if (value === 'row') classes.push('flex-row');
          if (value === 'column') classes.push('flex-col');
          break;

        case 'justifyContent':
          if (value === 'flex-start') classes.push('justify-start');
          if (value === 'center') classes.push('justify-center');
          if (value === 'flex-end') classes.push('justify-end');
          if (value === 'space-between') classes.push('justify-between');
          break;

        case 'alignItems':
          if (value === 'flex-start') classes.push('items-start');
          if (value === 'center') classes.push('items-center');
          if (value === 'flex-end') classes.push('items-end');
          break;

        case 'gap':
          // Parse gap value (e.g., "16px" -> "gap-4")
          const gapPx = parseInt(value);
          if (!isNaN(gapPx)) {
            // Tailwind uses 0.25rem units (1 unit = 4px)
            // Round to nearest integer to ensure valid Tailwind class names
            const gapRem = Math.round(gapPx / 4);
            classes.push(`gap-${gapRem}`);
          }
          break;

        case 'padding':
          // Simple padding mapping (can be improved)
          const paddingPx = parseInt(value);
          if (!isNaN(paddingPx)) {
            // Tailwind uses 0.25rem units (1 unit = 4px)
            // Round to nearest integer to ensure valid Tailwind class names
            const paddingRem = Math.round(paddingPx / 4);
            classes.push(`p-${paddingRem}`);
          }
          break;

        // Add more mappings as needed
      }
    }

    return classes;
  }

  /**
   * Generate Tailwind typography configuration from typography styles
   * Task 6.5: Implement Tailwind typography configuration generation
   * Requirement 4.4: Generate valid Tailwind configuration for typography when configured
   * 
   * @param typographyStyles - Map of typography style names to their style definitions
   * @returns Tailwind config object that can be merged into tailwind.config.js theme.extend
   */
  generateTailwindTypographyConfig(
    typographyStyles: Map<string, TypographyStyle>
  ): TailwindTypographyConfig {
    const fontFamily: Record<string, string[]> = {};
    const fontSize: Record<string, [string, { lineHeight: string; letterSpacing?: string }]> = {};
    const fontWeight: Record<string, number> = {};
    const textColor: Record<string, string> = {};

    // Process each typography style
    for (const [name, style] of typographyStyles.entries()) {
      // Sanitize name for use as Tailwind config key
      const sanitizedName = this.sanitizeConfigKey(name);

      // Add font family if not already present
      if (style.fontFamily && !fontFamily[style.fontFamily.toLowerCase()]) {
        fontFamily[style.fontFamily.toLowerCase()] = [style.fontFamily, 'sans-serif'];
      }

      // Add font size with line height and letter spacing
      if (style.fontSize) {
        const lineHeight = style.lineHeight || '1.5';
        const letterSpacing = style.letterSpacing !== '0.000em' ? style.letterSpacing : undefined;
        
        fontSize[sanitizedName] = [
          style.fontSize,
          {
            lineHeight,
            ...(letterSpacing && { letterSpacing }),
          },
        ];
      }

      // Add font weight if it's a custom value
      if (style.fontWeight && ![100, 200, 300, 400, 500, 600, 700, 800, 900].includes(style.fontWeight)) {
        fontWeight[sanitizedName] = style.fontWeight;
      }

      // Add text color
      if (style.color) {
        textColor[sanitizedName] = style.color;
      }
    }

    return {
      fontFamily: Object.keys(fontFamily).length > 0 ? fontFamily : undefined,
      fontSize: Object.keys(fontSize).length > 0 ? fontSize : undefined,
      fontWeight: Object.keys(fontWeight).length > 0 ? fontWeight : undefined,
      textColor: Object.keys(textColor).length > 0 ? textColor : undefined,
    };
  }

  /**
   * Sanitize a name for use as a Tailwind configuration key
   * Converts to kebab-case and removes invalid characters
   */
  private sanitizeConfigKey(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-') // Replace non-alphanumeric with hyphens
      .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
  }

  /**
   * Generate Tailwind color configuration from extracted colors
   * Task 6.11: Implement Tailwind color configuration generation
   * Requirement 5.4: Generate valid Tailwind color configuration when configured
   * 
   * @param colorStyles - Map of color names to CSS color values
   * @returns Tailwind config object that can be merged into tailwind.config.js theme.colors
   */
  generateTailwindColorConfig(
    colorStyles: Map<string, string>
  ): Record<string, string> {
    const colors: Record<string, string> = {};

    // Process each color style
    for (const [name, colorValue] of colorStyles.entries()) {
      // Sanitize name for use as Tailwind config key
      const sanitizedName = this.sanitizeConfigKey(name);

      // Only add if sanitized name is not empty
      if (sanitizedName.length > 0) {
        // Add color to config
        colors[sanitizedName] = colorValue;
      }
    }

    return colors;
  }
}

/**
 * Tailwind typography configuration structure
 * Matches the structure expected in tailwind.config.js theme.extend
 */
export interface TailwindTypographyConfig {
  fontFamily?: Record<string, string[]>;
  fontSize?: Record<string, [string, { lineHeight: string; letterSpacing?: string }]>;
  fontWeight?: Record<string, number>;
  textColor?: Record<string, string>;
}
