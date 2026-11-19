import assert from "node:assert/strict";
import { test } from "node:test";
import { compareNewsByDate, normalizePublishedDate } from "../src/lib/newsDate";

test("publication dates in the notations Gemini returns are normalised to YYYY-MM-DD", () => {
  assert.equal(normalizePublishedDate("2026-11-17"), "2026-11-17");
  assert.equal(normalizePublishedDate("2026년 11월 17일"), "2026-11-17");
  assert.equal(normalizePublishedDate("2026년 7월 6일"), "2026-07-06");
  assert.equal(normalizePublishedDate("2026년 11월 17일 (추정)"), "2026-11-17");
  assert.equal(normalizePublishedDate("2026-05-27 ~ 28"), "2026-05-27");
  assert.equal(normalizePublishedDate("2026.11.05"), "2026-11-05");
  assert.equal(normalizePublishedDate("최근 보도"), null);
  assert.equal(normalizePublishedDate(""), null);
  assert.equal(normalizePublishedDate(null), null);
  assert.equal(normalizePublishedDate("2026-13-40"), null);
});

test("news is ordered by article date, newest first, regardless of notation or collection time", () => {
  const at = (iso: string) => new Date(iso);
  const rows = [
    { id: "old-but-just-collected", publishedAt: "2026-11-03", createdAt: at("2026-11-19T06:00:00Z") },
    { id: "korean-notation-newest", publishedAt: "2026년 11월 19일", createdAt: at("2026-11-19T01:00:00Z") },
    { id: "iso-middle", publishedAt: "2026-11-17", createdAt: at("2026-11-19T05:00:00Z") },
    { id: "unknown-date-collected-18th", publishedAt: "최근 보도", createdAt: at("2026-11-18T02:00:00Z") },
    { id: "same-day-earlier-collected", publishedAt: "2026-11-17", createdAt: at("2026-11-18T23:00:00Z") },
  ];
  assert.deepEqual(rows.sort(compareNewsByDate).map((r) => r.id), [
    "korean-notation-newest",
    "unknown-date-collected-18th",
    "iso-middle",
    "same-day-earlier-collected",
    "old-but-just-collected",
  ]);
});
