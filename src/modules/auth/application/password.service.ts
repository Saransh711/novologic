import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

/**
 * Wraps password hashing/verification with argon2id (memory-hard), the modern
 * recommended algorithm for password storage. Centralised so the cost
 * parameters live in one place and plaintext never escapes this boundary.
 */
@Injectable()
export class PasswordService {
  private readonly options: argon2.Options = { type: argon2.argon2id };

  hash(plain: string): Promise<string> {
    return argon2.hash(plain, this.options);
  }

  /**
   * Constant-time verification of a plaintext password against a stored hash.
   * Returns false (never throws) on malformed hashes so callers can treat all
   * failures identically and avoid leaking detail.
   */
  async verify(hash: string, plain: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plain, this.options);
    } catch {
      return false;
    }
  }
}
