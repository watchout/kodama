import Database from "better-sqlite3";

import {
  SourceAuditPersistenceError,
  SourceIdCollisionError,
  type DurableAuditSourceStore,
  type SourceListFilter,
} from "./source-store.js";
import { insertAuditEvent } from "./source-audit-store.js";
import { migrateSourceStorage } from "../services/source-store-migrations.js";
import type {
  SourceConfig,
  SourceRecord,
  SourceRegistryAuditEvent,
  SourceType,
  SourceVisibility,
  StorageMode,
} from "../types/source-registry.js";

export class SQLiteSourceStore implements DurableAuditSourceStore {
  readonly database: Database.Database;

  constructor(databasePath: string) {
    this.database = new Database(databasePath);
    migrateSourceStorage(this.database);
  }

  close(): void {
    this.database.close();
  }

  async createSource(record: SourceRecord): Promise<void> {
    try {
      insertSource(this.database, record);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new SourceIdCollisionError(record.id);
      }

      throw error;
    }
  }

  async createSourceWithAudit(
    record: SourceRecord,
    auditEvent: SourceRegistryAuditEvent,
  ): Promise<void> {
    try {
      const create = this.database.transaction(() => {
        insertSource(this.database, record);
        insertAuditEvent(this.database, auditEvent);
      });

      create();
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new SourceIdCollisionError(record.id);
      }

      if (error instanceof SourceIdCollisionError) {
        throw error;
      }

      throw new SourceAuditPersistenceError(
        error instanceof Error ? error.message : "Source audit insert failed.",
      );
    }
  }

  async recordAuditEvent(event: SourceRegistryAuditEvent): Promise<void> {
    insertAuditEvent(this.database, event);
  }

  async getSource(sourceId: string): Promise<SourceRecord | null> {
    const row = this.database
      .prepare(
        `SELECT
          id,
          account_id AS accountId,
          owner_id AS ownerId,
          workspace_id AS workspaceId,
          scope_view_id AS scopeViewId,
          visibility,
          type,
          name,
          config_json AS configJson,
          storage_mode AS storageMode,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM sources
        WHERE id = ?`,
      )
      .get(sourceId) as SourceRow | undefined;

    return row ? rowToSourceRecord(row) : null;
  }

  async listSources(filter: SourceListFilter = {}): Promise<SourceRecord[]> {
    const clauses: string[] = [];
    const params: string[] = [];

    if (filter.accountId) {
      clauses.push("account_id = ?");
      params.push(filter.accountId);
    }

    if (filter.sourceType) {
      clauses.push("type = ?");
      params.push(filter.sourceType);
    }

    if (filter.visibility) {
      clauses.push("visibility = ?");
      params.push(filter.visibility);
    }

    const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
    const rows = this.database
      .prepare(
        `SELECT
          id,
          account_id AS accountId,
          owner_id AS ownerId,
          workspace_id AS workspaceId,
          scope_view_id AS scopeViewId,
          visibility,
          type,
          name,
          config_json AS configJson,
          storage_mode AS storageMode,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM sources
        ${where}
        ORDER BY created_at ASC, id ASC`,
      )
      .all(...params) as SourceRow[];

    return rows.map(rowToSourceRecord);
  }
}

function insertSource(database: Database.Database, record: SourceRecord): void {
  database
    .prepare(
      `INSERT INTO sources (
        id,
        account_id,
        owner_id,
        workspace_id,
        scope_view_id,
        visibility,
        type,
        name,
        config_json,
        storage_mode,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      record.id,
      record.accountId,
      record.ownerId ?? null,
      record.workspaceId ?? null,
      record.scopeViewId ?? null,
      record.visibility,
      record.type,
      record.name,
      JSON.stringify(record.config),
      record.storageMode,
      record.createdAt,
      record.updatedAt,
    );
}

function rowToSourceRecord(row: SourceRow): SourceRecord {
  return {
    id: row.id,
    accountId: row.accountId,
    ...(row.ownerId ? { ownerId: row.ownerId } : {}),
    ...(row.workspaceId ? { workspaceId: row.workspaceId } : {}),
    ...(row.scopeViewId ? { scopeViewId: row.scopeViewId } : {}),
    visibility: row.visibility,
    type: row.type,
    name: row.name,
    config: JSON.parse(row.configJson) as SourceConfig,
    storageMode: row.storageMode,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as { code?: unknown }).code === "SQLITE_CONSTRAINT_PRIMARYKEY"
  );
}

interface SourceRow {
  id: string;
  accountId: string;
  ownerId: string | null;
  workspaceId: string | null;
  scopeViewId: string | null;
  visibility: SourceVisibility;
  type: SourceType;
  name: string;
  configJson: string;
  storageMode: StorageMode;
  createdAt: string;
  updatedAt: string;
}

