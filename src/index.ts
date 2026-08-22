import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createQaFusionXServer } from "./mcp/server.ts";

const server = createQaFusionXServer();
const transport = new StdioServerTransport();
await server.connect(transport);
