export const SOURCE_TYPES = ["local_files", "github"] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

export const STORAGE_MODES = ["copy", "index", "reference", "ephemeral"] as const;
export type StorageMode = (typeof STORAGE_MODES)[number];

export type SourceRegistryErrorCode =
  | "INVALID_SOURCE_TYPE"
  | "UNSUPPORTED_SOURCE_TYPE"
  | "INVALID_SOURCE_NAME"
  | "INVALID_STORAGE_MODE"
  | "INVALID_SOURCE_CONFIG"
  | "SOURCE_REGISTRY_UNAVAILABLE";

export interface LocalFilesSourceConfig {
  root_path: string;
  include_globs?: string[];
  exclude_globs?: string[];
}

export interface GithubSourceConfig {
  owner: string;
  repo: string;
  installation_id?: string;
  default_branch?: string;
}

export type SourceConfig = LocalFilesSourceConfig | GithubSourceConfig;

export interface RegisterSourceInput {
  type: SourceType;
  name: string;
  config: SourceConfig;
  storage_mode: StorageMode;
}

export interface RegisterSourceOutput {
  source_id: string;
  status: "registered";
}

export interface SourceRecord {
  id: string;
  type: SourceType;
  name: string;
  config: SourceConfig;
  storageMode: StorageMode;
  createdAt: string;
  updatedAt: string;
}

export interface RegistrationContext {
  actorId?: string;
}

export interface SourceRegistryAuditEvent {
  eventType: "source.registered" | "source.registration_failed";
  result: "success" | "failure";
  sourceId?: string;
  actorId?: string;
  sourceType?: string;
  storageMode?: string;
  errorCode?: SourceRegistryErrorCode;
  createdAt: string;
}

export type SourceRegistryAuditSink = (
  event: SourceRegistryAuditEvent,
) => void | Promise<void>;
