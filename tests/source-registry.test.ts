import { describe, expect, it, vi } from "vitest";

import { InMemorySourceStore } from "../src/adapters/source-store.js";
import { createRegisterSourceToolHandler } from "../src/mcp/register-source-tool.js";
import { SourceRegistryService } from "../src/services/source-registry-service.js";
import {
  SourceRegistryError,
  validateRegisterSourceInput,
} from "../src/services/source-registry-validation.js";

describe("SOURCEREGISTRY-001 Source Registry", () => {
  describe("registerSource", () => {
    it("AC-SOURCEREGISTRY-001-001 registers a local files source", async () => {
      const store = new InMemorySourceStore();
      const service = new SourceRegistryService(store);

      const result = await service.registerSource({
        type: "local_files",
        name: "Project Docs",
        config: { root_path: "/workspace/docs" },
        storage_mode: "index",
      });

      expect(result.status).toBe("registered");
      expect(result.source_id).toMatch(/^src_/);
      expect(store.getSource(result.source_id)).toMatchObject({
        id: result.source_id,
        type: "local_files",
        name: "Project Docs",
        storageMode: "index",
      });
    });

    it("AC-SOURCEREGISTRY-001-002 registers a GitHub source", async () => {
      const store = new InMemorySourceStore();
      const service = new SourceRegistryService(store);

      const result = await service.registerSource({
        type: "github",
        name: "Kodama Repo",
        config: { owner: "watchout", repo: "kodama" },
        storage_mode: "reference",
      });

      expect(result.status).toBe("registered");
      expect(result.source_id).toMatch(/^src_/);
      expect(store.getSource(result.source_id)).toMatchObject({
        id: result.source_id,
        type: "github",
        name: "Kodama Repo",
        storageMode: "reference",
      });
    });

    it("does not persist a source when validation fails", async () => {
      const store = new InMemorySourceStore();
      const service = new SourceRegistryService(store);

      await expect(
        service.registerSource({
          type: "local_files",
          name: "Project Docs",
          config: {},
          storage_mode: "index",
        }),
      ).rejects.toMatchObject({ code: "INVALID_SOURCE_CONFIG" });

      expect(store.listSources()).toHaveLength(0);
    });

    it("emits audit events for success and failure", async () => {
      const auditSink = vi.fn();
      const store = new InMemorySourceStore();
      const service = new SourceRegistryService(store, { auditSink });

      await service.registerSource(
        {
          type: "github",
          name: "Kodama Repo",
          config: { owner: "watchout", repo: "kodama" },
          storage_mode: "reference",
        },
        { actorId: "agent-1" },
      );

      await expect(
        service.registerSource(
          {
            type: "github",
            name: "Kodama Repo",
            config: { owner: "watchout" },
            storage_mode: "reference",
          },
          { actorId: "agent-1" },
        ),
      ).rejects.toMatchObject({ code: "INVALID_SOURCE_CONFIG" });

      expect(auditSink).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: "agent-1",
          eventType: "source.registered",
          result: "success",
          sourceType: "github",
        }),
      );
      expect(auditSink).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: "agent-1",
          errorCode: "INVALID_SOURCE_CONFIG",
          eventType: "source.registration_failed",
          result: "failure",
        }),
      );
    });

    it("does not report registration failure after source persistence when audit sink fails", async () => {
      const auditError = new Error("audit unavailable");
      const auditSink = vi.fn().mockRejectedValue(auditError);
      const onAuditError = vi.fn();
      const store = new InMemorySourceStore();
      const service = new SourceRegistryService(store, {
        auditSink,
        onAuditError,
      });

      const result = await service.registerSource({
        type: "github",
        name: "Kodama Repo",
        config: { owner: "watchout", repo: "kodama" },
        storage_mode: "reference",
      });

      expect(result.status).toBe("registered");
      expect(store.getSource(result.source_id)).toMatchObject({
        id: result.source_id,
        type: "github",
      });
      expect(onAuditError).toHaveBeenCalledWith(
        auditError,
        expect.objectContaining({
          eventType: "source.registered",
          result: "success",
          sourceId: result.source_id,
        }),
      );
    });
  });

  describe("validateRegisterSourceInput", () => {
    it("AC-SOURCEREGISTRY-001-003 rejects unsupported source types", () => {
      expect(() =>
        validateRegisterSourceInput({
          type: "slack",
          name: "Team Slack",
          config: { channel: "engineering" },
          storage_mode: "index",
        }),
      ).toThrow(SourceRegistryError);

      try {
        validateRegisterSourceInput({
          type: "slack",
          name: "Team Slack",
          config: { channel: "engineering" },
          storage_mode: "index",
        });
      } catch (error) {
        expect(error).toMatchObject({ code: "UNSUPPORTED_SOURCE_TYPE" });
      }
    });

    it("AC-SOURCEREGISTRY-001-004 rejects missing local files root_path", () => {
      expect(() =>
        validateRegisterSourceInput({
          type: "local_files",
          name: "Project Docs",
          config: {},
          storage_mode: "index",
        }),
      ).toThrow(SourceRegistryError);

      try {
        validateRegisterSourceInput({
          type: "local_files",
          name: "Project Docs",
          config: {},
          storage_mode: "index",
        });
      } catch (error) {
        expect(error).toMatchObject({ code: "INVALID_SOURCE_CONFIG" });
      }
    });

    it("enforces name and storage mode boundaries", () => {
      expect(
        validateRegisterSourceInput({
          type: "local_files",
          name: " A ",
          config: { root_path: "/workspace" },
          storage_mode: "copy",
        }).name,
      ).toBe("A");

      expect(() =>
        validateRegisterSourceInput({
          type: "local_files",
          name: "x".repeat(121),
          config: { root_path: "/workspace" },
          storage_mode: "copy",
        }),
      ).toThrow(expect.objectContaining({ code: "INVALID_SOURCE_NAME" }));

      expect(() =>
        validateRegisterSourceInput({
          type: "local_files",
          name: "Project Docs",
          config: { root_path: "/workspace" },
          storage_mode: "archive",
        }),
      ).toThrow(expect.objectContaining({ code: "INVALID_STORAGE_MODE" }));
    });

    it("rejects secret-like config keys", () => {
      expect(() =>
        validateRegisterSourceInput({
          type: "github",
          name: "Kodama Repo",
          config: {
            owner: "watchout",
            repo: "kodama",
            token: "secret",
          },
          storage_mode: "reference",
        }),
      ).toThrow(expect.objectContaining({ code: "INVALID_SOURCE_CONFIG" }));
    });
  });

  describe("MCP tool handler", () => {
    it("returns structured content for successful registration", async () => {
      const service = new SourceRegistryService(new InMemorySourceStore());
      const handler = createRegisterSourceToolHandler(service);

      const result = await handler({
        type: "github",
        name: "Kodama Repo",
        config: { owner: "watchout", repo: "kodama" },
        storage_mode: "reference",
      });

      expect(result.isError).toBeUndefined();
      expect(result.structuredContent).toMatchObject({
        status: "registered",
      });
      expect(result.content[0]).toMatchObject({ type: "text" });
    });

    it("returns stable error codes for validation failure", async () => {
      const service = new SourceRegistryService(new InMemorySourceStore());
      const handler = createRegisterSourceToolHandler(service);

      const result = await handler({
        type: "github",
        name: "Kodama Repo",
        config: { owner: "watchout" },
        storage_mode: "reference",
      });

      expect(result.isError).toBe(true);
      expect(result.structuredContent).toMatchObject({
        error: {
          code: "INVALID_SOURCE_CONFIG",
        },
      });
    });
  });
});
