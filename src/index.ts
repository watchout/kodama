export const serverName = "kodama";

export function main(): void {
  throw new Error("Kodama MCP server entry point is not implemented yet.");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
