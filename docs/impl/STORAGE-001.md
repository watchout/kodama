---
id: IMPL-STORAGE-001-001
status: Draft
traces:
  spec: [SPEC-STORAGE-001-001]
  verify: [VERIFY-STORAGE-001-001]
  ops: [OPS-STORAGE-001-001]
---

# IMPL: Persistent Context Store

## 0. 対応するSPEC
- SPEC: `SPEC-STORAGE-001-001`
- Feature: `STORAGE-001`

## 1. 実装方針
Store interface を先に固定し、SQLite adapter をその下に置く。MCP tool や local filesystem adapter はこの feature では追加しない。

```text
src/types/context-store.ts
src/adapters/context-store.ts
src/adapters/sqlite-context-store.ts
src/services/context-store-service.ts
tests/context-store.test.ts
```

SQLite dependency は既存 package と Node runtime を確認してから選定する。最小方針は sync API を持つ local embedded driver を採用し、テストで一時 DB を使う。

## 2. 新規ファイル
| path | purpose |
|---|---|
| `src/types/context-store.ts` | Document, Chunk, Entity, Relation, RetrievalRun domain types |
| `src/adapters/context-store.ts` | Store interfaces and in-memory test implementation |
| `src/adapters/sqlite-context-store.ts` | SQLite persistent adapter |
| `src/services/context-store-service.ts` | Store orchestration and validation |
| `tests/context-store.test.ts` | Acceptance and adapter tests |

## 3. 主要型
```ts
type EntityType =
  | "repo"
  | "file"
  | "symbol"
  | "issue"
  | "pull_request"
  | "task"
  | "decision"
  | "agent"
  | "product"
  | "topic";

type RelationType =
  | "contains"
  | "mentions"
  | "defines"
  | "derived_from"
  | "same_topic"
  | "co_changed"
  | "co_retrieved"
  | "supports"
  | "contradicts"
  | "supersedes";
```

## 4. Store interfaces
```ts
interface DocumentStore {
  putDocument(document: DocumentRecord): Promise<void>;
  getDocument(id: string): Promise<DocumentRecord | null>;
  putChunks(chunks: DocumentChunkRecord[]): Promise<void>;
  getChunksByDocument(documentId: string): Promise<DocumentChunkRecord[]>;
  searchChunksLexical(query: string, limit: number): Promise<LexicalSearchResult[]>;
}

interface EntityStore {
  putEntity(entity: EntityRecord): Promise<void>;
  getEntity(id: string): Promise<EntityRecord | null>;
}

interface RelationStore {
  putRelation(relation: RelationRecord): Promise<void>;
  getAdjacent(recordId: string, limit: number): Promise<RelationRecord[]>;
}

interface RetrievalRunStore {
  recordRetrievalRun(run: RetrievalRunRecord): Promise<void>;
}
```

## 5. SQLite schema
```sql
CREATE TABLE schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL
);

CREATE TABLE documents (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  snapshot_id TEXT,
  uri TEXT NOT NULL,
  display_path TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  mime_type TEXT,
  size_bytes INTEGER,
  modified_at TEXT,
  status TEXT NOT NULL,
  metadata_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE document_chunks (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  ordinal INTEGER NOT NULL,
  text TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  start_line INTEGER,
  end_line INTEGER,
  metadata_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE VIRTUAL TABLE document_chunks_fts USING fts5(
  text,
  chunk_id UNINDEXED,
  document_id UNINDEXED,
  source_id UNINDEXED
);

CREATE TABLE entities (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  canonical_ref TEXT,
  confidence REAL,
  status TEXT NOT NULL,
  metadata_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE relations (
  id TEXT PRIMARY KEY,
  from_record_id TEXT NOT NULL,
  to_record_id TEXT NOT NULL,
  type TEXT NOT NULL,
  weight REAL NOT NULL,
  confidence REAL,
  source_refs_json TEXT NOT NULL,
  activation_count INTEGER NOT NULL DEFAULT 0,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  last_activated_at TEXT,
  metadata_json TEXT NOT NULL
);

CREATE TABLE retrieval_runs (
  id TEXT PRIMARY KEY,
  query TEXT NOT NULL,
  anchors_json TEXT NOT NULL,
  candidate_ids_json TEXT NOT NULL,
  selected_ids_json TEXT NOT NULL,
  score_summary_json TEXT NOT NULL,
  missing_context_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
```

## 6. 実装順
1. Add domain types and in-memory store tests.
2. Add SQLite adapter and migrations.
3. Add FTS5-backed `searchChunksLexical`.
4. Add relation adjacency queries.
5. Add retrieval run persistence.
6. Wire only internal services; do not expose a new MCP tool in this feature.

## 7. リスク
| risk | mitigation |
|---|---|
| SQLite dependency churn | Keep dependency isolated behind adapter |
| Overfitting schema before sync exists | Store only stable logical fields and JSON metadata escape hatch |
| Vector search pressure too early | Reserve metadata fields but keep MVP lexical/relation-based |
| Governance overreach | Keep strict start and merge authority disabled |

## §Evidence
### 実 file 引用
- `docs/spec/STORAGE-001.md` defines the accepted store behavior.
- `docs/design/core/SSOT-4_DATA_MODEL.md` defines Source, Document, ContextRecord, ContextPack, and storage modes.

### Research / official docs
- SQLite FTS5: https://www.sqlite.org/fts5.html
- Microsoft GraphRAG: https://www.microsoft.com/en-us/research/project/graphrag/
- RAPTOR: https://arxiv.org/abs/2401.18059
