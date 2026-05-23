---
id: SPEC-SOURCESTORAGE-001-001
status: Draft
traces:
  impl: [IMPL-SOURCESTORAGE-001-001]
  verify: [VERIFY-SOURCESTORAGE-001-001]
  ops: [OPS-SOURCESTORAGE-001-001]
---

# SPEC: Source Storage

## 0. メタ
- 作成日: 2026-05-23
- 対象 feature: SOURCESTORAGE-001
- 対象領域: SQLite-backed Source persistence
- Tracking issue: https://github.com/watchout/kodama/issues/6
- 前提 feature: `SOURCEREGISTRY-001`
- 関連 umbrella: `STORAGE-001`

## 1. 目的
SOURCESTORAGE-001 は、`SOURCEREGISTRY-001` の in-memory SourceStore を SQLite-backed durable store に置き換えられるようにする。Kodama の root namespace は agent、runtime、directory、project ではなく account/tenant とし、local files、GitHub、Google Drive、server files などを将来ひとつの account-bound unified corpus/graph に接続できる source model を確立する。

## 2. 非目的
- ファイル走査、差分同期、document/chunk 作成は `DOCUMENTINDEX-001` が扱う。
- 検索 API、ranking、citation、context pack は扱わない。
- Google Drive、GitHub API、local filesystem への provider 接続確認は扱わない。
- project/category を root storage hierarchy として導入しない。
- strict start、merge-authority、role-bound governance は有効化しない。

## 3. ユーザーストーリー
- IYASAKA internal operator として、登録した source が process restart 後も残るようにしたい。
- 複数 agent / 複数 LLM を使う account owner として、Kodama access を agent や runtime ではなく account 境界に紐づけたい。
- Dev lead として、source 登録と失敗を durable audit log に残し、Shirube 起因バグや provider 設計ミスを issue 化できるようにしたい。
- Architect として、project/workspace を root partition ではなく optional scope/policy view として後から定義できる source metadata を持ちたい。

## 4. 機能要件
### 4.1 FR-SOURCESTORAGE-001: SQLite SourceStore
`SourceStore` は SQLite-backed implementation を持つ。既存 `SourceRegistryService` は store interface 経由で利用し、MCP handler や validation logic は SQLite details を知らない。

### 4.2 FR-SOURCESTORAGE-002: Source durability
登録済み source は process restart 後も SQLite DB から取得できる。source id、type、name、config、storage mode、created_at、updated_at を保持する。

### 4.3 FR-SOURCESTORAGE-003: Account-bound ownership
Source record は account/tenant boundary を表す `account_id` を保持できる。MVP local dogfood では default local account を使えるが、schema は future multi-agent/multi-LLM access を妨げてはならない。

### 4.4 FR-SOURCESTORAGE-004: Scope view metadata
Source record は optional な `workspace_id`、`scope_view_id`、`visibility`、`owner_id` を保持できる。これらは retrieval-time filtering/policy の材料であり、root storage partition ではない。

### 4.5 FR-SOURCESTORAGE-005: Durable audit log
Source registration success/failure と store failure は durable audit log に保存できる。audit log は event_type、account_id、actor_id、source_id、result、error_code、created_at、metadata を保持する。

For successful registration, source creation and the `source.registered` audit event must be committed in the same SQLite transaction. An implementation must not commit `sources` while losing the corresponding success audit event.

For validation failures, the service must write `source.registration_failed` to durable audit when SQLite is open and the durable audit store is available. If SQLite cannot be opened before the audit write, durable audit is impossible; the service returns the structured error and reports the audit failure through the configured audit-error boundary.

For store failures after SQLite is open, the source write must be rolled back and a failure audit event must be attempted in a separate transaction. If that failure-audit insert also fails, the caller still receives `SOURCE_REGISTRY_UNAVAILABLE`, and the audit insert failure is reported through the audit-error boundary.

Audit `metadata` must never contain raw source config, tokens, credentials, private keys, or secret-like key/value pairs. Metadata may contain sanitized config shape, source type, storage mode, and failure classification.

### 4.6 FR-SOURCESTORAGE-006: Migration boundary
SQLite schema migration は explicit version と applied_at を持つ。adapter 起動時に必要 migration を適用できる。

### 4.7 FR-SOURCESTORAGE-007: Secret handling
Source config に token、password、secret、private_key などの secret-like key を保存してはならない。既存 validation と store layer の両方で拒否または redaction できる境界を持つ。

## 5. インターフェース
### 5.1 SourceStore extension
```ts
interface SourceStore {
  createSource(record: SourceRecord): Promise of void;
  getSource(sourceId: string): Promise of SourceRecord or null;
  listSources(filter?: SourceListFilter): Promise of SourceRecord array;
}
```

### 5.2 Source ownership fields
| field | required | purpose |
|---|---:|---|
| `account_id` | yes | Primary account/tenant boundary |
| `owner_id` | no | Human or service owner when known |
| `workspace_id` | no | Optional workflow grouping |
| `scope_view_id` | no | Optional policy/scope view |
| `visibility` | yes | `private`, `account`, `restricted` |

### 5.3 SQLite tables
| table | purpose |
|---|---|
| `schema_migrations` | migration version ledger |
| `sources` | durable source registry |
| `source_audit_events` | durable source registration/store audit |

## 6. 非機能要件
### 6.1 性能
Local SQLite source registration should complete within normal unit test timeouts. Provider network calls are excluded from this feature.

### 6.2 可用性
If SQLite is unavailable, registration returns `SOURCE_REGISTRY_UNAVAILABLE`. The runtime must not silently fall back to in-memory storage for production use.

### 6.3 セキュリティ要件
#### 6.3.1 STRIDE
| カテゴリ | 該当内容 |
|---|---|
| Spoofing | `account_id` and actor metadata are preserved but not authenticated by this layer. |
| Tampering | Source config and ownership fields are validated before persistence. |
| Repudiation | Durable audit log records source registration and failure events. |
| Information Disclosure | Secret-like config keys are rejected or redacted before storage. |
| Denial of Service | Config shape and name length limits from `SOURCEREGISTRY-001` remain enforced. |
| Elevation of Privilege | Project/workspace metadata does not grant access; future policy layer must evaluate visibility. |

#### 6.3.2 OWASP Top 10:2021
- A01 Broken Access Control: `account_id` and visibility fields are stored for future policy enforcement.
- A02 Cryptographic Failures: Secrets must not be stored in source config.
- A03 Injection: SQLite writes use parameter binding, not SQL string interpolation.
- A04 Insecure Design: Project/category is not treated as a security boundary.
- A05 Security Misconfiguration: SQLite path and migration status are explicit.
- A06 Vulnerable and Outdated Components: SQLite dependency selection is reviewed through lockfile.
- A07 Identification and Authentication Failures: Authentication remains outside this feature.
- A08 Software and Data Integrity Failures: Migrations and unique source ids preserve data integrity.
- A09 Security Logging and Monitoring Failures: Source audit events are durable.
- A10 Server-Side Request Forgery: This feature performs no remote fetches.

### 6.4 監査ログ要件
Audit events must be written for successful registration, validation failure when durable audit storage is available, and store failure after SQLite has opened.

Atomicity rules:

| case | source row | audit row | transaction rule |
|---|---|---|---|
| registration success | committed | committed | same transaction |
| success audit insert fails | rolled back | not committed | return `SOURCE_REGISTRY_UNAVAILABLE` |
| validation failure with DB available | not created | committed failure event | separate audit insert |
| SQLite open unavailable | not created | not durable | return structured error and invoke audit-error boundary |
| source insert/store failure after DB open | rolled back | attempted failure event | separate audit insert |

Audit metadata must be sanitized. It may include source type, storage mode, account id, actor id, failure phase, and error code. It must not include raw config or secret-like keys.

## 7. 受入基準
### AC-SOURCESTORAGE-001-001: durable source create/read
```gherkin
Feature: Source Storage
  Scenario: Persist source in SQLite
    Given a valid local_files source registration
    When the source is registered with SQLiteSourceStore
    Then the source can be read back by source_id after store reinitialization
```

### AC-SOURCESTORAGE-001-002: account ownership fields
```gherkin
Feature: Source Storage
  Scenario: Persist account-bound source metadata
    Given a source registration context with account_id "acct_local"
    When the source is persisted
    Then the source record includes account_id and visibility metadata
```

### AC-SOURCESTORAGE-001-003: durable audit event
```gherkin
Feature: Source Storage
  Scenario: Record durable source audit
    Given a successful source registration
    When the audit sink receives source.registered
    Then source_audit_events contains the event with account_id, source_id, and result
```

### AC-SOURCESTORAGE-001-004: atomic source and audit success
```gherkin
Feature: Source Storage
  Scenario: Roll back source when success audit cannot be written
    Given SQLiteSourceStore can insert a source
    And SourceAuditStore fails to insert source.registered
    When source registration is attempted
    Then the source row is not committed
    And registration fails with SOURCE_REGISTRY_UNAVAILABLE
```

### AC-SOURCESTORAGE-001-005: validation failure audit
```gherkin
Feature: Source Storage
  Scenario: Record validation failure when durable audit is available
    Given SQLite durable audit storage is open
    When source registration fails validation
    Then source_audit_events contains source.registration_failed
    And the audit metadata does not contain raw source config
```

### AC-SOURCESTORAGE-001-006: store failure audit
```gherkin
Feature: Source Storage
  Scenario: Record source store failure after SQLite opens
    Given SQLite durable audit storage is open
    And the source insert fails
    When source registration is attempted
    Then no source row is committed
    And source_audit_events contains a failure event with SOURCE_REGISTRY_UNAVAILABLE
```

### AC-SOURCESTORAGE-001-007: no production memory fallback
```gherkin
Feature: Source Storage
  Scenario: SQLite unavailable
    Given SQLiteSourceStore cannot open its database
    When source registration is attempted
    Then registration fails with SOURCE_REGISTRY_UNAVAILABLE
```

## 8. 前提・依存
- `SOURCEREGISTRY-001` validation and service boundary exist.
- `STORAGE-001` defines the broader context store direction.
- SQLite driver selection occurs in implementation and remains adapter-internal.
- `account_id` is application-layer metadata in MVP, not a cloud-grade tenant security boundary.

## 9. Test Coverage Gap
| gap 種別 | 内容 | 解消アクション |
|---|---|---|
| Coverage gap | Existing SourceStore is in-memory only | Add SQLite adapter tests |
| Audit gap | Existing audit sink is not durable | Add `source_audit_events` persistence |
| Policy gap | Account/workspace/scope semantics are not enforced | Store metadata now; enforce in later policy/search feature |
| Migration gap | No migration runner exists | Add explicit migration table and adapter initialization tests |

## 10. 制御機構選定原則
### 10.1 採択原則
This feature uses deterministic TypeScript validation, SQLite migrations, adapter tests, and existing Shirube gates. LLM prompts and hooks do not control persistence correctness.

### 10.2 本 spec の選定
| FR | 機構 | 不可避 case 該当 | 根拠 |
|---|---|---|---|
| FR-SOURCESTORAGE-001 | script | 該当なし: adapter testsで制御する | Store persistence is deterministic |
| FR-SOURCESTORAGE-002 | script | 該当なし: restart/readback testsで制御する | Durability can be tested locally |
| FR-SOURCESTORAGE-003 | script | 該当なし: typed fields and testsで制御する | Account metadata is deterministic |
| FR-SOURCESTORAGE-004 | script | 該当なし: schema fields and testsで制御する | Scope metadata does not require LLM judgment |
| FR-SOURCESTORAGE-005 | script | 該当なし: audit insert/read testsで制御する | Audit persistence is deterministic |
| FR-SOURCESTORAGE-006 | script | 該当なし: migration testsで制御する | Migration versioning is deterministic |
| FR-SOURCESTORAGE-007 | script | 該当なし: validation testsで制御する | Secret-like keys are enumerable guardrails |

### 10.3 違反時 rollback
If source persistence depends on prompt text, non-durable in-memory fallback, or project/category as a hard root namespace, the implementation is rejected and refactored.

## 11. Acceptance Criteria BDD
| acceptance id | test file |
|---|---|
| AC-SOURCESTORAGE-001-001 | `tests/source-storage.test.ts` |
| AC-SOURCESTORAGE-001-002 | `tests/source-storage.test.ts` |
| AC-SOURCESTORAGE-001-003 | `tests/source-storage.test.ts` |
| AC-SOURCESTORAGE-001-004 | `tests/source-storage.test.ts` |
| AC-SOURCESTORAGE-001-005 | `tests/source-storage.test.ts` |
| AC-SOURCESTORAGE-001-006 | `tests/source-storage.test.ts` |
| AC-SOURCESTORAGE-001-007 | `tests/source-storage.test.ts` |

## §Evidence
### 実 file 引用
- `src/adapters/source-store.ts` currently provides `InMemorySourceStore`.
- `src/services/source-registry-service.ts` depends on `SourceStore`, allowing durable replacement.
- `docs/spec/SOURCEREGISTRY-001.md` defines registration as identity/config persistence only.
- `docs/spec/STORAGE-001.md` defines account-bound unified corpus direction as broader storage context.

### Web / research references
- SQLite FTS5 and SQLite local storage are used as the local-first storage basis: https://www.sqlite.org/fts5.html
