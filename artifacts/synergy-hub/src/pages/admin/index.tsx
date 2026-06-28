import { useQueryClient } from "@tanstack/react-query";
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
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ShieldAlert } from "lucide-react";
import {
  AdminSection,
  toTags,
  fromTags,
  toNum,
  type FormValues,
} from "./AdminSection";

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
    type: v.type as "hardware" | "software",
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
      columns={[
        { key: "name", header: "기업명", render: (c) => <span className="font-medium">{c.name}</span> },
        {
          key: "type",
          header: "유형",
          render: (c) => (
            <Badge variant="secondary">
              {c.type === "hardware" ? "하드웨어" : "소프트웨어"}
            </Badge>
          ),
        },
        { key: "location", header: "지역", render: (c) => c.location || "-" },
        { key: "trustScore", header: "신뢰점수", render: (c) => c.trustScore },
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
          ],
        },
        { name: "location", label: "지역", type: "text" },
        { name: "contactEmail", label: "이메일", type: "text" },
        { name: "phone", label: "전화번호", type: "text" },
        { name: "taxCode", label: "사업자번호", type: "text" },
        { name: "kakaoTalkId", label: "카카오톡 ID", type: "text" },
        { name: "logoUrl", label: "로고 URL", type: "text" },
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
      columns={[
        { key: "title", header: "제목", render: (p) => <span className="font-medium">{p.title}</span> },
        { key: "demandCompany", header: "수요기업", render: (p) => p.demandCompany || "-" },
        { key: "category", header: "분야", render: (p) => p.category || "-" },
        { key: "status", header: "상태", render: (p) => <Badge variant="outline">{p.status}</Badge> },
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
      columns={[
        { key: "projectId", header: "프로젝트 ID", render: (m) => m.projectId },
        { key: "companyId", header: "기업 ID", render: (m) => m.companyId },
        { key: "status", header: "상태", render: (m) => <Badge variant="outline">{m.status}</Badge> },
        { key: "synergyScore", header: "시너지 점수", render: (m) => m.synergyScore },
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
      columns={[
        { key: "title", header: "제목", render: (s) => <span className="font-medium">{s.title}</span> },
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
        { name: "imageUrl", label: "이미지 URL", type: "text", full: true },
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
      columns={[
        { key: "projectId", header: "프로젝트 ID", render: (p) => p.projectId },
        { key: "companyId", header: "기업 ID", render: (p) => p.companyId },
        { key: "role", header: "역할", render: (p) => p.role || "-" },
        { key: "contributionPercent", header: "기여도(%)", render: (p) => p.contributionPercent },
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
      columns={[
        {
          key: "postType",
          header: "유형",
          render: (t) => (
            <Badge variant={t.postType === "hiring" ? "default" : "secondary"}>
              {t.postType === "hiring" ? "구인" : "구직"}
            </Badge>
          ),
        },
        { key: "title", header: "제목", render: (t) => <span className="font-medium">{t.title}</span> },
        { key: "authorName", header: "작성자", render: (t) => t.authorName },
        { key: "position", header: "포지션", render: (t) => t.position || "-" },
        { key: "location", header: "지역", render: (t) => t.location || "-" },
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

export default function AdminPage() {
  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <ShieldAlert className="h-7 w-7 text-primary" />
          관리자 (ADMIN)
        </h1>
        <p className="text-muted-foreground mt-1">
          모든 데이터를 입력 · 수정 · 삭제할 수 있는 통합 관리 콘솔입니다.
        </p>
      </div>

      <Tabs defaultValue="companies" className="w-full">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="companies">기업</TabsTrigger>
          <TabsTrigger value="projects">프로젝트</TabsTrigger>
          <TabsTrigger value="matches">매칭</TabsTrigger>
          <TabsTrigger value="solutions">솔루션</TabsTrigger>
          <TabsTrigger value="performance">성과</TabsTrigger>
          <TabsTrigger value="talent">인력 Pool</TabsTrigger>
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
        <TabsContent value="solutions" className="mt-6">
          <SolutionsAdmin />
        </TabsContent>
        <TabsContent value="performance" className="mt-6">
          <PerformanceAdmin />
        </TabsContent>
        <TabsContent value="talent" className="mt-6">
          <TalentAdmin />
        </TabsContent>
      </Tabs>
    </div>
  );
}
