/** A binary to persist, together with the extension for its server-generated key. */
export interface StoredBinary {
  readonly content: Buffer;
  readonly extension: string;
}

export abstract class FileStorage {

  abstract save(binary: StoredBinary): Promise<string>;


  abstract exists(storageKey: string): Promise<boolean>;


  abstract remove(storageKey: string): Promise<void>;
}
