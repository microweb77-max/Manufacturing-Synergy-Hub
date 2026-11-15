import { rewriteMediaUrls } from "./media";

/**
 * Serializes a value the same way `res.json` would, converting Date objects to
 * ISO strings. Use this before validating with generated Zod response schemas,
 * which expect date-time strings rather than Date instances.
 *
 * Also replaces inline base64 images with cacheable media URLs (see media.ts).
 */
export function toJson<T>(value: T): T {
  const out = JSON.parse(JSON.stringify(value)) as T;
  rewriteMediaUrls(out);
  return out;
}
