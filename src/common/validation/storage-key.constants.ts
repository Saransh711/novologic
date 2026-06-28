/**
 * Allowed shape for a server-generated storage key: a relative, slash-delimited
 * path of safe characters that cannot begin with a slash and cannot contain a
 * `..` traversal segment. The storage layer additionally confines the resolved
 * path to the uploads root as defence-in-depth.
 */
export const STORAGE_KEY_PATTERN = /^(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9][A-Za-z0-9._/-]*$/;

export const STORAGE_KEY_PATTERN_MESSAGE =
  'storageKey must be a relative path of safe characters with no ".." traversal segments.';
