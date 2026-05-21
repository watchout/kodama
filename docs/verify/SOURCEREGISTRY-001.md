---
id: VERIFY-SOURCEREGISTRY-001-001
status: Draft
traces:
  spec: [SPEC-SOURCEREGISTRY-001-001]
  impl: [IMPL-SOURCEREGISTRY-001-001]
  ops: [OPS-SOURCEREGISTRY-001-001]
---

# VERIFY: Source Registry

## 0. 対応するSPEC / IMPL
- SPEC: `SPEC-SOURCEREGISTRY-001-001`
- IMPL: `IMPL-SOURCEREGISTRY-001-001`
- Feature: `SOURCEREGISTRY-001`

## 1. 機能テスト
### 1.1 AC-SOURCEREGISTRY-001-001 正常系: local files source registration
```gherkin
Feature: Source Registry
  Scenario: Register a local files source
    Given a valid local_files source registration input
    When kodama.register_source is invoked
    Then the response contains a non-empty source_id and status "registered"
```

### 1.2 AC-SOURCEREGISTRY-001-002 正常系: github source registration
```gherkin
Feature: Source Registry
  Scenario: Register a GitHub source
    Given a valid github source registration input
    When kodama.register_source is invoked
    Then the response contains a non-empty source_id and status "registered"
```

### 1.3 AC-SOURCEREGISTRY-001-003 異常系: unsupported source type
```gherkin
Feature: Source Registry
  Scenario: Reject unsupported source type
    Given a source registration input with type "slack"
    When kodama.register_source is invoked
    Then the tool returns error code "UNSUPPORTED_SOURCE_TYPE"
```

### 1.4 AC-SOURCEREGISTRY-001-004 異常系: invalid config
```gherkin
Feature: Source Registry
  Scenario: Reject invalid local files config
    Given a local_files source registration input without root_path
    When kodama.register_source is invoked
    Then the tool returns error code "INVALID_SOURCE_CONFIG"
```

## 2. 境界値テスト
| 項目 | 境界 | 期待値 |
|---|---|---|
| name | 1 trimmed character | accepted |
| name | 120 trimmed characters | accepted |
| name | 121 trimmed characters | `INVALID_SOURCE_NAME` |
| config | local_files without root_path | `INVALID_SOURCE_CONFIG` |
| storage_mode | each allowed enum value | accepted |

## 3. 異常系テスト
| 入力 | 期待するエラー | エラーコード |
|---|---|---|
| type is not string | invalid source type | `INVALID_SOURCE_TYPE` |
| type is slack | unsupported source type | `UNSUPPORTED_SOURCE_TYPE` |
| name is blank | invalid source name | `INVALID_SOURCE_NAME` |
| storage_mode is archive | invalid storage mode | `INVALID_STORAGE_MODE` |
| config is null | invalid source config | `INVALID_SOURCE_CONFIG` |
| store create throws | registry unavailable | `SOURCE_REGISTRY_UNAVAILABLE` |

## 4. 認証/認可テスト
MCP server profile does not define application roles yet. Tests verify that optional actor identity can be passed through registration context and into audit sink without requiring a specific authentication provider.

| ロール | 操作 | 期待結果 |
|---|---|---|
| MCP session actor | register valid source | accepted and actor id passed to audit sink |
| missing actor | register valid source | accepted with anonymous audit context |

## 5. パフォーマンステスト
| 項目 | 基準値 | 計測方法 |
|---|---|---|
| local in-memory registration | p95 below 20ms | Vitest timing smoke test |
| validation only | completes synchronously for bounded payloads | unit tests |

## 6. セキュリティテスト
| 攻撃ベクタ | 想定結果 |
|---|---|
| secret-like config key such as token | rejected or redacted according to implementation rule |
| type attempts command injection text | treated as invalid enum |
| root_path contains shell metacharacters | stored as data only, never executed |
| oversized name | `INVALID_SOURCE_NAME` |

## 7. Definition of Done
- [ ] `tests/source-registry.test.ts` covers all acceptance criteria.
- [ ] `npm test` passes.
- [ ] `npm run typecheck` passes.
- [ ] `npm run build` passes.
- [ ] Structured error codes match SPEC §5.3.
- [ ] No production `console.log` or `any` usage is introduced.

## 8. トレース
| acceptance id | requirement | implementation target |
|---|---|---|
| AC-SOURCEREGISTRY-001-001 | FR-SOURCEREGISTRY-001 | `SourceRegistryService.registerSource` |
| AC-SOURCEREGISTRY-001-002 | FR-SOURCEREGISTRY-001 | `SourceRegistryService.registerSource` |
| AC-SOURCEREGISTRY-001-003 | FR-SOURCEREGISTRY-002 | `validateRegisterSourceInput` |
| AC-SOURCEREGISTRY-001-004 | FR-SOURCEREGISTRY-004 | `validateRegisterSourceInput` |

## §Evidence
### 実 file 引用
- `docs/spec/SOURCEREGISTRY-001.md` contains acceptance criteria and error contract.
- `package.json` defines `npm test`, `npm run typecheck`, and `npm run build`.

### Web 検索 / 公式 doc URL
- No external web source was used for this verification plan.
