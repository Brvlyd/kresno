/**
 * Tests for DesignParser
 * Task 4.4: Test node type classification
 */

import { DesignParser, InternalNodeType, NodeTypeClassification } from '../../lib/figma-import/core/design-parser';
import { Node, NodeType, FigmaFile, DocumentNode, CanvasNode } from '../../lib/figma-import/types/figma-api';

describe('DesignParser', () => {
  let parser: DesignParser;

  beforeEach(() => {
    parser = new DesignParser();
  });

  describe('classifyNodeType', () => {
    describe('Task 4.4: Node Type Classification', () => {
      /**
       * Requirement 3.2: The Design_Parser SHALL identify frames, groups, components, and instances
       */

      it('should classify FRAME nodes correctly', () => {
        const frameNode: Node = {
          id: '1:1',
          name: 'Test Frame',
          type: 'FRAME',
          visible: true,
        };

        const classification = parser.classifyNodeType(frameNode);

        expect(classification.internalType).toBe('frame');
        expect(classification.isContainer).toBe(true);
        expect(classification.isComponent).toBe(false);
        expect(classification.isInstance).toBe(false);
      });

      it('should classify GROUP nodes correctly', () => {
        const groupNode: Node = {
          id: '1:2',
          name: 'Test Group',
          type: 'GROUP',
          visible: true,
        };

        const classification = parser.classifyNodeType(groupNode);

        expect(classification.internalType).toBe('group');
        expect(classification.isContainer).toBe(true);
        expect(classification.isComponent).toBe(false);
        expect(classification.isInstance).toBe(false);
      });

      it('should classify COMPONENT nodes correctly', () => {
        const componentNode: Node = {
          id: '1:3',
          name: 'Test Component',
          type: 'COMPONENT',
          visible: true,
        };

        const classification = parser.classifyNodeType(componentNode);

        expect(classification.internalType).toBe('component');
        expect(classification.isContainer).toBe(true);
        expect(classification.isComponent).toBe(true);
        expect(classification.isInstance).toBe(false);
      });

      it('should classify COMPONENT_SET nodes as component type', () => {
        const componentSetNode: Node = {
          id: '1:4',
          name: 'Test Component Set',
          type: 'COMPONENT_SET',
          visible: true,
        };

        const classification = parser.classifyNodeType(componentSetNode);

        expect(classification.internalType).toBe('component');
        expect(classification.isContainer).toBe(true);
        expect(classification.isComponent).toBe(true);
        expect(classification.isInstance).toBe(false);
      });

      it('should classify INSTANCE nodes correctly', () => {
        const instanceNode: Node = {
          id: '1:5',
          name: 'Test Instance',
          type: 'INSTANCE',
          visible: true,
        };

        const classification = parser.classifyNodeType(instanceNode);

        expect(classification.internalType).toBe('instance');
        expect(classification.isContainer).toBe(true);
        expect(classification.isComponent).toBe(false);
        expect(classification.isInstance).toBe(true);
      });
    });

    describe('Additional node type classification', () => {
      it('should classify TEXT nodes correctly', () => {
        const textNode: Node = {
          id: '1:6',
          name: 'Test Text',
          type: 'TEXT',
          visible: true,
        };

        const classification = parser.classifyNodeType(textNode);

        expect(classification.internalType).toBe('text');
        expect(classification.isContainer).toBe(false);
        expect(classification.isComponent).toBe(false);
        expect(classification.isInstance).toBe(false);
      });

      it('should classify IMAGE nodes correctly', () => {
        const imageNode: Node = {
          id: '1:7',
          name: 'Test Image',
          type: 'IMAGE',
          visible: true,
        };

        const classification = parser.classifyNodeType(imageNode);

        expect(classification.internalType).toBe('image');
        expect(classification.isContainer).toBe(false);
        expect(classification.isComponent).toBe(false);
        expect(classification.isInstance).toBe(false);
      });

      it('should classify RECTANGLE nodes as shape', () => {
        const rectangleNode: Node = {
          id: '1:8',
          name: 'Test Rectangle',
          type: 'RECTANGLE',
          visible: true,
        };

        const classification = parser.classifyNodeType(rectangleNode);

        expect(classification.internalType).toBe('shape');
        expect(classification.isContainer).toBe(false);
      });

      it('should classify ELLIPSE nodes as shape', () => {
        const ellipseNode: Node = {
          id: '1:9',
          name: 'Test Ellipse',
          type: 'ELLIPSE',
          visible: true,
        };

        const classification = parser.classifyNodeType(ellipseNode);

        expect(classification.internalType).toBe('shape');
        expect(classification.isContainer).toBe(false);
      });

      it('should classify LINE nodes as shape', () => {
        const lineNode: Node = {
          id: '1:10',
          name: 'Test Line',
          type: 'LINE',
          visible: true,
        };

        const classification = parser.classifyNodeType(lineNode);

        expect(classification.internalType).toBe('shape');
        expect(classification.isContainer).toBe(false);
      });

      it('should classify VECTOR nodes as shape', () => {
        const vectorNode: Node = {
          id: '1:11',
          name: 'Test Vector',
          type: 'VECTOR',
          visible: true,
        };

        const classification = parser.classifyNodeType(vectorNode);

        expect(classification.internalType).toBe('shape');
        expect(classification.isContainer).toBe(false);
      });

      it('should classify BOOLEAN_OPERATION nodes as shape', () => {
        const booleanNode: Node = {
          id: '1:12',
          name: 'Test Boolean',
          type: 'BOOLEAN_OPERATION',
          visible: true,
        };

        const classification = parser.classifyNodeType(booleanNode);

        expect(classification.internalType).toBe('shape');
        expect(classification.isContainer).toBe(false);
      });

      it('should classify CANVAS nodes as container', () => {
        const canvasNode: Node = {
          id: '0:1',
          name: 'Page 1',
          type: 'CANVAS',
          visible: true,
        };

        const classification = parser.classifyNodeType(canvasNode);

        expect(classification.internalType).toBe('container');
        expect(classification.isContainer).toBe(true);
        expect(classification.isComponent).toBe(false);
        expect(classification.isInstance).toBe(false);
      });

      it('should classify DOCUMENT nodes as container', () => {
        const documentNode: Node = {
          id: '0:0',
          name: 'Document',
          type: 'DOCUMENT',
          visible: true,
        };

        const classification = parser.classifyNodeType(documentNode);

        expect(classification.internalType).toBe('container');
        expect(classification.isContainer).toBe(true);
        expect(classification.isComponent).toBe(false);
        expect(classification.isInstance).toBe(false);
      });
    });

    describe('Unsupported node types', () => {
      it('should handle SLICE nodes as unsupported and log warning', () => {
        const sliceNode: Node = {
          id: '1:13',
          name: 'Test Slice',
          type: 'SLICE',
          visible: true,
        };

        const classification = parser.classifyNodeType(sliceNode);

        // Should still return a classification (fallback to container)
        expect(classification.internalType).toBe('container');
        expect(classification.isContainer).toBe(false);

        // Should log a warning
        const warnings = parser.getWarnings();
        expect(warnings).toHaveLength(1);
        expect(warnings[0].message).toContain('Unsupported node type: SLICE');
        expect(warnings[0].nodeId).toBe('1:13');
        expect(warnings[0].nodeName).toBe('Test Slice');
      });

      it('should handle unknown node types and log warning', () => {
        const unknownNode = {
          id: '1:14',
          name: 'Unknown Node',
          type: 'UNKNOWN_TYPE' as NodeType,
          visible: true,
        };

        const classification = parser.classifyNodeType(unknownNode);

        // Should still return a classification (fallback to container)
        expect(classification.internalType).toBe('container');
        expect(classification.isContainer).toBe(false);

        // Should log a warning
        const warnings = parser.getWarnings();
        expect(warnings.length).toBeGreaterThan(0);
        expect(warnings[warnings.length - 1].message).toContain('Unsupported node type');
      });
    });
  });

  describe('validateStructure', () => {
    it('should validate a valid Figma file with at least one canvas', () => {
      const validFile: FigmaFile = {
        name: 'Test File',
        lastModified: '2024-01-01T00:00:00Z',
        thumbnailUrl: 'https://example.com/thumb.png',
        version: '1.0',
        document: {
          id: '0:0',
          name: 'Document',
          type: 'DOCUMENT',
          visible: true,
          children: [
            {
              id: '0:1',
              name: 'Page 1',
              type: 'CANVAS',
              visible: true,
              backgroundColor: { r: 1, g: 1, b: 1, a: 1 },
              children: [],
            } as CanvasNode,
          ],
        } as DocumentNode,
        components: {},
        componentSets: {},
        styles: {},
        schemaVersion: 0,
      };

      const result = parser.validateStructure(validFile);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject a Figma file without any canvas', () => {
      const invalidFile: FigmaFile = {
        name: 'Test File',
        lastModified: '2024-01-01T00:00:00Z',
        thumbnailUrl: 'https://example.com/thumb.png',
        version: '1.0',
        document: {
          id: '0:0',
          name: 'Document',
          type: 'DOCUMENT',
          visible: true,
          children: [],
        } as DocumentNode,
        components: {},
        componentSets: {},
        styles: {},
        schemaVersion: 0,
      };

      const result = parser.validateStructure(invalidFile);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('at least one canvas/page');
    });
  });

  describe('parse', () => {
    it('should parse a simple Figma file with frames', () => {
      const figmaFile: FigmaFile = {
        name: 'Test Design',
        lastModified: '2024-01-01T00:00:00Z',
        thumbnailUrl: 'https://example.com/thumb.png',
        version: '1.0',
        document: {
          id: '0:0',
          name: 'Document',
          type: 'DOCUMENT',
          visible: true,
          children: [
            {
              id: '0:1',
              name: 'Page 1',
              type: 'CANVAS',
              visible: true,
              children: [
                {
                  id: '1:1',
                  name: 'Frame 1',
                  type: 'FRAME',
                  visible: true,
                  children: [],
                  absoluteBoundingBox: { x: 0, y: 0, width: 100, height: 100 },
                },
                {
                  id: '1:2',
                  name: 'Component 1',
                  type: 'COMPONENT',
                  visible: true,
                  children: [],
                  absoluteBoundingBox: { x: 0, y: 0, width: 100, height: 100 },
                },
              ],
            } as any,
          ],
        } as DocumentNode,
        components: {},
        componentSets: {},
        styles: {},
        schemaVersion: 0,
      };

      const parsed = parser.parse(figmaFile);

      expect(parsed.metadata.fileName).toBe('Test Design');
      expect(parsed.pages).toHaveLength(1);
      expect(parsed.pages[0].name).toBe('Page 1');
      expect(parsed.pages[0].frames).toHaveLength(2);

      // Check frame classification
      const frame1 = parsed.pages[0].frames[0];
      expect(frame1.name).toBe('Frame 1');
      expect(frame1.nodeType).toBe('frame');

      // Check component classification
      const component1 = parsed.pages[0].frames[1];
      expect(component1.name).toBe('Component 1');
      expect(component1.nodeType).toBe('component');
    });

    it('should parse nested node structures', () => {
      const figmaFile: FigmaFile = {
        name: 'Test Design',
        lastModified: '2024-01-01T00:00:00Z',
        thumbnailUrl: 'https://example.com/thumb.png',
        version: '1.0',
        document: {
          id: '0:0',
          name: 'Document',
          type: 'DOCUMENT',
          visible: true,
          children: [
            {
              id: '0:1',
              name: 'Page 1',
              type: 'CANVAS',
              visible: true,
              children: [
                {
                  id: '1:1',
                  name: 'Frame 1',
                  type: 'FRAME',
                  visible: true,
                  absoluteBoundingBox: { x: 0, y: 0, width: 100, height: 100 },
                  children: [
                    {
                      id: '2:1',
                      name: 'Group 1',
                      type: 'GROUP',
                      visible: true,
                      absoluteBoundingBox: { x: 0, y: 0, width: 50, height: 50 },
                      children: [
                        {
                          id: '3:1',
                          name: 'Rectangle 1',
                          type: 'RECTANGLE',
                          visible: true,
                          absoluteBoundingBox: { x: 0, y: 0, width: 50, height: 50 },
                        },
                      ],
                    },
                    {
                      id: '2:2',
                      name: 'Text 1',
                      type: 'TEXT',
                      visible: true,
                      characters: 'Hello',
                      absoluteBoundingBox: { x: 0, y: 0, width: 50, height: 20 },
                      style: {
                        fontFamily: 'Inter',
                        fontWeight: 400,
                        fontSize: 16,
                        textAlignHorizontal: 'LEFT',
                        textAlignVertical: 'TOP',
                        letterSpacing: 0,
                        lineHeightPx: 24,
                        lineHeightPercent: 150,
                      },
                    },
                  ],
                },
              ],
            } as any,
          ],
        } as DocumentNode,
        components: {},
        componentSets: {},
        styles: {},
        schemaVersion: 0,
      };

      const parsed = parser.parse(figmaFile);

      expect(parsed.pages).toHaveLength(1);
      expect(parsed.pages[0].frames).toHaveLength(1);

      const frame = parsed.pages[0].frames[0];
      expect(frame.children).toHaveLength(2);

      // Check group node
      const group = frame.children[0];
      expect(group.name).toBe('Group 1');
      expect(group.nodeType).toBe('group');
      expect(group.children).toHaveLength(1);

      // Check rectangle inside group
      const rectangle = group.children![0];
      expect(rectangle.name).toBe('Rectangle 1');
      expect(rectangle.nodeType).toBe('shape');

      // Check text node
      const text = frame.children[1];
      expect(text.name).toBe('Text 1');
      expect(text.nodeType).toBe('text');
    });

    it('should handle instance nodes with componentId', () => {
      const figmaFile: FigmaFile = {
        name: 'Test Design',
        lastModified: '2024-01-01T00:00:00Z',
        thumbnailUrl: 'https://example.com/thumb.png',
        version: '1.0',
        document: {
          id: '0:0',
          name: 'Document',
          type: 'DOCUMENT',
          visible: true,
          children: [
            {
              id: '0:1',
              name: 'Page 1',
              type: 'CANVAS',
              visible: true,
              children: [
                {
                  id: '1:1',
                  name: 'Instance 1',
                  type: 'INSTANCE',
                  visible: true,
                  componentId: '2:1',
                  children: [],
                  absoluteBoundingBox: { x: 0, y: 0, width: 100, height: 100 },
                },
              ],
            } as any,
          ],
        } as DocumentNode,
        components: {
          '2:1': {
            key: 'comp-key-1',
            name: 'Button Component',
            description: 'A button component',
          },
        },
        componentSets: {},
        styles: {},
        schemaVersion: 0,
      };

      const parsed = parser.parse(figmaFile);

      expect(parsed.pages[0].frames).toHaveLength(1);
      
      const instance = parsed.pages[0].frames[0];
      expect(instance.nodeType).toBe('instance');
      expect(instance.componentId).toBe('2:1');
    });
  });
});
