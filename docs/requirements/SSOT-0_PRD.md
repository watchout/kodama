# SSOT-0 PRD: Kodama

## 1. Product Thesis

Kodama is a shared context network for humans and agents. It gives MCP-compatible agents a single, grounded interface for retrieving organizational context without replacing the systems where that knowledge already lives.

## 2. Problem

Teams already have knowledge, but it is scattered across repositories, issues, pull requests, documents, chats, meetings, tickets, databases, file servers, and agent sessions. Agents frequently act with incomplete context because the relevant source, decision, or artifact is not available at the moment of work.

## 3. Target Users

- AI-native engineering teams using Claude Code, Codex, Cursor, ChatGPT, or custom agents.
- Organizations that need source-grounded context packs for human-agent and agent-agent work.
- Teams with existing tools such as GitHub, Notion, Drive, Slack, Jira, Linear, Confluence, SharePoint, Postgres, local files, or internal APIs.

## 4. Goals

- Register existing sources without forcing data migration.
- Normalize source items, facts, decisions, tasks, questions, and artifacts into a shared context graph.
- Preserve source provenance, permissions, timestamps, and freshness.
- Provide grounded search and task-specific context packs.
- Let MCP-compatible agents retrieve the same organizational context.
- Extract useful context from agent sessions and human-agent interactions.
- Promote important findings into durable company memory.
- Support local, self-hosted, customer-cloud, and managed deployment modes.

## 5. Non-Goals

- Replacing Notion, GitHub, Google Drive, Slack, or internal databases.
- Storing raw logs as the primary durable memory format.
- Building every connector in the first release.
- Returning unsourced answers as company memory.

## 6. MVP Scope

The first useful version proves the context network with:

1. Local file and GitHub source adapters.
2. Structured memory records for fact, decision, task, question, and artifact.
3. Source references and citations.
4. Keyword search first, with vector search optional.
5. `kodama.get_context` for task-specific agent briefing.
6. `kodama.ingest_agent_session` for extracting useful context from agent output.
7. Human approval flow for promoting candidate memory.
8. Simple MCP server with local SQLite or Postgres storage.

## 7. Core Principle

Your data stays where it is. Your agents get one context interface.
