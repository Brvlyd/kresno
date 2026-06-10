/**
 * Tests for type definitions
 * Validates that core types are properly defined
 */

import {
  FigmaFile,
  Color,
  Paint,
  TypeStyle,
  ParsedDesign,
  ParsedNode,
  StyleInfo,
  LayoutInfo,
  ImportConfig,
} from '@/lib/figma-import/types';

describe('Figma API Types', () => {
  it('should define Color interface correctly', () => {
    const color: Color = {
      r: 0.5,
      g: 0.5,
      b: 0.5,
      a: 1.0,
    };

    expect(color.r).toBe(0.5);
    expect(color.g).toBe(0.5);
    expect(color.b).toBe(0.5);
    expect(color.a).toBe(1.0);
  });

  it('should define Paint interface with solid color', () => {
    const paint: Paint = {
      type: 'SOLID',
      visible: true,
      opacity: 1.0,
      color: {
        r: 1,
        g: 0,
        b: 0,
        a: 1,
      },
    };

    expect(paint.type).toBe('SOLID');
    expect(paint.color?.r).toBe(1);
  });

  it('should define TypeStyle interface', () => {
    const style: TypeStyle = {
      fontFamily: 'Inter',
      fontWeight: 400,
      fontSize: 16,
      textAlignHorizontal: 'LEFT',
      textAlignVertical: 'TOP',
      letterSpacing: 0,
      lineHeightPx: 24,
      lineHeightPercent: 150,
    };

    expect(style.fontFamily).toBe('Inter');
    expect(style.fontSize).toBe(16);
  });
});

describe('Internal Data Models', () => {
  it('should define LayoutInfo interface', () => {
    const layout: LayoutInfo = {
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 16,
      padding: {
        top: 8,
        right: 16,
        bottom: 8,
        left: 16,
      },
    };

    expect(layout.display).toBe('flex');
    expect(layout.gap).toBe(16);
  });

  it('should define StyleInfo interface', () => {
    const style: StyleInfo = {
      className: 'button-primary',
      cssProperties: {
        backgroundColor: 'blue',
        color: 'white',
      },
      tailwindClasses: ['bg-blue-500', 'text-white'],
    };

    expect(style.className).toBe('button-primary');
    expect(style.cssProperties.backgroundColor).toBe('blue');
  });

  it('should define ParsedNode interface', () => {
    const node: ParsedNode = {
      id: '1:23',
      name: 'Button',
      sanitizedName: 'Button',
      nodeType: 'container',
      htmlTag: 'div',
      layout: {
        display: 'flex',
      },
      styles: {
        className: 'button',
        cssProperties: {},
      },
    };

    expect(node.id).toBe('1:23');
    expect(node.nodeType).toBe('container');
  });
});

describe('Configuration Types', () => {
  it('should define ImportConfig interface', () => {
    const config: ImportConfig = {
      fileUrl: 'https://www.figma.com/file/ABC123/Test',
      token: 'test-token',
      outputDir: './components',
      assetsDir: './public/assets',
      useTailwind: true,
      namingConvention: 'pascal',
      imageFormat: 'png',
      imageScale: 2,
    };

    expect(config.useTailwind).toBe(true);
    expect(config.namingConvention).toBe('pascal');
  });
});
