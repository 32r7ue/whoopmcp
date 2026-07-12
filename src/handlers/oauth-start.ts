import type { VercelRequest, VercelResponse } from "@vercel/node";
import { startWebOAuth } from "../auth.js";
import { getConfig } from "../config.js";

export const config = {
  maxDuration: 30,
};

function sendErrorPage(res: VercelResponse, title: string, message: string): void {
  res
    .status(500)
    .setHeader("Content-Type", "text/html; charset=utf-8")
    .send(`<!DOCTYPE html><html><body><h1>${title}</h1><p>${message}</p></body></html>`);
}

export default async function handler(_req: VercelRequest, res: VercelResponse): Promise<void> {
  try {
    getConfig();
    const { url } = await startWebOAuth();
    res.redirect(302, url);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    sendErrorPage(res, "OAuth start failed", message);
  }
}
