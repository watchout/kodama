import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { InMemorySourceStore } from "./adapters/source-store.js";
import { registerSourceTool } from "./mcp/register-source-tool.js";
import { SourceRegistryService } from "./services/source-registry-service.js";

export const serverName = "kodama";

export function createKodamaServer(): McpServer {
  const server = new McpServer({
    name: serverName,
    version: "0.1.0",
  });
  const sourceRegistry = new SourceRegistryService(new InMemorySourceStore());

  registerSourceTool(server, sourceRegistry);

  return server;
}

export async function main(): Promise<void> {
  const server = createKodamaServer();
  const transport = new StdioServerTransport();

  await server.connect(transport);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void main();
}
