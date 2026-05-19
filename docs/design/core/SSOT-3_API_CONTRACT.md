# SSOT-3 API Contract: Kodama MCP Server

## 1. Transport

Kodama is an MCP server. The initial implementation should support stdio for local agent integration. HTTP transport may be added behind a narrow adapter when specified.

## 2. Tool Surface

### `kodama.register_source`

Register a source adapter and its configuration.

Input:

```ts
{
  type: "local_files" | "github";
  name: string;
  config: Record<string, unknown>;
  storage_mode: "copy" | "index" | "reference" | "ephemeral";
}
```

Output:

```ts
{
  source_id: string;
  status: "registered";
}
```

### `kodama.sync_source`

Ingest or refresh a source according to its storage mode.

### `kodama.search`

Search connected context with filters and source citations.

### `kodama.get_context`

Build a task-specific context pack for an agent.

### `kodama.answer_with_sources`

Answer a question using grounded sources and citations.

### `kodama.remember`

Save a structured fact, decision, task, question, or artifact.

### `kodama.promote`

Promote candidate context into approved company memory.

### `kodama.ingest_agent_session`

Extract decisions, facts, tasks, questions, and artifacts from an agent session.

### `kodama.explain_context`

Explain why a context item was selected, where it came from, and who can see it.

## 3. Error Contract

All tools return structured MCP errors for invalid input, missing source, permission denial, unsupported adapter, and unavailable source content. Errors must include a stable code and a human-readable message.
