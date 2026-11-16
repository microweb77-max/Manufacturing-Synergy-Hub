// Pure input validators shared by routes (extracted for unit testing; behavior unchanged).

const LOGO_DATA_URL_RE = /^data:image\/(png|jpe?g|webp|gif);base64,([A-Za-z0-9+/]+={0,2})$/;
const MAX_LOGO_BYTES = 2 * 1024 * 1024;

/**
 * Validates a logo value. Accepts a raster image data URL (<= 2MB decoded) or a
 * plain https URL. Returns the normalized value, or `{ error }` if invalid.
 */
export function validateLogoUrl(value: string): { value: string } | { error: string } {
  const trimmed = value.trim();
  if (trimmed === "") return { value: "" };

  const dataMatch = LOGO_DATA_URL_RE.exec(trimmed);
  if (dataMatch) {
    const base64 = dataMatch[2];
    const decodedBytes = Math.floor((base64.length * 3) / 4) - (base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0);
    if (decodedBytes > MAX_LOGO_BYTES) {
      return { error: "로고 이미지는 2MB 이하여야 합니다." };
    }
    return { value: trimmed };
  }

  if (/^https:\/\/\S+$/.test(trimmed)) {
    return { value: extractDirectImageUrl(trimmed) };
  }

  return { error: "유효하지 않은 로고 이미지입니다. 이미지(PNG, JPG, WEBP, GIF) 파일을 업로드해주세요." };
}

// Users sometimes paste a Google Images viewer-page link
// (https://www.google.com/imgres?...&imgurl=<direct-url>) instead of the direct
// image URL. That page returns HTML, not an image, so the <img> never renders.
// Extract the embedded `imgurl` (the real image file) when present.
function extractDirectImageUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const isGoogle = /(^|\.)google\.[a-z.]+$/i.test(parsed.hostname);
    if (isGoogle && parsed.pathname.includes("/imgres")) {
      const imgUrl = parsed.searchParams.get("imgurl");
      if (imgUrl && /^https:\/\/\S+$/.test(imgUrl)) {
        return imgUrl;
      }
    }
  } catch {
    // Not parseable; return original.
  }
  return url;
}

const RESUME_DATA_URL_RE =
  /^data:(application\/pdf|application\/msword|application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document|image\/(png|jpe?g|webp));base64,([A-Za-z0-9+/]+={0,2})$/;
const MAX_RESUME_BYTES = 5 * 1024 * 1024;

/**
 * Validates an uploaded resume file value. Accepts a PDF / Word / raster image
 * data URL (<= 5MB decoded). Empty string is allowed (no file attached).
 * Never trust the client-only size/type checks.
 */
export function validateResumeData(value: string): { value: string } | { error: string } {
  const trimmed = value.trim();
  if (trimmed === "") return { value: "" };

  const match = RESUME_DATA_URL_RE.exec(trimmed);
  if (!match) {
    return {
      error:
        "유효하지 않은 이력서 파일입니다. PDF, Word 또는 이미지(PNG, JPG, WEBP) 파일을 업로드해주세요.",
    };
  }

  const base64 = match[match.length - 1];
  const decodedBytes =
    Math.floor((base64.length * 3) / 4) -
    (base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0);
  if (decodedBytes > MAX_RESUME_BYTES) {
    return { error: "이력서 파일은 5MB 이하여야 합니다." };
  }

  return { value: trimmed };
}

