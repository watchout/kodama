---
id: OPS-SOURCEREGISTRY-001-001
status: Draft
traces:
  spec: [SPEC-SOURCEREGISTRY-001-001]
  impl: [IMPL-SOURCEREGISTRY-001-001]
  verify: [VERIFY-SOURCEREGISTRY-001-001]
---

# OPS: Source Registry

## 0. 対応するSPEC / IMPL
- SPEC: `SPEC-SOURCEREGISTRY-001-001`
- IMPL: `IMPL-SOURCEREGISTRY-001-001`
- VERIFY: `VERIFY-SOURCEREGISTRY-001-001`
- Feature: `SOURCEREGISTRY-001`

## 1. デプロイ手順
### 1.1 前提条件
- Node.js 20 or later is available.
- Dependencies are installed with `npm ci` or `npm install`.
- Gate A/B/C are passed before product code changes are released.

### 1.2 手順
1. Run `npm run typecheck`.
2. Run `npm test`.
3. Run `npm run build`.
4. Run `node dist/index.js` from an MCP host that provides stdio transport.

### 1.3 デプロイ後確認
- MCP host can start the `kodama` server process.
- `kodama.register_source` appears in the available tool list.
- A valid local_files registration returns status `registered`.

## 2. ロールバック手順
### 2.1 ロールバック条件
- MCP server cannot start.
- `kodama.register_source` returns unstructured errors for valid inputs.
- Source records are persisted with secrets or malformed config.

### 2.2 手順
1. Stop the MCP host process using the new build.
2. Restore the previous known-good package or commit.
3. Restart the MCP host.
4. Re-run a valid registration smoke test.

## 3. 監視項目
| メトリクス名 | 正常範囲 | アラート条件 | 通知先 |
|---|---|---|---|
| register_source success count | increases when users register sources | zero success after deployment with attempted use | project maintainer |
| register_source error count | low relative to attempts | sustained spike in validation or store errors | project maintainer |
| source registry unavailable count | zero during normal operation | any sustained nonzero count | project maintainer |

## 4. SLO
| SLI | 目標値 | 測定方法 | エラーバジェット |
|---|---|---|---|
| register_source successful response for valid input | 99 percent per local deployment window | MCP behavior smoke test and audit events | 1 percent failed valid registrations |
| register_source latency with local storage | p95 below 200ms | timing around service call | 5 percent above target |

## 5. 障害対応 Runbook
### 5.1 症状: MCP server fails to start
- 一次対応: Run `npm run build` and inspect TypeScript output.
- エスカレーション: Assign to maintainer if build passes but runtime fails.
- 再発防止: Add startup behavior test for server registration.

### 5.2 症状: valid registration returns validation error
- 一次対応: Compare input with SPEC §5.1 and §5.2.
- エスカレーション: Add failing input as regression test.
- 再発防止: Keep validation table and tests in sync with SPEC.

### 5.3 症状: registry unavailable error
- 一次対応: Check storage adapter initialization and permissions.
- エスカレーション: Switch to previous known-good storage configuration.
- 再発防止: Add store health smoke check before MCP host rollout.

## 6. 定期メンテナンス
- Review source records for accidental secret-like config keys after each adapter expansion.
- Review dependency updates through CI before release.

## 7. バックアップ・リストア
### 7.1 対象・頻度
Durable Source records are backup targets once a persistent store is introduced. In-memory test stores have no backup requirement.

### 7.2 RTO / RPO
For local prototype deployments, RTO and RPO are best effort. Team deployments must define RTO and RPO when persistent storage is selected.

## 8. 権限管理
MCP server profile does not define app roles yet. Runtime must preserve actor identity when available and must not treat registration as permission to read source content.

## 9. 制御機構の使い分け原則
### 9.1 採択原則
Operations checks use deterministic scripts: `npm run typecheck`, `npm test`, `npm run build`, and framework gate commands. Hook-based controls are repository guardrails only.

### 9.2 本 feature の運用機構
Source registration is runtime service behavior and is controlled by code, tests, and build gates. No operational decision in this feature requires LLM hook judgment.

## 10. トレース
| ops item | spec reference | verify reference |
|---|---|---|
| deploy smoke test | AC-SOURCEREGISTRY-001-001 | VERIFY §1.1 |
| rollback on unstructured errors | SPEC §5.3 | VERIFY §3 |
| monitoring source registry unavailable | SPEC §6.2 | VERIFY §3 |

## §Evidence
### 実 file 引用
- `package.json` defines build and test commands used in deployment checks.
- `docs/spec/SOURCEREGISTRY-001.md` defines operationally relevant error codes and SLO targets.

### Web 検索 / 公式 doc URL
- No external web source was used for this operations plan.
