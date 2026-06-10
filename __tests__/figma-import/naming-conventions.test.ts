/**
 * Unit tests for naming conventions
 * Task 10.14 — Requirements: 10.2
 *
 * Covers the three naming-convention conversions implemented in
 * lib/figma-import/utils/name-sanitizer.ts:
 *   - sanitizeComponentName (PascalCase)
 *   - toKebabCase           (kebab-case)
 *   - toCamelCase           (camelCase)
 *   - isReservedKeyword
 * and their end-to-end use via ComponentGenerator.generate() through the
 * GeneratorOptions.namingConvention setting.
 *
 * Assertions reflect the REAL current behavior of the implementation
 * (including the case-boundary preservation fix and reserved-keyword handling
 * from task 10.13), not idealized behavior.
 */

import {
  sanitizeComponentName,
  toKebabCase,
  toCamelCase,
  isReservedKeyword,
} from '../../lib/figma-import/utils/name-sanitizer';
import {
  ComponentGenerator,
  GeneratorOptions,
} from '../../lib/figma-import/core/component-generator';
import { ParsedFrame } from '../../lib/figma-import/types/internal-models';

/** A valid JS/TS identifier: starts with a letter/_/$, then alphanumerics/_/$. */
const VALID_IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

/** Build a minimal valid ParsedFrame whose sanitizedName drives naming. */
function makeFrame(sanitizedName: string): ParsedFrame {
  return {
    id: '1:1',
    name: sanitizedName,
    sanitizedName,
    nodeType: 'frame',
    layout: { display: 'block' },
    styles: { className: 'c', cssProperties: {} },
    children: [],
  };
}

describe('naming conventions', () => {
  // --------------------------------------------------------------------------
  // PascalCase — sanitizeComponentName
  // --------------------------------------------------------------------------
  describe('sanitizeComponentName (PascalCase)', () => {
    it('converts space-separated words', () => {
      expect(sanitizeComponentName('my button')).toBe('MyButton');
    });

    it('converts hyphen-separated words', () => {
      expect(sanitizeComponentName('my-button')).toBe('MyButton');
    });

    it('converts underscore-separated words', () => {
      expect(sanitizeComponentName('my_button')).toBe('MyButton');
    });

    it('preserves an existing PascalCase boundary (MyButton stays MyButton)', () => {
      expect(sanitizeComponentName('MyButton')).toBe('MyButton');
    });

    it('converts camelCase to PascalCase', () => {
      expect(sanitizeComponentName('myButton')).toBe('MyButton');
    });

    it('preserves acronym-to-word boundaries', () => {
      expect(sanitizeComponentName('XMLParser')).toBe('XMLParser');
    });

    it('prefixes names that start with a digit with "Component"', () => {
      expect(sanitizeComponentName('123abc')).toBe('Component123abc');
    });

    it('strips special characters', () => {
      expect(sanitizeComponentName('Button #1')).toBe('Button1');
      expect(sanitizeComponentName('My@Button')).toBe('MyButton');
    });

    it('suffixes reserved keywords with "Component" (class -> ClassComponent)', () => {
      expect(sanitizeComponentName('class')).toBe('ClassComponent');
    });

    it('treats reserved keywords case-insensitively (Class -> ClassComponent)', () => {
      expect(sanitizeComponentName('Class')).toBe('ClassComponent');
    });

    it('falls back to UnnamedComponent when nothing usable remains', () => {
      expect(sanitizeComponentName('@#$%')).toBe('UnnamedComponent');
    });

    it('always produces a valid identifier', () => {
      for (const input of ['my button', '123abc', 'class', 'My@Button', 'MyButton']) {
        expect(sanitizeComponentName(input)).toMatch(VALID_IDENTIFIER);
      }
    });
  });

  // --------------------------------------------------------------------------
  // kebab-case — toKebabCase
  // --------------------------------------------------------------------------
  describe('toKebabCase (kebab-case)', () => {
    it('converts PascalCase to kebab-case', () => {
      expect(toKebabCase('MyButton')).toBe('my-button');
    });

    it('converts space-separated words', () => {
      expect(toKebabCase('my button')).toBe('my-button');
    });

    it('leaves already-kebab names unchanged', () => {
      expect(toKebabCase('my-button')).toBe('my-button');
    });

    it('converts camelCase to kebab-case', () => {
      expect(toKebabCase('myButton')).toBe('my-button');
    });

    it('converts underscores to hyphens', () => {
      expect(toKebabCase('my_button')).toBe('my-button');
    });

    it('collapses repeated separators and trims edge hyphens', () => {
      expect(toKebabCase('  my   button  ')).toBe('my-button');
    });

    it('strips special characters', () => {
      expect(toKebabCase('My@Button')).toBe('mybutton');
    });

    it('does NOT escape reserved keywords (real behavior)', () => {
      // toKebabCase has no reserved-keyword handling, unlike the PascalCase /
      // camelCase converters.
      expect(toKebabCase('class')).toBe('class');
    });
  });

  // --------------------------------------------------------------------------
  // camelCase — toCamelCase
  // --------------------------------------------------------------------------
  describe('toCamelCase (camelCase)', () => {
    it('converts PascalCase to camelCase', () => {
      expect(toCamelCase('MyButton')).toBe('myButton');
    });

    it('converts space-separated words', () => {
      expect(toCamelCase('my button')).toBe('myButton');
    });

    it('converts hyphen-separated words', () => {
      expect(toCamelCase('my-button')).toBe('myButton');
    });

    it('converts underscore-separated words', () => {
      expect(toCamelCase('my_button')).toBe('myButton');
    });

    it('leaves already-camelCase names unchanged', () => {
      expect(toCamelCase('myButton')).toBe('myButton');
    });

    it('prefixes names that start with a digit with "component"', () => {
      expect(toCamelCase('123abc')).toBe('component123abc');
    });

    it('suffixes reserved keywords with "Component" (class -> classComponent)', () => {
      expect(toCamelCase('class')).toBe('classComponent');
    });

    it('falls back to "unnamed" when nothing usable remains', () => {
      expect(toCamelCase('@#$%')).toBe('unnamed');
    });

    it('always produces a valid identifier', () => {
      for (const input of ['my button', '123abc', 'class', 'My@Button', 'MyButton']) {
        expect(toCamelCase(input)).toMatch(VALID_IDENTIFIER);
      }
    });
  });

  // --------------------------------------------------------------------------
  // isReservedKeyword
  // --------------------------------------------------------------------------
  describe('isReservedKeyword', () => {
    it('recognizes reserved keywords (case-insensitive)', () => {
      expect(isReservedKeyword('class')).toBe(true);
      expect(isReservedKeyword('Class')).toBe(true);
      expect(isReservedKeyword('function')).toBe(true);
      expect(isReservedKeyword('return')).toBe(true);
    });

    it('returns false for non-reserved identifiers', () => {
      expect(isReservedKeyword('button')).toBe(false);
      expect(isReservedKeyword('MyButton')).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // End-to-end via ComponentGenerator.generate()
  // --------------------------------------------------------------------------
  describe('ComponentGenerator.generate() naming convention', () => {
    const baseOptions: GeneratorOptions = {
      namingConvention: 'pascal',
      useTailwind: true,
      outputDir: './components',
    };

    it('applies the pascal convention to the component name and file path', () => {
      const generator = new ComponentGenerator();
      const result = generator.generate(makeFrame('My Button'), {
        ...baseOptions,
        namingConvention: 'pascal',
      });

      expect(result.name).toBe('MyButton');
      expect(result.filePath).toBe('./components/MyButton.tsx');
    });

    it('applies the kebab convention to the component name and file path', () => {
      const generator = new ComponentGenerator();
      const result = generator.generate(makeFrame('My Button'), {
        ...baseOptions,
        namingConvention: 'kebab',
      });

      expect(result.name).toBe('my-button');
      expect(result.filePath).toBe('./components/my-button.tsx');
    });

    it('applies the camel convention to the component name and file path', () => {
      const generator = new ComponentGenerator();
      const result = generator.generate(makeFrame('My Button'), {
        ...baseOptions,
        namingConvention: 'camel',
      });

      expect(result.name).toBe('myButton');
      expect(result.filePath).toBe('./components/myButton.tsx');
    });

    it('produces a valid identifier for a reserved-keyword source name (pascal)', () => {
      const generator = new ComponentGenerator();
      const result = generator.generate(makeFrame('class'), {
        ...baseOptions,
        namingConvention: 'pascal',
      });

      expect(result.name).toBe('ClassComponent');
      expect(result.name).toMatch(VALID_IDENTIFIER);
      expect(result.filePath).toBe('./components/ClassComponent.tsx');
    });

    it('produces a valid identifier for a reserved-keyword source name (camel)', () => {
      const generator = new ComponentGenerator();
      const result = generator.generate(makeFrame('class'), {
        ...baseOptions,
        namingConvention: 'camel',
      });

      expect(result.name).toBe('classComponent');
      expect(result.name).toMatch(VALID_IDENTIFIER);
    });
  });
});
