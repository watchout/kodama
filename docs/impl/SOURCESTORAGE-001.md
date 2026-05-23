---
id: IMPL-SOURCESTORAGE-001-001
status: Draft
traces:
  spec: [SPEC-SOURCESTORAGE-001-001]
  verify: [VERIFY-SOURCESTORAGE-001-001]
  ops: [OPS-SOURCESTORAGE-001-001]
---

# IMPL: Source Storage

## 0. 対応するSPEC
- SPEC: `SPEC-SOURCESTORAGE-001-001`
- Feature: `SOURCESTORAGE-001`

## 1. 配置図
### 1.1 新規ファイル
| path | purpose |
|---|---|
| `src/adapters/sqlite-source-store.ts` | SQLite-backed SourceStore implementation |
| `src/adapters/source-audit-store.ts` | Durable audit store interface and SQLite implementation |
| `src/services/source-store-migrations.ts` | Migration runner for source storage tables |
| `tests/source-storage.test.ts` | SQLite persistence and audit tests |

### 1.2 変更ファイル
| path | change |
|---|---|
| `src/adapters/source-store.ts` | Extend interface with get/list operations and ownership metadata support |
| `src/types/source-registry.ts` | Add account/workspace/scope/visibility fields to source records and context |
| `src/services/source-registry-service.ts` | Pass ownership metadata into SourceRecord and durable audit event |

## 2. 型定義
```ts
type SourceVisibility = "private" | "account" | "restricted";

interface SourceOwnership {
  accountId: string;
  ownerId?: string;
  workspaceId?: string;
  scopeViewId?: string;
  visibility: SourceVisibility;
}

interface SourceListFilter {
  accountId?: string;
  sourceType?: SourceType;
  visibility?: SourceVisibility;
}
```

## 3. SQLite schema
```sql
CREATE TABLE schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL
);

CREATE TABLE sources (
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

CREATE INDEX idx_sources_account_id ON sources(account_id);
CREATE INDEX idx_sources_type ON sources(type);

CREATE TABLE source_audit_events (
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

CREATE INDEX idx_source_audit_account_id ON source_audit_events(account_id);
CREATE INDEX idx_source_audit_source_id ON source_audit_events(source_id);
```

## 4. Transaction model
Successful source registration uses one SQLite transaction:

```text
BEGIN
  INSERT INTO sources
  INSERT INTO source_audit_events(event_type = source.registered)
COMMIT
```

If the success audit insert fails, the transaction rolls back and the service returns `SOURCE_REGISTRY_UNAVAILABLE`. The implementation must not allow a committed source row without its success audit event.

Validation failure uses a separate durable audit insert when SQLite is available:

```text
INSERT INTO source_audit_events(event_type = source.registration_failed)
```

If SQLite cannot open, durable audit is impossible. The service returns the structured error and invokes the configured audit-error boundary. It must not fall back to production in-memory storage.

Store failure after SQLite has opened rolls back the source transaction and attempts a separate failure audit insert. If that audit insert fails, the service still returns the original structured error and invokes the audit-error boundary.

Audit metadata is produced through a sanitizer. It may include source type, storage mode, account id, actor id, failure phase, and error code. It must not include raw `config_json` or secret-like key/value pairs.

## 5. 実装順序
1. Extend Source types with account ownership fields while preserving existing tests through default local account behavior.
2. Extend `SourceStore` with read/list methods.
3. Add migration runner.
4. Add SQLite source store.
5. Add durable source audit store.
6. Add transaction-backed source plus success-audit commit path.
7. Add validation/store failure durable audit paths and audit metadata sanitizer.
8. Keep MCP runtime behavior unchanged except durable store can be selected by construction.

## 6. エラー処理
| condition | behavior |
|---|---|
| SQLite open fails | throw store error mapped to `SOURCE_REGISTRY_UNAVAILABLE` |
| source insert succeeds but success audit insert fails | roll back transaction and return `SOURCE_REGISTRY_UNAVAILABLE` |
| validation fails and DB is available | write durable failure audit without raw config |
| validation fails and DB is unavailable | return validation error and report non-durable audit failure through audit-error boundary |
| source insert/store fails after DB open | roll back source write, attempt failure audit, return `SOURCE_REGISTRY_UNAVAILABLE` |
| source id collision | preserve existing retry behavior |
| malformed stored JSON | treat as store corruption and fail read |
| secret-like config key | reject through validation before store write |

## 7. 既存コードとの取り合い
- Existing in-memory tests must continue to pass.
- `SourceRegistryService` remains the orchestration boundary.
- No new MCP tool is exposed.
- No provider network calls are introduced.

## 8. Open decisions
| decision | default for implementation |
|---|---|
| SQLite dependency | choose a local embedded driver with Node 20 support |
| DB path config | keep constructor-driven in tests; runtime config can follow later |
| local default account id | `acct_local` unless caller provides account id |
| migration rollback | MVP uses up-only migrations; destructive rollback is not implemented |

## §Evidence
### 実 file 引用
- `src/adapters/source-store.ts` is the adapter seam.
- `tests/source-registry.test.ts` covers current in-memory behavior and must remain green.
