import type {
  SourceRecord,
  SourceRegistryAuditEvent,
  SourceType,
  SourceVisibility,
} from "../types/source-registry.js";

export interface SourceListFilter {
  accountId?: string;
  sourceType?: SourceType;
  visibility?: SourceVisibility;
}

export interface SourceStore {
  createSource(record: SourceRecord): Promise<void>;
  getSource(sourceId: string): Promise<SourceRecord | null>;
  listSources(filter?: SourceListFilter): Promise<SourceRecord[]>;
}

export interface DurableAuditSourceStore extends SourceStore {
  createSourceWithAudit(
    record: SourceRecord,
    auditEvent: SourceRegistryAuditEvent,
  ): Promise<void>;
  recordAuditEvent(event: SourceRegistryAuditEvent): Promise<void>;
}

export class SourceIdCollisionError extends Error {
  constructor(sourceId: string) {
    super(`Source id already exists: ${sourceId}`);
    this.name = "SourceIdCollisionError";
  }
}

export class SourceAuditPersistenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SourceAuditPersistenceError";
  }
}

export class InMemorySourceStore implements SourceStore {
  private readonly sources = new Map<string, SourceRecord>();

  async createSource(record: SourceRecord): Promise<void> {
    if (this.sources.has(record.id)) {
      throw new SourceIdCollisionError(record.id);
    }

    this.sources.set(record.id, record);
  }

  async getSource(sourceId: string): Promise<SourceRecord | null> {
    return this.sources.get(sourceId) ?? null;
  }

  async listSources(filter: SourceListFilter = {}): Promise<SourceRecord[]> {
    return [...this.sources.values()].filter((source) => {
      if (filter.accountId && source.accountId !== filter.accountId) {
        return false;
      }

      if (filter.sourceType && source.type !== filter.sourceType) {
        return false;
      }

      if (filter.visibility && source.visibility !== filter.visibility) {
        return false;
      }

      return true;
    });
  }
}

export function isDurableAuditSourceStore(
  store: SourceStore,
): store is DurableAuditSourceStore {
  const candidate = store as Partial<DurableAuditSourceStore>;
  return (
    typeof candidate.createSourceWithAudit === "function" &&
    typeof candidate.recordAuditEvent === "function"
  );
}
