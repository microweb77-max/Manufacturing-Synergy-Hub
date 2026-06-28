import type { Company, Project } from "@workspace/db";

/**
 * Computes a synergy score (0-100) between a project's required tags and a
 * candidate company. The score blends tag overlap with the company's trust
 * signals so that capable, proven partners surface first.
 */
export function computeSynergyScore(
  project: Project,
  company: Company,
): { score: number; matchedTags: string[] } {
  const required = project.requiredTags.map((t) => t.toLowerCase());
  const owned = company.capabilityTags.map((t) => t.toLowerCase());

  const matchedTags = company.capabilityTags.filter((t) =>
    required.includes(t.toLowerCase()),
  );

  const tagCoverage =
    required.length > 0 ? matchedTags.length / required.length : 0;

  // Tag overlap is the dominant factor (up to 60 pts), trust score adds up to
  // 25 pts, and proven track record (completed projects) adds up to 15 pts.
  const tagComponent = tagCoverage * 60;
  const trustComponent = (company.trustScore / 100) * 25;
  const trackComponent = Math.min(company.projectsCompleted, 15);

  const score = Math.round(tagComponent + trustComponent + trackComponent);

  return { score: Math.max(0, Math.min(100, score)), matchedTags };
}

export function buildReason(
  company: Company,
  matchedTags: string[],
  score: number,
): string {
  const typeLabel = company.type === "hardware" ? "하드웨어" : "소프트웨어";
  if (matchedTags.length === 0) {
    return `${typeLabel} 역량 보유 업체로, 트러스트 스코어 ${company.trustScore}점을 기반으로 추천됩니다.`;
  }
  return `${matchedTags.join(", ")} 역량이 프로젝트 요구사항과 일치하며, 완수 이력 ${company.projectsCompleted}건과 트러스트 스코어 ${company.trustScore}점으로 수주 확률이 높습니다. (시너지 ${score}점)`;
}
