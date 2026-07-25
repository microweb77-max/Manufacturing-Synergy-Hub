import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAdminAuth } from "@/lib/adminAuth";
import {
  useListCompanies,
  useCreateCompany,
  useUpdateCompany,
  useDeleteCompany,
  getListCompaniesQueryKey,
  useListProjects,
  useCreateProject,
  useUpdateProject,
  useDeleteProject,
  getListProjectsQueryKey,
  useListMatches,
  useCreateMatch,
  useUpdateMatch,
  useDeleteMatch,
  getListMatchesQueryKey,
  useListSolutions,
  useCreateSolution,
  useUpdateSolution,
  useDeleteSolution,
  getListSolutionsQueryKey,
  useListPerformanceLogs,
  useCreatePerformanceLog,
  useUpdatePerformanceLog,
  useDeletePerformanceLog,
  getListPerformanceLogsQueryKey,
  useListTalentPosts,
  useCreateTalentPost,
  useUpdateTalentPost,
  useDeleteTalentPost,
  getListTalentPostsQueryKey,
  useListSupplyOffers,
  useCreateSupplyOffer,
  useUpdateSupplyOffer,
  useDeleteSupplyOffer,
  getListSupplyOffersQueryKey,
  useListOfferMatches,
  useUpdateOfferMatch,
  useDeleteOfferMatch,
  getListOfferMatchesQueryKey,
  useListProjectApplications,
  useUpdateProjectApplication,
  useDeleteProjectApplication,
  getListProjectApplicationsQueryKey,
  useListResumeSubmissions,
  useUpdateResumeSubmission,
  useDeleteResumeSubmission,
  getListResumeSubmissionsQueryKey,
  useListTalentContactRequests,
  useUpdateTalentContactRequest,
  useDeleteTalentContactRequest,
  getListTalentContactRequestsQueryKey,
  useListNavSettings,
  useUpsertNavSetting,
  getListNavSettingsQueryKey,
  useCollectJobs,
  useListBanners,
  useCreateBanner,
  useUpdateBanner,
  useDeleteBanner,
  getListBannersQueryKey,
} from "@workspace/api-client-react";
import { useState, type ReactNode } from "react";
import { useToast } from "@/hooks/use-toast";
import { getCompanyTypeMeta } from "@/lib/companyType";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { NAV_ITEMS, isNavItemHidden } from "@/lib/navItems";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  ShieldAlert,
  Sparkles,
  Loader2,
  Building2,
  ClipboardList,
  GitMerge,
  Package,
  Users,
  PackageSearch,
  Handshake,
  UserPlus,
  FileText,
  Download,
  Image as ImageIcon,
} from "lucide-react";
import {
  AdminSection,
  toTags,
  fromTags,
  toNum,
  type FormValues,
} from "./AdminSection";

function formatDateTime(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function CollectJobsControl({
  postType,
}: {
  postType: "hiring" | "seeking";
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [region, setRegion] = useState("");
  const collectJobs = useCollectJobs();

  const label = postType === "seeking" ? "구직" : "구인";
  const inputId = `collect-region-${postType}`;

  const handleCollect = () => {
    collectJobs.mutate(
      {
        data: {
          postType,
          ...(region.trim() ? { region: region.trim() } : {}),
        },
      },
      {
        onSuccess: (result) => {
          toast({
            title: "자동 수집 완료",
            description:
              result.inserted > 0
                ? `새 ${label} 정보 ${result.inserted}건을 등록했습니다.${
                    result.skipped > 0 ? ` (중복 ${result.skipped}건 제외)` : ""
                  }`
                : `새로 등록할 ${label} 정보를 찾지 못했습니다. 잠시 후 다시 시도해주세요.`,
          });
          qc.invalidateQueries({ queryKey: getListTalentPostsQueryKey({}) });
          setOpen(false);
          setRegion("");
        },
        onError: () => {
          toast({
            title: "오류",
            description: `${label} 정보 자동 수집 중 문제가 발생했습니다.`,
            variant: "destructive",
          });
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Sparkles className="mr-1.5 h-4 w-4" />
          {label} 정보 자동 수집
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            베트남 제조업 {label} 정보 자동 수집
          </DialogTitle>
          <DialogDescription>
            {postType === "seeking"
              ? "웹에서 베트남 제조업 분야 구직자/인재 정보를 검색해 구직 정보로 자동 등록합니다. 이미 등록된 항목은 제외됩니다."
              : "웹에서 베트남 제조업 관련 최신 채용 공고를 검색해 구인 정보로 자동 등록합니다. 이미 등록된 공고는 제외됩니다."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 py-2">
          <Label htmlFor={inputId}>
            지역/분야 집중{" "}
            <span className="text-muted-foreground font-normal">(선택)</span>
          </Label>
          <Input
            id={inputId}
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            placeholder="예: 박닌, 호치민, 자동화, 금형"
            disabled={collectJobs.isPending}
          />
          <p className="text-xs text-muted-foreground">
            비워두면 베트남 전역 주요 산업단지를 폭넓게 검색합니다.
          </p>
        </div>
        <div className="flex justify-end pt-2">
          <Button onClick={handleCollect} disabled={collectJobs.isPending}>
            {collectJobs.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                수집 중...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                수집 시작
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CompaniesAdmin() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data, isLoading } = useListCompanies({});
  const create = useCreateCompany();
  const update = useUpdateCompany();
  const del = useDeleteCompany();

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: getListCompaniesQueryKey({}) });

  const buildBody = (v: FormValues) => ({
    name: v.name,
    type: v.type as "hardware" | "software" | "service",
    location: v.location,
    contactEmail: v.contactEmail,
    phone: v.phone,
    taxCode: v.taxCode,
    kakaoTalkId: v.kakaoTalkId,
    description: v.description,
    techSpecs: v.techSpecs,
    capabilityTags: toTags(v.capabilityTags),
    logoUrl: v.logoUrl,
  });

  return (
    <AdminSection
      title="기업"
      description="등록된 협력사 정보를 관리합니다."
      items={data}
      isLoading={isLoading}
      getId={(c) => c.id}
      getRowLabel={(c) => c.name}
      getSearchText={(c) =>
        [c.name, c.location ?? "", c.capabilityTags.join(" ")].join(" ")
      }
      searchPlaceholder="기업명 · 지역 · 태그 검색"
      filters={[
        {
          key: "type",
          label: "유형",
          getValue: (c) => c.type,
          options: [
            { value: "hardware", label: "하드웨어" },
            { value: "software", label: "소프트웨어" },
            { value: "service", label: "서비스" },
          ],
        },
      ]}
      columns={[
        { key: "name", header: "기업명", render: (c) => <span className="font-medium">{c.name}</span>, sortValue: (c) => c.name },
        {
          key: "type",
          header: "유형",
          render: (c) => (
            <Badge variant="secondary">{getCompanyTypeMeta(c.type).label}</Badge>
          ),
        },
        { key: "location", header: "지역", render: (c) => c.location || "-" },
        { key: "trustScore", header: "신뢰점수", render: (c) => c.trustScore, sortValue: (c) => c.trustScore },
        {
          key: "tags",
          header: "역량 태그",
          render: (c) => (
            <span className="text-xs text-muted-foreground">
              {c.capabilityTags.slice(0, 3).join(", ")}
              {c.capabilityTags.length > 3 ? ` +${c.capabilityTags.length - 3}` : ""}
            </span>
          ),
        },
      ]}
      fields={[
        { name: "name", label: "기업명", type: "text", required: true },
        {
          name: "type",
          label: "유형",
          type: "select",
          required: true,
          options: [
            { value: "hardware", label: "하드웨어 (Hardware)" },
            { value: "software", label: "소프트웨어 (Software)" },
            { value: "service", label: "서비스 (Service)" },
          ],
        },
        { name: "location", label: "지역", type: "text" },
        { name: "contactEmail", label: "이메일", type: "text" },
        { name: "phone", label: "전화번호", type: "text" },
        { name: "taxCode", label: "사업자번호", type: "text" },
        { name: "kakaoTalkId", label: "카카오톡 ID", type: "text" },
        { name: "logoUrl", label: "로고 이미지", type: "image", full: true },
        { name: "capabilityTags", label: "역량 태그", type: "tags", full: true },
        { name: "description", label: "기업 소개", type: "textarea", full: true },
        { name: "techSpecs", label: "기술 사양", type: "textarea", full: true },
      ]}
      emptyValues={{
        name: "",
        type: "hardware",
        location: "",
        contactEmail: "",
        phone: "",
        taxCode: "",
        kakaoTalkId: "",
        logoUrl: "",
        capabilityTags: "",
        description: "",
        techSpecs: "",
      }}
      toFormValues={(c) => ({
        name: c.name,
        type: c.type,
        location: c.location ?? "",
        contactEmail: c.contactEmail ?? "",
        phone: c.phone ?? "",
        taxCode: c.taxCode ?? "",
        kakaoTalkId: c.kakaoTalkId ?? "",
        logoUrl: c.logoUrl ?? "",
        capabilityTags: fromTags(c.capabilityTags),
        description: c.description ?? "",
        techSpecs: c.techSpecs ?? "",
      })}
      onCreate={async (v) => {
        try {
          await create.mutateAsync({ data: buildBody(v) });
          toast({ title: "추가 완료", description: "기업이 등록되었습니다." });
          invalidate();
        } catch {
          toast({ title: "오류", description: "저장에 실패했습니다.", variant: "destructive" });
          throw new Error("failed");
        }
      }}
      onUpdate={async (id, v) => {
        try {
          await update.mutateAsync({ id, data: buildBody(v) });
          toast({ title: "수정 완료", description: "기업 정보가 수정되었습니다." });
          invalidate();
        } catch {
          toast({ title: "오류", description: "저장에 실패했습니다.", variant: "destructive" });
          throw new Error("failed");
        }
      }}
      onDelete={async (id) => {
        try {
          await del.mutateAsync({ id });
          toast({ title: "삭제 완료", description: "기업이 삭제되었습니다." });
          invalidate();
        } catch {
          toast({ title: "오류", description: "삭제에 실패했습니다.", variant: "destructive" });
        }
      }}
    />
  );
}

function ProjectsAdmin() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data, isLoading } = useListProjects({});
  const create = useCreateProject();
  const update = useUpdateProject();
  const del = useDeleteProject();

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: getListProjectsQueryKey({}) });

  const statusOptions = [
    { value: "open", label: "모집중 (open)" },
    { value: "matching", label: "매칭중 (matching)" },
    { value: "in_progress", label: "진행중 (in_progress)" },
    { value: "completed", label: "완료 (completed)" },
  ];

  return (
    <AdminSection
      title="프로젝트"
      description="수요 프로젝트(데맨드)를 관리합니다."
      items={data}
      isLoading={isLoading}
      getId={(p) => p.id}
      getRowLabel={(p) => p.title}
      getSearchText={(p) =>
        [p.title, p.demandCompany ?? "", p.category ?? ""].join(" ")
      }
      searchPlaceholder="제목 · 수요기업 · 분야 검색"
      filters={[
        {
          key: "status",
          label: "상태",
          getValue: (p) => p.status,
          options: statusOptions.map((o) => ({ value: o.value, label: o.label })),
        },
      ]}
      columns={[
        { key: "title", header: "제목", render: (p) => <span className="font-medium">{p.title}</span>, sortValue: (p) => p.title },
        { key: "demandCompany", header: "수요기업", render: (p) => p.demandCompany || "-" },
        { key: "category", header: "분야", render: (p) => p.category || "-" },
        { key: "status", header: "상태", render: (p) => <Badge variant="outline">{p.status}</Badge>, sortValue: (p) => p.status },
        { key: "budget", header: "예산", render: (p) => p.budget || "-" },
      ]}
      fields={[
        { name: "title", label: "제목", type: "text", required: true, full: true },
        { name: "demandCompany", label: "수요기업", type: "text" },
        { name: "category", label: "분야", type: "text" },
        { name: "status", label: "상태", type: "select", options: statusOptions },
        { name: "budget", label: "예산", type: "text" },
        { name: "deadline", label: "마감일", type: "text", placeholder: "예: 2026-12-31" },
        { name: "requiredTags", label: "요구 역량 태그", type: "tags", full: true },
        { name: "description", label: "상세 설명", type: "textarea", full: true },
      ]}
      emptyValues={{
        title: "",
        demandCompany: "",
        category: "",
        status: "open",
        budget: "",
        deadline: "",
        requiredTags: "",
        description: "",
      }}
      toFormValues={(p) => ({
        title: p.title,
        demandCompany: p.demandCompany ?? "",
        category: p.category ?? "",
        status: p.status,
        budget: p.budget ?? "",
        deadline: p.deadline ?? "",
        requiredTags: fromTags(p.requiredTags),
        description: p.description ?? "",
      })}
      onCreate={async (v) => {
        try {
          await create.mutateAsync({
            data: {
              title: v.title,
              description: v.description,
              demandCompany: v.demandCompany,
              category: v.category,
              requiredTags: toTags(v.requiredTags),
              budget: v.budget,
              deadline: v.deadline,
            },
          });
          toast({ title: "추가 완료", description: "프로젝트가 등록되었습니다." });
          invalidate();
        } catch {
          toast({ title: "오류", description: "저장에 실패했습니다.", variant: "destructive" });
          throw new Error("failed");
        }
      }}
      onUpdate={async (id, v) => {
        try {
          await update.mutateAsync({
            id,
            data: {
              title: v.title,
              description: v.description,
              demandCompany: v.demandCompany,
              category: v.category,
              requiredTags: toTags(v.requiredTags),
              budget: v.budget,
              deadline: v.deadline,
              status: v.status as "open" | "matching" | "in_progress" | "completed",
            },
          });
          toast({ title: "수정 완료", description: "프로젝트가 수정되었습니다." });
          invalidate();
        } catch {
          toast({ title: "오류", description: "저장에 실패했습니다.", variant: "destructive" });
          throw new Error("failed");
        }
      }}
      onDelete={async (id) => {
        try {
          await del.mutateAsync({ id });
          toast({ title: "삭제 완료", description: "프로젝트가 삭제되었습니다." });
          invalidate();
        } catch {
          toast({ title: "오류", description: "삭제에 실패했습니다.", variant: "destructive" });
        }
      }}
    />
  );
}

function MatchesAdmin() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data, isLoading } = useListMatches({});
  const create = useCreateMatch();
  const update = useUpdateMatch();
  const del = useDeleteMatch();

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: getListMatchesQueryKey({}) });

  const statusOptions = [
    { value: "pending", label: "대기 (pending)" },
    { value: "accepted", label: "수락 (accepted)" },
    { value: "declined", label: "거절 (declined)" },
  ];

  return (
    <AdminSection
      title="매칭"
      description="프로젝트-기업 매칭을 관리합니다. (수정 시 상태만 변경됩니다)"
      items={data}
      isLoading={isLoading}
      getId={(m) => m.id}
      getRowLabel={(m) => `매칭 #${m.id}`}
      getSearchText={(m) =>
        [`매칭 ${m.id}`, `프로젝트 ${m.projectId}`, `기업 ${m.companyId}`, m.status].join(" ")
      }
      searchPlaceholder="ID · 상태 검색"
      filters={[
        {
          key: "status",
          label: "상태",
          getValue: (m) => m.status,
          options: statusOptions.map((o) => ({ value: o.value, label: o.label })),
        },
      ]}
      columns={[
        { key: "projectId", header: "프로젝트 ID", render: (m) => m.projectId, sortValue: (m) => m.projectId },
        { key: "companyId", header: "기업 ID", render: (m) => m.companyId, sortValue: (m) => m.companyId },
        { key: "status", header: "상태", render: (m) => <Badge variant="outline">{m.status}</Badge>, sortValue: (m) => m.status },
        { key: "synergyScore", header: "시너지 점수", render: (m) => m.synergyScore, sortValue: (m) => m.synergyScore },
      ]}
      fields={[
        { name: "projectId", label: "프로젝트 ID", type: "number", required: true },
        { name: "companyId", label: "기업 ID", type: "number", required: true },
        { name: "synergyScore", label: "시너지 점수", type: "number" },
        { name: "status", label: "상태 (수정 시)", type: "select", options: statusOptions },
      ]}
      emptyValues={{ projectId: "", companyId: "", synergyScore: "", status: "pending" }}
      toFormValues={(m) => ({
        projectId: String(m.projectId),
        companyId: String(m.companyId),
        synergyScore: String(m.synergyScore),
        status: m.status,
      })}
      onCreate={async (v) => {
        try {
          await create.mutateAsync({
            data: {
              projectId: toNum(v.projectId),
              companyId: toNum(v.companyId),
              ...(v.synergyScore ? { synergyScore: toNum(v.synergyScore) } : {}),
            },
          });
          toast({ title: "추가 완료", description: "매칭이 생성되었습니다." });
          invalidate();
        } catch {
          toast({ title: "오류", description: "저장에 실패했습니다.", variant: "destructive" });
          throw new Error("failed");
        }
      }}
      onUpdate={async (id, v) => {
        try {
          await update.mutateAsync({
            id,
            data: { status: v.status as "pending" | "accepted" | "declined" },
          });
          toast({ title: "수정 완료", description: "매칭 상태가 변경되었습니다." });
          invalidate();
        } catch {
          toast({ title: "오류", description: "저장에 실패했습니다.", variant: "destructive" });
          throw new Error("failed");
        }
      }}
      onDelete={async (id) => {
        try {
          await del.mutateAsync({ id });
          toast({ title: "삭제 완료", description: "매칭이 삭제되었습니다." });
          invalidate();
        } catch {
          toast({ title: "오류", description: "삭제에 실패했습니다.", variant: "destructive" });
        }
      }}
    />
  );
}

function SolutionsAdmin() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data, isLoading } = useListSolutions({});
  const create = useCreateSolution();
  const update = useUpdateSolution();
  const del = useDeleteSolution();

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: getListSolutionsQueryKey({}) });

  const buildBody = (v: FormValues) => ({
    title: v.title,
    description: v.description,
    category: v.category,
    tags: toTags(v.tags),
    companyIds: toTags(v.companyIds).map((s) => toNum(s)),
    imageUrl: v.imageUrl,
    outcome: v.outcome,
    featured: v.featured === "true",
  });

  return (
    <AdminSection
      title="솔루션"
      description="공동 솔루션 패키지를 관리합니다."
      items={data}
      isLoading={isLoading}
      getId={(s) => s.id}
      getRowLabel={(s) => s.title}
      getSearchText={(s) => [s.title, s.category ?? ""].join(" ")}
      searchPlaceholder="제목 · 분야 검색"
      filters={[
        {
          key: "featured",
          label: "추천",
          getValue: (s) => (s.featured ? "true" : "false"),
          options: [
            { value: "true", label: "추천" },
            { value: "false", label: "일반" },
          ],
        },
      ]}
      columns={[
        { key: "title", header: "제목", render: (s) => <span className="font-medium">{s.title}</span>, sortValue: (s) => s.title },
        { key: "category", header: "분야", render: (s) => s.category || "-" },
        {
          key: "companyIds",
          header: "참여기업",
          render: (s) => <span className="text-xs">{s.companyIds.join(", ") || "-"}</span>,
        },
        {
          key: "featured",
          header: "추천",
          render: (s) => (s.featured ? <Badge>추천</Badge> : <span className="text-muted-foreground text-xs">-</span>),
        },
      ]}
      fields={[
        { name: "title", label: "제목", type: "text", required: true, full: true },
        { name: "category", label: "분야", type: "text" },
        { name: "featured", label: "추천 여부", type: "select", options: [
          { value: "false", label: "일반" },
          { value: "true", label: "추천" },
        ] },
        { name: "companyIds", label: "참여기업 ID", type: "tags", full: true, placeholder: "예: 1, 2" },
        { name: "tags", label: "태그", type: "tags", full: true },
        { name: "imageUrl", label: "이미지", type: "image", full: true },
        { name: "outcome", label: "성과", type: "textarea", full: true },
        { name: "description", label: "상세 설명", type: "textarea", full: true },
      ]}
      emptyValues={{
        title: "",
        category: "",
        featured: "false",
        companyIds: "",
        tags: "",
        imageUrl: "",
        outcome: "",
        description: "",
      }}
      toFormValues={(s) => ({
        title: s.title,
        category: s.category ?? "",
        featured: s.featured ? "true" : "false",
        companyIds: s.companyIds.join(", "),
        tags: fromTags(s.tags),
        imageUrl: s.imageUrl ?? "",
        outcome: s.outcome ?? "",
        description: s.description ?? "",
      })}
      onCreate={async (v) => {
        try {
          await create.mutateAsync({ data: buildBody(v) });
          toast({ title: "추가 완료", description: "솔루션이 등록되었습니다." });
          invalidate();
        } catch {
          toast({ title: "오류", description: "저장에 실패했습니다.", variant: "destructive" });
          throw new Error("failed");
        }
      }}
      onUpdate={async (id, v) => {
        try {
          await update.mutateAsync({ id, data: buildBody(v) });
          toast({ title: "수정 완료", description: "솔루션이 수정되었습니다." });
          invalidate();
        } catch {
          toast({ title: "오류", description: "저장에 실패했습니다.", variant: "destructive" });
          throw new Error("failed");
        }
      }}
      onDelete={async (id) => {
        try {
          await del.mutateAsync({ id });
          toast({ title: "삭제 완료", description: "솔루션이 삭제되었습니다." });
          invalidate();
        } catch {
          toast({ title: "오류", description: "삭제에 실패했습니다.", variant: "destructive" });
        }
      }}
    />
  );
}

function PerformanceAdmin() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data, isLoading } = useListPerformanceLogs({});
  const create = useCreatePerformanceLog();
  const update = useUpdatePerformanceLog();
  const del = useDeletePerformanceLog();

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: getListPerformanceLogsQueryKey({}) });

  const buildBody = (v: FormValues) => ({
    projectId: toNum(v.projectId),
    companyId: toNum(v.companyId),
    role: v.role,
    contributionPercent: toNum(v.contributionPercent),
    revenue: v.revenue,
    notes: v.notes,
  });

  return (
    <AdminSection
      title="성과"
      description="프로젝트 기여 성과 로그를 관리합니다."
      items={data}
      isLoading={isLoading}
      getId={(p) => p.id}
      getRowLabel={(p) => `성과 #${p.id}`}
      getSearchText={(p) =>
        [`성과 ${p.id}`, p.role ?? "", `프로젝트 ${p.projectId}`, `기업 ${p.companyId}`].join(" ")
      }
      searchPlaceholder="역할 · ID 검색"
      columns={[
        { key: "projectId", header: "프로젝트 ID", render: (p) => p.projectId, sortValue: (p) => p.projectId },
        { key: "companyId", header: "기업 ID", render: (p) => p.companyId, sortValue: (p) => p.companyId },
        { key: "role", header: "역할", render: (p) => p.role || "-" },
        { key: "contributionPercent", header: "기여도(%)", render: (p) => p.contributionPercent, sortValue: (p) => p.contributionPercent },
        { key: "revenue", header: "매출", render: (p) => p.revenue || "-" },
      ]}
      fields={[
        { name: "projectId", label: "프로젝트 ID", type: "number", required: true },
        { name: "companyId", label: "기업 ID", type: "number", required: true },
        { name: "role", label: "역할", type: "text", required: true },
        { name: "contributionPercent", label: "기여도 (%)", type: "number", required: true },
        { name: "revenue", label: "매출", type: "text" },
        { name: "notes", label: "비고", type: "textarea", full: true },
      ]}
      emptyValues={{
        projectId: "",
        companyId: "",
        role: "",
        contributionPercent: "",
        revenue: "",
        notes: "",
      }}
      toFormValues={(p) => ({
        projectId: String(p.projectId),
        companyId: String(p.companyId),
        role: p.role ?? "",
        contributionPercent: String(p.contributionPercent),
        revenue: p.revenue ?? "",
        notes: p.notes ?? "",
      })}
      onCreate={async (v) => {
        try {
          await create.mutateAsync({ data: buildBody(v) });
          toast({ title: "추가 완료", description: "성과 로그가 등록되었습니다." });
          invalidate();
        } catch {
          toast({ title: "오류", description: "저장에 실패했습니다.", variant: "destructive" });
          throw new Error("failed");
        }
      }}
      onUpdate={async (id, v) => {
        try {
          await update.mutateAsync({ id, data: buildBody(v) });
          toast({ title: "수정 완료", description: "성과 로그가 수정되었습니다." });
          invalidate();
        } catch {
          toast({ title: "오류", description: "저장에 실패했습니다.", variant: "destructive" });
          throw new Error("failed");
        }
      }}
      onDelete={async (id) => {
        try {
          await del.mutateAsync({ id });
          toast({ title: "삭제 완료", description: "성과 로그가 삭제되었습니다." });
          invalidate();
        } catch {
          toast({ title: "오류", description: "삭제에 실패했습니다.", variant: "destructive" });
        }
      }}
    />
  );
}

function TalentAdmin() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data, isLoading } = useListTalentPosts({});
  const create = useCreateTalentPost();
  const update = useUpdateTalentPost();
  const del = useDeleteTalentPost();

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: getListTalentPostsQueryKey({}) });

  const buildBody = (v: FormValues) => ({
    postType: v.postType as "hiring" | "seeking",
    title: v.title,
    authorName: v.authorName,
    position: v.position,
    location: v.location,
    employmentType: v.employmentType,
    experienceLevel: v.experienceLevel,
    ...(v.headcount ? { headcount: toNum(v.headcount) } : {}),
    skills: toTags(v.skills),
    description: v.description,
    contactEmail: v.contactEmail,
    contactPhone: v.contactPhone,
  });

  return (
    <AdminSection
      title="인력 Pool"
      description="구인(hiring)/구직(seeking) 게시물을 관리합니다."
      items={data}
      isLoading={isLoading}
      getId={(t) => t.id}
      getRowLabel={(t) => t.title}
      headerActions={
        <>
          <CollectJobsControl postType="hiring" />
          <CollectJobsControl postType="seeking" />
        </>
      }
      getSearchText={(t) =>
        [t.title, t.authorName, t.position ?? "", t.location ?? ""].join(" ")
      }
      searchPlaceholder="제목 · 작성자 · 포지션 · 지역 검색"
      filters={[
        {
          key: "postType",
          label: "유형",
          getValue: (t) => t.postType,
          options: [
            { value: "hiring", label: "구인" },
            { value: "seeking", label: "구직" },
          ],
        },
        {
          key: "source",
          label: "출처",
          getValue: (t) => (t.source === "auto" ? "auto" : "manual"),
          options: [
            { value: "manual", label: "직접 등록" },
            { value: "auto", label: "자동 수집" },
          ],
        },
      ]}
      columns={[
        {
          key: "postType",
          header: "유형",
          render: (t) => (
            <Badge variant={t.postType === "hiring" ? "default" : "secondary"}>
              {t.postType === "hiring" ? "구인" : "구직"}
            </Badge>
          ),
          sortValue: (t) => t.postType,
        },
        { key: "title", header: "제목", render: (t) => <span className="font-medium">{t.title}</span>, sortValue: (t) => t.title },
        { key: "authorName", header: "작성자", render: (t) => t.authorName },
        { key: "position", header: "포지션", render: (t) => t.position || "-" },
        { key: "location", header: "지역", render: (t) => t.location || "-" },
        {
          key: "source",
          header: "출처",
          render: (t) =>
            t.source === "auto" ? (
              <Badge variant="outline" className="gap-1">
                <Sparkles className="h-3 w-3" />
                자동수집
              </Badge>
            ) : (
              <span className="text-muted-foreground text-xs">직접</span>
            ),
          sortValue: (t) => (t.source === "auto" ? "auto" : "manual"),
        },
      ]}
      fields={[
        { name: "postType", label: "유형", type: "select", required: true, options: [
          { value: "hiring", label: "구인 (hiring)" },
          { value: "seeking", label: "구직 (seeking)" },
        ] },
        { name: "title", label: "제목", type: "text", required: true, full: true },
        { name: "authorName", label: "작성자", type: "text", required: true },
        { name: "position", label: "포지션", type: "text" },
        { name: "location", label: "지역", type: "text" },
        { name: "employmentType", label: "고용형태", type: "text" },
        { name: "experienceLevel", label: "경력수준", type: "text" },
        { name: "headcount", label: "모집인원", type: "number" },
        { name: "contactEmail", label: "이메일", type: "text" },
        { name: "contactPhone", label: "연락처", type: "text" },
        { name: "skills", label: "보유/요구 기술", type: "tags", full: true },
        { name: "description", label: "상세 내용", type: "textarea", full: true },
      ]}
      emptyValues={{
        postType: "hiring",
        title: "",
        authorName: "",
        position: "",
        location: "",
        employmentType: "",
        experienceLevel: "",
        headcount: "",
        contactEmail: "",
        contactPhone: "",
        skills: "",
        description: "",
      }}
      toFormValues={(t) => ({
        postType: t.postType,
        title: t.title,
        authorName: t.authorName,
        position: t.position ?? "",
        location: t.location ?? "",
        employmentType: t.employmentType ?? "",
        experienceLevel: t.experienceLevel ?? "",
        headcount: t.headcount != null ? String(t.headcount) : "",
        contactEmail: t.contactEmail ?? "",
        contactPhone: t.contactPhone ?? "",
        skills: fromTags(t.skills),
        description: t.description ?? "",
      })}
      onCreate={async (v) => {
        try {
          await create.mutateAsync({ data: buildBody(v) });
          toast({ title: "추가 완료", description: "게시물이 등록되었습니다." });
          invalidate();
        } catch {
          toast({ title: "오류", description: "저장에 실패했습니다.", variant: "destructive" });
          throw new Error("failed");
        }
      }}
      onUpdate={async (id, v) => {
        try {
          await update.mutateAsync({ id, data: buildBody(v) });
          toast({ title: "수정 완료", description: "게시물이 수정되었습니다." });
          invalidate();
        } catch {
          toast({ title: "오류", description: "저장에 실패했습니다.", variant: "destructive" });
          throw new Error("failed");
        }
      }}
      onDelete={async (id) => {
        try {
          await del.mutateAsync({ id });
          toast({ title: "삭제 완료", description: "게시물이 삭제되었습니다." });
          invalidate();
        } catch {
          toast({ title: "오류", description: "삭제에 실패했습니다.", variant: "destructive" });
        }
      }}
    />
  );
}

function SupplyOffersAdmin() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data, isLoading } = useListSupplyOffers();
  const create = useCreateSupplyOffer();
  const update = useUpdateSupplyOffer();
  const del = useDeleteSupplyOffer();

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: getListSupplyOffersQueryKey() });

  const buildBody = (v: FormValues) => ({
    companyId: toNum(v.companyId),
    category: v.category,
    itemName: v.itemName,
    unitPrice: v.unitPrice,
    unit: v.unit,
    currency: v.currency,
    minOrderQty: v.minOrderQty,
    description: v.description,
  });

  const categoryOptions = [
    { value: "원재료", label: "원재료" },
    { value: "자재", label: "자재" },
    { value: "부자재", label: "부자재" },
    { value: "설비 및 장비", label: "설비 및 장비" },
    { value: "네트워크", label: "네트워크" },
    { value: "소비재", label: "소비재" },
    { value: "서비스", label: "서비스" },
    { value: "소프트웨어", label: "소프트웨어" },
    { value: "기타", label: "기타" },
  ];

  return (
    <AdminSection
      title="공급 오퍼"
      description="협력사가 공급하는 원재료·자재·부자재 품목과 단가를 관리합니다."
      items={data}
      isLoading={isLoading}
      getId={(o) => o.id}
      getRowLabel={(o) => o.itemName}
      getSearchText={(o) => [o.itemName, o.companyName ?? ""].join(" ")}
      searchPlaceholder="품명 · 공급기업 검색"
      filters={[
        {
          key: "category",
          label: "분류",
          getValue: (o) => o.category,
          options: categoryOptions,
        },
      ]}
      columns={[
        { key: "itemName", header: "품명", render: (o) => <span className="font-medium">{o.itemName}</span>, sortValue: (o) => o.itemName },
        { key: "companyName", header: "공급기업", render: (o) => o.companyName || "-" },
        { key: "category", header: "분류", render: (o) => <Badge variant="secondary">{o.category}</Badge>, sortValue: (o) => o.category },
        {
          key: "unitPrice",
          header: "단가",
          render: (o) => (
            <span className="font-mono text-sm">
              {o.unitPrice || "-"} {o.currency}
              {o.unit ? `/${o.unit}` : ""}
            </span>
          ),
        },
      ]}
      fields={[
        { name: "companyId", label: "공급기업 ID", type: "number", required: true },
        { name: "category", label: "분류", type: "select", options: categoryOptions },
        { name: "itemName", label: "품명", type: "text", required: true, full: true },
        { name: "unitPrice", label: "단가", type: "text" },
        { name: "currency", label: "통화", type: "text" },
        { name: "unit", label: "단위", type: "text" },
        { name: "minOrderQty", label: "최소 주문 수량", type: "text" },
        { name: "description", label: "설명", type: "textarea", full: true },
      ]}
      emptyValues={{
        companyId: "",
        category: "원재료",
        itemName: "",
        unitPrice: "",
        currency: "USD",
        unit: "",
        minOrderQty: "",
        description: "",
      }}
      toFormValues={(o) => ({
        companyId: String(o.companyId),
        category: o.category,
        itemName: o.itemName,
        unitPrice: o.unitPrice ?? "",
        currency: o.currency ?? "USD",
        unit: o.unit ?? "",
        minOrderQty: o.minOrderQty ?? "",
        description: o.description ?? "",
      })}
      onCreate={async (v) => {
        try {
          await create.mutateAsync({ data: buildBody(v) });
          toast({ title: "추가 완료", description: "공급 오퍼가 등록되었습니다." });
          invalidate();
        } catch {
          toast({ title: "오류", description: "저장에 실패했습니다.", variant: "destructive" });
          throw new Error("failed");
        }
      }}
      onUpdate={async (id, v) => {
        try {
          await update.mutateAsync({ id, data: buildBody(v) });
          toast({ title: "수정 완료", description: "공급 오퍼가 수정되었습니다." });
          invalidate();
        } catch {
          toast({ title: "오류", description: "저장에 실패했습니다.", variant: "destructive" });
          throw new Error("failed");
        }
      }}
      onDelete={async (id) => {
        try {
          await del.mutateAsync({ id });
          toast({ title: "삭제 완료", description: "공급 오퍼가 삭제되었습니다." });
          invalidate();
        } catch {
          toast({ title: "오류", description: "삭제에 실패했습니다.", variant: "destructive" });
        }
      }}
    />
  );
}

function OfferMatchesAdmin() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data, isLoading } = useListOfferMatches();
  const update = useUpdateOfferMatch();
  const del = useDeleteOfferMatch();

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: getListOfferMatchesQueryKey() });

  const statusOptions = [
    { value: "pending", label: "대기 (pending)" },
    { value: "reviewing", label: "검토중 (reviewing)" },
    { value: "matched", label: "매칭완료 (matched)" },
    { value: "rejected", label: "거절 (rejected)" },
  ];

  const statusLabel: Record<string, string> = {
    pending: "대기",
    reviewing: "검토중",
    matched: "매칭완료",
    rejected: "거절",
  };

  return (
    <AdminSection
      title="오퍼 매칭"
      description="고객사가 요청한 매칭 내역입니다. (매칭 과정·결과는 관리자만 열람) 상태와 메모만 수정됩니다."
      items={data}
      isLoading={isLoading}
      canCreate={false}
      getId={(m) => m.id}
      getRowLabel={(m) => `매칭 #${m.id}`}
      getSearchText={(m) =>
        [m.itemName ?? "", m.supplierCompanyName ?? "", m.clientCompanyName, m.contactName ?? ""].join(" ")
      }
      searchPlaceholder="품명 · 기업 · 담당자 검색"
      filters={[
        {
          key: "status",
          label: "상태",
          getValue: (m) => m.status,
          options: statusOptions.map((o) => ({ value: o.value, label: statusLabel[o.value] ?? o.label })),
        },
      ]}
      columns={[
        { key: "itemName", header: "품명", render: (m) => <span className="font-medium">{m.itemName}</span>, sortValue: (m) => m.itemName ?? "" },
        { key: "supplier", header: "공급기업", render: (m) => m.supplierCompanyName || "-" },
        { key: "client", header: "고객사(요청)", render: (m) => m.clientCompanyName, sortValue: (m) => m.clientCompanyName },
        { key: "contact", header: "담당자", render: (m) => m.contactName || "-" },
        { key: "contactInfo", header: "연락처", render: (m) => m.contactInfo || "-" },
        { key: "message", header: "요청 메시지", render: (m) => <span className="text-xs text-muted-foreground line-clamp-2 max-w-[240px]">{m.message || "-"}</span> },
        { key: "status", header: "상태", render: (m) => <Badge variant="outline">{statusLabel[m.status] ?? m.status}</Badge>, sortValue: (m) => m.status },
        { key: "createdAt", header: "요청일", render: (m) => formatDateTime(m.createdAt), sortValue: (m) => m.createdAt },
      ]}
      fields={[
        { name: "clientCompanyName", label: "고객사 (요청)", type: "readonly" },
        { name: "contactName", label: "담당자", type: "readonly" },
        { name: "contactInfo", label: "연락처", type: "readonly" },
        { name: "createdAt", label: "요청일", type: "readonly" },
        { name: "message", label: "요청 메시지", type: "readonly", full: true },
        { name: "status", label: "상태", type: "select", options: statusOptions },
        { name: "adminNote", label: "관리자 메모", type: "textarea", full: true },
      ]}
      emptyValues={{
        clientCompanyName: "",
        contactName: "",
        contactInfo: "",
        createdAt: "",
        message: "",
        status: "pending",
        adminNote: "",
      }}
      toFormValues={(m) => ({
        clientCompanyName: m.clientCompanyName,
        contactName: m.contactName ?? "",
        contactInfo: m.contactInfo ?? "",
        createdAt: formatDateTime(m.createdAt),
        message: m.message ?? "",
        status: m.status,
        adminNote: m.adminNote ?? "",
      })}
      onCreate={async () => {
        throw new Error("not supported");
      }}
      onUpdate={async (id, v) => {
        try {
          await update.mutateAsync({
            id,
            data: {
              status: v.status as "pending" | "reviewing" | "matched" | "rejected",
              adminNote: v.adminNote,
            },
          });
          toast({ title: "수정 완료", description: "매칭 상태가 변경되었습니다." });
          invalidate();
        } catch {
          toast({ title: "오류", description: "저장에 실패했습니다.", variant: "destructive" });
          throw new Error("failed");
        }
      }}
      onDelete={async (id) => {
        try {
          await del.mutateAsync({ id });
          toast({ title: "삭제 완료", description: "매칭이 삭제되었습니다." });
          invalidate();
        } catch {
          toast({ title: "오류", description: "삭제에 실패했습니다.", variant: "destructive" });
        }
      }}
    />
  );
}

function ResumeSubmissionsAdmin() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data, isLoading } = useListResumeSubmissions({});
  const update = useUpdateResumeSubmission();
  const del = useDeleteResumeSubmission();

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: getListResumeSubmissionsQueryKey() });

  const statusOptions = [
    { value: "received", label: "접수됨 (received)" },
    { value: "reviewing", label: "검토중 (reviewing)" },
    { value: "accepted", label: "합격 (accepted)" },
    { value: "rejected", label: "불합격 (rejected)" },
  ];

  const statusLabel: Record<string, string> = {
    received: "접수됨",
    reviewing: "검토중",
    accepted: "합격",
    rejected: "불합격",
  };

  return (
    <AdminSection
      title="이력서 접수"
      description="구인 공고에 접수된 이력서 내역입니다. (열람은 관리자만) 상태와 메모만 수정됩니다."
      items={data}
      isLoading={isLoading}
      canCreate={false}
      getId={(a) => a.id}
      getRowLabel={(a) => `이력서 #${a.id}`}
      getSearchText={(a) =>
        [a.jobTitle ?? "", a.applicantName ?? "", a.contactEmail ?? ""].join(" ")
      }
      searchPlaceholder="공고 · 지원자 · 이메일 검색"
      filters={[
        {
          key: "status",
          label: "상태",
          getValue: (a) => a.status,
          options: statusOptions.map((o) => ({
            value: o.value,
            label: statusLabel[o.value] ?? o.label,
          })),
        },
      ]}
      columns={[
        {
          key: "job",
          header: "구인 공고",
          render: (a) => (
            <span className="font-medium">
              {a.jobTitle || `#${a.talentPostId}`}
            </span>
          ),
          sortValue: (a) => a.jobTitle ?? "",
        },
        {
          key: "applicant",
          header: "지원자",
          render: (a) => a.applicantName || "-",
          sortValue: (a) => a.applicantName ?? "",
        },
        {
          key: "contact",
          header: "연락처",
          render: (a) => (
            <span className="text-xs text-muted-foreground">
              {[a.contactEmail, a.contactPhone].filter(Boolean).join(" / ") ||
                "-"}
            </span>
          ),
        },
        {
          key: "resume",
          header: "이력서",
          render: (a) =>
            a.resumeFileData ? (
              <a
                href={a.resumeFileData}
                download={a.resumeFileName || `resume-${a.id}`}
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                <Download className="h-3.5 w-3.5" />
                {a.resumeFileName || "다운로드"}
              </a>
            ) : (
              <span className="text-xs text-muted-foreground">파일 없음</span>
            ),
        },
        {
          key: "status",
          header: "상태",
          render: (a) => (
            <Badge variant="outline">{statusLabel[a.status] ?? a.status}</Badge>
          ),
          sortValue: (a) => a.status,
        },
        {
          key: "createdAt",
          header: "접수일",
          render: (a) => formatDateTime(a.createdAt),
          sortValue: (a) => a.createdAt,
        },
      ]}
      fields={[
        { name: "jobTitle", label: "구인 공고", type: "readonly" },
        { name: "applicantName", label: "지원자", type: "readonly" },
        { name: "contactEmail", label: "이메일", type: "readonly" },
        { name: "contactPhone", label: "연락처", type: "readonly" },
        { name: "createdAt", label: "접수일", type: "readonly" },
        { name: "message", label: "자기소개 / 지원 메시지", type: "readonly", full: true },
        { name: "status", label: "상태", type: "select", options: statusOptions },
        { name: "adminNote", label: "관리자 메모", type: "textarea", full: true },
      ]}
      emptyValues={{
        jobTitle: "",
        applicantName: "",
        contactEmail: "",
        contactPhone: "",
        createdAt: "",
        message: "",
        status: "received",
        adminNote: "",
      }}
      toFormValues={(a) => ({
        jobTitle: a.jobTitle,
        applicantName: a.applicantName,
        contactEmail: a.contactEmail ?? "",
        contactPhone: a.contactPhone ?? "",
        createdAt: formatDateTime(a.createdAt),
        message: a.message ?? "",
        status: a.status,
        adminNote: a.adminNote ?? "",
      })}
      onCreate={async () => {
        throw new Error("not supported");
      }}
      onUpdate={async (id, v) => {
        try {
          await update.mutateAsync({
            id,
            data: {
              status: v.status as
                | "received"
                | "reviewing"
                | "accepted"
                | "rejected",
              adminNote: v.adminNote,
            },
          });
          toast({ title: "수정 완료", description: "이력서 상태가 변경되었습니다." });
          invalidate();
        } catch {
          toast({ title: "오류", description: "저장에 실패했습니다.", variant: "destructive" });
          throw new Error("failed");
        }
      }}
      onDelete={async (id) => {
        try {
          await del.mutateAsync({ id });
          toast({ title: "삭제 완료", description: "이력서가 삭제되었습니다." });
          invalidate();
        } catch {
          toast({ title: "오류", description: "삭제에 실패했습니다.", variant: "destructive" });
        }
      }}
    />
  );
}

function MenuManagementAdmin() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: navSettings, isLoading } = useListNavSettings();
  const upsert = useUpsertNavSetting();

  const overrides: Record<string, boolean> = {};
  for (const s of navSettings ?? []) overrides[s.key] = s.hidden;

  const toggle = async (key: string, nextVisible: boolean) => {
    try {
      await upsert.mutateAsync({ key, data: { hidden: !nextVisible } });
      await qc.invalidateQueries({ queryKey: getListNavSettingsQueryKey() });
      toast({
        title: "메뉴 설정 저장됨",
        description: nextVisible
          ? "메뉴가 표시됩니다."
          : "메뉴가 숨겨집니다.",
      });
    } catch {
      toast({
        title: "오류",
        description: "메뉴 설정 저장에 실패했습니다.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">메뉴 관리</h2>
        <p className="text-sm text-muted-foreground mt-1">
          사이드바에 표시할 메뉴를 켜고 끕니다. 숨겨진 메뉴는 사이드바에서만
          보이지 않으며, 기능과 페이지는 그대로 유지됩니다 (직접 URL 접근 가능).
        </p>
      </div>

      <Card>
        <CardContent className="p-0 divide-y">
          {isLoading ? (
            <div className="p-6 flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              불러오는 중...
            </div>
          ) : (
            NAV_ITEMS.map((item) => {
              const hidden = isNavItemHidden(item, overrides);
              const Icon = item.icon;
              return (
                <div
                  key={item.key}
                  className="flex items-center justify-between gap-4 p-4"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-9 w-9 items-center justify-center rounded-md bg-muted shrink-0">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium truncate">{item.label}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {item.href}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <Badge variant={hidden ? "outline" : "secondary"}>
                      {hidden ? "숨김" : "표시"}
                    </Badge>
                    <Switch
                      checked={!hidden}
                      onCheckedChange={(checked) => toggle(item.key, checked)}
                      disabled={upsert.isPending}
                    />
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ProjectApplicationsAdmin() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data, isLoading } = useListProjectApplications({});
  const update = useUpdateProjectApplication();
  const del = useDeleteProjectApplication();

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: getListProjectApplicationsQueryKey() });

  const statusOptions = [
    { value: "pending", label: "접수됨 (pending)" },
    { value: "reviewing", label: "검토중 (reviewing)" },
    { value: "accepted", label: "수락 (accepted)" },
    { value: "rejected", label: "거절 (rejected)" },
  ];

  const statusLabel: Record<string, string> = {
    pending: "접수됨",
    reviewing: "검토중",
    accepted: "수락",
    rejected: "거절",
  };

  return (
    <AdminSection
      title="프로젝트 지원"
      description="파트너 기업이 프로젝트 의뢰에 지원한 내역입니다. (열람은 관리자만) 상태와 메모만 수정됩니다."
      items={data}
      isLoading={isLoading}
      canCreate={false}
      getId={(a) => a.id}
      getRowLabel={(a) => `지원 #${a.id}`}
      getSearchText={(a) =>
        [a.projectTitle ?? "", a.companyName ?? "", a.contactName ?? ""].join(" ")
      }
      searchPlaceholder="프로젝트 · 기업 · 담당자 검색"
      filters={[
        {
          key: "status",
          label: "상태",
          getValue: (a) => a.status,
          options: statusOptions.map((o) => ({ value: o.value, label: statusLabel[o.value] ?? o.label })),
        },
      ]}
      columns={[
        { key: "project", header: "프로젝트", render: (a) => <span className="font-medium">{a.projectTitle || `#${a.projectId}`}</span>, sortValue: (a) => a.projectTitle ?? "" },
        { key: "company", header: "지원사", render: (a) => a.companyName || `#${a.companyId}`, sortValue: (a) => a.companyName ?? "" },
        { key: "contact", header: "담당자", render: (a) => a.contactName || "-" },
        { key: "contactInfo", header: "연락처", render: (a) => a.contactInfo || "-" },
        { key: "message", header: "지원 내용", render: (a) => <span className="text-xs text-muted-foreground line-clamp-2 max-w-[240px]">{a.message || "-"}</span> },
        { key: "status", header: "상태", render: (a) => <Badge variant="outline">{statusLabel[a.status] ?? a.status}</Badge>, sortValue: (a) => a.status },
        { key: "createdAt", header: "지원일", render: (a) => formatDateTime(a.createdAt), sortValue: (a) => a.createdAt },
      ]}
      fields={[
        { name: "projectTitle", label: "프로젝트", type: "readonly" },
        { name: "companyName", label: "지원사", type: "readonly" },
        { name: "contactName", label: "담당자", type: "readonly" },
        { name: "contactInfo", label: "연락처", type: "readonly" },
        { name: "createdAt", label: "지원일", type: "readonly" },
        { name: "message", label: "지원 내용", type: "readonly", full: true },
        { name: "status", label: "상태", type: "select", options: statusOptions },
        { name: "adminNote", label: "관리자 메모", type: "textarea", full: true },
      ]}
      emptyValues={{
        projectTitle: "",
        companyName: "",
        contactName: "",
        contactInfo: "",
        createdAt: "",
        message: "",
        status: "pending",
        adminNote: "",
      }}
      toFormValues={(a) => ({
        projectTitle: a.projectTitle,
        companyName: a.companyName,
        contactName: a.contactName ?? "",
        contactInfo: a.contactInfo ?? "",
        createdAt: formatDateTime(a.createdAt),
        message: a.message ?? "",
        status: a.status,
        adminNote: a.adminNote ?? "",
      })}
      onCreate={async () => {
        throw new Error("not supported");
      }}
      onUpdate={async (id, v) => {
        try {
          await update.mutateAsync({
            id,
            data: {
              status: v.status as "pending" | "reviewing" | "accepted" | "rejected",
              adminNote: v.adminNote,
            },
          });
          toast({ title: "수정 완료", description: "지원 상태가 변경되었습니다." });
          invalidate();
        } catch {
          toast({ title: "오류", description: "저장에 실패했습니다.", variant: "destructive" });
          throw new Error("failed");
        }
      }}
      onDelete={async (id) => {
        try {
          await del.mutateAsync({ id });
          toast({ title: "삭제 완료", description: "지원이 삭제되었습니다." });
          invalidate();
        } catch {
          toast({ title: "오류", description: "삭제에 실패했습니다.", variant: "destructive" });
        }
      }}
    />
  );
}

function StatCard({
  icon,
  label,
  value,
  isLoading,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  isLoading: boolean;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground truncate">{label}</p>
          <p className="text-xl font-bold tabular-nums">
            {isLoading ? "—" : value.toLocaleString("ko")}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function BannersAdmin() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data, isLoading } = useListBanners();
  const create = useCreateBanner();
  const update = useUpdateBanner();
  const del = useDeleteBanner();

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: getListBannersQueryKey() });

  const buildBody = (v: FormValues) => ({
    title: v.title,
    imageUrl: v.imageUrl,
    linkUrl: v.linkUrl.trim() === "" ? null : v.linkUrl.trim(),
    durationSeconds: Math.max(1, toNum(v.durationSeconds) || 5),
    displayOrder: toNum(v.displayOrder) || 0,
    active: v.active === "true",
  });

  return (
    <AdminSection
      title="배너"
      description="대시보드 상단에 순환 표시되는 배너를 관리합니다. 각 배너는 지정한 표시 시간(초)만큼 노출된 뒤 다음 배너로 전환됩니다."
      items={data}
      isLoading={isLoading}
      getId={(b) => b.id}
      getRowLabel={(b) => b.title || `배너 #${b.id}`}
      columns={[
        {
          key: "preview",
          header: "미리보기",
          render: (b) =>
            b.imageUrl ? (
              <img
                src={b.imageUrl}
                alt={b.title || "배너"}
                className="h-10 w-28 rounded border object-cover"
              />
            ) : (
              <span className="text-muted-foreground text-xs">-</span>
            ),
        },
        {
          key: "title",
          header: "제목",
          render: (b) => (
            <span className="font-medium">{b.title || "-"}</span>
          ),
          sortValue: (b) => b.title,
        },
        {
          key: "durationSeconds",
          header: "표시 시간",
          render: (b) => `${b.durationSeconds}초`,
          sortValue: (b) => b.durationSeconds,
        },
        {
          key: "displayOrder",
          header: "순서",
          render: (b) => b.displayOrder,
          sortValue: (b) => b.displayOrder,
        },
        {
          key: "active",
          header: "상태",
          render: (b) =>
            b.active ? (
              <Badge>표시</Badge>
            ) : (
              <span className="text-muted-foreground text-xs">숨김</span>
            ),
          sortValue: (b) => (b.active ? "1" : "0"),
        },
      ]}
      fields={[
        { name: "title", label: "제목", type: "text", full: true, placeholder: "배너 제목 (관리용 · 이미지 대체 텍스트)" },
        { name: "imageUrl", label: "배너 이미지", type: "image", required: true, full: true },
        { name: "linkUrl", label: "연결 링크", type: "text", full: true, placeholder: "클릭 시 이동할 URL (선택, https://...)" },
        { name: "durationSeconds", label: "표시 시간(초)", type: "number", placeholder: "예: 5" },
        { name: "displayOrder", label: "표시 순서", type: "number", placeholder: "숫자가 작을수록 먼저" },
        { name: "active", label: "상태", type: "select", options: [
          { value: "true", label: "표시" },
          { value: "false", label: "숨김" },
        ] },
      ]}
      emptyValues={{
        title: "",
        imageUrl: "",
        linkUrl: "",
        durationSeconds: "5",
        displayOrder: "0",
        active: "true",
      }}
      toFormValues={(b) => ({
        title: b.title,
        imageUrl: b.imageUrl,
        linkUrl: b.linkUrl ?? "",
        durationSeconds: String(b.durationSeconds),
        displayOrder: String(b.displayOrder),
        active: b.active ? "true" : "false",
      })}
      onCreate={async (v) => {
        try {
          await create.mutateAsync({ data: buildBody(v) });
          toast({ title: "추가 완료", description: "배너가 등록되었습니다." });
          invalidate();
        } catch {
          toast({ title: "오류", description: "저장에 실패했습니다.", variant: "destructive" });
          throw new Error("failed");
        }
      }}
      onUpdate={async (id, v) => {
        try {
          await update.mutateAsync({ id, data: buildBody(v) });
          toast({ title: "수정 완료", description: "배너가 수정되었습니다." });
          invalidate();
        } catch {
          toast({ title: "오류", description: "저장에 실패했습니다.", variant: "destructive" });
          throw new Error("failed");
        }
      }}
      onDelete={async (id) => {
        try {
          await del.mutateAsync({ id });
          toast({ title: "삭제 완료", description: "배너가 삭제되었습니다." });
          invalidate();
        } catch {
          toast({ title: "오류", description: "삭제에 실패했습니다.", variant: "destructive" });
        }
      }}
    />
  );
}

function TalentContactRequestsAdmin() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: requests, isLoading } = useListTalentContactRequests();
  const updateReq = useUpdateTalentContactRequest();
  const deleteReq = useDeleteTalentContactRequest();

  const invalidate = () => qc.invalidateQueries({ queryKey: getListTalentContactRequestsQueryKey() });

  const toggleStatus = (id: number, current: string) => {
    const next = current === "pending" ? "completed" : "pending";
    updateReq.mutate(
      { id, data: { status: next as "pending" | "completed" } },
      {
        onSuccess: () => { toast({ title: "상태 변경 완료" }); invalidate(); },
        onError: () => toast({ title: "오류", description: "상태 변경에 실패했습니다.", variant: "destructive" }),
      },
    );
  };

  const handleDelete = (id: number) => {
    deleteReq.mutate(
      { id },
      {
        onSuccess: () => { toast({ title: "삭제 완료" }); invalidate(); },
        onError: () => toast({ title: "오류", description: "삭제에 실패했습니다.", variant: "destructive" }),
      },
    );
  };

  if (isLoading) return <div className="py-8 text-center text-muted-foreground">로딩 중...</div>;
  if (!requests || requests.length === 0)
    return <div className="py-8 text-center text-muted-foreground border rounded-lg bg-card">연락 요청이 없습니다.</div>;

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            {["구직자", "포스트", "업체명", "담당자", "연락처", "이메일", "상태", "접수일", ""].map((h) => (
              <th key={h} className="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {requests.map((r) => (
            <tr key={r.id} className="border-t hover:bg-muted/30">
              <td className="px-3 py-2 font-medium">{r.seekerName}</td>
              <td className="px-3 py-2 max-w-[180px] truncate text-muted-foreground">{r.postTitle}</td>
              <td className="px-3 py-2">{r.companyName}</td>
              <td className="px-3 py-2">{r.contactPerson}</td>
              <td className="px-3 py-2">{r.phone || "-"}</td>
              <td className="px-3 py-2">{r.email || "-"}</td>
              <td className="px-3 py-2">
                <button
                  type="button"
                  onClick={() => toggleStatus(r.id, r.status)}
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border transition-colors ${
                    r.status === "completed"
                      ? "bg-green-100 text-green-800 border-green-200"
                      : "bg-amber-100 text-amber-800 border-amber-200"
                  }`}
                >
                  {r.status === "completed" ? "처리완료" : "대기중"}
                </button>
              </td>
              <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{formatDateTime(r.createdAt)}</td>
              <td className="px-3 py-2">
                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive h-7 px-2" onClick={() => handleDelete(r.id)}>
                  삭제
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AdminDashboard() {
  const companies = useListCompanies({});
  const projects = useListProjects({});
  const matches = useListMatches({});
  const solutions = useListSolutions({});
  const talent = useListTalentPosts({});
  const offers = useListSupplyOffers();
  const offerMatches = useListOfferMatches();
  const applications = useListProjectApplications({});
  const resumes = useListResumeSubmissions({});
  const banners = useListBanners();

  const talentPosts = talent.data ?? [];
  const hiring = talentPosts.filter((t) => t.postType === "hiring").length;
  const seeking = talentPosts.filter((t) => t.postType === "seeking").length;

  const cards = [
    {
      icon: <Building2 className="h-5 w-5" />,
      label: "기업",
      value: companies.data?.length ?? 0,
      isLoading: companies.isLoading,
    },
    {
      icon: <ClipboardList className="h-5 w-5" />,
      label: "프로젝트",
      value: projects.data?.length ?? 0,
      isLoading: projects.isLoading,
    },
    {
      icon: <GitMerge className="h-5 w-5" />,
      label: "매칭",
      value: matches.data?.length ?? 0,
      isLoading: matches.isLoading,
    },
    {
      icon: <UserPlus className="h-5 w-5" />,
      label: "프로젝트 지원",
      value: applications.data?.length ?? 0,
      isLoading: applications.isLoading,
    },
    {
      icon: <FileText className="h-5 w-5" />,
      label: "이력서 접수",
      value: resumes.data?.length ?? 0,
      isLoading: resumes.isLoading,
    },
    {
      icon: <Package className="h-5 w-5" />,
      label: "솔루션",
      value: solutions.data?.length ?? 0,
      isLoading: solutions.isLoading,
    },
    {
      icon: <Users className="h-5 w-5" />,
      label: "구인",
      value: hiring,
      isLoading: talent.isLoading,
    },
    {
      icon: <Users className="h-5 w-5" />,
      label: "구직",
      value: seeking,
      isLoading: talent.isLoading,
    },
    {
      icon: <PackageSearch className="h-5 w-5" />,
      label: "공급 오퍼",
      value: offers.data?.length ?? 0,
      isLoading: offers.isLoading,
    },
    {
      icon: <Handshake className="h-5 w-5" />,
      label: "오퍼 매칭",
      value: offerMatches.data?.length ?? 0,
      isLoading: offerMatches.isLoading,
    },
    {
      icon: <ImageIcon className="h-5 w-5" />,
      label: "배너",
      value: banners.data?.length ?? 0,
      isLoading: banners.isLoading,
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {cards.map((c) => (
        <StatCard key={c.label} {...c} />
      ))}
    </div>
  );
}

export default function AdminPage() {
  const { logout } = useAdminAuth();
  const [, navigate] = useLocation();

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <ShieldAlert className="h-7 w-7 text-primary" />
            관리자 (ADMIN)
          </h1>
          <p className="text-muted-foreground mt-1">
            모든 데이터를 입력 · 수정 · 삭제할 수 있는 통합 관리 콘솔입니다.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleLogout} className="gap-1.5 shrink-0">
          <ShieldAlert className="h-4 w-4" />
          관리자 로그아웃
        </Button>
      </div>

      <AdminDashboard />

      <Tabs defaultValue="companies" className="w-full">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="companies">기업</TabsTrigger>
          <TabsTrigger value="projects">프로젝트</TabsTrigger>
          <TabsTrigger value="matches">매칭</TabsTrigger>
          <TabsTrigger value="applications">프로젝트 지원</TabsTrigger>
          <TabsTrigger value="resumes">이력서 접수</TabsTrigger>
          <TabsTrigger value="solutions">솔루션</TabsTrigger>
          <TabsTrigger value="performance">성과</TabsTrigger>
          <TabsTrigger value="talent">인력 Pool</TabsTrigger>
          <TabsTrigger value="offers">공급 오퍼</TabsTrigger>
          <TabsTrigger value="offer-matches">오퍼 매칭</TabsTrigger>
          <TabsTrigger value="banners">배너 관리</TabsTrigger>
          <TabsTrigger value="menu">메뉴 관리</TabsTrigger>
          <TabsTrigger value="contact-requests">구직 연락 요청</TabsTrigger>
        </TabsList>
        <TabsContent value="companies" className="mt-6">
          <CompaniesAdmin />
        </TabsContent>
        <TabsContent value="projects" className="mt-6">
          <ProjectsAdmin />
        </TabsContent>
        <TabsContent value="matches" className="mt-6">
          <MatchesAdmin />
        </TabsContent>
        <TabsContent value="applications" className="mt-6">
          <ProjectApplicationsAdmin />
        </TabsContent>
        <TabsContent value="resumes" className="mt-6">
          <ResumeSubmissionsAdmin />
        </TabsContent>
        <TabsContent value="solutions" className="mt-6">
          <SolutionsAdmin />
        </TabsContent>
        <TabsContent value="performance" className="mt-6">
          <PerformanceAdmin />
        </TabsContent>
        <TabsContent value="talent" className="mt-6">
          <TalentAdmin />
        </TabsContent>
        <TabsContent value="offers" className="mt-6">
          <SupplyOffersAdmin />
        </TabsContent>
        <TabsContent value="offer-matches" className="mt-6">
          <OfferMatchesAdmin />
        </TabsContent>
        <TabsContent value="banners" className="mt-6">
          <BannersAdmin />
        </TabsContent>
        <TabsContent value="menu" className="mt-6">
          <MenuManagementAdmin />
        </TabsContent>
        <TabsContent value="contact-requests" className="mt-6">
          <TalentContactRequestsAdmin />
        </TabsContent>
      </Tabs>
    </div>
  );
}
