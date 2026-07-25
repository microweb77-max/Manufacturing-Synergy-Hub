import { useEffect, useMemo, useState } from "react";
import {
  useListTalentPosts,
  useCreateTalentPost,
  useDeleteTalentPost,
  useCreateResumeSubmission,
  useCreateTalentContactRequest,
  getListTalentPostsQueryKey,
  type TalentPost,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import {
  Users,
  Plus,
  Briefcase,
  UserSearch,
  MapPin,
  Mail,
  Phone,
  X,
  Building2,
  Clock,
  Trash2,
  Sparkles,
  ExternalLink,
  Search,
  Filter,
  RotateCcw,
  FileUp,
  Link2,
  ArrowRight,
  MessageSquare,
} from "lucide-react";

const postSchema = z.object({
  postType: z.enum(["hiring", "seeking"]),
  title: z.string().min(2, "제목을 입력해주세요"),
  authorName: z.string().min(1, "이름 또는 회사명을 입력해주세요"),
  position: z.string().optional(),
  location: z.string().optional(),
  employmentType: z.string().optional(),
  experienceLevel: z.string().optional(),
  headcount: z.coerce.number().optional(),
  description: z.string().optional(),
  contactEmail: z.string().optional(),
  contactPhone: z.string().optional(),
});

type PostForm = z.infer<typeof postSchema>;

const ALL = "__all__";

function distinctValues(
  posts: TalentPost[] | undefined,
  getter: (p: TalentPost) => string | null | undefined,
): string[] {
  const set = new Set<string>();
  for (const p of posts ?? []) {
    const v = getter(p)?.trim();
    if (v) set.add(v);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, "ko"));
}

const norm = (v: string | null | undefined) => (v ?? "").trim().toLowerCase();

// Given a 구직(seeking) post, find matching 구인(hiring) posts.
// Scores by shared 직무(position, strong), overlapping 역량(skills), and 지역(location).
function findMatchingHiring(
  seeking: TalentPost,
  hiring: TalentPost[],
): TalentPost[] {
  const seekPos = norm(seeking.position);
  const seekLoc = norm(seeking.location);
  const seekSkills = new Set(seeking.skills.map(norm).filter(Boolean));

  return hiring
    .map((h) => {
      let score = 0;
      if (seekPos && norm(h.position) === seekPos) score += 3;
      const overlap = h.skills.filter((s) => seekSkills.has(norm(s))).length;
      score += overlap;
      if (seekLoc && norm(h.location) === seekLoc) score += 1;
      return { post: h, score };
    })
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((m) => m.post);
}

function ContactRequestDialog({
  post,
  onClose,
}: {
  post: TalentPost | null;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const createRequest = useCreateTalentContactRequest();
  const [companyName, setCompanyName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    if (post) {
      setCompanyName("");
      setContactPerson("");
      setPhone("");
      setEmail("");
    }
  }, [post]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!post) return;
    if (!companyName.trim() || !contactPerson.trim()) {
      toast({ title: "필수 항목을 입력해주세요", description: "업체명과 담당자는 필수입니다.", variant: "destructive" });
      return;
    }
    createRequest.mutate(
      { data: { talentPostId: post.id, companyName: companyName.trim(), contactPerson: contactPerson.trim(), phone: phone.trim() || undefined, email: email.trim() || undefined } },
      {
        onSuccess: () => {
          toast({ title: "연락 요청 완료", description: "요청이 접수되었습니다. 구직자가 확인 후 연락드립니다." });
          onClose();
        },
        onError: () => {
          toast({ title: "오류", description: "요청 처리 중 문제가 발생했습니다.", variant: "destructive" });
        },
      },
    );
  };

  return (
    <Dialog open={post !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            구직자 연락 요청
          </DialogTitle>
          <DialogDescription>
            {post ? `"${post.title}" 구직자에게 연락 요청을 남깁니다.` : ""}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>업체명 <span className="text-destructive">*</span></Label>
            <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="예: 사이공 정밀 금형" />
          </div>
          <div className="space-y-2">
            <Label>담당자 <span className="text-destructive">*</span></Label>
            <Input value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} placeholder="예: 홍길동 부장" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>연락처 <span className="text-muted-foreground font-normal">(선택)</span></Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="예: +84 90 000 0000" />
            </div>
            <div className="space-y-2">
              <Label>이메일 <span className="text-muted-foreground font-normal">(선택)</span></Label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={createRequest.isPending}>
              {createRequest.isPending ? "제출 중..." : "요청 보내기"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const RESUME_ACCEPT =
  ".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/png,image/jpeg,image/webp";
const MAX_RESUME_BYTES = 5 * 1024 * 1024;

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("파일을 읽지 못했습니다."));
    reader.readAsDataURL(file);
  });
}

function ResumeDialog({
  post,
  onClose,
}: {
  post: TalentPost | null;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const createResume = useCreateResumeSubmission();

  const [applicantName, setApplicantName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [message, setMessage] = useState("");
  const [fileName, setFileName] = useState("");
  const [fileData, setFileData] = useState("");

  useEffect(() => {
    if (post) {
      setApplicantName("");
      setContactEmail("");
      setContactPhone("");
      setMessage("");
      setFileName("");
      setFileData("");
    }
  }, [post]);

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > MAX_RESUME_BYTES) {
      toast({
        title: "파일이 너무 큽니다",
        description: "이력서 파일은 5MB 이하여야 합니다.",
        variant: "destructive",
      });
      return;
    }
    try {
      const dataUrl = await fileToDataUrl(file);
      setFileName(file.name);
      setFileData(dataUrl);
    } catch {
      toast({
        title: "오류",
        description: "파일을 읽는 중 문제가 발생했습니다.",
        variant: "destructive",
      });
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!post) return;
    if (applicantName.trim().length < 1) {
      toast({
        title: "이름을 입력해주세요",
        description: "지원자 이름은 필수입니다.",
        variant: "destructive",
      });
      return;
    }
    createResume.mutate(
      {
        data: {
          talentPostId: post.id,
          applicantName: applicantName.trim(),
          contactEmail: contactEmail.trim() || undefined,
          contactPhone: contactPhone.trim() || undefined,
          message: message.trim() || undefined,
          resumeFileName: fileName || undefined,
          resumeFileData: fileData || undefined,
        },
      },
      {
        onSuccess: () => {
          toast({
            title: "이력서 접수 완료",
            description: "이력서가 정상적으로 접수되었습니다.",
          });
          onClose();
        },
        onError: () => {
          toast({
            title: "오류",
            description: "이력서 접수 중 문제가 발생했습니다.",
            variant: "destructive",
          });
        },
      },
    );
  };

  return (
    <Dialog open={post !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[480px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>이력서 접수</DialogTitle>
          <DialogDescription>
            {post ? `"${post.title}" 구인 공고에 이력서를 접수합니다.` : ""}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>
              이름 <span className="text-destructive">*</span>
            </Label>
            <Input
              value={applicantName}
              onChange={(e) => setApplicantName(e.target.value)}
              placeholder="예: 홍길동"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>
                이메일{" "}
                <span className="text-muted-foreground font-normal">(선택)</span>
              </Label>
              <Input
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="name@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label>
                연락처{" "}
                <span className="text-muted-foreground font-normal">(선택)</span>
              </Label>
              <Input
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="예: +84 ..."
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>
              자기소개 / 지원 메시지{" "}
              <span className="text-muted-foreground font-normal">(선택)</span>
            </Label>
            <Textarea
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="간단한 자기소개나 지원 동기를 남겨주세요."
            />
          </div>

          <div className="space-y-2">
            <Label>
              이력서 파일{" "}
              <span className="text-muted-foreground font-normal">
                (PDF, Word, 이미지 · 5MB 이하)
              </span>
            </Label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  document.getElementById("resume-file-input")?.click()
                }
              >
                <FileUp className="mr-2 h-4 w-4" />
                파일 선택
              </Button>
              {fileName && (
                <span className="text-sm text-muted-foreground truncate">
                  {fileName}
                </span>
              )}
            </div>
            <input
              id="resume-file-input"
              type="file"
              accept={RESUME_ACCEPT}
              className="hidden"
              onChange={onPickFile}
            />
          </div>

          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={createResume.isPending}>
              {createResume.isPending ? "접수 중..." : "이력서 접수하기"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function TalentPool() {
  const [tab, setTab] = useState<"hiring" | "seeking">("hiring");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [skills, setSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: posts, isLoading } = useListTalentPosts({ postType: tab });
  const { data: hiringPosts } = useListTalentPosts({ postType: "hiring" });
  const createPost = useCreateTalentPost();
  const deletePost = useDeleteTalentPost();

  const [highlightId, setHighlightId] = useState<number | null>(null);
  const [resumeTarget, setResumeTarget] = useState<TalentPost | null>(null);
  const [contactTarget, setContactTarget] = useState<TalentPost | null>(null);

  const [keyword, setKeyword] = useState("");
  const [fPosition, setFPosition] = useState(ALL);
  const [fLocation, setFLocation] = useState(ALL);
  const [fEmployment, setFEmployment] = useState(ALL);
  const [fExperience, setFExperience] = useState(ALL);

  const ITEMS_PER_PAGE = 10;
  const [currentPage, setCurrentPage] = useState(1);

  const positionOptions = useMemo(() => distinctValues(posts, (p) => p.position), [posts]);
  const locationOptions = useMemo(() => distinctValues(posts, (p) => p.location), [posts]);
  const employmentOptions = useMemo(() => distinctValues(posts, (p) => p.employmentType), [posts]);
  const experienceOptions = useMemo(() => distinctValues(posts, (p) => p.experienceLevel), [posts]);

  const resetFilters = () => {
    setKeyword("");
    setFPosition(ALL);
    setFLocation(ALL);
    setFEmployment(ALL);
    setFExperience(ALL);
    setCurrentPage(1);
  };

  useEffect(() => {
    resetFilters();
  }, [tab]);

  // 필터가 바뀌면 첫 페이지로 리셋
  useEffect(() => {
    setCurrentPage(1);
  }, [keyword, fPosition, fLocation, fEmployment, fExperience]);

  const goToHiring = (id: number) => {
    setTab("hiring");
    setHighlightId(id);
  };

  useEffect(() => {
    if (highlightId == null) return;
    const scroll = setTimeout(() => {
      document
        .getElementById(`talent-card-${highlightId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 150);
    const clear = setTimeout(() => setHighlightId(null), 2600);
    return () => {
      clearTimeout(scroll);
      clearTimeout(clear);
    };
  }, [highlightId, tab]);

  const hasActiveFilters =
    keyword.trim() !== "" ||
    fPosition !== ALL ||
    fLocation !== ALL ||
    fEmployment !== ALL ||
    fExperience !== ALL;

  const filteredPosts = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    return (posts ?? []).filter((p) => {
      if (fPosition !== ALL && p.position?.trim() !== fPosition) return false;
      if (fLocation !== ALL && p.location?.trim() !== fLocation) return false;
      if (fEmployment !== ALL && p.employmentType?.trim() !== fEmployment) return false;
      if (fExperience !== ALL && p.experienceLevel?.trim() !== fExperience) return false;
      if (q) {
        const hay = [
          p.title,
          p.authorName,
          p.description,
          p.position,
          p.location,
          ...(p.skills ?? []),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [posts, keyword, fPosition, fLocation, fEmployment, fExperience]);

  const totalPages = Math.max(1, Math.ceil(filteredPosts.length / ITEMS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedPosts = filteredPosts.slice(
    (safePage - 1) * ITEMS_PER_PAGE,
    safePage * ITEMS_PER_PAGE,
  );

  const form = useForm<PostForm>({
    resolver: zodResolver(postSchema),
    defaultValues: {
      postType: "hiring",
      title: "",
      authorName: "",
      position: "",
      location: "",
      employmentType: "",
      experienceLevel: "",
      description: "",
      contactEmail: "",
      contactPhone: "",
    },
  });

  const postType = form.watch("postType");

  const addSkill = () => {
    const v = skillInput.trim();
    if (v && !skills.includes(v)) {
      setSkills([...skills, v]);
    }
    setSkillInput("");
  };

  const removeSkill = (s: string) => setSkills(skills.filter((t) => t !== s));

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: getListTalentPostsQueryKey() });

  const onSubmit = (values: PostForm) => {
    createPost.mutate(
      {
        data: {
          ...values,
          headcount:
            values.headcount && !Number.isNaN(values.headcount)
              ? values.headcount
              : undefined,
          skills,
        },
      },
      {
        onSuccess: () => {
          toast({
            title: "등록 완료",
            description:
              values.postType === "hiring"
                ? "구인 정보가 등록되었습니다."
                : "구직 정보가 등록되었습니다.",
          });
          invalidate();
          setIsDialogOpen(false);
          setSkills([]);
          form.reset({ ...form.getValues(), postType: values.postType });
          setTab(values.postType);
        },
        onError: () => {
          toast({
            title: "오류",
            description: "등록 중 문제가 발생했습니다.",
            variant: "destructive",
          });
        },
      },
    );
  };

  const handleDelete = (id: number) => {
    deletePost.mutate(
      { id },
      {
        onSuccess: () => {
          toast({ title: "삭제 완료", description: "게시글이 삭제되었습니다." });
          invalidate();
        },
        onError: () => {
          toast({
            title: "오류",
            description: "삭제 중 문제가 발생했습니다.",
            variant: "destructive",
          });
        },
      },
    );
  };

  const openDialog = (type: "hiring" | "seeking") => {
    setSkills([]);
    form.reset({
      postType: type,
      title: "",
      authorName: "",
      position: "",
      location: "",
      employmentType: "",
      experienceLevel: "",
      description: "",
      contactEmail: "",
      contactPhone: "",
    });
    setIsDialogOpen(true);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Users className="w-8 h-8 text-primary" />
            인력 Pool
          </h1>
          <p className="text-muted-foreground mt-1">
            제조기업과 공급업체가 필요한 인력을 구하고, 구직자가 본인의 정보를
            등록하는 인력 매칭 공간입니다.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => openDialog(tab)}>
              <Plus className="mr-2 h-4 w-4" />
              {tab === "hiring" ? "구인 등록" : "구직 등록"}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {postType === "hiring" ? "구인 정보 등록" : "구직 정보 등록"}
              </DialogTitle>
              <DialogDescription>
                {postType === "hiring"
                  ? "필요한 인력의 직무, 지역, 자격 요건을 등록하세요."
                  : "본인의 경력, 희망 직무, 보유 역량을 등록하세요."}
              </DialogDescription>
            </DialogHeader>

            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-4 py-2"
              >
                <FormField
                  control={form.control}
                  name="postType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>구분</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="hiring">구인 (인력 채용)</SelectItem>
                          <SelectItem value="seeking">구직 (일자리 희망)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>제목</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={
                            postType === "hiring"
                              ? "예: 설비 자동화 엔지니어 채용"
                              : "예: 10년 경력 설비 엔지니어 구직"
                          }
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="authorName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {postType === "hiring" ? "회사명" : "이름"}
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder={
                            postType === "hiring"
                              ? "예: 사이공 정밀 금형"
                              : "예: 홍길동"
                          }
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="position"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {postType === "hiring" ? "모집 직무" : "희망 직무"}{" "}
                          <span className="text-muted-foreground font-normal">
                            (선택)
                          </span>
                        </FormLabel>
                        <FormControl>
                          <Input placeholder="예: 생산관리" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="location"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          지역{" "}
                          <span className="text-muted-foreground font-normal">
                            (선택)
                          </span>
                        </FormLabel>
                        <FormControl>
                          <Input placeholder="예: Ho Chi Minh City" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="employmentType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          고용 형태{" "}
                          <span className="text-muted-foreground font-normal">
                            (선택)
                          </span>
                        </FormLabel>
                        <FormControl>
                          <Input placeholder="예: 정규직 / 계약직" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="experienceLevel"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          경력{" "}
                          <span className="text-muted-foreground font-normal">
                            (선택)
                          </span>
                        </FormLabel>
                        <FormControl>
                          <Input placeholder="예: 신입 / 경력 5년" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {postType === "hiring" && (
                  <FormField
                    control={form.control}
                    name="headcount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          모집 인원{" "}
                          <span className="text-muted-foreground font-normal">
                            (선택)
                          </span>
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="1"
                            placeholder="예: 3"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <div className="space-y-2">
                  <Label>
                    보유/필요 역량 태그{" "}
                    <span className="text-muted-foreground font-normal">
                      (엔터로 추가)
                    </span>
                  </Label>
                  {skills.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {skills.map((s) => (
                        <Badge
                          key={s}
                          variant="secondary"
                          className="px-2 py-1 text-sm"
                        >
                          {s}
                          <button
                            type="button"
                            onClick={() => removeSkill(s)}
                            className="ml-2 hover:text-destructive focus:outline-none"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Input
                      value={skillInput}
                      onChange={(e) => setSkillInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addSkill();
                        }
                      }}
                      placeholder="예: PLC, 용접, CNC, MES..."
                    />
                    <Button type="button" variant="outline" onClick={addSkill}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        상세 설명{" "}
                        <span className="text-muted-foreground font-normal">
                          (선택)
                        </span>
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          rows={3}
                          placeholder={
                            postType === "hiring"
                              ? "담당 업무, 자격 요건, 근무 조건 등을 적어주세요."
                              : "주요 경력, 강점, 희망 근무 조건 등을 적어주세요."
                          }
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="contactEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          연락 이메일{" "}
                          <span className="text-muted-foreground font-normal">
                            (선택)
                          </span>
                        </FormLabel>
                        <FormControl>
                          <Input placeholder="name@example.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="contactPhone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          연락처{" "}
                          <span className="text-muted-foreground font-normal">
                            (선택)
                          </span>
                        </FormLabel>
                        <FormControl>
                          <Input placeholder="예: +84 ..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex justify-end pt-2">
                  <Button type="submit" disabled={createPost.isPending}>
                    {createPost.isPending ? "등록 중..." : "등록하기"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as "hiring" | "seeking")}
      >
        <TabsList>
          <TabsTrigger value="hiring" className="gap-2">
            <Briefcase className="h-4 w-4" />
            구인 정보
          </TabsTrigger>
          <TabsTrigger value="seeking" className="gap-2">
            <UserSearch className="h-4 w-4" />
            구직 정보
          </TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-6">
          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2">
              <Skeleton className="h-48 w-full" />
              <Skeleton className="h-48 w-full" />
            </div>
          ) : !posts || posts.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground border rounded-lg bg-card">
              {tab === "hiring" ? (
                <Briefcase className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
              ) : (
                <UserSearch className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
              )}
              <p className="mb-4">
                {tab === "hiring"
                  ? "등록된 구인 정보가 없습니다."
                  : "등록된 구직 정보가 없습니다."}
              </p>
              <Button variant="outline" onClick={() => openDialog(tab)}>
                <Plus className="mr-2 h-4 w-4" />
                {tab === "hiring" ? "첫 구인 정보 등록" : "첫 구직 정보 등록"}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border bg-card p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={keyword}
                      onChange={(e) => setKeyword(e.target.value)}
                      placeholder="제목, 이름/회사, 역량, 내용 검색"
                      className="pl-9"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:flex">
                    <Select value={fPosition} onValueChange={setFPosition}>
                      <SelectTrigger className="lg:w-[150px]">
                        <SelectValue placeholder="직무" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ALL}>전체 직무</SelectItem>
                        {positionOptions.map((o) => (
                          <SelectItem key={o} value={o}>{o}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={fLocation} onValueChange={setFLocation}>
                      <SelectTrigger className="lg:w-[150px]">
                        <SelectValue placeholder="지역" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ALL}>전체 지역</SelectItem>
                        {locationOptions.map((o) => (
                          <SelectItem key={o} value={o}>{o}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={fEmployment} onValueChange={setFEmployment}>
                      <SelectTrigger className="lg:w-[150px]">
                        <SelectValue placeholder="고용 형태" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ALL}>전체 고용형태</SelectItem>
                        {employmentOptions.map((o) => (
                          <SelectItem key={o} value={o}>{o}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={fExperience} onValueChange={setFExperience}>
                      <SelectTrigger className="lg:w-[150px]">
                        <SelectValue placeholder="경력" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ALL}>전체 경력</SelectItem>
                        {experienceOptions.map((o) => (
                          <SelectItem key={o} value={o}>{o}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {hasActiveFilters && (
                    <Button variant="ghost" size="sm" className="gap-1.5 shrink-0" onClick={resetFilters}>
                      <RotateCcw className="h-3.5 w-3.5" />
                      초기화
                    </Button>
                  )}
                </div>
                <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Filter className="h-3.5 w-3.5" />
                  {filteredPosts.length}건 / 전체 {posts.length}건
                </p>
              </div>

              {filteredPosts.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground border rounded-lg bg-card">
                  <Filter className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="mb-4">검색 조건에 맞는 결과가 없습니다.</p>
                  <Button variant="outline" size="sm" onClick={resetFilters}>
                    <RotateCcw className="mr-2 h-4 w-4" />
                    필터 초기화
                  </Button>
                </div>
              ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {paginatedPosts.map((post) => (
                <Card
                  key={post.id}
                  id={`talent-card-${post.id}`}
                  className={
                    "flex flex-col scroll-mt-24 transition-shadow" +
                    (highlightId === post.id
                      ? " ring-2 ring-primary shadow-lg"
                      : "")
                  }
                >
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5 mb-1">
                          <Badge
                            variant={
                              post.postType === "hiring"
                                ? "default"
                                : "secondary"
                            }
                          >
                            {post.postType === "hiring" ? "구인" : "구직"}
                          </Badge>
                          {post.source === "auto" && (
                            <Badge
                              variant="outline"
                              className="gap-1 border-primary/40 text-primary"
                            >
                              <Sparkles className="h-3 w-3" />
                              자동수집
                            </Badge>
                          )}
                        </div>
                        <CardTitle className="text-lg">{post.title}</CardTitle>
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          {post.postType === "hiring" ? (
                            <Building2 className="h-3.5 w-3.5" />
                          ) : (
                            <UserSearch className="h-3.5 w-3.5" />
                          )}
                          {post.authorName}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-destructive shrink-0"
                        onClick={() => handleDelete(post.id)}
                        disabled={deletePost.isPending}
                        aria-label="삭제"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 space-y-3">
                    <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
                      {post.position && (
                        <span className="flex items-center gap-1">
                          <Briefcase className="h-3.5 w-3.5" />
                          {post.position}
                        </span>
                      )}
                      {post.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" />
                          {post.location}
                        </span>
                      )}
                      {post.employmentType && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {post.employmentType}
                        </span>
                      )}
                      {post.experienceLevel && (
                        <span>경력: {post.experienceLevel}</span>
                      )}
                      {post.headcount != null && (
                        <span>모집 {post.headcount}명</span>
                      )}
                    </div>

                    {post.skills.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {post.skills.map((s) => (
                          <Badge key={s} variant="outline" className="text-xs">
                            {s}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {post.description && (
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {post.description}
                      </p>
                    )}

                    {post.source === "auto" && post.sourceUrl && (
                      <a
                        href={post.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" />
                        출처 보기
                      </a>
                    )}

                    {(post.contactEmail || post.contactPhone) && (
                      <div className="flex flex-wrap gap-x-4 gap-y-1 pt-2 border-t text-sm">
                        {post.contactEmail && (
                          <a
                            href={`mailto:${post.contactEmail}`}
                            className="flex items-center gap-1 text-primary hover:underline"
                          >
                            <Mail className="h-3.5 w-3.5" />
                            {post.contactEmail}
                          </a>
                        )}
                        {post.contactPhone && (
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <Phone className="h-3.5 w-3.5" />
                            {post.contactPhone}
                          </span>
                        )}
                      </div>
                    )}

                    {post.postType === "hiring" && (
                      <div className="pt-3 mt-auto border-t">
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full gap-1.5"
                          onClick={() => setResumeTarget(post)}
                        >
                          <FileUp className="h-4 w-4" />
                          이력서 접수
                        </Button>
                      </div>
                    )}

                    {post.postType === "seeking" && (
                      <div className="pt-3 mt-auto border-t space-y-2">
                        <Button
                          variant="default"
                          size="sm"
                          className="w-full gap-1.5"
                          onClick={() => setContactTarget(post)}
                        >
                          <Phone className="h-4 w-4" />
                          연락 요청
                        </Button>
                        {(() => {
                          const matches = findMatchingHiring(post, hiringPosts ?? []);
                          if (matches.length === 0) return null;
                          return (
                            <div className="space-y-1.5">
                              <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                                <Link2 className="h-3.5 w-3.5" />
                                매칭되는 구인 정보
                              </p>
                              <div className="flex flex-col gap-1">
                                {matches.map((h) => (
                                  <button
                                    key={h.id}
                                    type="button"
                                    onClick={() => goToHiring(h.id)}
                                    className="group flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-left text-sm hover:border-primary/50 hover:bg-primary/5"
                                  >
                                    <span className="truncate">
                                      <span className="font-medium">{h.title}</span>
                                      {h.authorName && (
                                        <span className="text-muted-foreground"> · {h.authorName}</span>
                                      )}
                                    </span>
                                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-primary" />
                                  </button>
                                ))}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
              )}

              {/* 페이지네이션 */}
              {filteredPosts.length > 0 && totalPages > 1 && (
                <div className="flex items-center justify-center gap-1 pt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={safePage <= 1}
                  >
                    이전
                  </Button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <Button
                      key={page}
                      variant={page === safePage ? "default" : "outline"}
                      size="sm"
                      className="w-9"
                      onClick={() => setCurrentPage(page)}
                    >
                      {page}
                    </Button>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={safePage >= totalPages}
                  >
                    다음
                  </Button>
                </div>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <ResumeDialog post={resumeTarget} onClose={() => setResumeTarget(null)} />
      <ContactRequestDialog post={contactTarget} onClose={() => setContactTarget(null)} />
    </div>
  );
}
