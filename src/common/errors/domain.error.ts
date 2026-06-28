
export enum DomainErrorCode {
  NotFound = 'NOT_FOUND',
  Conflict = 'CONFLICT',
  InvalidInput = 'BAD_USER_INPUT',
}

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
