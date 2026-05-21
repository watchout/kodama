import { randomUUID } from "node:crypto";

import {
  SourceIdCollisionError,
  type SourceStore,
} from "../adapters/source-store.js";
import type {
  RegisterSourceOutput,
  RegistrationContext,
  SourceRecord,
  SourceRegistryAuditEvent,
  SourceRegistryAuditSink,
} from "../types/source-registry.js";
import {
  SourceRegistryError,
  validateRegisterSourceInput,
} from "./source-registry-validation.js";

const MAX_ID_GENERATION_ATTEMPTS = 3;

interface SourceRegistryServiceOptions {
  auditSink?: SourceRegistryAuditSink;
}

export class SourceRegistryService {
  private readonly store: SourceStore;
  private readonly auditSink?: SourceRegistryAuditSink;

  constructor(store: SourceStore, options: SourceRegistryServiceOptions = {}) {
    this.store = store;
    this.auditSink = options.auditSink;
  }

  async registerSource(
    input: unknown,
    context: RegistrationContext = {},
  ): Promise<RegisterSourceOutput> {
    try {
      const validated = validateRegisterSourceInput(input);
      const now = new Date().toISOString();

      for (let attempt = 1; attempt <= MAX_ID_GENERATION_ATTEMPTS; attempt += 1) {
        const sourceId = createSourceId();
        const record: SourceRecord = {
          id: sourceId,
          type: validated.type,
          name: validated.name,
          config: validated.config,
          storageMode: validated.storage_mode,
          createdAt: now,
          updatedAt: now,
        };

        try {
          await this.store.createSource(record);
          await this.emitAudit({
            actorId: context.actorId,
            createdAt: now,
            eventType: "source.registered",
            result: "success",
            sourceId,
            sourceType: validated.type,
            storageMode: validated.storage_mode,
          });

          return {
            source_id: sourceId,
            status: "registered",
          };
        } catch (error) {
          if (
            error instanceof SourceIdCollisionError &&
            attempt < MAX_ID_GENERATION_ATTEMPTS
          ) {
            continue;
          }

          throw new SourceRegistryError(
            "SOURCE_REGISTRY_UNAVAILABLE",
            "Source registry is unavailable.",
          );
        }
      }

      throw new SourceRegistryError(
        "SOURCE_REGISTRY_UNAVAILABLE",
        "Source registry could not create a unique source id.",
      );
    } catch (error) {
      if (error instanceof SourceRegistryError) {
        await this.emitAudit({
          actorId: context.actorId,
          createdAt: new Date().toISOString(),
          errorCode: error.code,
          eventType: "source.registration_failed",
          result: "failure",
        });
      }

      throw error;
    }
  }

  private async emitAudit(event: SourceRegistryAuditEvent): Promise<void> {
    await this.auditSink?.(event);
  }
}

function createSourceId(): string {
  return `src_${randomUUID()}`;
}
