import { randomUUID } from "node:crypto";

import {
  SourceIdCollisionError,
  isDurableAuditSourceStore,
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
const DEFAULT_ACCOUNT_ID = "acct_local";
const DEFAULT_VISIBILITY = "private";

interface SourceRegistryServiceOptions {
  auditSink?: SourceRegistryAuditSink;
  onAuditError?: (error: unknown, event: SourceRegistryAuditEvent) => void;
}

export class SourceRegistryService {
  private readonly store: SourceStore;
  private readonly auditSink?: SourceRegistryAuditSink;
  private readonly onAuditError?: (
    error: unknown,
    event: SourceRegistryAuditEvent,
  ) => void;

  constructor(store: SourceStore, options: SourceRegistryServiceOptions = {}) {
    this.store = store;
    this.auditSink = options.auditSink;
    this.onAuditError = options.onAuditError;
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
          accountId: context.accountId ?? DEFAULT_ACCOUNT_ID,
          ...(context.ownerId ? { ownerId: context.ownerId } : {}),
          ...(context.workspaceId ? { workspaceId: context.workspaceId } : {}),
          ...(context.scopeViewId ? { scopeViewId: context.scopeViewId } : {}),
          visibility: context.visibility ?? DEFAULT_VISIBILITY,
          type: validated.type,
          name: validated.name,
          config: validated.config,
          storageMode: validated.storage_mode,
          createdAt: now,
          updatedAt: now,
        };
        const successAuditEvent: SourceRegistryAuditEvent = {
          accountId: record.accountId,
          actorId: context.actorId,
          createdAt: now,
          eventType: "source.registered",
          metadata: {
            phase: "source_registration",
          },
          result: "success",
          sourceId,
          sourceType: validated.type,
          storageMode: validated.storage_mode,
        };

        try {
          if (isDurableAuditSourceStore(this.store)) {
            await this.store.createSourceWithAudit(record, successAuditEvent);
          } else {
            await this.store.createSource(record);
          }

          await this.emitExternalAudit(successAuditEvent);

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
        const failureEvent: SourceRegistryAuditEvent = {
          accountId: context.accountId ?? DEFAULT_ACCOUNT_ID,
          actorId: context.actorId,
          createdAt: new Date().toISOString(),
          errorCode: error.code,
          eventType: "source.registration_failed",
          metadata: {
            phase: "validation_or_registration",
          },
          result: "failure",
        };

        await this.recordDurableFailureAudit(failureEvent);
        await this.emitExternalAudit(failureEvent);
      }

      throw error;
    }
  }

  private async recordDurableFailureAudit(
    event: SourceRegistryAuditEvent,
  ): Promise<void> {
    if (!isDurableAuditSourceStore(this.store)) {
      return;
    }

    try {
      await this.store.recordAuditEvent(event);
    } catch (error) {
      this.onAuditError?.(error, event);
    }
  }

  private async emitExternalAudit(event: SourceRegistryAuditEvent): Promise<void> {
    try {
      await this.auditSink?.(event);
    } catch (error) {
      this.onAuditError?.(error, event);
    }
  }
}

function createSourceId(): string {
  return `src_${randomUUID()}`;
}
