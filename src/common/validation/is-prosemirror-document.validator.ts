import { registerDecorator, ValidationArguments, ValidationOptions } from 'class-validator';

/**
 * Minimal structural check that a value is a ProseMirror/Tiptap document: a
 * plain (non-array) object whose `type` is the string `"doc"`. Deep schema
 * validation is intentionally deferred to the editor; this only rejects values
 * that could never render as a workbook.
 */
export function isProseMirrorDocument(value: unknown): boolean {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  return (value as Record<string, unknown>).type === 'doc';
}

export function IsProseMirrorDocument(validationOptions?: ValidationOptions) {
  return function registerOnProperty(object: object, propertyName: string): void {
    registerDecorator({
      name: 'isProseMirrorDocument',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          return isProseMirrorDocument(value);
        },
        defaultMessage(args: ValidationArguments): string {
          return `${args.property} must be a ProseMirror document object with type "doc".`;
        },
      },
    });
  };
}
