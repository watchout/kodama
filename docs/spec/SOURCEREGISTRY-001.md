---
id: SPEC-SOURCEREGISTRY-001-001
status: Draft
traces:
  impl: [IMPL-SOURCEREGISTRY-001-001]
  verify: [VERIFY-SOURCEREGISTRY-001-001]
  ops: [OPS-SOURCEREGISTRY-001-001]
---

# SPEC: Source Registry

## 0. メタ
- 作成日: 2026-05-20
- 対象 feature: SOURCEREGISTRY-001
- 対象 MCP tool: `kodama.register_source`
- 関連 PRD: `docs/requirements/SSOT-0_PRD.md`
- 関連 API contract: `docs/design/core/SSOT-3_API_CONTRACT.md`
- 関連 data model: `docs/design/core/SSOT-4_DATA_MODEL.md`

## 1. 目的
Source Registry は、Kodama が参照または同期する外部 source を MCP-compatible agent から登録できるようにする。登録時には source type、表示名、adapter config、storage mode を検証し、後続の sync/search/context retrieval が同じ source identity を参照できる状態を作る。

## 2. 非目的
- Source の内容をこの機能内で取り込まない。取り込みは `kodama.sync_source` が扱う。
- Search、context pack 生成、回答生成、memory promotion は扱わない。
- GitHub API や local filesystem への接続確認は登録時の必須処理にしない。登録は configuration validation と identity persistence に限定する。
- HTTP transport はこの feature の対象外とし、初期実装は stdio MCP server 上の tool contract を対象にする。

## 3. ユーザーストーリー
- AI-native engineering team の agent operator として、local file tree を Kodama source として登録し、後続タスクで同じ source を同期できるようにしたい。
- AI-native engineering team の agent operator として、GitHub repository を Kodama source として登録し、issue、PR、code context の取得対象にしたい。
- MCP-compatible agent として、不正な source type や storage mode を送った場合に、安定した error code と readable message を受け取りたい。

## 4. 機能要件
### 4.1 FR-SOURCEREGISTRY-001: Source 登録
`kodama.register_source` は、`type`、`name`、`config`、`storage_mode` を受け取り、source record を作成して `source_id` と `status: "registered"` を返す。

### 4.2 FR-SOURCEREGISTRY-002: 対応 source type
MVP で登録可能な source type は `local_files` と `github` のみとする。その他の type は `UNSUPPORTED_SOURCE_TYPE` を返す。

### 4.3 FR-SOURCEREGISTRY-003: Storage mode
Storage mode は `copy`、`index`、`reference`、`ephemeral` のみを受け付ける。各 mode の意味は `SSOT-4_DATA_MODEL.md` の Storage Modes に従う。

### 4.4 FR-SOURCEREGISTRY-004: 入力検証
`name` は trim 後 1 文字以上 120 文字以下でなければならない。`config` は JSON object でなければならない。source type ごとの最低 config は実装で型定義し、未知 key は保存してよいが、必須 key 欠落は `INVALID_SOURCE_CONFIG` とする。

### 4.5 FR-SOURCEREGISTRY-005: Source identity
`source_id` は Kodama 内で一意かつ推測困難な string とする。同じ name や config の再登録は新しい `source_id` を返す。重複統合は post-MVP の対象とする。

### 4.6 FR-SOURCEREGISTRY-006: Auditability
登録成功、validation failure、unsupported adapter は structured audit event として記録できる境界を service 層に設ける。初期実装で永続 audit log が未接続の場合も、service interface は audit event を失わない設計にする。

## 5. インターフェース
### 5.1 MCP tool contract
Tool name: `kodama.register_source`

Input fields:

| field | type | required | rule |
|---|---|---:|---|
| `type` | enum | yes | `local_files` or `github` |
| `name` | string | yes | trim 後 1 から 120 文字 |
| `config` | object | yes | source type ごとの必須 key を満たす JSON object |
| `storage_mode` | enum | yes | `copy`, `index`, `reference`, `ephemeral` |

Output fields:

| field | type | rule |
|---|---|---|
| `source_id` | string | Kodama 内で一意 |
| `status` | enum | `registered` |

### 5.2 Source type config
`local_files` config:

| field | type | required | rule |
|---|---|---:|---|
| `root_path` | string | yes | 空文字不可。path traversal の正規化は adapter 層で行う |
| `include_globs` | string array | no | 指定時は各 item が空文字不可 |
| `exclude_globs` | string array | no | 指定時は各 item が空文字不可 |

`github` config:

| field | type | required | rule |
|---|---|---:|---|
| `owner` | string | yes | 空文字不可 |
| `repo` | string | yes | 空文字不可 |
| `installation_id` | string | no | GitHub App 利用時の識別子 |
| `default_branch` | string | no | 未指定時の解決は sync adapter 側で行う |

### 5.3 Error contract
All errors are structured MCP errors with stable code and readable message.

| code | condition |
|---|---|
| `INVALID_SOURCE_TYPE` | `type` が enum 外、または string ではない |
| `UNSUPPORTED_SOURCE_TYPE` | enum として識別できるが MVP 非対応 |
| `INVALID_SOURCE_NAME` | `name` が空、長すぎる、または string ではない |
| `INVALID_STORAGE_MODE` | `storage_mode` が enum 外 |
| `INVALID_SOURCE_CONFIG` | `config` が object ではない、または必須 key を満たさない |
| `SOURCE_REGISTRY_UNAVAILABLE` | storage adapter が登録処理を完了できない |

### 5.4 DB スキーマ
Initial storage adapter must persist at least these logical fields for `Source`:

| field | type | rule |
|---|---|---|
| `id` | string | `source_id` と一致 |
| `type` | string | validated source type |
| `name` | string | trim 済み |
| `config` | JSON object | secret は入れない |
| `storage_mode` | string | validated storage mode |
| `created_at` | ISO datetime string | server generated |
| `updated_at` | ISO datetime string | server generated |

## 6. 非機能要件
### 6.1 性能
登録処理は local storage adapter 利用時に p95 200ms 以下を目標にする。外部 API 接続確認を登録 path に含めないことで、登録の latency を source provider の状態から分離する。

### 6.2 可用性
MCP server process が動作しており storage adapter が利用可能な場合、登録 tool は成功または structured error を返す。storage adapter 障害時は retry せず `SOURCE_REGISTRY_UNAVAILABLE` を返す。

### 6.3 セキュリティ要件
#### 6.3.1 STRIDE
| カテゴリ | 該当内容 |
|---|---|
| Spoofing | Source 登録者 identity は MCP session context から受け取り、source record または audit event に渡せる interface を用意する。 |
| Tampering | `config` は JSON object として validate し、adapter type ごとの必須 key を検証してから保存する。 |
| Repudiation | 登録成功と失敗を audit event 化できる service 境界を設ける。 |
| Information Disclosure | `config` には token や secret を保存しない。credential は将来の secret provider 経由に限定する。 |
| Denial of Service | name length、array item、config shape を制限し、巨大 payload を validation で拒否する。 |
| Elevation of Privilege | Source-level permission enforcement は後続 retrieval/sync 側でも必須。登録時は actor identity を権限評価に渡せる設計にする。 |

#### 6.3.2 OWASP Top 10:2021
- A01 Broken Access Control: Source registration must preserve actor identity for future RBAC or ABAC checks.
- A02 Cryptographic Failures: Secrets must not be stored in source config.
- A03 Injection: Config values are treated as data and are not interpolated into shell commands.
- A04 Insecure Design: Registration does not imply read permission to source contents.
- A05 Security Misconfiguration: Unsupported adapters fail closed.
- A06 Vulnerable and Outdated Components: Dependency checks are handled by CI and package lock review.
- A07 Identification and Authentication Failures: Authentication is delegated to MCP host/session context for this feature.
- A08 Software and Data Integrity Failures: Source records keep provenance fields and are not silently rewritten.
- A09 Security Logging and Monitoring Failures: Register success and failure paths produce audit events.
- A10 Server-Side Request Forgery: Registration does not fetch remote URLs; GitHub access occurs in adapter-controlled sync.

#### 6.3.3 データ分類
- 本 feature が扱うデータ:
  - [ ] PII
  - [ ] PCI
  - [x] 機密
  - [ ] 公開
- 分類理由: Repository names, paths, and source configuration can reveal internal project structure.
- 追加要件: Source config must not include tokens, passwords, private keys, or raw file contents.

### 6.4 監査ログ要件
Audit event fields: `event_type`, `source_id` when available, `actor_id` when available, `source_type`, `storage_mode`, `result`, `error_code` when failed, `created_at`.

## 7. 受入基準
### AC-SOURCEREGISTRY-001-001: local files source registration
```gherkin
Feature: Source Registry
  Scenario: Register a local files source
    Given an MCP client sends type "local_files", name "Project Docs", config with root_path "/workspace/docs", and storage_mode "index"
    When kodama.register_source is invoked
    Then the response contains a non-empty source_id and status "registered"
```

### AC-SOURCEREGISTRY-001-002: github source registration
```gherkin
Feature: Source Registry
  Scenario: Register a GitHub source
    Given an MCP client sends type "github", name "Kodama Repo", config with owner "watchout" and repo "kodama", and storage_mode "reference"
    When kodama.register_source is invoked
    Then the response contains a non-empty source_id and status "registered"
```

### AC-SOURCEREGISTRY-001-003: invalid source type
```gherkin
Feature: Source Registry
  Scenario: Reject an unsupported source type
    Given an MCP client sends type "slack", name "Team Slack", config with channel "engineering", and storage_mode "index"
    When kodama.register_source is invoked
    Then the tool returns error code "UNSUPPORTED_SOURCE_TYPE"
```

### AC-SOURCEREGISTRY-001-004: invalid config
```gherkin
Feature: Source Registry
  Scenario: Reject missing required local files config
    Given an MCP client sends type "local_files", name "Project Docs", config without root_path, and storage_mode "index"
    When kodama.register_source is invoked
    Then the tool returns error code "INVALID_SOURCE_CONFIG"
```

## 8. 前提・依存
- MCP SDK is available through `@modelcontextprotocol/sdk`.
- Initial transport is stdio as defined in `SSOT-3_API_CONTRACT.md`.
- Source entity semantics follow `SSOT-4_DATA_MODEL.md`.
- Storage implementation is behind an adapter so local SQLite, Postgres, or in-memory test storage can be swapped without changing MCP handlers.
- Human approval and memory promotion are outside this feature.

## 9. リスクと緩和策
| risk | impact | mitigation |
|---|---|---|
| Source config accidentally stores secrets | Credential leak through persisted config | Reject known secret-like keys and document credential provider as future boundary |
| Registration validates too much by calling providers | Registration becomes slow and flaky | Do not perform provider network calls in this feature |
| Duplicate sources accumulate | Operators may register same repo twice | Accept for MVP and expose unique `source_id`; deduplication can be added later |

## 10. 制御機構選定原則
### 10.1 採択原則
This feature uses script-controlled deterministic checks for gates and tests. Hook-based control is limited to repository guardrails outside runtime behavior.

### 10.2 本 spec の選定
| FR | 機構 | 不可避 case 該当 | 根拠 |
|---|---|---|---|
| FR-SOURCEREGISTRY-001 | script | 該当なし: runtime service と unit tests で制御する | MCP tool handler and service tests can deterministically verify registration |
| FR-SOURCEREGISTRY-002 | script | 該当なし: validation table で制御する | Source type enum validation is deterministic |
| FR-SOURCEREGISTRY-003 | script | 該当なし: validation table で制御する | Storage mode enum validation is deterministic |
| FR-SOURCEREGISTRY-004 | script | 該当なし: schema validation と tests で制御する | Input shape validation does not require LLM hook |
| FR-SOURCEREGISTRY-005 | script | 該当なし: storage adapter test で制御する | Source id uniqueness is testable |
| FR-SOURCEREGISTRY-006 | script | 該当なし: service boundary tests で制御する | Audit event emission can be asserted in tests |

### 10.3 違反時 rollback
Runtime behavior must not depend on LLM judgment. If validation or persistence is implemented as hook-only behavior, the implementation is rejected and refactored into service code plus deterministic tests.

## 11. Test Coverage Gap
| gap 種別 | 内容 | 影響範囲 | 解消アクション | verify 方法 |
|---|---|---|---|---|
| Coverage gap | MCP behavior tests are not yet implemented for register_source | Tool contract regressions | Add Vitest tests for normal, invalid type, invalid config, storage failure | `npm test` |
| Environment gap | Only local Node environment is configured | Provider-specific behavior may differ later | Keep provider network calls out of registration | Unit tests with fake storage |
| Tooling gap | No schema validation library is selected yet | Manual validation drift risk | Implement typed validation helpers or introduce a schema library through SSOT update | Typecheck and validation tests |
| Skill gap | MCP SDK registration patterns need implementation review | Incorrect handler shape | Compare implementation with official MCP SDK usage during implementation | Code review and behavior tests |

## 12. Acceptance Criteria BDD
| acceptance id | test file |
|---|---|
| AC-SOURCEREGISTRY-001-001 | `tests/source-registry.test.ts` |
| AC-SOURCEREGISTRY-001-002 | `tests/source-registry.test.ts` |
| AC-SOURCEREGISTRY-001-003 | `tests/source-registry.test.ts` |
| AC-SOURCEREGISTRY-001-004 | `tests/source-registry.test.ts` |

## 13. Invariants Property-Based
### INV-SOURCEREGISTRY-001-001
For every accepted registration input, returned `source_id` is non-empty and status is `registered`.

### INV-SOURCEREGISTRY-001-002
For every rejected registration input, the tool returns one of the stable error codes listed in §5.3 and does not persist a Source record.

## 14. Traceability Matrix
| 要件 ID | test ID | code 範囲 |
|---|---|---|
| FR-SOURCEREGISTRY-001 | AC-SOURCEREGISTRY-001-001, AC-SOURCEREGISTRY-001-002 | `src/services/source-registry-service.ts` |
| FR-SOURCEREGISTRY-002 | AC-SOURCEREGISTRY-001-003 | `src/services/source-registry-validation.ts` |
| FR-SOURCEREGISTRY-003 | validation unit tests | `src/services/source-registry-validation.ts` |
| FR-SOURCEREGISTRY-004 | AC-SOURCEREGISTRY-001-004 | `src/services/source-registry-validation.ts` |
| FR-SOURCEREGISTRY-005 | source id unit tests | `src/services/source-registry-service.ts` |
| FR-SOURCEREGISTRY-006 | audit event unit tests | `src/services/source-registry-service.ts` |

## §3-E 入出力例
| case | kind | input | expected |
|---|---|---|---|
| E1 | normal | local_files with name Project Docs, root_path /workspace/docs, storage_mode index | status registered with source_id |
| E2 | normal | github with owner watchout, repo kodama, storage_mode reference | status registered with source_id |
| E3 | abnormal | type slack | error code UNSUPPORTED_SOURCE_TYPE |
| E4 | abnormal | name is empty string | error code INVALID_SOURCE_NAME |
| E5 | abnormal | storage_mode archive | error code INVALID_STORAGE_MODE |
| E6 | abnormal | local_files config without root_path | error code INVALID_SOURCE_CONFIG |

## §3-F 境界値
| item | boundary | expected |
|---|---|---|
| name length | 1 trimmed character | accepted |
| name length | 120 trimmed characters | accepted |
| name length | 121 trimmed characters | `INVALID_SOURCE_NAME` |
| config | empty object for local_files | `INVALID_SOURCE_CONFIG` |
| include_globs | empty array | accepted |

## §3-G 例外応答
| condition | error code | persistence |
|---|---|---|
| unsupported source type | `UNSUPPORTED_SOURCE_TYPE` | no Source record |
| invalid source name | `INVALID_SOURCE_NAME` | no Source record |
| invalid storage mode | `INVALID_STORAGE_MODE` | no Source record |
| invalid config | `INVALID_SOURCE_CONFIG` | no Source record |
| storage adapter unavailable | `SOURCE_REGISTRY_UNAVAILABLE` | no partial Source record |

## §3-H Gherkin
```gherkin
Feature: Source Registry MCP tool
  Scenario: Valid local files source is registered
    Given a valid local_files registration input
    When kodama.register_source handles the request
    Then a Source record is created and the tool returns status "registered"

  Scenario: Invalid source config is rejected
    Given a local_files registration input without root_path
    When kodama.register_source handles the request
    Then the tool returns error code "INVALID_SOURCE_CONFIG"
```

## §Evidence
### 実 file 引用
- `docs/requirements/SSOT-0_PRD.md` states MVP includes local file and GitHub source adapters.
- `docs/design/core/SSOT-3_API_CONTRACT.md` defines `kodama.register_source` input and output.
- `docs/design/core/SSOT-4_DATA_MODEL.md` defines storage modes and Source entity semantics.

### Web 検索 / 公式 doc URL
- No external web source was used for this repository-local specification update.
