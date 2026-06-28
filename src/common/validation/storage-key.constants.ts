
export const STORAGE_KEY_PATTERN = /^(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9][A-Za-z0-9._/-]*$/;

export const STORAGE_KEY_PATTERN_MESSAGE =
  'storageKey must be a relative path of safe characters with no ".." traversal segments.';
