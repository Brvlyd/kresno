/**
 * Unit tests for DesignParser
 * Tests tree traversal, node parsing, and parent-child relationship preservation
 */

import { DesignParser } from './design-parser';
import {
  FigmaFile,
  DocumentNode,
  CanvasNode,
  FrameNode,
  TextNode,
  RectangleNode,
  GroupNode,
} from '../types/figma-api';

describe('DesignParser', () => {
  describe('parse', () => {
    it('should parse a simple Figma file with one page and one frame', () => {
      const mockFigmaFile: FigmaFile = {
        name: 'Test Design',
        lastModified: '2024-01-01T00:00:00Z',
        version: '1.0',
        thumbnailUrl: '',
        document: {
          id: 'doc-1',
          name: 'Document',
          type: 'DOCUMENT',
          visible: true,
          children: [
            {
              id: 'canvas-1',
              name: 'Page 1',
              type: 'CANVAS',
              visible: true,
              backgroundColor: { r: 1, g: 1, b: 1, a: 1 },
              children: [
                {
                  id: 'frame-1',
                  name: 'Frame 1',
                  type: 'FRAME',
                  visible: true,
                  children: [],
                  absoluteBoundingBox: { x: 0, y: 0, width: 100, height: 100 },
                } as FrameNode,
              ],
            } as CanvasNode,
          ],
        } as DocumentNode,
        components: {},
        componentSets: {},
        styles: {},
        schemaVersion: 0,
      };

      const parser = new DesignParser();
      const result = parser.parse(mockFigmaFile);

      expect(result.metadata.fileName).toBe('Test Design');
      expect(result.pages).toHaveLength(1);
      expect(result.pages[0].name).toBe('Page 1');
      expect(result.pages[0].frames).toHaveLength(1);
      expect(result.pages[0].frames[0].name).toBe('Frame 1');
    });

    it('should traverse the complete tree and visit every node', () => {
      const mockFigmaFile: FigmaFile = {
        name: 'Complete Tree Test',
        lastModified: '2024-01-01T00:00:00Z',
        version: '1.0',
        thumbnailUrl: '',
        document: {
          id: 'doc-1',
          name: 'Document',
          type: 'DOCUMENT',
          visible: true,
          children: [
            {
              id: 'canvas-1',
              name: 'Page 1',
              type: 'CANVAS',
              visible: true,
              backgroundColor: { r: 1, g: 1, b: 1, a: 1 },
              children: [
                {
                  id: 'frame-1',
                  name: 'Parent Frame',
                  type: 'FRAME',
                  visible: true,
                  absoluteBoundingBox: { x: 0, y: 0, width: 200, height: 200 },
                  children: [
                    {
                      id: 'text-1',
                      name: 'Text Node',
                      type: 'TEXT',
                      visible: true,
                      characters: 'Hello World',
                      style: {
                        fontFamily: 'Arial',
                        fontWeight: 400,
                        fontSize: 16,
                        textAlignHorizontal: 'LEFT',
                        textAlignVertical: 'TOP',
                        letterSpacing: 0,
                        lineHeightPx: 24,
                        lineHeightPercent: 150,
                      },
                      absoluteBoundingBox: { x: 10, y: 10, width: 100, height: 20 },
                    } as TextNode,
                    {
                      id: 'rect-1',
                      name: 'Rectangle',
                      type: 'RECTANGLE',
                      visible: true,
                      absoluteBoundingBox: { x: 10, y: 40, width: 50, height: 50 },
                    } as RectangleNode,
                  ],
                } as FrameNode,
              ],
            } as CanvasNode,
          ],
        } as DocumentNode,
        components: {},
        componentSets: {},
        styles: {},
        schemaVersion: 0,
      };

      const parser = new DesignParser();
      const result = parser.parse(mockFigmaFile);

      // Verify complete traversal
      expect(result.pages).toHaveLength(1);
      expect(result.pages[0].frames).toHaveLength(1);
      
      const frame = result.pages[0].frames[0];
      expect(frame.children).toHaveLength(2);
      expect(frame.children[0].nodeType).toBe('text');
      expect(frame.children[0].content).toBe('Hello World');
      expect(frame.children[1].nodeType).toBe('shape');
    });

    it('should preserve parent-child relationships in nested structures', () => {
      const mockFigmaFile: FigmaFile = {
        name: 'Nested Structure Test',
        lastModified: '2024-01-01T00:00:00Z',
        version: '1.0',
        thumbnailUrl: '',
        document: {
          id: 'doc-1',
          name: 'Document',
          type: 'DOCUMENT',
          visible: true,
          children: [
            {
              id: 'canvas-1',
              name: 'Page 1',
              type: 'CANVAS',
              visible: true,
              backgroundColor: { r: 1, g: 1, b: 1, a: 1 },
              children: [
                {
                  id: 'frame-1',
                  name: 'Grandparent',
                  type: 'FRAME',
                  visible: true,
                  absoluteBoundingBox: { x: 0, y: 0, width: 300, height: 300 },
                  children: [
                    {
                      id: 'frame-2',
                      name: 'Parent',
                      type: 'FRAME',
                      visible: true,
                      absoluteBoundingBox: { x: 10, y: 10, width: 200, height: 200 },
                      children: [
                        {
                          id: 'frame-3',
                          name: 'Child',
                          type: 'FRAME',
                          visible: true,
                          absoluteBoundingBox: { x: 20, y: 20, width: 100, height: 100 },
                          children: [
                            {
                              id: 'text-1',
                              name: 'Leaf',
                              type: 'TEXT',
                              visible: true,
                              characters: 'Deeply nested',
                              style: {
                                fontFamily: 'Arial',
                                fontWeight: 400,
                                fontSize: 12,
                                textAlignHorizontal: 'LEFT',
                                textAlignVertical: 'TOP',
                                letterSpacing: 0,
                                lineHeightPx: 16,
                                lineHeightPercent: 133,
                              },
                              absoluteBoundingBox: { x: 30, y: 30, width: 50, height: 16 },
                            } as TextNode,
                          ],
                        } as FrameNode,
                      ],
                    } as FrameNode,
                  ],
                } as FrameNode,
              ],
            } as CanvasNode,
          ],
        } as DocumentNode,
        components: {},
        componentSets: {},
        styles: {},
        schemaVersion: 0,
      };

      const parser = new DesignParser();
      const result = parser.parse(mockFigmaFile);

      // Verify nested structure is preserved
      const grandparent = result.pages[0].frames[0];
      expect(grandparent.name).toBe('Grandparent');
      expect(grandparent.children).toHaveLength(1);

      const parent = grandparent.children[0];
      expect(parent.name).toBe('Parent');
      expect(parent.children).toHaveLength(1);

      const child = parent.children![0];
      expect(child.name).toBe('Child');
      expect(child.children).toHaveLength(1);

      const leaf = child.children![0];
      expect(leaf.name).toBe('Leaf');
      expect(leaf.nodeType).toBe('text');
      expect(leaf.content).toBe('Deeply nested');
    });

    it('should handle group nodes with children', () => {
      const mockFigmaFile: FigmaFile = {
        name: 'Group Test',
        lastModified: '2024-01-01T00:00:00Z',
        version: '1.0',
        thumbnailUrl: '',
        document: {
          id: 'doc-1',
          name: 'Document',
          type: 'DOCUMENT',
          visible: true,
          children: [
            {
              id: 'canvas-1',
              name: 'Page 1',
              type: 'CANVAS',
              visible: true,
              backgroundColor: { r: 1, g: 1, b: 1, a: 1 },
              children: [
                {
                  id: 'frame-1',
                  name: 'Container',
                  type: 'FRAME',
                  visible: true,
                  absoluteBoundingBox: { x: 0, y: 0, width: 200, height: 200 },
                  children: [
                    {
                      id: 'group-1',
                      name: 'Group',
                      type: 'GROUP',
                      visible: true,
                      absoluteBoundingBox: { x: 10, y: 10, width: 100, height: 100 },
                      children: [
                        {
                          id: 'rect-1',
                          name: 'Rect in Group',
                          type: 'RECTANGLE',
                          visible: true,
                          absoluteBoundingBox: { x: 10, y: 10, width: 50, height: 50 },
                        } as RectangleNode,
                        {
                          id: 'text-1',
                          name: 'Text in Group',
                          type: 'TEXT',
                          visible: true,
                          characters: 'Grouped text',
                          style: {
                            fontFamily: 'Arial',
                            fontWeight: 400,
                            fontSize: 14,
                            textAlignHorizontal: 'LEFT',
                            textAlignVertical: 'TOP',
                            letterSpacing: 0,
                            lineHeightPx: 18,
                            lineHeightPercent: 128,
                          },
                          absoluteBoundingBox: { x: 10, y: 70, width: 80, height: 18 },
                        } as TextNode,
                      ],
                    } as GroupNode,
                  ],
                } as FrameNode,
              ],
            } as CanvasNode,
          ],
        } as DocumentNode,
        components: {},
        componentSets: {},
        styles: {},
        schemaVersion: 0,
      };

      const parser = new DesignParser();
      const result = parser.parse(mockFigmaFile);

      const frame = result.pages[0].frames[0];
      expect(frame.children).toHaveLength(1);

      const group = frame.children[0];
      expect(group.nodeType).toBe('group');
      expect(group.children).toHaveLength(2);
      expect(group.children![0].nodeType).toBe('shape');
      expect(group.children![1].nodeType).toBe('text');
    });

    it('should handle component nodes', () => {
      const mockFigmaFile: FigmaFile = {
        name: 'Component Test',
        lastModified: '2024-01-01T00:00:00Z',
        version: '1.0',
        thumbnailUrl: '',
        document: {
          id: 'doc-1',
          name: 'Document',
          type: 'DOCUMENT',
          visible: true,
          children: [
            {
              id: 'canvas-1',
              name: 'Page 1',
              type: 'CANVAS',
              visible: true,
              backgroundColor: { r: 1, g: 1, b: 1, a: 1 },
              children: [
                {
                  id: 'component-1',
                  name: 'Button Component',
                  type: 'COMPONENT',
                  visible: true,
                  absoluteBoundingBox: { x: 0, y: 0, width: 120, height: 40 },
                  children: [],
                },
              ],
            } as CanvasNode,
          ],
        } as DocumentNode,
        components: {},
        componentSets: {},
        styles: {},
        schemaVersion: 0,
      };

      const parser = new DesignParser();
      const result = parser.parse(mockFigmaFile);

      const frame = result.pages[0].frames[0];
      expect(frame.nodeType).toBe('component');
      expect(frame.name).toBe('Button Component');
    });

    it('should handle instance nodes with componentId', () => {
      const mockFigmaFile: FigmaFile = {
        name: 'Instance Test',
        lastModified: '2024-01-01T00:00:00Z',
        version: '1.0',
        thumbnailUrl: '',
        document: {
          id: 'doc-1',
          name: 'Document',
          type: 'DOCUMENT',
          visible: true,
          children: [
            {
              id: 'canvas-1',
              name: 'Page 1',
              type: 'CANVAS',
              visible: true,
              backgroundColor: { r: 1, g: 1, b: 1, a: 1 },
              children: [
                {
                  id: 'instance-1',
                  name: 'Button Instance',
                  type: 'INSTANCE',
                  componentId: 'component-123',
                  visible: true,
                  absoluteBoundingBox: { x: 0, y: 0, width: 120, height: 40 },
                  children: [],
                },
              ],
            } as CanvasNode,
          ],
        } as DocumentNode,
        components: {},
        componentSets: {},
        styles: {},
        schemaVersion: 0,
      };

      const parser = new DesignParser();
      const result = parser.parse(mockFigmaFile);

      const frame = result.pages[0].frames[0];
      expect(frame.nodeType).toBe('instance');
      expect(frame.componentId).toBe('component-123');
    });

    it('should handle multiple pages', () => {
      const mockFigmaFile: FigmaFile = {
        name: 'Multi-page Test',
        lastModified: '2024-01-01T00:00:00Z',
        version: '1.0',
        thumbnailUrl: '',
        document: {
          id: 'doc-1',
          name: 'Document',
          type: 'DOCUMENT',
          visible: true,
          children: [
            {
              id: 'canvas-1',
              name: 'Page 1',
              type: 'CANVAS',
              visible: true,
              backgroundColor: { r: 1, g: 1, b: 1, a: 1 },
              children: [
                {
                  id: 'frame-1',
                  name: 'Frame in Page 1',
                  type: 'FRAME',
                  visible: true,
                  absoluteBoundingBox: { x: 0, y: 0, width: 100, height: 100 },
                  children: [],
                } as FrameNode,
              ],
            } as CanvasNode,
            {
              id: 'canvas-2',
              name: 'Page 2',
              type: 'CANVAS',
              visible: true,
              backgroundColor: { r: 1, g: 1, b: 1, a: 1 },
              children: [
                {
                  id: 'frame-2',
                  name: 'Frame in Page 2',
                  type: 'FRAME',
                  visible: true,
                  absoluteBoundingBox: { x: 0, y: 0, width: 150, height: 150 },
                  children: [],
                } as FrameNode,
              ],
            } as CanvasNode,
          ],
        } as DocumentNode,
        components: {},
        componentSets: {},
        styles: {},
        schemaVersion: 0,
      };

      const parser = new DesignParser();
      const result = parser.parse(mockFigmaFile);

      expect(result.pages).toHaveLength(2);
      expect(result.pages[0].name).toBe('Page 1');
      expect(result.pages[1].name).toBe('Page 2');
      expect(result.pages[0].frames[0].name).toBe('Frame in Page 1');
      expect(result.pages[1].frames[0].name).toBe('Frame in Page 2');
    });

    it('should sanitize node names', () => {
      const mockFigmaFile: FigmaFile = {
        name: 'Name Sanitization Test',
        lastModified: '2024-01-01T00:00:00Z',
        version: '1.0',
        thumbnailUrl: '',
        document: {
          id: 'doc-1',
          name: 'Document',
          type: 'DOCUMENT',
          visible: true,
          children: [
            {
              id: 'canvas-1',
              name: 'Page 1',
              type: 'CANVAS',
              visible: true,
              backgroundColor: { r: 1, g: 1, b: 1, a: 1 },
              children: [
                {
                  id: 'frame-1',
                  name: 'My Awesome Frame!',
                  type: 'FRAME',
                  visible: true,
                  absoluteBoundingBox: { x: 0, y: 0, width: 100, height: 100 },
                  children: [],
                } as FrameNode,
              ],
            } as CanvasNode,
          ],
        } as DocumentNode,
        components: {},
        componentSets: {},
        styles: {},
        schemaVersion: 0,
      };

      const parser = new DesignParser();
      const result = parser.parse(mockFigmaFile);

      const frame = result.pages[0].frames[0];
      expect(frame.name).toBe('My Awesome Frame!');
      expect(frame.sanitizedName).toBe('MyAwesomeFrame');
    });

    it('should handle empty children arrays', () => {
      const mockFigmaFile: FigmaFile = {
        name: 'Empty Children Test',
        lastModified: '2024-01-01T00:00:00Z',
        version: '1.0',
        thumbnailUrl: '',
        document: {
          id: 'doc-1',
          name: 'Document',
          type: 'DOCUMENT',
          visible: true,
          children: [
            {
              id: 'canvas-1',
              name: 'Page 1',
              type: 'CANVAS',
              visible: true,
              backgroundColor: { r: 1, g: 1, b: 1, a: 1 },
              children: [
                {
                  id: 'frame-1',
                  name: 'Empty Frame',
                  type: 'FRAME',
                  visible: true,
                  absoluteBoundingBox: { x: 0, y: 0, width: 100, height: 100 },
                  children: [],
                } as FrameNode,
              ],
            } as CanvasNode,
          ],
        } as DocumentNode,
        components: {},
        componentSets: {},
        styles: {},
        schemaVersion: 0,
      };

      const parser = new DesignParser();
      const result = parser.parse(mockFigmaFile);

      const frame = result.pages[0].frames[0];
      expect(frame.children).toHaveLength(0);
    });
  });
});
