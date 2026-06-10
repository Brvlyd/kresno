/**
 * Filename collision resolution
 * Task 8.5 / Property 21: Filename Collision Resolution
 * Requirement 6.6: Handle duplicate image names by appending numeric suffixes
 *
 * Self-contained, pure helper with no dependency on AssetDownloader scaffolding.
 * Given a desired filename and a collection of already-used names, returns a
 * unique filename by appending numeric suffixes (-1, -2, -3, ...) before the
 * file extension until the name is unique.
 */

/**
 * Resolve a filename collision by appending numeric suffixes before the extension.
 *
 * - If `desiredFilename` is not present in `usedNames`, it is returned unchanged.
 * - Otherwise, suffixes `-1`, `-2`, `-3`, ... are appended to the base name
 *   (preserving the file extension) until a name not present in `usedNames`
 *   is found.
 *
 * The file extension is determined by the last dot in the filename. A leading
 * dot (e.g. dotfiles like `.gitignore`) is treated as part of the base name, so
 * the whole string is suffixed rather than splitting on the leading dot.
 *
 * This function is pure: it does not mutate `usedNames`. Callers are responsible
 * for adding the returned name to their used-name collection to guarantee
 * uniqueness across multiple assets.
 *
 * @param desiredFilename The preferred filename (e.g. "logo.png").
 * @param usedNames A collection of filenames already in use.
 * @returns A unique filename not present in `usedNames`.
 */
export function resolveFilenameCollision(
  desiredFilename: string,
  usedNames: ReadonlySet<string> | Iterable<string>
): string {
  const used =
    usedNames instanceof Set
      ? (usedNames as ReadonlySet<string>)
      : new Set<string>(usedNames);

  if (!used.has(desiredFilename)) {
    return desiredFilename;
  }

  const { base, ext } = splitExtension(desiredFilename);

  let counter = 1;
  let candidate = `${base}-${counter}${ext}`;
  while (used.has(candidate)) {
    counter++;
    candidate = `${base}-${counter}${ext}`;
  }

  return candidate;
}

/**
 * Split a filename into its base name and extension (including the leading dot).
 * A leading-dot filename (e.g. ".gitignore") is treated as having no extension.
 */
function splitExtension(filename: string): { base: string; ext: string } {
  const lastDotIndex = filename.lastIndexOf('.');

  // No dot, or leading dot only (dotfile) => treat entire string as base name.
  if (lastDotIndex <= 0) {
    return { base: filename, ext: '' };
  }

  return {
    base: filename.slice(0, lastDotIndex),
    ext: filename.slice(lastDotIndex),
  };
}
