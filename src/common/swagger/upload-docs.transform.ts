import type { OpenAPIObject } from '@nestjs/swagger';


type PathItemObject = NonNullable<OpenAPIObject['paths']>[string];
type OperationObject = NonNullable<PathItemObject['post']>;
type RequestBodyObject = Exclude<NonNullable<OperationObject['requestBody']>, { $ref: string }>;
type SchemaObject = Exclude<
  NonNullable<NonNullable<RequestBodyObject['content'][string]>['schema']>,
  { $ref: string }
>;

const HTTP_METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'] as const;

const BYTES_PER_MEBIBYTE = 1024 * 1024;
const MULTIPART_MEDIA_TYPE = 'multipart/form-data';
const FILE_FIELD = 'file';

export interface UploadConstraints {
  readonly allowedMimeTypes: readonly string[];
  readonly maxUploadSizeBytes: number;
}


export function applyUploadConstraintsToDocument(
  document: OpenAPIObject,
  operationId: string,
  constraints: UploadConstraints,
): void {
  const operation = findOperationById(document, operationId);
  if (!operation) {
    return;
  }

  const allowedTypesText =
    constraints.allowedMimeTypes.map((type) => `\`${type}\``).join(', ') || '_none configured_';
  const sizeText = formatByteSize(constraints.maxUploadSizeBytes);

  const constraintsSection = [
    `**Allowed MIME types:** ${allowedTypesText}.`,
    `**Maximum size:** ${sizeText}.`,
  ].join('\n');
  operation.description =
    `${(operation.description ?? '').trimEnd()}\n\n${constraintsSection}`.trim();

  const fileSchema = getFileSchema(operation);
  if (fileSchema) {
    const inlineConstraint = `Must be one of the allowed MIME types (${allowedTypesText}) and at most ${sizeText}.`;
    fileSchema.description = `${(fileSchema.description ?? '').trim()} ${inlineConstraint}`.trim();
  }
}

function findOperationById(
  document: OpenAPIObject,
  operationId: string,
): OperationObject | undefined {
  for (const pathItem of Object.values(document.paths ?? {})) {
    if (!pathItem) {
      continue;
    }
    for (const method of HTTP_METHODS) {
      const operation = pathItem[method];
      if (operation?.operationId === operationId) {
        return operation;
      }
    }
  }
  return undefined;
}

function getFileSchema(operation: OperationObject): SchemaObject | undefined {
  const requestBody = operation.requestBody;
  if (!requestBody || '$ref' in requestBody) {
    return undefined;
  }

  const schema = requestBody.content?.[MULTIPART_MEDIA_TYPE]?.schema;
  if (!schema || '$ref' in schema) {
    return undefined;
  }

  const fileProperty = schema.properties?.[FILE_FIELD];
  if (!fileProperty || '$ref' in fileProperty) {
    return undefined;
  }
  return fileProperty;
}

function formatByteSize(bytes: number): string {
  const mebibytes = bytes / BYTES_PER_MEBIBYTE;
  const rounded = Number.isInteger(mebibytes) ? mebibytes.toString() : mebibytes.toFixed(2);
  return `${rounded} MiB (${bytes.toLocaleString('en-US')} bytes)`;
}
