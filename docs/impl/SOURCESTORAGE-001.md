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

## 4. 実装順序
1. Extend Source types with account ownership fields while preserving existing tests through default local account behavior.
2. Extend `SourceStore` with read/list methods.
3. Add migration runner.
4. Add SQLite source store.
5. Add durable source audit store.
6. Wire service audit events to durable audit sink in tests.
7. Keep MCP runtime behavior unchanged except durable store can be selected by construction.

## 5. エラー処理
| condition | behavior |
|---|---|
| SQLite open fails | throw store error mapped to `SOURCE_REGISTRY_UNAVAILABLE` |
| source id collision | preserve existing retry behavior |
| malformed stored JSON | treat as store corruption and fail read |
| secret-like config key | reject through validation before store write |

## 6. 既存コードとの取り合い
- Existing in-memory tests must continue to pass.
- `SourceRegistryService` remains the orchestration boundary.
- No new MCP tool is exposed.
- No provider network calls are introduced.

## 7. Open decisions
| decision | default for implementation |
|---|---|
| SQLite dependency | choose a local embedded driver with Node 20 support |
| DB path config | keep constructor-driven in tests; runtime config can follow later |
| local default account id | `acct_local` unless caller provides account id |

## §Evidence
### 実 file 引用
- `src/adapters/source-store.ts` is the adapter seam.
- `tests/source-registry.test.ts` covers current in-memory behavior and must remain green.

