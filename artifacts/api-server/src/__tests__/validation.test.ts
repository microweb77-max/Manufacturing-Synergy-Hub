import { describe, expect, it } from "vitest";
import { validateLogoUrl, validateResumeData } from "../lib/validation";

const b64 = (n: number) => "A".repeat(n);

describe("validateLogoUrl", () => {
  it("빈 문자열은 빈 값으로 통과", () => {
    expect(validateLogoUrl("  ")).toEqual({ value: "" });
  });
  it("raster data URL 허용, svg 거부", () => {
    const ok = "data:image/png;base64,AAAA";
    expect(validateLogoUrl(ok)).toEqual({ value: ok });
    expect("error" in validateLogoUrl("data:image/svg+xml;base64,AAAA")).toBe(true);
  });
  it("2MB 초과 거부", () => {
    const big = `data:image/png;base64,${b64(Math.ceil((2 * 1024 * 1024 * 4) / 3) + 8)}`;
    expect(validateLogoUrl(big)).toEqual({ error: "로고 이미지는 2MB 이하여야 합니다." });
  });
  it("https URL 허용, http/기타 거부", () => {
    expect(validateLogoUrl("https://example.com/a.png")).toEqual({
      value: "https://example.com/a.png",
    });
    expect("error" in validateLogoUrl("http://example.com/a.png")).toBe(true);
    expect("error" in validateLogoUrl("javascript:alert(1)")).toBe(true);
  });
  it("구글 이미지 뷰어 링크는 imgurl 로 치환", () => {
    const u = "https://www.google.com/imgres?imgurl=https%3A%2F%2Fcdn.example.com%2Flogo.png&x=1";
    expect(validateLogoUrl(u)).toEqual({ value: "https://cdn.example.com/logo.png" });
  });
});

describe("validateResumeData", () => {
  it("빈 문자열 허용", () => {
    expect(validateResumeData("")).toEqual({ value: "" });
  });
  it("PDF/Word/이미지 허용", () => {
    for (const mime of [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "image/jpeg",
    ]) {
      const v = `data:${mime};base64,AAAA`;
      expect(validateResumeData(v)).toEqual({ value: v });
    }
  });
  it("허용되지 않는 형식 거부", () => {
    expect("error" in validateResumeData("data:text/html;base64,AAAA")).toBe(true);
    expect("error" in validateResumeData("not a data url")).toBe(true);
  });
  it("5MB 초과 거부", () => {
    const big = `data:application/pdf;base64,${b64(Math.ceil((5 * 1024 * 1024 * 4) / 3) + 8)}`;
    expect(validateResumeData(big)).toEqual({ error: "이력서 파일은 5MB 이하여야 합니다." });
  });
});
