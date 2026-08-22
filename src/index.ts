import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { bootstrapTbb } from "./tbb/bootstrap.ts";
import { createQaFusionXServer } from "./mcp/server.ts";

bootstrapTbb();

const server = createQaFusionXServer();
const transport = new StdioServerTransport();
await server.connect(transport);
