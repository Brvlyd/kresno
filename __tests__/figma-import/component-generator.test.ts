/**
 * Tests for ComponentGenerator
 */

import { ComponentGenerator, GeneratorOptions } from '../../lib/figma-import/core/component-generator';
import { ParsedFrame, ParsedNode } from '../../lib/figma-import/types/internal-models';

describe('ComponentGenerator', () => {
  let generator: ComponentGenerator;

  beforeEach(() => {
    generator = new ComponentGenerator();
  });

  describe('generate', () => {
    const defaultOptions: GeneratorOptions = {
      namingConvention: 'pascal',
      useTailwind: true,
      outputDir: './components',
    };

    it('should generate a basic React component', () => {
      const frame: ParsedFrame = {
        id: '1:1',
        name: 'Button',
        sanitizedName: 'Button',
        nodeType: 'frame',
        layout: { display: 'flex' },
        styles: { className: 'button', cssProperties: {} },
        children: [],
      };

      const result = generator.generate(frame, defaultOptions);

      expect(result.name).toBe('Button');
      expect(result.content).toContain('export const Button');
      expect(result.content).toContain('React.FC');
      expect(result.filePath).toBe('./components/Button.tsx');
    });

    it('should include React import', () => {
      const frame: ParsedFrame = {
        id: '1:1',
        name: 'Simple',
        sanitizedName: 'Simple',
        nodeType: 'frame',
        layout: { display: 'block' },
        styles: { className: 'simple', cssProperties: {} },
        children: [],
      };

      const result = generator.generate(frame, defaultOptions);

      expect(result.content).toContain("import React from 'react'");
    });

    it('should generate props interface', () => {
      const frame: ParsedFrame = {
        id: '1:1',
        name: 'Component',
        sanitizedName: 'Component',
        nodeType: 'frame',
        layout: { display: 'block' },
        styles: { className: 'component', cssProperties: {} },
        children: [],
      };

      const result = generator.generate(frame, defaultOptions);

      expect(result.content).toContain('interface ComponentProps');
      expect(result.content).toContain('className?: string');
      expect(result.content).toContain('children?: React.ReactNode');
    });

    it('should handle kebab-case naming convention', () => {
      const frame: ParsedFrame = {
        id: '1:1',
        name: 'MyButton',
        sanitizedName: 'MyButton',
        nodeType: 'frame',
        layout: { display: 'block' },
        styles: { className: 'my-button', cssProperties: {} },
        children: [],
      };

      const options: GeneratorOptions = {
        ...defaultOptions,
        namingConvention: 'kebab',
      };

      const result = generator.generate(frame, options);

      expect(result.filePath).toBe('./components/my-button.tsx');
    });

    it('should generate Tailwind classes for flexbox layout', () => {
      const frame: ParsedFrame = {
        id: '1:1',
        name: 'FlexContainer',
        sanitizedName: 'FlexContainer',
        nodeType: 'frame',
        layout: {
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 16,
        },
        styles: { className: 'flex-container', cssProperties: {} },
        children: [],
      };

      const result = generator.generate(frame, defaultOptions);

      expect(result.content).toContain('flex');
      expect(result.content).toContain('flex-row');
      expect(result.content).toContain('justify-center');
      expect(result.content).toContain('items-center');
      expect(result.content).toContain('gap-4'); // 16/4 = 4
    });
  });

  describe('generate with children', () => {
    const defaultOptions: GeneratorOptions = {
      namingConvention: 'pascal',
      useTailwind: true,
      outputDir: './components',
    };

    it('should generate text node children', () => {
      const frame: ParsedFrame = {
        id: '1:1',
        name: 'TextContainer',
        sanitizedName: 'TextContainer',
        nodeType: 'frame',
        layout: { display: 'block' },
        styles: { className: 'container', cssProperties: {} },
        children: [
          {
            id: '2:1',
            name: 'Title',
            sanitizedName: 'Title',
            nodeType: 'text',
            htmlTag: 'p',
            content: 'Hello World',
            layout: { display: 'block' },
            styles: { className: 'title', cssProperties: {} },
          },
        ],
      };

      const result = generator.generate(frame, defaultOptions);

      expect(result.content).toContain('<p');
      expect(result.content).toContain('Hello World');
    });

    it('should generate nested children', () => {
      const frame: ParsedFrame = {
        id: '1:1',
        name: 'NestedContainer',
        sanitizedName: 'NestedContainer',
        nodeType: 'frame',
        layout: { display: 'block' },
        styles: { className: 'container', cssProperties: {} },
        children: [
          {
            id: '2:1',
            name: 'Inner',
            sanitizedName: 'Inner',
            nodeType: 'container',
            htmlTag: 'div',
            layout: { display: 'block' },
            styles: { className: 'inner', cssProperties: {} },
            children: [
              {
                id: '3:1',
                name: 'Text',
                sanitizedName: 'Text',
                nodeType: 'text',
                htmlTag: 'p',
                content: 'Nested text',
                layout: { display: 'block' },
                styles: { className: 'text', cssProperties: {} },
              },
            ],
          },
        ],
      };

      const result = generator.generate(frame, defaultOptions);

      expect(result.content).toContain('<div');
      expect(result.content).toContain('<p');
      expect(result.content).toContain('Nested text');
    });

    it('should import Next.js Image when image nodes present', () => {
      const frame: ParsedFrame = {
        id: '1:1',
        name: 'ImageContainer',
        sanitizedName: 'ImageContainer',
        nodeType: 'frame',
        layout: { display: 'block' },
        styles: { className: 'container', cssProperties: {} },
        children: [
          {
            id: '2:1',
            name: 'Photo',
            sanitizedName: 'Photo',
            nodeType: 'image',
            htmlTag: 'img',
            imagePath: '/images/photo.png',
            layout: { display: 'block', width: 200, height: 150 },
            styles: { className: 'photo', cssProperties: {} },
          },
        ],
      };

      const result = generator.generate(frame, defaultOptions);

      expect(result.content).toContain("import Image from 'next/image'");
      expect(result.content).toContain('<Image');
      expect(result.content).toContain('src="/images/photo.png"');
      expect(result.content).toContain('width={200}');
      expect(result.content).toContain('height={150}');
      expect(result.dependencies).toContain('next/image');
    });
  });

  describe('Next.js Image generation', () => {
    const defaultOptions: GeneratorOptions = {
      namingConvention: 'pascal',
      useTailwind: true,
      outputDir: './components',
    };

    const makeImageFrame = (image: Partial<ParsedNode>): ParsedFrame => ({
      id: '1:1',
      name: 'ImageContainer',
      sanitizedName: 'ImageContainer',
      nodeType: 'frame',
      layout: { display: 'block' },
      styles: { className: 'container', cssProperties: {} },
      children: [
        {
          id: '2:1',
          name: 'Photo',
          sanitizedName: 'Photo',
          nodeType: 'image',
          htmlTag: 'img',
          imagePath: '/images/photo.png',
          layout: { display: 'block', width: 200, height: 150 },
          styles: { className: 'photo', cssProperties: {} },
          ...image,
        },
      ],
    });

    it('should use the Next.js Image component with correct src/alt/width/height', () => {
      const result = generator.generate(makeImageFrame({}), defaultOptions);

      expect(result.content).toContain('<Image');
      expect(result.content).toContain('src="/images/photo.png"');
      expect(result.content).toContain('alt="Photo"');
      expect(result.content).toContain('width={200}');
      expect(result.content).toContain('height={150}');
      expect(result.content).toContain('className="photo"');
    });

    it('should derive descriptive alt text from the node name', () => {
      const result = generator.generate(
        makeImageFrame({ name: 'Hero Banner' }),
        defaultOptions
      );

      expect(result.content).toContain('alt="Hero Banner"');
    });

    it('should fall back to a placeholder when imagePath is missing', () => {
      const result = generator.generate(
        makeImageFrame({ imagePath: undefined }),
        defaultOptions
      );

      expect(result.content).toContain('src="/placeholder.png"');
    });

    it('should fall back to a placeholder when imagePath is empty/whitespace', () => {
      const result = generator.generate(
        makeImageFrame({ imagePath: '   ' }),
        defaultOptions
      );

      expect(result.content).toContain('src="/placeholder.png"');
    });

    it('should use a default alt when node name is empty', () => {
      const result = generator.generate(
        makeImageFrame({ name: '' }),
        defaultOptions
      );

      expect(result.content).toContain('alt="Image"');
    });

    it('should fall back to default dimensions when width/height are missing', () => {
      const result = generator.generate(
        makeImageFrame({ layout: { display: 'block' } }),
        defaultOptions
      );

      expect(result.content).toContain('width={100}');
      expect(result.content).toContain('height={100}');
    });

    it('should fall back to default dimensions for non-positive or NaN values', () => {
      const result = generator.generate(
        makeImageFrame({ layout: { display: 'block', width: 0, height: NaN } }),
        defaultOptions
      );

      expect(result.content).toContain('width={100}');
      expect(result.content).toContain('height={100}');
      expect(result.content).not.toContain('width={NaN}');
      expect(result.content).not.toContain('height={NaN}');
    });

    it('should round fractional dimensions to integers', () => {
      const result = generator.generate(
        makeImageFrame({ layout: { display: 'block', width: 200.6, height: 149.2 } }),
        defaultOptions
      );

      expect(result.content).toContain('width={201}');
      expect(result.content).toContain('height={149}');
    });

    it('should escape quotes and angle brackets in alt text to keep JSX valid', () => {
      const result = generator.generate(
        makeImageFrame({ name: 'Logo "Main" <v2>' }),
        defaultOptions
      );

      expect(result.content).toContain('alt="Logo &quot;Main&quot; &lt;v2&gt;"');
      // The raw unescaped double quote must not leak into the attribute value.
      expect(result.content).not.toContain('alt="Logo "Main"');
    });

    it('should emit the next/image import only when image nodes exist', () => {
      const withImage = generator.generate(makeImageFrame({}), defaultOptions);
      expect(withImage.content).toContain("import Image from 'next/image'");
      expect(withImage.dependencies).toContain('next/image');

      const withoutImage = generator.generate(
        {
          id: '9:9',
          name: 'NoImage',
          sanitizedName: 'NoImage',
          nodeType: 'frame',
          layout: { display: 'block' },
          styles: { className: 'no-image', cssProperties: {} },
          children: [
            {
              id: '9:10',
              name: 'Label',
              sanitizedName: 'Label',
              nodeType: 'text',
              htmlTag: 'p',
              content: 'No image here',
              layout: { display: 'block' },
              styles: { className: 'label', cssProperties: {} },
            },
          ],
        },
        defaultOptions
      );
      expect(withoutImage.content).not.toContain("import Image from 'next/image'");
      expect(withoutImage.dependencies).not.toContain('next/image');
    });
  });

  describe('generatePropsInterface', () => {
    it('should generate basic props interface', () => {
      const frame: ParsedFrame = {
        id: '1:1',
        name: 'TestComponent',
        sanitizedName: 'TestComponent',
        nodeType: 'frame',
        layout: { display: 'block' },
        styles: { className: 'test', cssProperties: {} },
        children: [],
      };

      const result = generator.generatePropsInterface(frame, 'TestComponent');

      expect(result).toContain('interface TestComponentProps');
      expect(result).toContain('className?: string');
      expect(result).toContain('children?: React.ReactNode');
    });
  });

  describe('variant props generation', () => {
    const defaultOptions: GeneratorOptions = {
      namingConvention: 'pascal',
      useTailwind: true,
      outputDir: './components',
    };

    it('should generate a union-typed prop for a single variant property', () => {
      const frame: ParsedFrame = {
        id: '1:1',
        name: 'Button',
        sanitizedName: 'Button',
        nodeType: 'component',
        layout: { display: 'flex' },
        styles: { className: 'button', cssProperties: {} },
        children: [],
        variants: [
          { propertyName: 'variant', values: ['primary', 'secondary'] },
        ],
      };

      const result = generator.generatePropsInterface(frame, 'Button');

      expect(result).toContain("variant?: 'primary' | 'secondary';");
      // Common props are still present.
      expect(result).toContain('className?: string;');
      expect(result).toContain('children?: React.ReactNode;');
    });

    it('should generate union-typed props for multiple variant properties', () => {
      const frame: ParsedFrame = {
        id: '1:1',
        name: 'Button',
        sanitizedName: 'Button',
        nodeType: 'component',
        layout: { display: 'flex' },
        styles: { className: 'button', cssProperties: {} },
        children: [],
        variants: [
          { propertyName: 'variant', values: ['primary', 'secondary'] },
          { propertyName: 'size', values: ['sm', 'md', 'lg'] },
        ],
      };

      const result = generator.generatePropsInterface(frame, 'Button');

      expect(result).toContain("variant?: 'primary' | 'secondary';");
      expect(result).toContain("size?: 'sm' | 'md' | 'lg';");
    });

    it('should sanitize variant property names to valid TS identifiers', () => {
      const frame: ParsedFrame = {
        id: '1:1',
        name: 'Card',
        sanitizedName: 'Card',
        nodeType: 'component',
        layout: { display: 'flex' },
        styles: { className: 'card', cssProperties: {} },
        children: [],
        variants: [
          { propertyName: 'Icon Position', values: ['left', 'right'] },
        ],
      };

      const result = generator.generatePropsInterface(frame, 'Card');

      // "Icon Position" becomes a valid camelCase identifier.
      expect(result).toContain("iconPosition?: 'left' | 'right';");
    });

    it('should escape values that would break a string literal', () => {
      const frame: ParsedFrame = {
        id: '1:1',
        name: 'Card',
        sanitizedName: 'Card',
        nodeType: 'component',
        layout: { display: 'flex' },
        styles: { className: 'card', cssProperties: {} },
        children: [],
        variants: [
          { propertyName: 'state', values: ["it's on", 'off'] },
        ],
      };

      const result = generator.generatePropsInterface(frame, 'Card');

      expect(result).toContain("state?: 'it\\'s on' | 'off';");
    });

    it('should de-duplicate and drop empty variant values', () => {
      const frame: ParsedFrame = {
        id: '1:1',
        name: 'Tag',
        sanitizedName: 'Tag',
        nodeType: 'component',
        layout: { display: 'flex' },
        styles: { className: 'tag', cssProperties: {} },
        children: [],
        variants: [
          { propertyName: 'tone', values: ['info', 'info', '', '   ', 'warn'] },
        ],
      };

      const result = generator.generatePropsInterface(frame, 'Tag');

      expect(result).toContain("tone?: 'info' | 'warn';");
    });

    it('should keep default behavior for components without variants', () => {
      const frame: ParsedFrame = {
        id: '1:1',
        name: 'Plain',
        sanitizedName: 'Plain',
        nodeType: 'frame',
        layout: { display: 'block' },
        styles: { className: 'plain', cssProperties: {} },
        children: [],
      };

      const result = generator.generatePropsInterface(frame, 'Plain');

      expect(result).toContain('interface PlainProps');
      expect(result).toContain('className?: string;');
      expect(result).toContain('children?: React.ReactNode;');
      // Only the two common props are present (no variant lines).
      const propLines = result
        .split('\n')
        .filter((line) => line.trim().endsWith(';'));
      expect(propLines).toHaveLength(2);
    });

    it('should embed variant props into the generated component content', () => {
      const frame: ParsedFrame = {
        id: '1:1',
        name: 'Button',
        sanitizedName: 'Button',
        nodeType: 'component',
        layout: { display: 'flex' },
        styles: { className: 'button', cssProperties: {} },
        children: [],
        variants: [
          { propertyName: 'variant', values: ['primary', 'secondary'] },
        ],
      };

      const result = generator.generate(frame, defaultOptions);

      expect(result.content).toContain('interface ButtonProps');
      expect(result.content).toContain("variant?: 'primary' | 'secondary';");
    });
  });

  describe('resolveComponentReferences', () => {
    it('should map component IDs to names', () => {
      const components = [
        {
          id: 'comp-1',
          name: 'Button',
          sanitizedName: 'Button',
          hasVariants: false,
          frame: {} as any,
        },
        {
          id: 'comp-2',
          name: 'Card',
          sanitizedName: 'Card',
          hasVariants: false,
          frame: {} as any,
        },
      ];

      const mapping = generator.resolveComponentReferences(components);

      expect(mapping.get('comp-1')).toBe('Button');
      expect(mapping.get('comp-2')).toBe('Card');
    });
  });

  describe('component definition and instance handling', () => {
    const defaultOptions: GeneratorOptions = {
      namingConvention: 'pascal',
      useTailwind: true,
      outputDir: './components',
    };

    it('should generate a reusable React component for a component definition', () => {
      const frame: ParsedFrame = {
        id: 'comp-1',
        name: 'Button',
        sanitizedName: 'Button',
        nodeType: 'component',
        layout: { display: 'flex' },
        styles: { className: 'button', cssProperties: {} },
        children: [],
      };

      const result = generator.generate(frame, defaultOptions);

      // Reusable: named export that can be imported by other components.
      expect(result.content).toContain('export const Button: React.FC<ButtonProps>');
      expect(result.content).toContain('interface ButtonProps');

      // The definition is registered in the component map for instance resolution.
      const mapping = generator.resolveComponentReferences([
        { id: 'comp-1', name: 'Button', sanitizedName: 'Button', hasVariants: false, frame: {} as any },
      ]);
      expect(mapping.get('comp-1')).toBe('Button');
    });

    it('should reference a mapped component and emit its import for an instance', () => {
      // Establish the component ID -> name mapping first.
      generator.resolveComponentReferences([
        { id: 'comp-1', name: 'Button', sanitizedName: 'Button', hasVariants: false, frame: {} as any },
      ]);

      const frame: ParsedFrame = {
        id: '1:1',
        name: 'Toolbar',
        sanitizedName: 'Toolbar',
        nodeType: 'frame',
        layout: { display: 'flex' },
        styles: { className: 'toolbar', cssProperties: {} },
        children: [
          {
            id: '2:1',
            name: 'Button Instance',
            sanitizedName: 'ButtonInstance',
            nodeType: 'instance',
            componentId: 'comp-1',
            htmlTag: 'div',
            layout: { display: 'flex' },
            styles: { className: 'instance', cssProperties: {} },
          },
        ],
      };

      const result = generator.generate(frame, defaultOptions);

      // Correct JSX tag referencing the base component.
      expect(result.content).toContain('<Button />');
      expect(result.content).not.toContain('instance-placeholder');
      // Import statement emitted so the file compiles.
      expect(result.content).toContain("import { Button } from './Button';");
      // Tracked as a dependency.
      expect(result.dependencies).toContain('Button');
    });

    it('should not emit a self-import when a component instances itself', () => {
      generator.resolveComponentReferences([
        { id: 'comp-1', name: 'Button', sanitizedName: 'Button', hasVariants: false, frame: {} as any },
      ]);

      const frame: ParsedFrame = {
        id: 'comp-1',
        name: 'Button',
        sanitizedName: 'Button',
        nodeType: 'component',
        layout: { display: 'flex' },
        styles: { className: 'button', cssProperties: {} },
        children: [
          {
            id: '2:1',
            name: 'Self',
            sanitizedName: 'Self',
            nodeType: 'instance',
            componentId: 'comp-1',
            htmlTag: 'div',
            layout: { display: 'flex' },
            styles: { className: 'self', cssProperties: {} },
          },
        ],
      };

      const result = generator.generate(frame, defaultOptions);

      expect(result.content).not.toContain("import { Button } from './Button';");
    });

    it('should degrade gracefully for an unresolved instance with no mapping', () => {
      const frame: ParsedFrame = {
        id: '1:1',
        name: 'Toolbar',
        sanitizedName: 'Toolbar',
        nodeType: 'frame',
        layout: { display: 'flex' },
        styles: { className: 'toolbar', cssProperties: {} },
        children: [
          {
            id: '2:1',
            name: 'Mystery Widget',
            sanitizedName: 'MysteryWidget',
            nodeType: 'instance',
            componentId: 'missing-component',
            htmlTag: 'div',
            layout: { display: 'flex' },
            styles: { className: 'instance', cssProperties: {} },
          },
        ],
      };

      const result = generator.generate(frame, defaultOptions);

      // Falls back to a valid, clearly-named element rather than invalid code.
      expect(result.content).toContain('unresolved-instance');
      expect(result.content).toContain('data-instance="Mystery Widget"');
      // No phantom import for an unmapped component.
      expect(result.content).not.toMatch(/import \{ .* \} from '\.\/Mystery/);
    });

    it('should reference the kebab-case file path for imports under kebab convention', () => {
      generator.resolveComponentReferences([
        { id: 'comp-1', name: 'Icon Button', sanitizedName: 'Icon Button', hasVariants: false, frame: {} as any },
      ]);

      const frame: ParsedFrame = {
        id: '1:1',
        name: 'Toolbar',
        sanitizedName: 'Toolbar',
        nodeType: 'frame',
        layout: { display: 'flex' },
        styles: { className: 'toolbar', cssProperties: {} },
        children: [
          {
            id: '2:1',
            name: 'Button Instance',
            sanitizedName: 'ButtonInstance',
            nodeType: 'instance',
            componentId: 'comp-1',
            htmlTag: 'div',
            layout: { display: 'flex' },
            styles: { className: 'instance', cssProperties: {} },
          },
        ],
      };

      const result = generator.generate(frame, { ...defaultOptions, namingConvention: 'kebab' });

      // JSX tag stays PascalCase (React requirement) while the file path is kebab.
      expect(result.content).toContain('<IconButton />');
      expect(result.content).toContain("import { IconButton } from './icon-button';");
    });
  });

  describe('instance override props', () => {
    const defaultOptions: GeneratorOptions = {
      namingConvention: 'pascal',
      useTailwind: true,
      outputDir: './components',
    };

    const makeToolbarWithInstance = (instance: Partial<ParsedNode>): ParsedFrame => ({
      id: '1:1',
      name: 'Toolbar',
      sanitizedName: 'Toolbar',
      nodeType: 'frame',
      layout: { display: 'flex' },
      styles: { className: 'toolbar', cssProperties: {} },
      children: [
        {
          id: '2:1',
          name: 'Button Instance',
          sanitizedName: 'ButtonInstance',
          nodeType: 'instance',
          componentId: 'comp-1',
          htmlTag: 'div',
          layout: { display: 'flex' },
          styles: { className: 'instance', cssProperties: {} },
          ...instance,
        },
      ],
    });

    beforeEach(() => {
      generator.resolveComponentReferences([
        { id: 'comp-1', name: 'Button', sanitizedName: 'Button', hasVariants: false, frame: {} as any },
      ]);
    });

    it('should render string overrides as escaped string-valued props', () => {
      const result = generator.generate(
        makeToolbarWithInstance({ overrides: { variant: 'primary', label: 'Save' } }),
        defaultOptions
      );

      expect(result.content).toContain('<Button variant="primary" label="Save" />');
    });

    it('should render numeric and boolean overrides as expression props', () => {
      const result = generator.generate(
        makeToolbarWithInstance({ overrides: { count: 3, disabled: true } }),
        defaultOptions
      );

      expect(result.content).toContain('count={3}');
      expect(result.content).toContain('disabled={true}');
      // Numbers/booleans must not be quoted as strings.
      expect(result.content).not.toContain('count="3"');
      expect(result.content).not.toContain('disabled="true"');
    });

    it('should sanitize override prop names to valid JSX identifiers', () => {
      const result = generator.generate(
        makeToolbarWithInstance({ overrides: { 'Icon Position': 'left' } }),
        defaultOptions
      );

      expect(result.content).toContain('iconPosition="left"');
    });

    it('should escape string override values to keep JSX valid', () => {
      const result = generator.generate(
        makeToolbarWithInstance({ overrides: { label: 'Say "hi" <now>' } }),
        defaultOptions
      );

      expect(result.content).toContain('label="Say &quot;hi&quot; &lt;now&gt;"');
      // The raw unescaped double quote must not leak into the attribute value.
      expect(result.content).not.toContain('label="Say "hi"');
    });

    it('should skip non-finite numbers and unsanitizable prop names', () => {
      const result = generator.generate(
        makeToolbarWithInstance({ overrides: { ratio: NaN, '123': 'x', label: 'ok' } }),
        defaultOptions
      );

      expect(result.content).toContain('label="ok"');
      expect(result.content).not.toContain('ratio=');
      expect(result.content).not.toContain('NaN');
    });

    it('should keep emitting a bare reference when the instance has no overrides', () => {
      const result = generator.generate(makeToolbarWithInstance({}), defaultOptions);

      expect(result.content).toContain('<Button />');
    });

    it('should keep emitting a bare reference when overrides is empty', () => {
      const result = generator.generate(
        makeToolbarWithInstance({ overrides: {} }),
        defaultOptions
      );

      expect(result.content).toContain('<Button />');
    });
  });

  describe('TypeScript validity', () => {
    it('should generate syntactically valid TypeScript', () => {
      const frame: ParsedFrame = {
        id: '1:1',
        name: 'ValidComponent',
        sanitizedName: 'ValidComponent',
        nodeType: 'frame',
        layout: { display: 'flex', flexDirection: 'column' },
        styles: { className: 'valid', cssProperties: {} },
        children: [
          {
            id: '2:1',
            name: 'Title',
            sanitizedName: 'Title',
            nodeType: 'text',
            htmlTag: 'h1',
            content: 'Title',
            layout: { display: 'block' },
            styles: { className: 'title', cssProperties: {} },
          },
          {
            id: '2:2',
            name: 'Description',
            sanitizedName: 'Description',
            nodeType: 'text',
            htmlTag: 'p',
            content: 'Description text',
            layout: { display: 'block' },
            styles: { className: 'description', cssProperties: {} },
          },
        ],
      };

      const options: GeneratorOptions = {
        namingConvention: 'pascal',
        useTailwind: true,
        outputDir: './components',
      };

      const result = generator.generate(frame, options);

      // Check for proper structure
      expect(result.content).toMatch(/import React from 'react';/);
      expect(result.content).toMatch(/interface \w+Props/);
      expect(result.content).toMatch(/export const \w+: React\.FC</);
      expect(result.content).toMatch(/return \(/);
      expect(result.content).toMatch(/<div/);
      expect(result.content).toMatch(/<\/div>/);
    });
  });

  describe('naming convention support', () => {
    const baseFrame = (sanitizedName: string): ParsedFrame => ({
      id: '1:1',
      name: sanitizedName,
      sanitizedName,
      nodeType: 'frame',
      layout: { display: 'block' },
      styles: { className: 'c', cssProperties: {} },
      children: [],
    });

    const options = (namingConvention: 'pascal' | 'kebab' | 'camel'): GeneratorOptions => ({
      namingConvention,
      useTailwind: true,
      outputDir: './components',
    });

    it('should apply the pascal naming convention', () => {
      const result = generator.generate(baseFrame('MyButton'), options('pascal'));
      expect(result.name).toBe('MyButton');
      expect(result.content).toContain('export const MyButton');
      expect(result.filePath).toBe('./components/MyButton.tsx');
    });

    it('should apply the kebab naming convention to the file path', () => {
      const result = generator.generate(baseFrame('MyButton'), options('kebab'));
      expect(result.name).toBe('my-button');
      expect(result.filePath).toBe('./components/my-button.tsx');
    });

    it('should apply the camel naming convention', () => {
      const result = generator.generate(baseFrame('MyButton'), options('camel'));
      expect(result.name).toBe('myButton');
      expect(result.content).toContain('export const myButton');
    });

    it('should produce valid identifiers for reserved-keyword component names', () => {
      // Reserved keyword must not be emitted as a bare identifier.
      const pascal = generator.generate(baseFrame('class'), options('pascal'));
      expect(pascal.name).toBe('ClassComponent');
      expect(pascal.content).toContain('export const ClassComponent');

      const camel = generator.generate(baseFrame('class'), options('camel'));
      expect(camel.name).toBe('classComponent');
      expect(camel.content).toContain('export const classComponent');
    });
  });

  describe('component hierarchy preservation (Task 10.5 / Requirement 7.6)', () => {
    const options: GeneratorOptions = {
      namingConvention: 'pascal',
      useTailwind: false,
      outputDir: './components',
    };

    it('should emit nested JSX that preserves a 3-level node tree and sibling order', () => {
      // Tree:
      // Root (frame)
      //  └─ Outer (section)
      //       ├─ text "MIDDLE_TEXT"
      //       └─ Inner (article)
      //            └─ text "DEEPEST_TEXT"
      const deepestText: ParsedNode = {
        id: '4:1',
        name: 'Deepest',
        sanitizedName: 'Deepest',
        nodeType: 'text',
        htmlTag: 'span',
        content: 'DEEPEST_TEXT',
        layout: { display: 'block' },
        styles: { className: 'deepest', cssProperties: {} },
      };
      const inner: ParsedNode = {
        id: '3:1',
        name: 'Inner',
        sanitizedName: 'Inner',
        nodeType: 'container',
        htmlTag: 'article',
        layout: { display: 'block' },
        styles: { className: 'inner', cssProperties: {} },
        children: [deepestText],
      };
      const middleText: ParsedNode = {
        id: '2:2',
        name: 'Middle',
        sanitizedName: 'Middle',
        nodeType: 'text',
        htmlTag: 'span',
        content: 'MIDDLE_TEXT',
        layout: { display: 'block' },
        styles: { className: 'middle', cssProperties: {} },
      };
      const outer: ParsedNode = {
        id: '2:1',
        name: 'Outer',
        sanitizedName: 'Outer',
        nodeType: 'container',
        htmlTag: 'section',
        layout: { display: 'block' },
        styles: { className: 'outer', cssProperties: {} },
        children: [middleText, inner],
      };
      const frame: ParsedFrame = {
        id: '1:1',
        name: 'Root',
        sanitizedName: 'Root',
        nodeType: 'frame',
        layout: { display: 'block' },
        styles: { className: 'root', cssProperties: {} },
        children: [outer],
      };

      const { content } = generator.generate(frame, options);

      // Each container in the tree is represented by its own opening/closing tag
      // (no flattening or dropped nodes).
      const count = (needle: string) => content.split(needle).length - 1;
      expect(count('<section')).toBe(1);
      expect(count('</section>')).toBe(1);
      expect(count('<article')).toBe(1);
      expect(count('</article>')).toBe(1);

      // Pre-order ordering: Outer opens, then its first child (MIDDLE_TEXT),
      // then the nested Inner container, then Inner's child (DEEPEST_TEXT).
      const outerOpen = content.indexOf('<section');
      const middleIdx = content.indexOf('MIDDLE_TEXT');
      const innerOpen = content.indexOf('<article');
      const deepestIdx = content.indexOf('DEEPEST_TEXT');
      const innerClose = content.indexOf('</article>');
      const outerClose = content.indexOf('</section>');

      [outerOpen, middleIdx, innerOpen, deepestIdx, innerClose, outerClose].forEach((i) =>
        expect(i).toBeGreaterThanOrEqual(0)
      );

      // Sibling order: MIDDLE_TEXT precedes the nested Inner container.
      expect(middleIdx).toBeGreaterThan(outerOpen);
      expect(innerOpen).toBeGreaterThan(middleIdx);

      // Deepest text is nested inside Inner, which is nested inside Outer.
      expect(deepestIdx).toBeGreaterThan(innerOpen);
      expect(deepestIdx).toBeLessThan(innerClose);
      expect(innerClose).toBeLessThan(outerClose);
    });
  });
});
