# kodama

> Shared context network for humans and agents.

Kodama is a context hub for AI-native teams. It connects the knowledge roots of an organization, turns them into shared memory, and lets any agent ask for the right context when it needs to act.

Ask once, and the right context echoes back.

## Concept

Modern teams already have knowledge, but it is scattered across tools:

- GitHub repositories, issues, pull requests, and discussions
- Notion, Google Drive, SharePoint, Confluence, and internal docs
- Slack, email, meeting notes, tickets, and project boards
- Databases, file servers, PDFs, spreadsheets, and internal APIs
- Agent sessions, tool logs, generated artifacts, and decisions

Kodama does not aim to replace those systems. It provides a shared context layer on top of them.

```text
Roots
  Existing data sources, documents, repositories, conversations, and systems

Trunk
  Shared organizational context, memory, source links, permissions, and history

Branches
  Human work and agent-generated outputs: PRs, documents, plans, analysis, tasks
```

## Positioning

Kodama is designed to work alongside the existing IYASAKA agent stack:

```text
aun
  Agent-agent-human communication layer

wasurezu
  Persistent memory for individual agents and coding sessions

shirube
  AI development framework and operating method

kodama
  Shared context network for teams, organizations, humans, and agents
```

## What Kodama Should Do

- Connect to existing sources without forcing data migration
- Normalize documents, messages, decisions, tasks, facts, and artifacts
- Preserve source provenance, permissions, timestamps, and freshness
- Provide grounded search and task-specific context packs
- Let any MCP-compatible agent retrieve the same organizational context
- Extract useful context from agent sessions and human-agent interactions
- Promote important findings into durable company memory
- Support local, self-hosted, customer-cloud, and managed deployment modes

## Core Principle

Your data stays where it is. Your agents get one context interface.

## Status

Early concept repository. The initial architecture and design notes are in [docs/initial-design.md](docs/initial-design.md).

## Development

Kodama uses the Shirube `mcp-server` profile for spec-first development and gate checks.

```bash
npm install
npm run build
npm test
node ../ai-dev-framework/dist/cli/index.js gate check
```
