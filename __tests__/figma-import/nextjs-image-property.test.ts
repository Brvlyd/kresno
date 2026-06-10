/**
 * Property-Based Tests for Next.js Image Component Usage
 * Task 10.4: Write property test for Next.js Image usage
 *
 * **Validates: Requirements 7.3**
 * Property 23: Next.js Image Component Usage
 * For any image node, the generated component code SHALL use the Next.js Image
 * component with correct src, alt, width, and height properties.
 *
 * Implementation under test:
 *   lib/figma-import/core/component-generator.ts
 *   - image nodes are rendered via the Next.js <Image> component (generateImageJsx)
 *   - `import Image from 'next/image'` is emitted only when image nodes are present
 *   - src/alt/width/height are always present with valid values
 *     (width/height are positive integers, fallback 100; alt escaped;
 *      src falls back to /placeholder.png)
 */

import {
  ComponentGenerator,
  GeneratorOptions,
} from '../../lib/figma-import/core/component-generator';
import { ParsedFrame, ParsedNode } from '../../lib/figma-import/types/internal-models';
import * as fc from 'fast-check';

const options: GeneratorOptions = {
  namingConvention: 'pascal',
  useTailwind: true,
  outputDir: './components',
};

/**
 * Node names that stress JSX-attribute escaping: empty, whitespace, embedded
 * double-quotes and angle brackets, plus arbitrary unicode strings.
 */
const nameArb = fc.oneof(
  fc.constant(''),
  fc.constant('   '),
  fc.constantFrom(
    'Logo "Main" <v2>',
    'Hero <banner>',
    'a"b"c',
    '<<>>',
    '"quoted"',
    'Normal Name'
  ),
  fc.string()
);

/**
 * imagePath including the missing/empty/whitespace cases that must trigger the
 * /placeholder.png fallback, plus plausible asset paths.
 */
const imagePathArb = fc.oneof(
  fc.constant(undefined),
  fc.constant(''),
  fc.constant('   '),
  fc.constantFrom('/images/photo.png', '/assets/a.jpg', '/figma-assets/icon.png'),
  fc.string().map((s) => `/${s}`)
);

/**
 * Layout dimensions including the invalid cases (missing, 0, negative, NaN,
 * Infinity) that must fall back to the default of 100, plus valid fractional
 * and integer values. noNaN is used on the finite generators; NaN/Infinity are
 * injected explicitly to exercise the guard.
 */
const dimensionArb = fc.oneof(
  fc.constant<number | undefined>(undefined),
  fc.constant(0),
  fc.constant(-50),
  fc.constant(NaN),
  fc.constant(Infinity),
  fc.double({ min: 0.1, max: 8000, noNaN: true }),
  fc.integer({ min: 1, max: 8000 })
);

const imageSpecArb = fc.record({
  name: nameArb,
  imagePath: imagePathArb,
  width: dimensionArb,
  height: dimensionArb,
});

type ImageSpec = {
  name: string;
  imagePath: string | undefined;
  width: number | undefined;
  height: number | undefined;
};

function makeImageNode(spec: ImageSpec, id: number): ParsedNode {
  return {
    id: `img:${id}`,
    name: spec.name,
    sanitizedName: `Image${id}`,
    nodeType: 'image',
    htmlTag: 'img',
    imagePath: spec.imagePath,
    layout: { display: 'block', width: spec.width, height: spec.height },
    styles: { className: 'photo', cssProperties: {} },
  };
}

function makeTextNode(id: number): ParsedNode {
  return {
    id: `txt:${id}`,
    name: `Label ${id}`,
    sanitizedName: `Label${id}`,
    nodeType: 'text',
    htmlTag: 'p',
    content: 'text',
    layout: { display: 'block' },
    styles: { className: 'label', cssProperties: {} },
  };
}

function makeFrame(children: ParsedNode[]): ParsedFrame {
  return {
    id: '1:1',
    name: 'Container',
    sanitizedName: 'Container',
    nodeType: 'frame',
    layout: { display: 'block' },
    styles: { className: 'container', cssProperties: {} },
    children,
  };
}

/** Extract each generated <Image ... /> block from component content. */
function extractImageBlocks(content: string): string[] {
  return content.match(/<Image\b[\s\S]*?\/>/g) ?? [];
}

describe('Property-Based Test: Next.js Image Component Usage (Property 23)', () => {
  let generator: ComponentGenerator;

  beforeEach(() => {
    generator = new ComponentGenerator();
  });

  /**
   * Property 23: Next.js Image Component Usage
   * **Validates: Requirements 7.3**
   *
   * For any frame containing one or more image nodes (with randomized
   * imagePath, name, and dimensions), the generated component:
   *  - renders image nodes via the Next.js <Image> component (never a raw <img>)
   *  - imports Image from 'next/image'
   *  - emits src, alt, width={N}, height={N} for every image where N is a
   *    positive integer (no NaN/undefined/0/negative)
   *  - emits an alt attribute with no unescaped double-quote or angle bracket
   */
  it('renders image nodes as Next.js <Image> with valid src/alt/width/height', () => {
    fc.assert(
      fc.property(
        fc.array(imageSpecArb, { minLength: 1, maxLength: 6 }),
        // Optionally interleave non-image nodes to mimic realistic frames.
        fc.array(fc.boolean(), { maxLength: 3 }),
        (imageSpecs: ImageSpec[], textFlags: boolean[]) => {
          const children: ParsedNode[] = imageSpecs.map((s, i) => makeImageNode(s, i));
          textFlags.forEach((flag, i) => {
            if (flag) {
              children.push(makeTextNode(i));
            }
          });

          const { content } = generator.generate(makeFrame(children), options);

          // The Next.js Image import is present whenever an image node exists.
          expect(content).toContain("import Image from 'next/image'");

          // Image nodes must render as <Image>, never a raw <img> tag.
          expect(content).not.toMatch(/<img(\s|\/|>)/i);

          const blocks = extractImageBlocks(content);
          // One <Image> block per image node.
          expect(blocks).toHaveLength(imageSpecs.length);

          for (const block of blocks) {
            // src must be present and non-empty.
            const srcMatch = block.match(/\ssrc="([^"]*)"/);
            expect(srcMatch).not.toBeNull();
            expect(srcMatch![1].length).toBeGreaterThan(0);

            // alt must be present...
            const altMatch = block.match(/\salt="([^"]*)"/);
            expect(altMatch).not.toBeNull();
            const altValue = altMatch![1];
            expect(altValue.length).toBeGreaterThan(0);
            // ...and contain no unescaped angle brackets (raw double-quotes are
            // already excluded by the [^"]* capture closing the attribute).
            expect(altValue).not.toMatch(/[<>]/);

            // width must be a positive integer expression: width={N}
            const widthMatch = block.match(/\swidth=\{([^}]*)\}/);
            expect(widthMatch).not.toBeNull();
            const widthRaw = widthMatch![1];
            expect(widthRaw).toMatch(/^\d+$/);
            expect(Number.parseInt(widthRaw, 10)).toBeGreaterThan(0);

            // height must be a positive integer expression: height={N}
            const heightMatch = block.match(/\sheight=\{([^}]*)\}/);
            expect(heightMatch).not.toBeNull();
            const heightRaw = heightMatch![1];
            expect(heightRaw).toMatch(/^\d+$/);
            expect(Number.parseInt(heightRaw, 10)).toBeGreaterThan(0);
          }

          // Defensive: no NaN/undefined leaked into any dimension expression.
          expect(content).not.toContain('width={NaN}');
          expect(content).not.toContain('height={NaN}');
          expect(content).not.toContain('width={undefined}');
          expect(content).not.toContain('height={undefined}');
          expect(content).not.toContain('width={Infinity}');
          expect(content).not.toContain('height={Infinity}');
        }
      ),
      { numRuns: 500 }
    );
  });

  /**
   * The next/image import (and any <Image> usage) must be ABSENT when the frame
   * contains no image nodes, and PRESENT when it does. This guards the
   * conditional import behavior tied to Requirement 7.3.
   */
  it('emits the next/image import only when image nodes exist', () => {
    fc.assert(
      fc.property(
        fc.nat({ max: 5 }),
        fc.array(imageSpecArb, { maxLength: 5 }),
        (textCount: number, imageSpecs: ImageSpec[]) => {
          const children: ParsedNode[] = [];
          for (let i = 0; i < textCount; i++) {
            children.push(makeTextNode(i));
          }
          imageSpecs.forEach((s, i) => children.push(makeImageNode(s, i)));

          const { content, dependencies } = generator.generate(makeFrame(children), options);

          const hasImage = imageSpecs.length > 0;
          if (hasImage) {
            expect(content).toContain("import Image from 'next/image'");
            expect(content).toContain('<Image');
            expect(dependencies).toContain('next/image');
          } else {
            expect(content).not.toContain("import Image from 'next/image'");
            expect(content).not.toContain('<Image');
            expect(dependencies).not.toContain('next/image');
          }
        }
      ),
      { numRuns: 500 }
    );
  });
});
