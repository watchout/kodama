# Initial Design

## Product Thesis

Kodama is a shared context network for humans and agents.

As agents become part of daily work, companies will need a durable way to preserve not only files and chat logs, but the context behind work:

- what was decided
- why it was decided
- which sources supported it
- who or which agent acted on it
- what remains unresolved
- which artifacts were produced
- what context should be given to the next agent

Kodama should become a company-scale context layer that agents and humans can both use.

## Not a Replacement for Existing Tools

Kodama should not try to become a full replacement for Notion, GitHub, Google Drive, Slack, or internal databases.

Instead, it should sit above them:

```text
Sources
  GitHub / Notion / Drive / Slack / Jira / Linear / Confluence / SharePoint
  local files / NAS / S3 / Postgres / internal APIs / PDFs / spreadsheets

Kodama
  connector registry
  source index
  normalized context graph
  retrieval and ranking
  policy and redaction
  context pack generation
  audit and provenance

Consumers
  Claude Code / Codex / ChatGPT / Cursor / custom agents / internal bots
  humans through UI, search, and review flows
```

## Relationship With wasurezu

wasurezu and kodama should remain separate MCPs at first.

```text
wasurezu
  Agent working memory
  Session continuity
  Compaction recovery
  Decisions, task state, and knowledge learned during agent work

kodama
  Organizational shared context
  Multi-source retrieval
  Company memory
  Source-grounded context packs for any agent
```

Integration points:

- Kodama can include wasurezu memories as one source.
- wasurezu can promote important session learnings into Kodama.
- An agent starting work should read both:
  - wasurezu for its own prior working memory
  - kodama for shared company/project context

## Data Model

Kodama should avoid storing raw logs as the primary memory format. Raw source material can be referenced or indexed, but durable company memory should be structured.

Initial entities:

- `Source`
  - External system, repository, folder, document collection, database, or stream.
- `Document`
  - A retrievable source item: page, file, issue, PR, message thread, transcript.
- `Fact`
  - A claim about the business, system, customer, project, or process.
- `Decision`
  - A decision with rationale, alternatives, owner, scope, and review conditions.
- `Task`
  - Work item, status, blocker, next action, related artifacts.
- `Question`
  - Open issue that needs human or agent resolution.
- `Artifact`
  - PR, commit, design doc, spreadsheet, report, generated file, or analysis output.
- `ContextPack`
  - Task-specific bundle of grounded context returned to an agent.

Common fields:

```ts
type ContextRecord = {
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
};
```

## Storage Modes

Kodama should support different enterprise constraints.

```text
copy mode
  Copy source content into Kodama-managed storage.

index mode
  Store extracted text, metadata, and embeddings.

reference mode
  Store only source URIs, metadata, and permissions; fetch source content on demand.

ephemeral mode
  Read during retrieval but do not persist content or embeddings.
```

Deployment targets:

- local SQLite for individual or prototype use
- Postgres plus pgvector for teams
- self-hosted Postgres/OpenSearch/Qdrant for enterprise
- customer cloud deployment
- managed cloud deployment
- external-source-only mode for strict data residency environments

## MCP Tool Surface

Initial MCP tools should be small and composable.

```text
kodama.register_source
  Register a source adapter and its configuration.

kodama.sync_source
  Ingest or refresh a source according to its storage mode.

kodama.search
  Search across connected context with filters and source citations.

kodama.get_context
  Build a task-specific context pack for an agent.

kodama.answer_with_sources
  Answer a question using grounded sources and citations.

kodama.remember
  Save a structured fact, decision, task, question, or artifact.

kodama.promote
  Promote candidate context into approved company memory.

kodama.ingest_agent_session
  Extract decisions, facts, tasks, questions, and artifacts from an agent session.

kodama.explain_context
  Explain why a context item was selected, where it came from, and who can see it.
```

## Retrieval Flow

```text
1. Agent provides task, project, repo, user, and optional files.
2. Kodama resolves scope and permissions.
3. Kodama searches connected sources and structured company memory.
4. Kodama ranks by relevance, freshness, authority, and evidence quality.
5. Kodama builds a compact context pack.
6. Agent receives context with citations and follow-up search handles.
```

## Memory Promotion Flow

Not every message or session summary should become company memory.

```text
raw source
  Full logs, documents, messages, transcripts, issues, PRs

candidate memory
  Extracted facts, decisions, tasks, questions, artifacts

approved memory
  Human-reviewed or policy-approved company context

source of truth
  Original system or durable document where the final record belongs
```

This promotion flow is important because a useful company memory layer must stay clean, sourced, and reviewable.

## Security and Governance

Enterprise use requires policy support from the beginning:

- source-level permissions
- user and agent identity
- RBAC/ABAC hooks
- redaction before context is returned
- audit log for reads and writes
- source provenance on every context record
- data residency controls
- support for no-telemetry/self-hosted operation

## MVP

The first useful version should focus on proving the context network, not building every connector.

Suggested MVP:

1. Local files and GitHub source adapters
2. Structured memory records: fact, decision, task, question, artifact
3. Source references and citations
4. Keyword search first, vector search optional
5. `get_context` for task-specific agent briefing
6. `ingest_agent_session` for extracting useful context from agent output
7. Human approval flow for promoting candidate memory
8. Simple MCP server with local SQLite or Postgres storage

## Naming Note

Kodama can be explained without leaning on folklore:

> Ask once, and the right context echoes back from your organization's knowledge roots.

