/**
 * Abstraction over the binary store backing uploaded files. Used as the DI
 * token so the application layer depends on this contract, not a concrete
 * backend (local FS today, object storage later).
 */
export abstract class FileStorage {
  /** Whether a binary exists for the given server-generated storage key. */
  abstract exists(storageKey: string): Promise<boolean>;

  /** Removes the binary if present; a missing binary is treated as success. */
  abstract remove(storageKey: string): Promise<void>;
}
