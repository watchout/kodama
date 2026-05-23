import type { Database } from "better-sqlite3";

const SOURCE_STORAGE_SCHEMA_VERSION = 1;

export function migrateSourceStorage(database: Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  const applied = database
    .prepare("SELECT version FROM schema_migrations WHERE version = ?")
    .get(SOURCE_STORAGE_SCHEMA_VERSION);

  if (applied) {
    return;
  }

  const applyMigration = database.transaction(() => {
    database.exec(`
      CREATE TABLE IF NOT EXISTS sources (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        owner_id TEXT,
        workspace_id TEXT,
        scope_view_id TEXT,
        visibility TEXT NOT NULL,
        type TEXT NOT NULL,
        name TEXT NOT NULL,
        config_json TEXT NOT NULL,
        storage_mode TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_sources_account_id ON sources(account_id);
      CREATE INDEX IF NOT EXISTS idx_sources_type ON sources(type);

      CREATE TABLE IF NOT EXISTS source_audit_events (
        id TEXT PRIMARY KEY,
        event_type TEXT NOT NULL,
        account_id TEXT,
        actor_id TEXT,
        source_id TEXT,
        source_type TEXT,
        storage_mode TEXT,
        result TEXT NOT NULL,
        error_code TEXT,
        metadata_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_source_audit_account_id
        ON source_audit_events(account_id);
      CREATE INDEX IF NOT EXISTS idx_source_audit_source_id
        ON source_audit_events(source_id);
    `);

    database
      .prepare(
        "INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)",
      )
      .run(SOURCE_STORAGE_SCHEMA_VERSION, new Date().toISOString());
  });

  applyMigration();
}

