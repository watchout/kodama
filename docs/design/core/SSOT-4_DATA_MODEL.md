# SSOT-4 Data Model: Kodama

## 1. Storage Modes

Kodama supports four storage modes:

- `copy`: copy source content into Kodama-managed storage.
- `index`: store extracted text, metadata, and embeddings.
- `reference`: store only source URIs, metadata, and permissions; fetch content on demand.
- `ephemeral`: read during retrieval but do not persist content or embeddings.

## 2. Deployment Storage Targets

- Local SQLite for individual or prototype use.
- Postgres plus pgvector for teams.
- Self-hosted Postgres/OpenSearch/Qdrant for enterprise.
- Customer cloud deployment.
- Managed cloud deployment.
- External-source-only mode for strict data residency environments.

## 3. Entities

### `Source`

External system, repository, folder, document collection, database, or stream.

### `Document`

A retrievable source item: page, file, issue, PR, message thread, transcript, or record.

### `DocumentChunk`

Smallest searchable and citeable unit derived from a `Document`.

```ts
{
  id: string;
  document_id: string;
  source_id: string;
  ordinal: number;
  text: string;
  content_hash: string;
  range?: {
    start_line?: number;
    end_line?: number;
    start_byte?: number;
    end_byte?: number;
  };
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}
```

### `Entity`

Named or inferred item that can participate in retrieval graph activation.

Initial entity types:

- `repo`
- `file`
- `symbol`
- `issue`
- `pull_request`
- `task`
- `decision`
- `agent`
- `product`
- `topic`

### `Relation`

Weighted typed edge between documents, chunks, entities, and future context records.

Initial relation types:

- `contains`
- `mentions`
- `defines`
- `derived_from`
- `same_topic`
- `co_changed`
- `co_retrieved`
- `supports`
- `contradicts`
- `supersedes`

Relations are the primary mechanism for bio-inspired retrieval. Categories and tags are metadata or relation edges, not the main storage structure.

### `ContextRecord`

Structured durable memory.

```ts
{
  id: string;
  type: "fact" | "decision" | "task" | "question" | "artifact";
  title: string;
  content: string;
  scope: {
    organization?: string;
    team?: string;
    project?: string;
    repo?: string;
  };
  source_refs: SourceRef[];
  evidence_refs: SourceRef[];
  status: "candidate" | "active" | "superseded" | "rejected" | "archived";
  confidence?: number;
  visibility?: "private" | "team" | "organization" | "restricted";
  created_at: string;
  updated_at: string;
  expires_at?: string | null;
}
```

### `ContextPack`

Task-specific bundle of grounded context returned to an agent.

### `SourceRef`

Pointer to a source-backed claim.

## 4. Promotion Flow

Raw sources are extracted into candidate memory. Candidate memory becomes approved memory only after human review or a specified policy allows promotion. Every active record must retain source and evidence references.

## 5. Governance Requirements

- Enforce source-level permissions.
- Preserve user and agent identity for reads and writes.
- Support RBAC/ABAC hooks.
- Redact restricted content before context is returned.
- Write audit logs for reads, writes, syncs, and promotions.
- Preserve source provenance on every context record.
- Support no-telemetry and self-hosted operation.

## 6. Retrieval Model

Kodama retrieval is layered:

1. Scope, permission, and ignore-policy filtering.
2. Exact lookup for path, filename, symbol, issue, PR, and source ids.
3. Lexical search through SQLite FTS5/BM25 in local mode.
4. Relation expansion over `Relation` edges.
5. Optional dense vector search, rerank, and hierarchical summaries in later features.
6. Context pack assembly with source provenance.

The system must avoid vector-only retrieval as the default. File and code search require exact anchors and lexical recall before semantic expansion.
