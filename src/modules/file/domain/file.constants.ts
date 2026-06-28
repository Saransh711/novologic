/**
 * Maps an accepted IANA media type to the canonical file extension the storage
 * layer appends to a server-generated key. Client-supplied filenames are never
 * trusted for this; the extension is derived solely from the validated type.
 */
const MIME_TYPE_EXTENSIONS: ReadonlyMap<string, string> = new Map([
  ['image/png', 'png'],
  ['image/jpeg', 'jpg'],
  ['image/gif', 'gif'],
  ['image/webp', 'webp'],
  ['application/pdf', 'pdf'],
]);

/**
 * Resolves a safe file extension for the given media type. Falls back to a
 * sanitized subtype for allowlisted types without an explicit mapping, and to
 * `bin` when no safe extension can be derived.
 */
export function extensionForMimeType(mimeType: string): string {
  const normalized = mimeType.trim().toLowerCase();
  const mapped = MIME_TYPE_EXTENSIONS.get(normalized);
  if (mapped) {
    return mapped;
  }

  const subtype = normalized.split('/')[1] ?? '';
  const sanitized = subtype.replace(/[^a-z0-9]/g, '');
  return sanitized.length > 0 ? sanitized : 'bin';
}
