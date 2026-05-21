import type { SourceRecord } from "../types/source-registry.js";

export interface SourceStore {
  createSource(record: SourceRecord): Promise<void>;
}

export class SourceIdCollisionError extends Error {
  constructor(sourceId: string) {
    super(`Source id already exists: ${sourceId}`);
    this.name = "SourceIdCollisionError";
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

  getSource(sourceId: string): SourceRecord | undefined {
    return this.sources.get(sourceId);
  }

  listSources(): SourceRecord[] {
    return [...this.sources.values()];
  }
}
