/**
 * Tests for name sanitization utilities
 */

import {
  sanitizeComponentName,
  sanitizeFileName,
  generateAssetFilename,
  toKebabCase,
  toCamelCase,
  isReservedKeyword,
} from '@/lib/figma-import/utils';

describe('Name Sanitizer', () => {
  describe('sanitizeComponentName', () => {
    it('should convert spaces to PascalCase', () => {
      expect(sanitizeComponentName('my component')).toBe('MyComponent');
      expect(sanitizeComponentName('button primary')).toBe('ButtonPrimary');
    });

    it('should handle hyphens and underscores', () => {
      expect(sanitizeComponentName('my-component')).toBe('MyComponent');
      expect(sanitizeComponentName('my_component')).toBe('MyComponent');
      expect(sanitizeComponentName('my-cool_component')).toBe('MyCoolComponent');
    });

    it('should remove special characters', () => {
      expect(sanitizeComponentName('my@component#123')).toBe('Mycomponent123');
      expect(sanitizeComponentName('button (primary)')).toBe('ButtonPrimary');
    });

    it('should handle names starting with numbers', () => {
      expect(sanitizeComponentName('123 button')).toBe('Component123Button');
      expect(sanitizeComponentName('2xl button')).toBe('Component2xlButton');
    });

    it('should return default for empty names', () => {
      expect(sanitizeComponentName('')).toBe('UnnamedComponent');
      expect(sanitizeComponentName('   ')).toBe('UnnamedComponent');
      expect(sanitizeComponentName('###')).toBe('UnnamedComponent');
    });

    it('should preserve existing PascalCase/camelCase word boundaries', () => {
      // Previously this lowercased the interior of an already-PascalCase single
      // word (e.g. "MyButton" -> "Mybutton"). The boundary must be preserved.
      expect(sanitizeComponentName('MyButton')).toBe('MyButton');
      expect(sanitizeComponentName('myButton')).toBe('MyButton');
      expect(sanitizeComponentName('my button')).toBe('MyButton');
      expect(sanitizeComponentName('my-button')).toBe('MyButton');
      expect(sanitizeComponentName('IconButtonPrimary')).toBe('IconButtonPrimary');
    });

    it('should adjust reserved keywords to valid identifiers', () => {
      // isReservedKeyword is case-insensitive, so "Class" is treated as reserved.
      expect(sanitizeComponentName('class')).toBe('ClassComponent');
      expect(sanitizeComponentName('function')).toBe('FunctionComponent');
      expect(sanitizeComponentName('import')).toBe('ImportComponent');
    });
  });

  describe('sanitizeFileName', () => {
    it('should convert to lowercase with hyphens', () => {
      expect(sanitizeFileName('My Component')).toBe('my-component');
      expect(sanitizeFileName('Button Primary')).toBe('button-primary');
    });

    it('should handle underscores', () => {
      expect(sanitizeFileName('my_component')).toBe('my-component');
      expect(sanitizeFileName('my__component')).toBe('my-component');
    });

    it('should remove special characters', () => {
      expect(sanitizeFileName('my@component#123')).toBe('mycomponent123');
      expect(sanitizeFileName('button (icon)')).toBe('button-icon');
    });

    it('should handle multiple consecutive spaces', () => {
      expect(sanitizeFileName('my   component')).toBe('my-component');
    });

    it('should return default for empty names', () => {
      expect(sanitizeFileName('')).toBe('unnamed');
      expect(sanitizeFileName('   ')).toBe('unnamed');
    });
  });

  describe('generateAssetFilename', () => {
    it('should append the format as an extension', () => {
      expect(generateAssetFilename('My Image', 'png')).toBe('my-image.png');
      expect(generateAssetFilename('My Image', 'jpg')).toBe('my-image.jpg');
      expect(generateAssetFilename('My Image', 'svg')).toBe('my-image.svg');
    });

    it('should lowercase and collapse separators', () => {
      expect(generateAssetFilename('My   Cool_Asset', 'png')).toBe('my-cool-asset.png');
      expect(generateAssetFilename('My---Asset', 'png')).toBe('my-asset.png');
    });

    it('should strip filesystem-reserved characters (< > : " / \\ | ? *)', () => {
      expect(generateAssetFilename('a<b>c:d"e/f\\g|h?i*j', 'png')).toBe('abcdefghij.png');
    });

    it('should fall back to "unnamed" when nothing remains', () => {
      expect(generateAssetFilename('', 'png')).toBe('unnamed.png');
      expect(generateAssetFilename('!@#$%^&*()', 'png')).toBe('unnamed.png');
    });

    it('should normalize a malformed format', () => {
      expect(generateAssetFilename('My Image', '.PNG')).toBe('my-image.png');
      expect(generateAssetFilename('My Image', '')).toBe('my-image');
    });

    it('should never contain reserved characters in the output', () => {
      const result = generateAssetFilename('Folder/Sub:Name?<>', 'png');
      expect(result).not.toMatch(/[<>:"/\\|?*]/);
      expect(result).toBe('foldersubname.png');
    });
  });

  describe('toKebabCase', () => {
    it('should convert PascalCase to kebab-case', () => {
      expect(toKebabCase('MyComponent')).toBe('my-component');
      expect(toKebabCase('ButtonPrimary')).toBe('button-primary');
    });

    it('should handle spaces', () => {
      expect(toKebabCase('my component')).toBe('my-component');
    });

    it('should remove special characters', () => {
      expect(toKebabCase('my@component')).toBe('mycomponent');
    });
  });

  describe('toCamelCase', () => {
    it('should convert to camelCase', () => {
      expect(toCamelCase('my component')).toBe('myComponent');
      expect(toCamelCase('button primary')).toBe('buttonPrimary');
    });

    it('should handle PascalCase input', () => {
      expect(toCamelCase('MyComponent')).toBe('myComponent');
    });

    it('should handle kebab-case input', () => {
      expect(toCamelCase('my-component')).toBe('myComponent');
    });

    it('should return default for empty names', () => {
      expect(toCamelCase('')).toBe('unnamed');
    });

    it('should preserve existing case boundaries', () => {
      expect(toCamelCase('MyButton')).toBe('myButton');
      expect(toCamelCase('my button')).toBe('myButton');
      expect(toCamelCase('my-button')).toBe('myButton');
    });

    it('should adjust reserved keywords to valid identifiers', () => {
      expect(toCamelCase('class')).toBe('classComponent');
      expect(toCamelCase('function')).toBe('functionComponent');
    });
  });

  describe('isReservedKeyword', () => {
    it('should identify JavaScript reserved keywords', () => {
      expect(isReservedKeyword('class')).toBe(true);
      expect(isReservedKeyword('function')).toBe(true);
      expect(isReservedKeyword('import')).toBe(true);
      expect(isReservedKeyword('export')).toBe(true);
      expect(isReservedKeyword('const')).toBe(true);
    });

    it('should return false for non-reserved words', () => {
      expect(isReservedKeyword('button')).toBe(false);
      expect(isReservedKeyword('component')).toBe(false);
      expect(isReservedKeyword('myFunction')).toBe(false);
    });

    it('should be case-insensitive', () => {
      expect(isReservedKeyword('Class')).toBe(true);
      expect(isReservedKeyword('FUNCTION')).toBe(true);
    });
  });
});
