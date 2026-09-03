#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerCreateNote } from "./tools/createNote.js";
import { registerSearchNotes } from "./tools/searchNotes.js";
import { registerReadNote } from "./tools/readNote.js";
import { registerAppendToDaily } from "./tools/appendToDaily.js";

const server = new McpServer({
  name: "obsidian-vault",
  version: "0.1.0",
});

registerCreateNote(server);
registerSearchNotes(server);
registerReadNote(server);
registerAppendToDaily(server);
// MVP del SPEC.md completo: create_note, search_notes, read_note, append_to_daily.

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("obsidian-vault MCP server corriendo (stdio).");
}

main().catch((error) => {
  console.error("Error fatal iniciando el server:", error);
  process.exit(1);
});
