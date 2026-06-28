/** A binary to persist, together with the extension for its server-generated key. */
export interface StoredBinary {
  readonly content: Buffer;
  readonly extension: string;
}

/**
 * Abstraction over the binary store backing uploaded files. Used as the DI
 * token so the application layer depends on this contract, not a concrete
 * backend (local FS today, object storage later).
 */
export abstract class FileStorage {
  /**
   * Persists a binary under a freshly generated, server-controlled storage key
   * and returns that key. The caller never influences the storage path.
   */
  abstract save(binary: StoredBinary): Promise<string>;

  /** Whether a binary exists for the given server-generated storage key. */
  abstract exists(storageKey: string): Promise<boolean>;

  /** Removes the binary if present; a missing binary is treated as success. */
  abstract remove(storageKey: string): Promise<void>;
}
