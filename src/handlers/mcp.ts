import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createWhoopMcpServer } from "../server.js";

export const config = {
  runtime: "edge",
  maxDuration: 60,
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Mcp-Session-Id, MCP-Protocol-Version, Authorization",
};

function withCors(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(corsHeaders)) {
    headers.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  const server = createWhoopMcpServer();

  try {
    await server.connect(transport);
    const response = await transport.handleRequest(request);
    return withCors(response);
  } catch (error) {
    console.error("MCP handler error:", error);
    return new Response(
      JSON.stringify({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  } finally {
    await transport.close();
    await server.close();
  }
}
