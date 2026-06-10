/**
 * Utility functions for sanitizing names from Figma
 * Converts Figma node names to valid JavaScript/TypeScript identifiers
 */

/**
 * Splits a name into individual words while preserving word boundaries that are
 * already encoded in the casing of the input.
 *
 * Boundaries are detected from:
 * - explicit separators: whitespace, hyphens, underscores
 * - case transitions: a lowercase/digit followed by an uppercase letter
 *   (e.g. "myButton" -> ["my", "Button"])
 * - acronym-to-word transitions: a run of uppercase letters followed by an
 *   uppercase + lowercase pair (e.g. "XMLParser" -> ["XML", "Parser"])
 *
 * This is what keeps an already-PascalCase/camelCase name like "MyButton" from
 * being collapsed into a single word ("Mybutton"). Invalid identifier
 * characters are stripped first.
 */
function splitWords(name: string): string[] {
  return name
    .replace(/[^a-zA-Z0-9\s\-_]/g, '')
    // Insert a boundary between a lowercase letter/digit and an uppercase letter.
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    // Insert a boundary between an acronym run and a following capitalized word.
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(/[\s\-_]+/)
    .filter(Boolean);
}

/**
 * Sanitizes a Figma node name to be a valid component name (PascalCase).
 *
 * The name is split into words (respecting existing case boundaries so that an
 * already-PascalCase/camelCase name such as "MyButton" is preserved rather than
 * collapsed to "Mybutton"), then each word is capitalized. The result is
 * guaranteed to be a valid JavaScript identifier:
 * - invalid characters are removed
 * - names starting with a digit are prefixed with "Component"
 * - reserved keywords are suffixed with "Component" so the generated code
 *   compiles (note: {@link isReservedKeyword} is case-insensitive, so even
 *   "Class" is treated as reserved and becomes "ClassComponent")
 */
export function sanitizeComponentName(name: string): string {
  // Split into words while preserving existing case boundaries.
  const parts = splitWords(name);

  // Convert to PascalCase, capitalizing the first letter of each word and
  // preserving the remaining characters (so acronyms / inner capitals survive).
  let pascalCase = parts
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');

  // If empty after sanitization, return default
  if (!pascalCase) {
    return 'UnnamedComponent';
  }

  // Ensure it does not start with a digit (prepend 'Component' if it does).
  if (/^\d/.test(pascalCase)) {
    pascalCase = 'Component' + pascalCase;
  }

  // Ensure the identifier is not a reserved keyword.
  if (isReservedKeyword(pascalCase)) {
    pascalCase = pascalCase + 'Component';
  }

  return pascalCase;
}

/**
 * Sanitizes a filename for file system use
 * Converts to lowercase with hyphens, removes special characters.
 *
 * The output only contains lowercase letters, digits, and hyphens, which means
 * all filesystem-reserved characters (< > : " / \ | ? *) are stripped, ensuring
 * the result is a valid filename on Windows, macOS, and Linux.
 */
export function sanitizeFileName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s\-_]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    || 'unnamed';
}

/**
 * Generates a valid, descriptive asset filename from a Figma node name.
 *
 * The base name is sanitized via {@link sanitizeFileName} (lowercase, spaces and
 * underscores collapsed to hyphens, special/reserved characters removed, repeated
 * separators collapsed, and a sensible fallback for empty results) and the given
 * format is appended as a normalized extension.
 *
 * Requirement 6.4: Generate descriptive filenames based on node names.
 *
 * @param nodeName - The original Figma node name.
 * @param format - The image format/extension (e.g. "png", "jpg", "svg").
 * @returns A filesystem-safe filename such as "my-image.png".
 */
export function generateAssetFilename(nodeName: string, format: string): string {
  const base = sanitizeFileName(nodeName);

  // Normalize the extension: lowercase and strip anything that is not
  // alphanumeric so a malformed format cannot reintroduce invalid characters.
  const ext = (format ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

  return ext ? `${base}.${ext}` : base;
}

/**
 * Converts a name to kebab-case
 */
export function toKebabCase(name: string): string {
  return name
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase()
    .replace(/[^a-z0-9\-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Converts a name to camelCase.
 *
 * Uses the same word-splitting as {@link sanitizeComponentName} so existing case
 * boundaries are preserved (e.g. "MyButton" -> "myButton"). The result is kept a
 * valid JavaScript identifier: a leading digit is prefixed with "component" and
 * reserved keywords are suffixed with "Component".
 */
export function toCamelCase(name: string): string {
  const parts = splitWords(name);

  if (parts.length === 0) return 'unnamed';

  let camel = parts
    .map((part, index) =>
      index === 0
        ? part.charAt(0).toLowerCase() + part.slice(1)
        : part.charAt(0).toUpperCase() + part.slice(1)
    )
    .join('');

  // Ensure it does not start with a digit.
  if (/^\d/.test(camel)) {
    camel = 'component' + camel;
  }

  // Ensure the identifier is not a reserved keyword.
  if (isReservedKeyword(camel)) {
    camel = camel + 'Component';
  }

  return camel;
}

/**
 * Checks if a name is a reserved JavaScript keyword
 */
export function isReservedKeyword(name: string): boolean {
  const reserved = [
    'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger',
    'default', 'delete', 'do', 'else', 'export', 'extends', 'finally',
    'for', 'function', 'if', 'import', 'in', 'instanceof', 'new',
    'return', 'super', 'switch', 'this', 'throw', 'try', 'typeof',
    'var', 'void', 'while', 'with', 'yield', 'let', 'static',
    'enum', 'await', 'implements', 'interface', 'package', 'private',
    'protected', 'public',
  ];

  return reserved.includes(name.toLowerCase());
}
