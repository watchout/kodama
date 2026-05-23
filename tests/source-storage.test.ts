import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, describe, expect, it } from "vitest";

import { SQLiteSourceAuditStore } from "../src/adapters/source-audit-store.js";
import { SQLiteSourceStore } from "../src/adapters/sqlite-source-store.js";
import { SourceRegistryService } from "../src/services/source-registry-service.js";

const tempDirs: string[] = [];

afterEach(async () => {
  for (const dir of tempDirs.splice(0)) {
    await rm(dir, { force: true, recursive: true });
  }
});

describe("SOURCESTORAGE-001 Source Storage", () => {
  it("AC-SOURCESTORAGE-001-001 persists a source in SQLite", async () => {
    const databasePath = await createDatabasePath();
    const store = new SQLiteSourceStore(databasePath);
    const service = new SourceRegistryService(store);

    const result = await service.registerSource({
      type: "local_files",
      name: "Project Docs",
      config: { root_path: "/workspace/docs" },
      storage_mode: "index",
    });

    store.close();

    const reopened = new SQLiteSourceStore(databasePath);
    await expect(reopened.getSource(result.source_id)).resolves.toMatchObject({
      id: result.source_id,
      accountId: "acct_local",
      name: "Project Docs",
      storageMode: "index",
      type: "local_files",
      visibility: "private",
    });
    reopened.close();
  });

  it("AC-SOURCESTORAGE-001-002 persists account-bound source metadata", async () => {
    const store = new SQLiteSourceStore(await createDatabasePath());
    const service = new SourceRegistryService(store);

    const result = await service.registerSource(
      {
        type: "github",
        name: "Kodama Repo",
        config: { owner: "watchout", repo: "kodama" },
        storage_mode: "reference",
      },
      {
        accountId: "acct_iyasaka",
        ownerId: "yuji",
        scopeViewId: "scope_product",
        visibility: "account",
        workspaceId: "kodama",
      },
    );

    await expect(store.getSource(result.source_id)).resolves.toMatchObject({
      accountId: "acct_iyasaka",
      ownerId: "yuji",
      scopeViewId: "scope_product",
      visibility: "account",
      workspaceId: "kodama",
    });
    await expect(
      store.listSources({ accountId: "acct_iyasaka", sourceType: "github" }),
    ).resolves.toHaveLength(1);
    store.close();
  });

  it("AC-SOURCESTORAGE-001-003 records durable source audit events", async () => {
    const store = new SQLiteSourceStore(await createDatabasePath());
    const auditStore = new SQLiteSourceAuditStore(store.database);
    const service = new SourceRegistryService(store);

    const result = await service.registerSource(
      {
        type: "github",
        name: "Kodama Repo",
        config: { owner: "watchout", repo: "kodama" },
        storage_mode: "reference",
      },
      { accountId: "acct_iyasaka", actorId: "agent-1" },
    );

    await expect(auditStore.listAuditEvents()).resolves.toEqual([
      expect.objectContaining({
        accountId: "acct_iyasaka",
        actorId: "agent-1",
        eventType: "source.registered",
        result: "success",
        sourceId: result.source_id,
      }),
    ]);
    store.close();
  });

  it("AC-SOURCESTORAGE-001-004 rolls back source when success audit cannot be written", async () => {
    const store = new SQLiteSourceStore(await createDatabasePath());
    const service = new SourceRegistryService(store);
    store.database.exec("DROP TABLE source_audit_events");

    await expect(
      service.registerSource({
        type: "local_files",
        name: "Project Docs",
        config: { root_path: "/workspace/docs" },
        storage_mode: "index",
      }),
    ).rejects.toMatchObject({ code: "SOURCE_REGISTRY_UNAVAILABLE" });

    await expect(store.listSources()).resolves.toHaveLength(0);
    store.close();
  });

  it("AC-SOURCESTORAGE-001-005 records validation failure audit without raw config", async () => {
    const store = new SQLiteSourceStore(await createDatabasePath());
    const auditStore = new SQLiteSourceAuditStore(store.database);
    const service = new SourceRegistryService(store);

    await expect(
      service.registerSource(
        {
          type: "github",
          name: "Kodama Repo",
          config: {
            owner: "watchout",
            token: "secret",
          },
          storage_mode: "reference",
        },
        { accountId: "acct_iyasaka", actorId: "agent-1" },
      ),
    ).rejects.toMatchObject({ code: "INVALID_SOURCE_CONFIG" });

    const events = await auditStore.listAuditEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      accountId: "acct_iyasaka",
      actorId: "agent-1",
      errorCode: "INVALID_SOURCE_CONFIG",
      eventType: "source.registration_failed",
      result: "failure",
    });
    expect(JSON.stringify(events[0].metadata)).not.toContain("secret");
    expect(JSON.stringify(events[0].metadata)).not.toContain("token");
    store.close();
  });

  it("AC-SOURCESTORAGE-001-006 records store failure audit after SQLite opens", async () => {
    const store = new SQLiteSourceStore(await createDatabasePath());
    const auditStore = new SQLiteSourceAuditStore(store.database);
    const service = new SourceRegistryService(store);
    store.database.exec("DROP TABLE sources");

    await expect(
      service.registerSource({
        type: "local_files",
        name: "Project Docs",
        config: { root_path: "/workspace/docs" },
        storage_mode: "index",
      }),
    ).rejects.toMatchObject({ code: "SOURCE_REGISTRY_UNAVAILABLE" });

    await expect(auditStore.listAuditEvents()).resolves.toEqual([
      expect.objectContaining({
        errorCode: "SOURCE_REGISTRY_UNAVAILABLE",
        eventType: "source.registration_failed",
        result: "failure",
      }),
    ]);
    store.close();
  });

  it("AC-SOURCESTORAGE-001-007 fails when SQLite cannot open", () => {
    expect(
      () => new SQLiteSourceStore("/path/that/does/not/exist/kodama.db"),
    ).toThrow();
  });
});

async function createDatabasePath(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "kodama-source-storage-"));
  tempDirs.push(dir);
  return join(dir, "kodama.db");
}
