---
id: VERIFY-SOURCESTORAGE-001-001
status: Draft
traces:
  spec: [SPEC-SOURCESTORAGE-001-001]
  impl: [IMPL-SOURCESTORAGE-001-001]
  ops: [OPS-SOURCESTORAGE-001-001]
---

# VERIFY: Source Storage

## 0. 対応するSPEC / IMPL
- SPEC: `SPEC-SOURCESTORAGE-001-001`
- IMPL: `IMPL-SOURCESTORAGE-001-001`
- Feature: `SOURCESTORAGE-001`

## 1. 機能テスト
### 1.1 AC-SOURCESTORAGE-001-001 durable source create/read
```gherkin
Feature: Source Storage
  Scenario: Persist source in SQLite
    Given a valid local_files source registration
    When the source is registered with SQLiteSourceStore
    Then the source can be read back by source_id after store reinitialization
```

### 1.2 AC-SOURCESTORAGE-001-002 account ownership fields
```gherkin
Feature: Source Storage
  Scenario: Persist account-bound source metadata
    Given a source registration context with account_id "acct_local"
    When the source is persisted
    Then the source record includes account_id and visibility metadata
```

### 1.3 AC-SOURCESTORAGE-001-003 durable audit event
```gherkin
Feature: Source Storage
  Scenario: Record durable source audit
    Given a successful source registration
    When SourceAuditStore records source.registered
    Then source_audit_events contains the event with account_id, source_id, and result
```

### 1.4 AC-SOURCESTORAGE-001-004 atomic source and audit success
```gherkin
Feature: Source Storage
  Scenario: Roll back source when success audit cannot be written
    Given SQLiteSourceStore can insert a source
    And SourceAuditStore fails to insert source.registered
    When source registration is attempted
    Then the source row is not committed
    And registration fails with SOURCE_REGISTRY_UNAVAILABLE
```

### 1.5 AC-SOURCESTORAGE-001-005 validation failure audit
```gherkin
Feature: Source Storage
  Scenario: Record validation failure when durable audit is available
    Given SQLite durable audit storage is open
    When source registration fails validation
    Then source_audit_events contains source.registration_failed
    And the audit metadata does not contain raw source config
```

### 1.6 AC-SOURCESTORAGE-001-006 store failure audit
```gherkin
Feature: Source Storage
  Scenario: Record source store failure after SQLite opens
    Given SQLite durable audit storage is open
    And the source insert fails
    When source registration is attempted
    Then no source row is committed
    And source_audit_events contains a failure event with SOURCE_REGISTRY_UNAVAILABLE
```

### 1.7 AC-SOURCESTORAGE-001-007 no production memory fallback
```gherkin
Feature: Source Storage
  Scenario: SQLite unavailable
    Given SQLiteSourceStore cannot open its database
    When source registration is attempted
    Then registration fails with SOURCE_REGISTRY_UNAVAILABLE
```

## 2. 境界値テスト
| 項目 | 境界 | 期待値 |
|---|---|---|
| account_id | missing | default local account in service context |
| visibility | private/account/restricted | accepted |
| visibility | unknown | validation error |
| source list filter | account_id only | returns only matching account sources |

## 3. 異常系テスト
| 入力 | 期待するエラー |
|---|---|
| SQLite path cannot open | `SOURCE_REGISTRY_UNAVAILABLE` |
| success audit insert fails | source row rolled back and `SOURCE_REGISTRY_UNAVAILABLE` |
| validation failure with audit store open | durable failure audit inserted |
| source insert failure after DB open | source row rolled back and failure audit attempted |
| duplicate source id | retry or collision error path |
| secret-like config key | `INVALID_SOURCE_CONFIG` |
| malformed persisted JSON | store read failure |

## 4. Definition of Done
- [ ] SQLite source store exists.
- [ ] Migration runner exists.
- [ ] Durable audit store exists.
- [ ] Source registration success and success audit are committed atomically.
- [ ] Validation failure audit is tested.
- [ ] Store failure audit is tested.
- [ ] Audit metadata sanitizer is tested.
- [ ] Existing source registry tests pass.
- [ ] New source storage tests pass.
- [ ] `npm run type-check` passes.
- [ ] `npm test` passes.
- [ ] `npm run build` passes.
- [ ] `framework gate check` passes.
- [ ] `framework trace verify` passes.

## 5. トレース
| acceptance id | requirement | implementation target |
|---|---|---|
| AC-SOURCESTORAGE-001-001 | FR-SOURCESTORAGE-001, FR-SOURCESTORAGE-002 | `SQLiteSourceStore` |
| AC-SOURCESTORAGE-001-002 | FR-SOURCESTORAGE-003, FR-SOURCESTORAGE-004 | `SourceRecord` |
| AC-SOURCESTORAGE-001-003 | FR-SOURCESTORAGE-005 | `SourceAuditStore` |
| AC-SOURCESTORAGE-001-004 | FR-SOURCESTORAGE-005 | transaction-backed source and audit insert |
| AC-SOURCESTORAGE-001-005 | FR-SOURCESTORAGE-005, FR-SOURCESTORAGE-007 | validation failure audit and sanitizer |
| AC-SOURCESTORAGE-001-006 | FR-SOURCESTORAGE-005 | store failure audit |
| AC-SOURCESTORAGE-001-007 | FR-SOURCESTORAGE-001 | store error mapping |

## §Evidence
### 実 file 引用
- `package.json` defines `npm run type-check`, `npm test`, and `npm run build`.
- `docs/spec/SOURCESTORAGE-001.md` defines acceptance criteria.
