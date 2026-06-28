/**
 * Stable machine-readable codes surfaced to GraphQL clients via
 * `error.extensions.code`. They form part of the public API contract, so treat
 * renames as breaking changes.
 */
export enum DomainErrorCode {
  NotFound = 'NOT_FOUND',
  Conflict = 'CONFLICT',
  InvalidInput = 'BAD_USER_INPUT',
}

/**
 * Framework-agnostic base for expected, client-facing failures. Thrown by the
 * application layer and translated to GraphQL errors at the interface boundary.
 */
export abstract class DomainError extends Error {
  abstract readonly code: DomainErrorCode;

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class ResourceNotFoundError extends DomainError {
  readonly code = DomainErrorCode.NotFound;
}

export class ResourceConflictError extends DomainError {
  readonly code = DomainErrorCode.Conflict;
}

export class InvalidInputError extends DomainError {
  readonly code = DomainErrorCode.InvalidInput;
}
