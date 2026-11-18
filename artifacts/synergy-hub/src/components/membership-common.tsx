import { basePath } from "@/lib/clerk";

export function errMsg(err: unknown, fallback = "요청 처리 중 문제가 발생했습니다."): string {
  const e = err as { data?: { error?: string } | null; message?: string } | null;
  return e?.data?.error || e?.message || fallback;
}

export function effectiveStatus(status: string, expiresAt: string): string {
  if (status === "pending" && new Date(expiresAt).getTime() < Date.now()) return "expired";
  return status;
}

export const STATUS_LABEL: Record<string, string> = {
  pending: "검토 대기",
  approved: "승인됨",
  rejected: "반려됨",
  cancelled: "취소됨",
  superseded: "대체됨",
  delivery_failed: "메일 발송 실패",
  expired: "만료됨",
  sending: "발송 중",
  accepted: "초대 수락됨",
};

export const ROLE_LABEL: Record<string, string> = { company_admin: "회사 관리자", staff: "담당자" };

export function fmtDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "-" : d.toLocaleString("ko-KR");
}

export async function openEvidence(claimId: number): Promise<void> {
  const res = await fetch(`${basePath}/api/membership/claims/${claimId}/evidence`, { credentials: "include" });
  if (!res.ok) throw new Error("증빙 파일을 불러오지 못했습니다.");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const extension = blob.type === "application/pdf" ? "pdf" : blob.type === "image/png" ? "png" : "jpg";
  a.download = `claim-${claimId}-evidence.${extension}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
