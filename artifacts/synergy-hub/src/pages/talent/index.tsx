import { useState } from "react";
import {
  useListTalentPosts,
  useCreateTalentPost,
  useDeleteTalentPost,
  getListTalentPostsQueryKey,
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

export default function TalentPool() {
  const [tab, setTab] = useState<"hiring" | "seeking">("hiring");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [skills, setSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: posts, isLoading } = useListTalentPosts({ postType: tab });
  const createPost = useCreateTalentPost();
  const deletePost = useDeleteTalentPost();

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

      <Tabs value={tab} onValueChange={(v) => setTab(v as "hiring" | "seeking")}>
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
            <div className="grid gap-4 md:grid-cols-2">
              {posts.map((post) => (
                <Card key={post.id} className="flex flex-col">
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
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
