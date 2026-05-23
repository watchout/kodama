# CLAUDE.md - Project Instructions (for Claude Code)

> Claude Code reads this file automatically.
> This project is an MCP server. All specifications are in docs/.

---

## AI Interruption Protocol (Highest Priority Rule)

Stop immediately and ask the user in these cases:

1. A specification decision is needed but not in SSOT
2. SSOT wording is ambiguous with multiple interpretations
3. Multiple valid technical approaches exist
4. Contradiction between SSOT and existing implementation
5. Coding standards do not cover the current case
6. Impact scope of a change is unclear
7. A business decision is required

"Guessing" and "just use a placeholder" are PROHIBITED.

## Project Overview

| Item | Value |
|------|-------|
| Product | kodama |
| Description | Shared context network MCP server for humans and agents |
| Created | 2026-05-19 |
| Profile | MCP server |
| Runtime | TypeScript / Node.js |
| Transport | stdio or HTTP, as defined by SSOT |
| Testing | Vitest + MCP tool behavior tests |

---

## Specification Reference

Before implementation, always check:

```
1. MCP tool contracts -> docs/design/core/SSOT-3_API_CONTRACT.md
2. Data model         -> docs/design/core/SSOT-4_DATA_MODEL.md
3. Cross-cutting      -> docs/design/core/SSOT-5_CROSS_CUTTING.md when present
4. Dev standards      -> docs/standards/
5. PRD                -> docs/requirements/SSOT-0_PRD.md
```

## MCP Server Rules

- Treat MCP tools, resources, and prompts as external contracts.
- Define every tool input/output schema before implementation.
- Keep stdio and HTTP transport concerns behind narrow adapters.
- Keep storage/index adapters separate from MCP protocol handlers.
- Persisted entities and indexes must be reflected in SSOT-4_DATA_MODEL.
- Add behavior tests for each MCP tool, including validation and error cases.
- Do not add client UI, browser automation, or web-hosting assumptions unless explicitly specified.

## Directory Structure

```
src/
├── index.ts          <- server entry point
├── mcp/              <- tool/resource/prompt registration
├── adapters/         <- transport, storage, index adapters
├── services/         <- application services
├── types/            <- TypeScript types
└── __tests__/        <- MCP behavior tests

docs/
├── requirements/     <- PRD
├── design/core/      <- MCP contracts and data model
├── standards/        <- Dev standards
├── notes/            <- Working notes
└── ssot/             <- Decisions and traceability support
```

## Coding Standards

- Files: kebab-case
- Types/classes: PascalCase
- Functions/variables: camelCase
- Constants: UPPER_SNAKE_CASE
- No `any` type
- No `console.log` in production code; use structured logging when needed
- No hardcoded environment variables
- Keep protocol handlers thin; put business behavior in services

## Prohibited

- Do NOT implement MCP tools not in specs
- Do NOT change tool schemas without updating SSOT-3_API_CONTRACT
- Do NOT change persisted entities without updating SSOT-4_DATA_MODEL
- Do NOT couple tool handlers directly to a concrete database
- Do NOT submit PRs without MCP behavior tests
- Do NOT swallow errors

## Pre-Code Gate (3-gate enforcement)

コードを1行でも書く前に Gate A/B/C を確認する。
状態は .framework/gates.json で管理。

- Gate A: 開発環境（package.json, node_modules, .env, CI等）
- Gate B: 計画（.framework/plan.json にwave分類済み、GitHub Issues作成済み）
- Gate C: SSOT完全性（機能仕様書に §3-E/F/G/H が記入済み）

全Gate passed でなければ src/ 以下の編集は .claude/hooks/pre-code-gate.sh でブロックされる。

## GitHub Integration

タスク管理は GitHub Issues + Projects で行う。

```bash
gh auth login
framework plan --sync
framework status --github
```

## Workflow Orchestration

このプロジェクトには4つの専門スキルが .claude/skills/ に配置されている。
各スキルには専門エージェントが定義されており、品質の高い成果物を生成する。

### スキル起動ルール

**明示的なフェーズ指示**（以下のキーワード）→ 即座に Skill ツールで対応スキルを起動:

| キーワード | 起動スキル |
|-----------|-----------|
| 「ディスカバリー」「何を作りたい？」「アイデア」 | /discovery |
| 「設計」「仕様を作って」「スペック」「アーキテクチャ」 | /design |
| 「実装開始」「コードを書いて」「タスク分解」 | /implement |
| 「レビュー」「監査」「audit」 | /review |

**タスク指示**（「DEV-XXXを実装して」「〇〇機能を作って」等）→ 適切なスキルの起動を提案:
- 新機能の場合: 「/design で設計してから /implement で実装しますか？」
- 既存機能の修正: 「/implement で実装しますか？」
- 品質確認: 「/review で監査しますか？」
ユーザーが承認したら Skill ツールで起動。不要と判断されたらスキップ。

**軽微な作業**（typo修正、設定変更、1ファイルの小修正等）→ スキル不要。直接作業。

### LLM Control Policy

Shirube の設計・実装では、LLMに進行制御を委ねず、deterministic control を基本とする。

- default: script / daemon / queue runner / CI / GitHub Actions / DB trigger / 明示CLI
- Hook fallback: `PreToolUse` block、`SessionStart` / `UserPromptSubmit` context injection、`SessionStart` state recovery、`PostToolUse` immediate verification、`Stop` completion-time verification のみ
- queue進行、状態遷移、retry、finalize、外部投稿は Runner / deterministic service が持つ
- LLM runtime adapter は runtime-specific invocation と structured result の返却だけを担当する
- 起動時注入は bounded restart pack に限定し、全文memory dumpをしない
- memory/context retrieval は provenance付きcontextとして扱い、secret / PII / local path をredactする

### Design Thinking Flow

`/design` で自動化、エージェント挙動、Hook、memory、queue、Issue/PR生成、runtime orchestration を扱う場合は、成果物作成前に以下を整理する。

1. Source of Truth: どのartifact/stateが正か
2. Control split: deterministic control と LLM judgment の分担
3. Hook justification: Hook採用時の不可避ケース該当根拠
4. Runtime boundary: Runner、LLM adapter、memory/context、delivery adapter の責務
5. Startup context: SessionStartで入れるrestart packとon-demand検索に残す情報
6. Mechanical gates: 実装前、完了前、CIでblockする条件
7. Authority: Gate、CTO/L3、CEO判断が必要な変更

### フェーズ遷移
各スキル完了後、次のフェーズを提案する:
discovery → design → implement → review
ユーザー承認後に次スキルを Skill ツールで起動。

### Pre-Code Gate 連携
「実装開始」の場合:
1. Skill ツールで /implement を起動
2. /implement スキル内で `shirube gate check` と `shirube trace verify` を確認
3. 全Gate passed なら実装開始。未通過なら BLOCK 理由を報告。

## Knowledge & Memory

- .claude/memory/ — ADR, bug lessons, improvement records
- docs/standards/KNOWLEDGE_DIGEST.md — framework knowledge digest
