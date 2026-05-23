import { randomUUID } from "node:crypto";

import type { Database } from "better-sqlite3";

import type { SourceRegistryAuditEvent } from "../types/source-registry.js";

const SECRET_METADATA_KEY_PATTERN =
  /(^|_)(token|secret|password|private_key|api_key|config)$/i;

export interface SourceAuditRecord extends SourceRegistryAuditEvent {
  id: string;
}

export interface SourceAuditStore {
  recordAuditEvent(event: SourceRegistryAuditEvent): Promise<void>;
  listAuditEvents(): Promise<SourceAuditRecord[]>;
}

export class SQLiteSourceAuditStore implements SourceAuditStore {
  constructor(private readonly database: Database) {}

  async recordAuditEvent(event: SourceRegistryAuditEvent): Promise<void> {
    insertAuditEvent(this.database, event);
  }

  async listAuditEvents(): Promise<SourceAuditRecord[]> {
    const rows = this.database
      .prepare(
        `SELECT
          id,
          event_type AS eventType,
          account_id AS accountId,
          actor_id AS actorId,
          source_id AS sourceId,
          source_type AS sourceType,
          storage_mode AS storageMode,
          result,
          error_code AS errorCode,
          metadata_json AS metadataJson,
          created_at AS createdAt
        FROM source_audit_events
        ORDER BY created_at ASC, id ASC`,
      )
      .all() as AuditEventRow[];

    return rows.map(rowToAuditRecord);
  }
}

export function insertAuditEvent(
  database: Database,
  event: SourceRegistryAuditEvent,
): void {
  const metadata = sanitizeAuditMetadata(event.metadata ?? {});

  database
    .prepare(
      `INSERT INTO source_audit_events (
        id,
        event_type,
        account_id,
        actor_id,
        source_id,
        source_type,
        storage_mode,
        result,
        error_code,
        metadata_json,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      `aud_${randomUUID()}`,
      event.eventType,
      event.accountId ?? null,
      event.actorId ?? null,
      event.sourceId ?? null,
      event.sourceType ?? null,
      event.storageMode ?? null,
      event.result,
      event.errorCode ?? null,
      JSON.stringify(metadata),
      event.createdAt,
    );
}

export function sanitizeAuditMetadata(
  metadata: Record<string, unknown>,
): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(metadata)) {
    if (SECRET_METADATA_KEY_PATTERN.test(key)) {
      continue;
    }

    if (isPlainObject(value)) {
      sanitized[key] = sanitizeAuditMetadata(value);
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map((item) =>
        isPlainObject(item) ? sanitizeAuditMetadata(item) : item,
      );
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

function rowToAuditRecord(row: AuditEventRow): SourceAuditRecord {
  return {
    id: row.id,
    eventType: row.eventType,
    result: row.result,
    createdAt: row.createdAt,
    ...(row.accountId ? { accountId: row.accountId } : {}),
    ...(row.actorId ? { actorId: row.actorId } : {}),
    ...(row.sourceId ? { sourceId: row.sourceId } : {}),
    ...(row.sourceType ? { sourceType: row.sourceType } : {}),
    ...(row.storageMode ? { storageMode: row.storageMode } : {}),
    ...(row.errorCode ? { errorCode: row.errorCode } : {}),
    metadata: JSON.parse(row.metadataJson) as Record<string, unknown>,
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

interface AuditEventRow {
  id: string;
  eventType: SourceRegistryAuditEvent["eventType"];
  accountId: string | null;
  actorId: string | null;
  sourceId: string | null;
  sourceType: string | null;
  storageMode: string | null;
  result: SourceRegistryAuditEvent["result"];
  errorCode: SourceRegistryAuditEvent["errorCode"] | null;
  metadataJson: string;
  createdAt: string;
}

