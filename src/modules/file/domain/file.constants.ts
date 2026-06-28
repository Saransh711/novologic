
const MIME_TYPE_EXTENSIONS: ReadonlyMap<string, string> = new Map([
  ['image/png', 'png'],
  ['image/jpeg', 'jpg'],
  ['image/gif', 'gif'],
  ['image/webp', 'webp'],
  ['application/pdf', 'pdf'],
]);


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
