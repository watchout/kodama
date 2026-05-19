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
