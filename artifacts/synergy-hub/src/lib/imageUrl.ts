/**
 * Normalizes an image URL for use as an <img src>.
 *
 * Users sometimes paste a Google Images *viewer page* link
 * (e.g. `https://www.google.com/imgres?...&imgurl=<direct-url>&...`)
 * instead of the direct image file URL. Such a page returns HTML, not an
 * image, so the <img> never renders. This extracts the embedded `imgurl`
 * (the actual image file) from those wrapper links. Other URLs (direct
 * image URLs, data URLs) are returned unchanged.
 */
export function normalizeImageUrl(url: string): string {
  const trimmed = url.trim();
  if (!/^https?:\/\//i.test(trimmed)) return trimmed;

  try {
    const parsed = new URL(trimmed);
    const isGoogle = /(^|\.)google\.[a-z.]+$/i.test(parsed.hostname);
    if (isGoogle && parsed.pathname.includes("/imgres")) {
      const imgUrl = parsed.searchParams.get("imgurl");
      if (imgUrl && /^https?:\/\/\S+$/i.test(imgUrl)) {
        return imgUrl;
      }
    }
  } catch {
    // Not a parseable URL; fall through and return as-is.
  }
  return trimmed;
}
