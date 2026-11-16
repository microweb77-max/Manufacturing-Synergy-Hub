import { describe, expect, it } from "vitest";
import type { Company, Project } from "@workspace/db";
import { buildReason, computeSynergyScore } from "../lib/synergy";

const project = (tags: string[]) => ({ requiredTags: tags }) as Project;
const company = (over: Partial<Company>) =>
  ({
    capabilityTags: [],
    trustScore: 0,
    projectsCompleted: 0,
    type: "hardware",
    ...over,
  }) as Company;

describe("computeSynergyScore", () => {
  it("태그 전부 일치 + 신뢰 100 + 실적 15 이상이면 100점", () => {
    const r = computeSynergyScore(
      project(["CNC", "MES"]),
      company({ capabilityTags: ["CNC", "MES"], trustScore: 100, projectsCompleted: 20 }),
    );
    expect(r.score).toBe(100);
    expect(r.matchedTags).toEqual(["CNC", "MES"]);
  });

  it("태그 60 / 신뢰 25 / 실적 15 가중치", () => {
    expect(
      computeSynergyScore(project(["a"]), company({ capabilityTags: ["a"] })).score,
    ).toBe(60);
    expect(computeSynergyScore(project(["a"]), company({ trustScore: 100 })).score).toBe(25);
    expect(computeSynergyScore(project(["a"]), company({ projectsCompleted: 7 })).score).toBe(7);
    // 절반 일치: 30
    expect(
      computeSynergyScore(project(["a", "b"]), company({ capabilityTags: ["a"] })).score,
    ).toBe(30);
  });

  it("대소문자를 무시하고 매칭하며 회사 원본 표기를 반환", () => {
    const r = computeSynergyScore(project(["cnc"]), company({ capabilityTags: ["CNC"] }));
    expect(r.matchedTags).toEqual(["CNC"]);
    expect(r.score).toBe(60);
  });

  it("요구 태그가 없으면 태그 점수 0, 결과는 0~100 범위", () => {
    const r = computeSynergyScore(project([]), company({ trustScore: 100, projectsCompleted: 99 }));
    expect(r.score).toBe(40);
    const over = computeSynergyScore(
      project(["a"]),
      company({ capabilityTags: ["a"], trustScore: 1000, projectsCompleted: 99 }),
    );
    expect(over.score).toBe(100);
    const under = computeSynergyScore(project(["a"]), company({ trustScore: -500 }));
    expect(under.score).toBe(0);
  });
});

describe("buildReason", () => {
  it("태그가 없으면 타입 라벨과 트러스트 스코어 문구", () => {
    expect(buildReason(company({ type: "hardware", trustScore: 80 }), [], 10)).toBe(
      "하드웨어 역량 보유 업체로, 트러스트 스코어 80점을 기반으로 추천됩니다.",
    );
    expect(buildReason(company({ type: "service" }), [], 0)).toContain("서비스 역량");
    expect(buildReason(company({ type: "software" }), [], 0)).toContain("소프트웨어 역량");
  });

  it("태그가 있으면 일치 태그·이력·점수를 포함", () => {
    const r = buildReason(
      company({ trustScore: 90, projectsCompleted: 5 }),
      ["CNC", "MES"],
      77,
    );
    expect(r).toContain("CNC, MES 역량");
    expect(r).toContain("완수 이력 5건");
    expect(r).toContain("트러스트 스코어 90점");
    expect(r).toContain("(시너지 77점)");
  });
});
