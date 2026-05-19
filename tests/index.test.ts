import { describe, expect, it } from "vitest";

import { serverName } from "../src/index.js";

describe("kodama entrypoint", () => {
  it("exports the MCP server name", () => {
    expect(serverName).toBe("kodama");
  });
});
