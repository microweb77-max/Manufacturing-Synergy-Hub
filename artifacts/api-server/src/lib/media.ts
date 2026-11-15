import crypto from "node:crypto";
import type { Response } from "express";

/**
 * Images (company logos, banner/solution images) are stored inline in the DB
 * as base64 data URLs. Sending them inside every list response made pages
 * heavy, so responses replace them with a short URL served by
 * `routes/media.ts`, which the browser can cache.
 *
 * Mapping is by field name, which is unambiguous in the current schema:
 *   logoUrl                     -> company
 *   imageUrl + linkUrl present  -> banner
 *   imageUrl (otherwise)        -> solution
 */

export const MEDIA_PREFIX = "/api/media/";

function shortHash(s: string): string {
  return crypto.createHash("sha1").update(s).digest("hex").slice(0, 10);
}

function mediaUrl(kind: "company" | "banner" | "solution", id: number, data: string): string {
  return `${MEDIA_PREFIX}${kind}/${id}?v=${shortHash(data)}`;
}

function rewriteObject(obj: Record<string, unknown>): void {
  const id = obj["id"];
  if (typeof id !== "number") return;
  const logo = obj["logoUrl"];
  if (typeof logo === "string" && logo.startsWith("data:")) {
    obj["logoUrl"] = mediaUrl("company", id, logo);
  }
  const image = obj["imageUrl"];
  if (typeof image === "string" && image.startsWith("data:")) {
    obj["imageUrl"] = mediaUrl("linkUrl" in obj ? "banner" : "solution", id, image);
  }
}

/** Recursively replaces inline image data URLs with media URLs (in place). */
export function rewriteMediaUrls(value: unknown): void {
  if (Array.isArray(value)) {
    for (const v of value) rewriteMediaUrls(v);
  } else if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    rewriteObject(obj);
    for (const v of Object.values(obj)) {
      if (v && typeof v === "object") rewriteMediaUrls(v);
    }
  }
}

/** True if a client sent back a media URL we generated (i.e. "unchanged"). */
export function isMediaUrl(value: unknown): boolean {
  return typeof value === "string" && value.startsWith(MEDIA_PREFIX);
}

const DATA_URL_RE = /^data:([a-zA-Z0-9.+/-]+);base64,(.*)$/s;

/** Sends a stored data URL as a binary response. Returns false if invalid. */
export function sendDataUrl(
  res: Response,
  dataUrl: string | null | undefined,
  opts: { cache?: boolean; downloadName?: string } = {},
): boolean {
  if (!dataUrl) return false;
  const m = DATA_URL_RE.exec(dataUrl);
  if (!m) return false;
  const mime = m[1]!;
  // Never serve SVG/HTML inline from our origin.
  if (!opts.downloadName && !/^image\/(png|jpe?g|webp|gif)$/.test(mime)) return false;
  res.setHeader("Content-Type", mime);
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (opts.downloadName) {
    res.setHeader(
      "Content-Disposition",
      `attachment; filename*=UTF-8''${encodeURIComponent(opts.downloadName)}`,
    );
    res.setHeader("Cache-Control", "private, no-store");
  } else if (opts.cache) {
    // URLs carry a content hash (?v=...), so they can be cached aggressively.
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  }
  res.send(Buffer.from(m[2]!, "base64"));
  return true;
}
