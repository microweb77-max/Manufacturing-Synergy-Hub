import { describe, expect, it } from "vitest";
import { isMediaUrl, rewriteMediaUrls } from "../lib/media";

const DATA = "data:image/png;base64,AAAA";

describe("rewriteMediaUrls", () => {
  it("logoUrl → company 미디어 URL", () => {
    const o = { id: 3, logoUrl: DATA };
    rewriteMediaUrls(o);
    expect(o.logoUrl).toMatch(/^\/api\/media\/company\/3\?v=[0-9a-f]{10}$/);
  });

  it("imageUrl + linkUrl 있으면 banner, 없으면 solution", () => {
    const banner = { id: 1, imageUrl: DATA, linkUrl: "https://x" };
    const solution = { id: 2, imageUrl: DATA };
    rewriteMediaUrls([banner, solution]);
    expect(banner.imageUrl).toMatch(/^\/api\/media\/banner\/1\?v=/);
    expect(solution.imageUrl).toMatch(/^\/api\/media\/solution\/2\?v=/);
  });

  it("중첩 객체/배열도 처리", () => {
    const o = { items: [{ id: 5, logoUrl: DATA }], nested: { deep: { id: 6, logoUrl: DATA } } };
    rewriteMediaUrls(o);
    expect(o.items[0]!.logoUrl).toMatch(/^\/api\/media\/company\/5/);
    expect(o.nested.deep.logoUrl).toMatch(/^\/api\/media\/company\/6/);
  });

  it("data URL이 아닌 값·id 없는 객체는 유지", () => {
    const a = { id: 1, logoUrl: "https://example.com/a.png", imageUrl: null };
    const b = { logoUrl: DATA };
    rewriteMediaUrls([a, b]);
    expect(a.logoUrl).toBe("https://example.com/a.png");
    expect(a.imageUrl).toBeNull();
    expect(b.logoUrl).toBe(DATA);
  });

  it("같은 데이터는 같은 해시, 다른 데이터는 다른 해시", () => {
    const x = { id: 1, logoUrl: DATA };
    const y = { id: 1, logoUrl: DATA };
    const z = { id: 1, logoUrl: "data:image/png;base64,BBBB" };
    rewriteMediaUrls([x, y, z]);
    expect(x.logoUrl).toBe(y.logoUrl);
    expect(x.logoUrl).not.toBe(z.logoUrl);
  });
});

describe("isMediaUrl", () => {
  it("생성한 미디어 URL만 true", () => {
    expect(isMediaUrl("/api/media/company/1?v=abc")).toBe(true);
    expect(isMediaUrl("https://example.com/a.png")).toBe(false);
    expect(isMediaUrl(DATA)).toBe(false);
    expect(isMediaUrl(undefined)).toBe(false);
    expect(isMediaUrl(null)).toBe(false);
  });
});
