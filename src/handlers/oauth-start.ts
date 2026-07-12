import { startWebOAuth } from "../auth.js";
import { getConfig } from "../config.js";

export const config = {
  runtime: "edge",
  maxDuration: 30,
};

function errorPage(title: string, message: string): Response {
  return new Response(
    `<!DOCTYPE html><html><body><h1>${title}</h1><p>${message}</p></body></html>`,
    { status: 500, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

export default async function handler(): Promise<Response> {
  try {
    getConfig();
    const { url } = await startWebOAuth();
    return Response.redirect(url, 302);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return errorPage("OAuth start failed", message);
  }
}
