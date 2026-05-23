---
id: OPS-SOURCESTORAGE-001-001
status: Draft
traces:
  spec: [SPEC-SOURCESTORAGE-001-001]
  impl: [IMPL-SOURCESTORAGE-001-001]
  verify: [VERIFY-SOURCESTORAGE-001-001]
---

# OPS: Source Storage

## 0. 対応するSPEC / IMPL / VERIFY
- SPEC: `SPEC-SOURCESTORAGE-001-001`
- IMPL: `IMPL-SOURCESTORAGE-001-001`
- VERIFY: `VERIFY-SOURCESTORAGE-001-001`
- Feature: `SOURCESTORAGE-001`

## 1. 運用モード
SOURCESTORAGE-001 は standard/lightweight Shirube mode で進める。strict start、merge-authority、role-bound governance は有効化しない。

## 2. Local DB
- MVP local dogfood uses SQLite.
- DB path is constructor/config controlled during implementation.
- Tests use temporary DB files.
- In-memory store remains test/dev utility, not production fallback.

## 3. Account model
- Local dogfood default account: `acct_local`.
- Account is the primary namespace field for future multi-agent and multi-LLM access.
- Project/workspace/scope view is optional policy metadata, not the root partition.

## 4. Audit operation
- Successful source registration requires both the source row and `source.registered` audit row to commit.
- If SQLite cannot open, durable audit is unavailable and the structured error path is the source of truth for that failed attempt.
- Audit metadata is sanitized and must not contain raw source config or secret-like values.

## 5. Pending governance
- `.github/workflows/merge-authority.yml` remains pending until governance activation.
- `.framework/archive/` remains out of commit scope.
- Role bindings are placeholder-only and `workflow.publishPolicy` remains `draft_only`; strict governance is not active.
