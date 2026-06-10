/**
 * Tests for StylesheetGenerator (CSS modules path)
 * Task 12.1 / Requirement 10.4
 */

import { StylesheetGenerator } from '../../lib/figma-import/core/stylesheet-generator';
import { ParsedFrame } from '../../lib/figma-import/types/internal-models';

/**
 * Assert that a CSS string is syntactically well-formed for the subset we
 * generate: balanced braces, every declaration ends with `;`, and class
 * selectors are well-formed.
 */
function assertValidCss(css: string): void {
  // Braces must be balanced.
  const open = (css.match(/{/g) || []).length;
  const close = (css.match(/}/g) || []).length;
  expect(open).toBe(close);

  // Walk the content, validating selectors and declarations.
  // Strip comments first.
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const ruleRegex = /([^{}]*)\{([^{}]*)\}/g;
  let match: RegExpExecArray | null;
  let sawRule = false;
  while ((match = ruleRegex.exec(withoutComments)) !== null) {
    sawRule = true;
    const selector = match[1].trim();
    const body = match[2].trim();

    // Selector must be a well-formed class selector.
    expect(selector).toMatch(/^\.[a-zA-Z_][a-zA-Z0-9_-]*$/);

    if (body.length > 0) {
      // Each declaration must end with a semicolon.
      const declarations = body
        .split(';')
        .map((d) => d.trim())
        .filter((d) => d.length > 0);
      for (const decl of declarations) {
        // property: value
        expect(decl).toMatch(/^[a-z-]+\s*:\s*.+$/);
      }
      // The body must end with a semicolon (after trimming).
      expect(body.endsWith(';')).toBe(true);
    }
  }

  // Either there were no rules (empty stylesheet) or all rules were valid.
  expect(sawRule || withoutComments.trim().length === 0).toBe(true);
}

describe('StylesheetGenerator - CSS modules', () => {
  let generator: StylesheetGenerator;

  beforeEach(() => {
    generator = new StylesheetGenerator();
  });

  it('derives a <ComponentName>.module.css filename and emits a valid stylesheet', () => {
    const frame: ParsedFrame = {
      id: '1:1',
      name: 'My Button',
      sanitizedName: 'MyButton',
      nodeType: 'frame',
      layout: { display: 'flex', flexDirection: 'row', gap: 16 },
      styles: { className: 'my-button', cssProperties: { backgroundColor: '#fff' } },
      children: [
        {
          id: '2:1',
          name: 'Label',
          sanitizedName: 'Label',
          nodeType: 'text',
          htmlTag: 'span',
          content: 'Click me',
          layout: { display: 'block' },
          styles: { className: 'label', cssProperties: { color: 'rgb(0, 0, 0)' } },
        },
      ],
    };

    const result = generator.generateCssModule(frame);

    expect(result.fileName).toBe('MyButton.module.css');
    expect(result.content).toContain('.my-button {');
    expect(result.content).toContain('.label {');
    assertValidCss(result.content);
  });

  it('uses the kebab-case filename under the kebab naming convention', () => {
    const frame: ParsedFrame = {
      id: '1:1',
      name: 'MyButton',
      sanitizedName: 'MyButton',
      nodeType: 'frame',
      layout: { display: 'block' },
      styles: { className: 'my-button', cssProperties: {} },
      children: [],
    };

    const result = generator.generateCssModule(frame, { namingConvention: 'kebab' });

    expect(result.fileName).toBe('my-button.module.css');
  });

  it('includes all extracted cssProperties as declarations', () => {
    const frame: ParsedFrame = {
      id: '1:1',
      name: 'Card',
      sanitizedName: 'Card',
      nodeType: 'frame',
      layout: { display: 'block' },
      styles: {
        className: 'card',
        cssProperties: {
          backgroundColor: 'rgb(255, 255, 255)',
          borderRadius: '8px',
          // camelCase property should be normalized to kebab-case.
          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.1)',
        },
      },
      children: [],
    };

    const result = generator.generateCssModule(frame);

    expect(result.content).toContain('background-color: rgb(255, 255, 255);');
    expect(result.content).toContain('border-radius: 8px;');
    expect(result.content).toContain('box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);');
    assertValidCss(result.content);
  });

  it('includes layout-derived declarations and lets cssProperties override them', () => {
    const frame: ParsedFrame = {
      id: '1:1',
      name: 'Row',
      sanitizedName: 'Row',
      nodeType: 'frame',
      layout: {
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
        padding: { top: 4, right: 8, bottom: 4, left: 8 },
      },
      styles: {
        className: 'row',
        // Override the layout-derived gap.
        cssProperties: { gap: '12px' },
      },
      children: [],
    };

    const result = generator.generateCssModule(frame);

    expect(result.content).toContain('display: flex;');
    expect(result.content).toContain('flex-direction: row;');
    expect(result.content).toContain('justify-content: center;');
    expect(result.content).toContain('align-items: center;');
    expect(result.content).toContain('padding: 4px 8px 4px 8px;');
    // cssProperties override wins over the layout-derived gap (8px).
    expect(result.content).toContain('gap: 12px;');
    expect(result.content).not.toContain('gap: 8px;');
    assertValidCss(result.content);
  });

  it('merges declarations for nodes that share a class name without duplicate selectors', () => {
    const frame: ParsedFrame = {
      id: '1:1',
      name: 'List',
      sanitizedName: 'List',
      nodeType: 'frame',
      layout: { display: 'block' },
      styles: { className: 'list', cssProperties: {} },
      children: [
        {
          id: '2:1',
          name: 'Item A',
          sanitizedName: 'ItemA',
          nodeType: 'container',
          htmlTag: 'div',
          layout: { display: 'block' },
          styles: { className: 'item', cssProperties: { color: 'red' } },
        },
        {
          id: '2:2',
          name: 'Item B',
          sanitizedName: 'ItemB',
          nodeType: 'container',
          htmlTag: 'div',
          layout: { display: 'block' },
          styles: { className: 'item', cssProperties: { 'font-weight': '700' } },
        },
      ],
    };

    const result = generator.generateCssModule(frame);

    // Only one `.item` selector should exist.
    const itemSelectorCount = (result.content.match(/\.item\s*\{/g) || []).length;
    expect(itemSelectorCount).toBe(1);
    // Both declarations are merged into the single rule.
    expect(result.content).toContain('color: red;');
    expect(result.content).toContain('font-weight: 700;');
    assertValidCss(result.content);
  });

  it('sanitizes unsafe class names and declaration values to keep CSS valid', () => {
    const frame: ParsedFrame = {
      id: '1:1',
      name: 'Weird',
      sanitizedName: 'Weird',
      nodeType: 'frame',
      layout: { display: 'block' },
      styles: {
        className: 'weird name!',
        // A value containing characters that could break out of the block.
        cssProperties: { content: 'a; } .injected {' },
      },
      children: [],
    };

    const result = generator.generateCssModule(frame);

    expect(result.content).toContain('.weird-name {');
    // The injected braces/semicolons must have been neutralized so no extra
    // rule (`.injected { ... }`) can be formed; the leftover text is an inert
    // declaration value.
    expect(result.content).not.toMatch(/\.injected\s*\{/);
    assertValidCss(result.content);
  });

  it('handles the empty case gracefully (no styles)', () => {
    const frame: ParsedFrame = {
      id: '1:1',
      name: 'Empty',
      sanitizedName: 'Empty',
      nodeType: 'frame',
      layout: { display: 'block' },
      styles: { className: '', cssProperties: {} },
      children: [],
    };

    const result = generator.generateCssModule(frame);

    expect(result.fileName).toBe('Empty.module.css');
    // No class selectors are emitted, but the output is still valid CSS.
    expect(result.content).not.toContain('{');
    assertValidCss(result.content);
  });

  it('emits an empty but valid rule when a class has no declarations', () => {
    const frame: ParsedFrame = {
      id: '1:1',
      name: 'Bare',
      sanitizedName: 'Bare',
      nodeType: 'frame',
      // No layout fields set beyond a falsy display.
      layout: {} as ParsedFrame['layout'],
      styles: { className: 'bare', cssProperties: {} },
      children: [],
    };

    const result = generator.generateCssModule(frame);

    expect(result.content).toContain('.bare {');
    assertValidCss(result.content);
  });
});

/**
 * Assert that every class in a list is a well-formed Tailwind utility token,
 * i.e. no raw CSS leaked in: no semicolons, colons, braces, parentheses, `#`,
 * `%`, whitespace, or `px`-bearing values.
 */
function assertNoRawCss(classes: string[]): void {
  for (const cls of classes) {
    expect(cls).toMatch(/^[a-z][a-z0-9-]*$/i);
    expect(cls).not.toMatch(/[;:{}()#%\s]/);
    expect(cls).not.toMatch(/\d+px/);
  }
}

describe('StylesheetGenerator - Tailwind utility classes', () => {
  let generator: StylesheetGenerator;

  beforeEach(() => {
    generator = new StylesheetGenerator();
  });

  it('maps a flexbox frame layout to the expected utility classes', () => {
    const frame: ParsedFrame = {
      id: '1:1',
      name: 'Row',
      sanitizedName: 'Row',
      nodeType: 'frame',
      layout: {
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 16,
      },
      styles: { className: 'row', cssProperties: {} },
      children: [],
    };

    const result = generator.generateTailwindClasses(frame);
    const classes = result.classListById['1:1'];

    expect(classes).toEqual(
      expect.arrayContaining(['flex', 'flex-row', 'justify-center', 'items-center', 'gap-4'])
    );
    expect(result.classNamesById['1:1']).toBe('flex flex-row justify-center items-center gap-4');
    assertNoRawCss(classes);
  });

  it('maps a vertical flex frame to flex-col', () => {
    const frame: ParsedFrame = {
      id: '1:1',
      name: 'Col',
      sanitizedName: 'Col',
      nodeType: 'frame',
      layout: {
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 8,
      },
      styles: { className: 'col', cssProperties: {} },
      children: [],
    };

    const classes = generator.generateTailwindClasses(frame).classListById['1:1'];

    expect(classes).toEqual(
      expect.arrayContaining(['flex', 'flex-col', 'justify-between', 'items-start', 'gap-2'])
    );
    assertNoRawCss(classes);
  });

  it('produces a per-node class mapping for the frame and its descendants', () => {
    const frame: ParsedFrame = {
      id: '1:1',
      name: 'Card',
      sanitizedName: 'Card',
      nodeType: 'frame',
      layout: { display: 'flex', flexDirection: 'column', gap: 24 },
      styles: { className: 'card', cssProperties: {} },
      children: [
        {
          id: '2:1',
          name: 'Header',
          sanitizedName: 'Header',
          nodeType: 'container',
          htmlTag: 'div',
          layout: {
            display: 'flex',
            flexDirection: 'row',
            justifyContent: 'flex-end',
            alignItems: 'center',
            gap: 4,
          },
          styles: { className: 'header', cssProperties: {} },
          children: [
            {
              id: '3:1',
              name: 'Title',
              sanitizedName: 'Title',
              nodeType: 'text',
              htmlTag: 'span',
              content: 'Hello',
              layout: { display: 'block' },
              styles: { className: 'title', cssProperties: {} },
            },
          ],
        },
      ],
    };

    const result = generator.generateTailwindClasses(frame);

    // Every node id in the tree has an entry.
    expect(Object.keys(result.classListById).sort()).toEqual(['1:1', '2:1', '3:1']);

    expect(result.classListById['1:1']).toEqual(
      expect.arrayContaining(['flex', 'flex-col', 'gap-6'])
    );
    expect(result.classListById['2:1']).toEqual(
      expect.arrayContaining(['flex', 'flex-row', 'justify-end', 'items-center', 'gap-1'])
    );
    expect(result.classListById['3:1']).toEqual(['block']);

    // No raw CSS leaks into any node's classes.
    for (const classes of Object.values(result.classListById)) {
      assertNoRawCss(classes);
    }
  });

  it('merges pre-computed tailwindClasses and de-duplicates per node', () => {
    const frame: ParsedFrame = {
      id: '1:1',
      name: 'Box',
      sanitizedName: 'Box',
      nodeType: 'frame',
      layout: { display: 'flex', flexDirection: 'row', gap: 16 },
      styles: {
        className: 'box',
        cssProperties: {},
        // `flex` duplicates a layout-derived class and must not appear twice.
        tailwindClasses: ['flex', 'rounded-lg', 'bg-white'],
      },
      children: [],
    };

    const classes = generator.generateTailwindClasses(frame).classListById['1:1'];

    // Layout-derived classes come first, explicit extras appended, no dupes.
    expect(classes).toEqual(['flex', 'flex-row', 'gap-4', 'rounded-lg', 'bg-white']);
    expect(classes.filter((c) => c === 'flex')).toHaveLength(1);
    assertNoRawCss(classes);
  });

  it('drops any non-utility tokens that contain raw CSS syntax', () => {
    const frame: ParsedFrame = {
      id: '1:1',
      name: 'Dirty',
      sanitizedName: 'Dirty',
      nodeType: 'frame',
      layout: { display: 'flex', gap: 16 },
      styles: {
        className: 'dirty',
        cssProperties: {},
        // These should all be rejected as invalid utility tokens.
        tailwindClasses: ['16px', 'color: red', 'p-4; }', 'rgb(0,0,0)', 'w-50%', 'p-2'],
      },
      children: [],
    };

    const classes = generator.generateTailwindClasses(frame).classListById['1:1'];

    expect(classes).toEqual(['flex', 'gap-4', 'p-2']);
    assertNoRawCss(classes);
  });

  it('returns an empty class string for a node with no layout-derived classes', () => {
    const frame: ParsedFrame = {
      id: '1:1',
      name: 'Empty',
      sanitizedName: 'Empty',
      nodeType: 'frame',
      // `none` display has no Tailwind mapping and there are no extras.
      layout: { display: 'none' },
      styles: { className: 'empty', cssProperties: {} },
      children: [],
    };

    const result = generator.generateTailwindClasses(frame);

    expect(result.classListById['1:1']).toEqual([]);
    expect(result.classNamesById['1:1']).toBe('');
  });

  it('getClassesForNode works standalone for a single node', () => {
    const node: ParsedFrame = {
      id: '9:9',
      name: 'Solo',
      sanitizedName: 'Solo',
      nodeType: 'frame',
      layout: { display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 12 },
      styles: { className: 'solo', cssProperties: {} },
      children: [],
    };

    const classes = generator.getClassesForNode(node);

    expect(classes).toEqual(expect.arrayContaining(['flex', 'flex-row', 'items-center', 'gap-3']));
    assertNoRawCss(classes);
  });
});
