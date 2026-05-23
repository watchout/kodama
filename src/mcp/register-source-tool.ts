import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";

import { SourceRegistryService } from "../services/source-registry-service.js";
import { SourceRegistryError } from "../services/source-registry-validation.js";
import type { RegisterSourceOutput } from "../types/source-registry.js";

const registerSourceInputSchema = {
  type: z.string(),
  name: z.string(),
  config: z.record(z.string(), z.unknown()),
  storage_mode: z.string(),
};

export function registerSourceTool(
  server: McpServer,
  service: SourceRegistryService,
): void {
  server.registerTool(
    "kodama.register_source",
    {
      description: "Register a Kodama source adapter and storage mode.",
      inputSchema: registerSourceInputSchema,
    },
    createRegisterSourceToolHandler(service),
  );
}

export function createRegisterSourceToolHandler(
  service: SourceRegistryService,
): (input: unknown) => Promise<CallToolResult> {
  return async (input: unknown): Promise<CallToolResult> => {
    try {
      const result = await service.registerSource(input);
      return successResult(result);
    } catch (error) {
      if (error instanceof SourceRegistryError) {
        return errorResult(error);
      }

      return errorResult(
        new SourceRegistryError(
          "SOURCE_REGISTRY_UNAVAILABLE",
          "Source registry is unavailable.",
        ),
      );
    }
  };
}

function successResult(result: RegisterSourceOutput): CallToolResult {
  return {
    content: [
      {
        type: "text",
        text: `Source registered: ${result.source_id}`,
      },
    ],
    structuredContent: {
      source_id: result.source_id,
      status: result.status,
    },
  };
}

function errorResult(error: SourceRegistryError): CallToolResult {
  return {
    content: [
      {
        type: "text",
        text: `${error.code}: ${error.message}`,
      },
    ],
    isError: true,
    structuredContent: {
      error: {
        code: error.code,
        message: error.message,
      },
    },
  };
}
