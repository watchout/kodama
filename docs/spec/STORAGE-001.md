---
id: SPEC-STORAGE-001-001
status: Draft
traces:
  impl: [IMPL-STORAGE-001-001]
  verify: [VERIFY-STORAGE-001-001]
  ops: [OPS-STORAGE-001-001]
---

# SPEC: Persistent Context Store

## 0. メタ
- 作成日: 2026-05-23
- 対象 feature: STORAGE-001
- 対象領域: SQLite-first persistent store for file-derived context
- 関連 PRD: `docs/requirements/SSOT-0_PRD.md`
- 関連 data model: `docs/design/core/SSOT-4_DATA_MODEL.md`
- Tracking issue: https://github.com/watchout/kodama/issues/5
- 前提 feature: `SOURCEREGISTRY-001`

## 1. 目的
STORAGE-001 は、Kodama が local files first の dogfood を進めるための永続 store 境界を定義する。目的は、ファイルをカテゴリ棚として保存することではなく、source、document、chunk、entity、relation、retrieval run を保存し、後続の sync/search/context pack が同じ provenance と関係ネットワークを参照できる状態にすることである。

この feature は Wasurezu の bio-inspired memory model を Kodama の file context に転用する。Wasurezu の `raw_events -> memory_atoms -> memory_edges -> active_memory_pack` に対応して、Kodama は `source snapshots -> documents -> chunks/entities -> relations -> context pack` を扱う。

## 2. 非目的
- ファイルシステム走査、内容取り込み、差分同期は `LOCALFILES-001` が扱う。
- MCP 検索 tool、回答生成、context pack 生成は `SEARCH-001` が扱う。
- vector embedding、HNSW、RAPTOR-style hierarchical summaries は post-MVP の拡張とし、この feature では差し替え可能な列・境界だけを残す。
- strict governance、merge-authority、role-binding の有効化は扱わない。
- native P2P/device-agent sync は扱わない。MVP は Kodama process から見える local path、mounted volume、sshfs 等を source として扱う。

## 3. ユーザーストーリー
- IYASAKA internal dogfood operator として、登録済み local_files source の document/chunk を SQLite に永続化し、後続 sync/search が同じ provenance を参照できるようにしたい。
- MCP-compatible agent として、ファイル名、symbol、issue id、設計語彙などの exact/lexical anchor を使って、後続検索で再現可能な chunk index を使いたい。
- Dev lead として、検索結果がどの source/document/chunk/relation から来たかを retrieval run として追跡し、誤検索や Shirube 起因バグを issue 化できるようにしたい。
- Architect として、vector-only ではなく exact、FTS/BM25、relation expansion、将来の vector/rerank を差し替え可能な store 境界にしたい。

## 4. 機能要件
### 4.0 設計判断
#### 4.0.1 採択する検索・管理思想
Kodama は「カテゴリを選んで取り出す」方式を主構造にしない。カテゴリやタグは metadata または relation の一部として扱う。

主構造は以下である。

```text
Source -> Snapshot -> Document -> Chunk
                           |        |
                           v        v
                         Entity -- Relation -- Entity/Chunk/Document
```

検索時は、exact match、FTS/BM25、metadata、relation expansion、将来の vector/rerank を統合し、provenance 付き context pack に変換する。

#### 4.0.2 SQLite-first
MVP は SQLite を主 backend とする。理由は local dogfood、single-user operation、portable DB、FTS5 の利用に適しているためである。

Postgres/pgvector は team/enterprise posture、remote service、multi-user operation、large-scale vector index が必要になった時点で追加する。Store interface は SQLite 固有 API を service 層へ漏らしてはならない。

### 4.1 FR-STORAGE-001: Store interface
実装は少なくとも `SourceStore`、`DocumentStore`、`EntityStore`、`RelationStore`、`RetrievalRunStore` の論理境界を持つ。

### 4.2 FR-STORAGE-002: Source snapshot
Source のある時点の観測状態を `source_snapshots` として保存できる。snapshot は sync run、content hash、metadata、created_at を持つ。

### 4.3 FR-STORAGE-003: Document persistence
Document は source 配下の retrievable item として保存できる。local file の場合は canonical path、display path、content hash、mime/type hint、size、mtime、storage mode、visibility metadata を保持する。

### 4.4 FR-STORAGE-004: Chunk persistence
Document は検索・引用単位の chunk に分割して保存できる。chunk は ordinal、byte/line range、content text、content hash、metadata を持つ。chunk id は source id、document id、content hash、range から安定生成できる設計にする。

### 4.5 FR-STORAGE-005: Entity persistence
Entity は file、symbol、repo、issue、PR、task、decision、agent、product、topic などを表せる。MVP では entity type を string enum とし、未知 type は拒否する。

### 4.6 FR-STORAGE-006: Relation persistence
Relation は document、chunk、entity 間の typed edge として保存できる。edge は type、weight、confidence、source refs、first_seen_at、last_seen_at、metadata を持つ。

MVP で予約する relation type:

| type | 意味 |
|---|---|
| `contains` | document が chunk/entity を含む |
| `mentions` | chunk/document が entity を言及する |
| `defines` | chunk/document が symbol/entity を定義する |
| `derived_from` | entity/context が source span から抽出された |
| `same_topic` | topic/entity/chunk が同じ主題に属する |
| `co_changed` | 同じ変更・sync window で観測された |
| `co_retrieved` | 同じ retrieval run で取得された |
| `supports` | claim/context を裏付ける |
| `contradicts` | claim/context と矛盾する |
| `supersedes` | 古い context を置き換える |

### 4.7 FR-STORAGE-007: FTS-ready text index
SQLite backend は document/chunk text を FTS5 で検索できる形にする。FTS virtual table の有無は adapter 内部詳細だが、service 層は lexical search を呼べる。

### 4.8 FR-STORAGE-008: Retrieval run audit
検索は後続 feature だが、retrieval run の記録先をこの feature で用意する。保存対象は query、anchors、candidate ids、selected ids、score summary、missing context、created_at である。

### 4.9 FR-STORAGE-009: Provenance
すべての derived data は source/document/chunk の provenance を失ってはならない。検索結果や context record は根拠 source に戻れる必要がある。

## 5. インターフェース
### 5.1 Store interface
STORAGE-001 は runtime MCP tool を追加しない。実装は TypeScript service/adapter interface を公開面とする。

| interface | responsibility |
|---|---|
| `DocumentStore` | persist/read documents, chunks, and lexical chunk search |
| `EntityStore` | persist/read typed entities |
| `RelationStore` | persist/read weighted graph edges and adjacency |
| `RetrievalRunStore` | persist retrieval audit records |

### 5.2 Logical data model
The store interface must support these logical tables. Physical SQLite details remain adapter-internal.

### 5.1 Logical tables
| table | purpose |
|---|---|
| `sources` | registered external source |
| `source_snapshots` | observed source state at sync time |
| `documents` | retrievable file/page/issue/thread |
| `document_chunks` | searchable and citeable text unit |
| `entities` | repo/file/symbol/issue/PR/task/decision/topic/agent |
| `relations` | weighted typed edge between records |
| `retrieval_runs` | audit trail of retrieval behavior |

### 5.3 Scoring fields
The schema must preserve enough fields for future activation-based search:

| field | applies to | purpose |
|---|---|---|
| `weight` | relation | strength of edge |
| `confidence` | entity/relation | extraction confidence |
| `activation_count` | relation | retrieval/use reinforcement |
| `last_activated_at` | relation | decay and recency |
| `status` | document/entity/relation | active/superseded/archived |

## 6. 非機能要件
- Store operations must be deterministic and testable without network access.
- SQLite backend must run locally without external services.
- Schema migrations must be explicit and versioned.
- Store implementations must not execute file paths or source config values as shell commands.
- No secret material may be stored in document metadata or source config.

### 6.1 性能
Local SQLite adapter should support inserting 100 documents and 500 chunks inside the normal test timeout. Exact target latency is set during implementation after driver selection.

### 6.2 可用性
Store failures must return typed service errors. Runtime fallback from durable SQLite to in-memory storage is not allowed because it would silently lose context.

### 6.3 セキュリティ要件
#### 6.3.1 STRIDE
| カテゴリ | 該当内容 |
|---|---|
| Spoofing | Store records preserve source and actor metadata when provided; they do not authenticate actors. |
| Tampering | Documents, chunks, entities, and relations are validated before persistence. |
| Repudiation | Retrieval runs and provenance records provide read/search auditability. |
| Information Disclosure | Secret-like metadata and source config keys must be rejected or redacted before persistence. |
| Denial of Service | Chunk text and metadata size limits are enforced by service validation. |
| Elevation of Privilege | STORAGE-001 stores policy metadata but does not grant read permission by itself. |

#### 6.3.2 OWASP Top 10:2021
- A01 Broken Access Control: Store layer preserves scope/visibility fields for future policy filtering.
- A02 Cryptographic Failures: Secrets are not stored in source config or document metadata.
- A03 Injection: FTS queries use parameter binding and are not string-interpolated into SQL.
- A04 Insecure Design: Registration or storage does not imply read permission to returned context.
- A05 Security Misconfiguration: SQLite path and migration state are explicit.
- A06 Vulnerable and Outdated Components: SQLite driver selection is reviewed through dependency lockfile.
- A07 Identification and Authentication Failures: Authentication remains outside this feature.
- A08 Software and Data Integrity Failures: Content hashes and provenance detect stale or mismatched records.
- A09 Security Logging and Monitoring Failures: Retrieval runs and provenance records provide audit trail.
- A10 Server-Side Request Forgery: STORAGE-001 performs no remote fetches.

### 6.4 監査ログ要件
Retrieval run records must include `query`, `anchors`, `candidate_ids`, `selected_ids`, `score_summary`, `missing_context`, and `created_at`.

## 7. 受入基準
### AC-STORAGE-001-001: persist document with chunks
```gherkin
Feature: Persistent Context Store
  Scenario: Persist a local file document and chunks
    Given a registered local_files source
    When a document and two chunks are stored
    Then the document can be fetched with its chunks and source provenance
```

### AC-STORAGE-001-002: lexical search over chunks
```gherkin
Feature: Persistent Context Store
  Scenario: Search chunk text through store interface
    Given chunks containing "GraphRAG" and "SQLite FTS5"
    When lexical search is invoked with "GraphRAG"
    Then the matching chunk is returned with document and source ids
```

### AC-STORAGE-001-003: relation expansion basis
```gherkin
Feature: Persistent Context Store
  Scenario: Store and read relation edges
    Given two chunks and one entity
    When mentions and same_topic relations are stored
    Then relation queries can return adjacent records with weights
```

### AC-STORAGE-001-004: retrieval audit
```gherkin
Feature: Persistent Context Store
  Scenario: Record retrieval run
    Given a lexical search result
    When a retrieval run is recorded
    Then query, candidate ids, selected ids, and score summary are persisted
```

## 8. 前提・依存
- `SOURCEREGISTRY-001` provides source identity and storage mode semantics.
- `docs/design/core/SSOT-4_DATA_MODEL.md` defines Source, Document, ContextRecord, ContextPack, and storage modes.
- SQLite driver selection is deferred to implementation but must stay behind adapter interface.
- Local file walking and content extraction are implemented by `LOCALFILES-001`, not this feature.
- Search MCP tools and context pack assembly are implemented by `SEARCH-001`, not this feature.

## 9. Research Basis
この feature は以下の調査結果を設計根拠にする。

| source | adopted point |
|---|---|
| SQLite FTS5 documentation | SQLite-first lexical/BM25 search is suitable for MVP exact and full-text retrieval. |
| Microsoft GraphRAG | Relation graph over extracted entities improves corpus-level context retrieval. |
| RAPTOR | Later hierarchical summaries should be supported by keeping chunks and summaries separate. |
| Wasurezu Living Memory Research | Raw ledger plus atoms/edges/activation maps to Kodama file-derived context. |
| Wasurezu Recovery Evaluation | Search layer should stay replaceable while source provenance remains auditable. |

## 10. 制御機構選定原則
### 10.1 採択原則
This feature uses script-controlled deterministic checks, typed store interfaces, schema migrations, and unit tests. Hook-based or LLM-mediated behavior is not used for persistence correctness.

### 10.2 本 spec の選定
| FR | 機構 | 不可避 case 該当 | 根拠 |
|---|---|---|---|
| FR-STORAGE-001 | script | 該当なし: TypeScript interface and testsで制御する | Store boundary is deterministic and locally testable |
| FR-STORAGE-002 | script | 該当なし: schema and insert testsで制御する | Snapshot persistence has bounded fields |
| FR-STORAGE-003 | script | 該当なし: schema and adapter testsで制御する | Document persistence does not require LLM judgment |
| FR-STORAGE-004 | script | 該当なし: typed validation and chunk testsで制御する | Chunk identity and ranges are deterministic |
| FR-STORAGE-005 | script | 該当なし: enum validationで制御する | Entity type acceptance is a closed set |
| FR-STORAGE-006 | script | 該当なし: enum validation and adjacency testsで制御する | Relation graph storage is deterministic |
| FR-STORAGE-007 | script | 該当なし: SQLite FTS query testsで制御する | Lexical search behavior is adapter-owned |
| FR-STORAGE-008 | script | 該当なし: persistence testsで制御する | Retrieval audit is data insertion/readback |
| FR-STORAGE-009 | script | 該当なし: provenance fields and testsで制御する | Provenance preservation can be asserted |

### 10.3 違反時 rollback
If persistence correctness depends on prompt text, hook side effects, or untested LLM classification, the implementation is rejected and refactored into typed service logic plus deterministic tests.

## 11. Test Coverage Gap
| gap 種別 | 内容 | 解消アクション |
|---|---|---|
| Coverage gap | SQLite adapter does not exist yet | Add store adapter tests before local file sync |
| Retrieval gap | Hybrid ranking is not implemented | Start with FTS5/exact/relation expansion, add vector later |
| Migration gap | Schema versioning is not defined | Add explicit migration table in implementation |
| Governance gap | Role bindings are not configured | Keep standard/lightweight mode and record provenance only |

## 12. Acceptance Criteria BDD
| acceptance id | test file |
|---|---|
| AC-STORAGE-001-001 | `tests/context-store.test.ts` |
| AC-STORAGE-001-002 | `tests/context-store.test.ts` |
| AC-STORAGE-001-003 | `tests/context-store.test.ts` |
| AC-STORAGE-001-004 | `tests/context-store.test.ts` |

## §Evidence
### 実 file 引用
- `docs/design/core/SSOT-4_DATA_MODEL.md` defines storage modes and core entities.
- `docs/spec/SOURCEREGISTRY-001.md` establishes that storage implementation must stay behind an adapter.
- `src/adapters/source-store.ts` currently provides the existing SourceStore pattern used by `SOURCEREGISTRY-001`.
- `/Users/yuji/Developer/iyasaka-arc/context/wasurezu-living-memory-research.md` defines the raw ledger, atom, edge, activation, and retrieval-run model used as design input.
- `/Users/yuji/Developer/wasurezu-main/docs/operations/RECOVERY_EVALUATION.md` defines the layered retrieval and provenance-preserving recovery standard used as design input.

### Web 検索 / 公式 doc URL
- SQLite FTS5: https://www.sqlite.org/fts5.html
- Microsoft GraphRAG: https://www.microsoft.com/en-us/research/project/graphrag/
- RAPTOR: https://arxiv.org/abs/2401.18059
- pgvector HNSW reference for later Postgres migration: https://github.com/pgvector/pgvector
