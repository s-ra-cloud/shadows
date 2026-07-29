/**
 * Editor/admin authorization shared by the REST routes.
 *
 * Deterministic tokens derived from SESSION_SECRET are used as a fallback to
 * cookies because the app is embedded in a cross-site iframe (canvas preview),
 * where browsers (Safari, recent Chrome) block third-party cookies entirely —
 * so cookie-based sessions can't be relied on. Tokens are sent in the
 * `x-editor-token` header and validated here. They survive restarts and need
 * no server-side storage.
 */
import type { Request, Response, NextFunction } from "express";
import { createHmac } from "crypto";

const SECRET = process.env.SESSION_SECRET || "shadows-dev-secret";
export const EDITOR_TOKEN = createHmac("sha256", SECRET).update("editor").digest("hex");
export const ADMIN_TOKEN = createHmac("sha256", SECRET).update("admin").digest("hex");

function tokenFrom(req: Request): string {
  return (req.headers["x-editor-token"] as string | undefined) || "";
}

export function hasAdmin(req: Request): boolean {
  return !!(req.session && req.session.isAdmin) || tokenFrom(req) === ADMIN_TOKEN;
}

export function hasEditor(req: Request): boolean {
  return (
    !!(req.session && (req.session.isEditor || req.session.isAdmin)) ||
    tokenFrom(req) === EDITOR_TOKEN ||
    tokenFrom(req) === ADMIN_TOKEN
  );
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (hasAdmin(req)) {
    next();
  } else {
    res.status(401).json({ message: "Unauthorized" });
  }
}

export function requireEditor(req: Request, res: Response, next: NextFunction) {
  if (hasEditor(req)) {
    next();
  } else {
    res.status(401).json({ message: "Unauthorized" });
  }
}
