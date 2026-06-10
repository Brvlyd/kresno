/**
 * Unit tests for filename collision resolution
 * Task 8.5 / Requirement 6.6
 */

import { resolveFilenameCollision } from '../../lib/figma-import/utils/filename-collision';

describe('resolveFilenameCollision', () => {
  it('returns the original filename when there is no collision', () => {
    const used = new Set<string>();
    expect(resolveFilenameCollision('logo.png', used)).toBe('logo.png');
  });

  it('appends -1 before the extension for the first collision', () => {
    const used = new Set(['logo.png']);
    expect(resolveFilenameCollision('logo.png', used)).toBe('logo-1.png');
  });

  it('increments the suffix for successive collisions', () => {
    const used = new Set(['logo.png', 'logo-1.png', 'logo-2.png']);
    expect(resolveFilenameCollision('logo.png', used)).toBe('logo-3.png');
  });

  it('preserves the file extension when suffixing', () => {
    const used = new Set(['icon.svg']);
    const result = resolveFilenameCollision('icon.svg', used);
    expect(result).toBe('icon-1.svg');
    expect(result.endsWith('.svg')).toBe(true);
  });

  it('handles filenames without an extension', () => {
    const used = new Set(['image']);
    expect(resolveFilenameCollision('image', used)).toBe('image-1');
  });

  it('treats a leading-dot filename as having no extension', () => {
    const used = new Set(['.gitignore']);
    expect(resolveFilenameCollision('.gitignore', used)).toBe('.gitignore-1');
  });

  it('suffixes only the final extension for multi-dot filenames', () => {
    const used = new Set(['archive.tar.gz']);
    expect(resolveFilenameCollision('archive.tar.gz', used)).toBe('archive.tar-1.gz');
  });

  it('does not mutate the provided used-names set', () => {
    const used = new Set(['logo.png']);
    resolveFilenameCollision('logo.png', used);
    expect(used.size).toBe(1);
    expect(used.has('logo-1.png')).toBe(false);
  });

  it('accepts any iterable of used names, not just a Set', () => {
    expect(resolveFilenameCollision('logo.png', ['logo.png', 'logo-1.png'])).toBe('logo-2.png');
  });

  it('produces unique names across a sequence of duplicate base names', () => {
    const used = new Set<string>();
    const results: string[] = [];

    for (let i = 0; i < 5; i++) {
      const name = resolveFilenameCollision('photo.png', used);
      used.add(name);
      results.push(name);
    }

    expect(results).toEqual([
      'photo.png',
      'photo-1.png',
      'photo-2.png',
      'photo-3.png',
      'photo-4.png',
    ]);
    // All names must be unique.
    expect(new Set(results).size).toBe(results.length);
  });

  it('guarantees uniqueness for mixed base names sharing a directory', () => {
    const used = new Set<string>();
    const desired = ['a.png', 'a.png', 'b.png', 'a.png', 'b.png'];
    const results = desired.map((name) => {
      const unique = resolveFilenameCollision(name, used);
      used.add(unique);
      return unique;
    });

    expect(results).toEqual(['a.png', 'a-1.png', 'b.png', 'a-2.png', 'b-1.png']);
    expect(new Set(results).size).toBe(results.length);
  });
});
