import {
  SOURCE_TYPES,
  STORAGE_MODES,
  type GithubSourceConfig,
  type LocalFilesSourceConfig,
  type RegisterSourceInput,
  type SourceRegistryErrorCode,
  type SourceType,
  type StorageMode,
} from "../types/source-registry.js";

const MAX_SOURCE_NAME_LENGTH = 120;
const SECRET_KEY_PATTERN = /(^|_)(token|secret|password|private_key|api_key)$/i;

export class SourceRegistryError extends Error {
  readonly code: SourceRegistryErrorCode;

  constructor(code: SourceRegistryErrorCode, message: string) {
    super(message);
    this.name = "SourceRegistryError";
    this.code = code;
  }
}

export function validateRegisterSourceInput(input: unknown): RegisterSourceInput {
  const record = asRecord(input, "INVALID_SOURCE_CONFIG", "Input must be an object.");
  const type = validateSourceType(record.type);
  const name = validateSourceName(record.name);
  const storageMode = validateStorageMode(record.storage_mode);
  const configRecord = asRecord(
    record.config,
    "INVALID_SOURCE_CONFIG",
    "Source config must be an object.",
  );

  rejectSecretLikeKeys(configRecord);

  const config =
    type === "local_files"
      ? validateLocalFilesConfig(configRecord)
      : validateGithubConfig(configRecord);

  return {
    type,
    name,
    config,
    storage_mode: storageMode,
  };
}

function validateSourceType(value: unknown): SourceType {
  if (typeof value !== "string") {
    throw new SourceRegistryError(
      "INVALID_SOURCE_TYPE",
      "Source type must be a string.",
    );
  }

  if (!includesLiteral(SOURCE_TYPES, value)) {
    throw new SourceRegistryError(
      "UNSUPPORTED_SOURCE_TYPE",
      `Source type "${value}" is not supported.`,
    );
  }

  return value;
}

function validateSourceName(value: unknown): string {
  if (typeof value !== "string") {
    throw new SourceRegistryError(
      "INVALID_SOURCE_NAME",
      "Source name must be a string.",
    );
  }

  const name = value.trim();
  if (name.length < 1 || name.length > MAX_SOURCE_NAME_LENGTH) {
    throw new SourceRegistryError(
      "INVALID_SOURCE_NAME",
      `Source name must be between 1 and ${MAX_SOURCE_NAME_LENGTH} characters.`,
    );
  }

  return name;
}

function validateStorageMode(value: unknown): StorageMode {
  if (typeof value !== "string" || !includesLiteral(STORAGE_MODES, value)) {
    throw new SourceRegistryError(
      "INVALID_STORAGE_MODE",
      "Storage mode is invalid.",
    );
  }

  return value;
}

function validateLocalFilesConfig(
  config: Record<string, unknown>,
): LocalFilesSourceConfig {
  const rootPath = requiredNonEmptyString(config.root_path, "root_path");
  const includeGlobs = optionalNonEmptyStringArray(
    config.include_globs,
    "include_globs",
  );
  const excludeGlobs = optionalNonEmptyStringArray(
    config.exclude_globs,
    "exclude_globs",
  );

  return {
    root_path: rootPath,
    ...(includeGlobs ? { include_globs: includeGlobs } : {}),
    ...(excludeGlobs ? { exclude_globs: excludeGlobs } : {}),
  };
}

function validateGithubConfig(config: Record<string, unknown>): GithubSourceConfig {
  const owner = requiredNonEmptyString(config.owner, "owner");
  const repo = requiredNonEmptyString(config.repo, "repo");
  const installationId = optionalNonEmptyString(
    config.installation_id,
    "installation_id",
  );
  const defaultBranch = optionalNonEmptyString(
    config.default_branch,
    "default_branch",
  );

  return {
    owner,
    repo,
    ...(installationId ? { installation_id: installationId } : {}),
    ...(defaultBranch ? { default_branch: defaultBranch } : {}),
  };
}

function asRecord(
  value: unknown,
  code: SourceRegistryErrorCode,
  message: string,
): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new SourceRegistryError(code, message);
  }

  return value as Record<string, unknown>;
}

function requiredNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new SourceRegistryError(
      "INVALID_SOURCE_CONFIG",
      `Source config field "${field}" must be a non-empty string.`,
    );
  }

  return value.trim();
}

function optionalNonEmptyString(value: unknown, field: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  return requiredNonEmptyString(value, field);
}

function optionalNonEmptyStringArray(
  value: unknown,
  field: string,
): string[] | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    throw new SourceRegistryError(
      "INVALID_SOURCE_CONFIG",
      `Source config field "${field}" must be an array of non-empty strings.`,
    );
  }

  return value.map((item) => requiredNonEmptyString(item, field));
}

function rejectSecretLikeKeys(config: Record<string, unknown>): void {
  for (const key of Object.keys(config)) {
    if (SECRET_KEY_PATTERN.test(key)) {
      throw new SourceRegistryError(
        "INVALID_SOURCE_CONFIG",
        `Source config field "${key}" must not contain secrets.`,
      );
    }
  }
}

function includesLiteral<const T extends readonly string[]>(
  values: T,
  value: string,
): value is T[number] {
  return values.includes(value);
}
