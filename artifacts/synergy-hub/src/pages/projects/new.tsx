import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useCreateProject, getListProjectsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { X, Plus, Bot } from "lucide-react";

const formSchema = z.object({
  title: z.string().min(5, "프로젝트 제목을 상세히 입력해주세요"),
  demandCompany: z.string().min(2, "수요 기업명을 입력해주세요"),
  category: z.string().min(2, "카테고리를 입력해주세요"),
  description: z.string().min(20, "프로젝트 배경 및 요구사항을 자세히 입력해주세요"),
  budget: z.string().optional(),
  deadline: z.string().optional(),
});

export default function NewProject() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");

  const createProject = useCreateProject();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      demandCompany: "",
      category: "",
      description: "",
      budget: "",
      deadline: "",
    },
  });

  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      if (!tags.includes(tagInput.trim())) {
        setTags([...tags, tagInput.trim()]);
      }
      setTagInput("");
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    if (tags.length === 0) {
      toast({ title: "오류", description: "최소 1개의 요구 역량 태그를 추가해주세요.", variant: "destructive" });
      return;
    }

    createProject.mutate({
      data: {
        ...values,
        requiredTags: tags,
      }
    }, {
      onSuccess: (newProject) => {
        queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
        toast({ title: "프로젝트 등록 성공", description: "AI가 즉시 최적의 파트너 매칭 분석을 시작합니다." });
        setLocation(`/projects/${newProject.id}`);
      },
      onError: () => {
        toast({ title: "오류", description: "프로젝트 등록 중 문제가 발생했습니다.", variant: "destructive" });
      }
    });
  };

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">수요 프로젝트 등록</h1>
        <p className="text-muted-foreground mt-1">새로운 제조 현장의 수요를 등록하면 AI가 최적의 HW/SW 협력사를 추천합니다.</p>
      </div>

      <Card className="border-t-4 border-t-primary">
        <CardHeader>
          <div className="flex items-center gap-2 text-primary font-medium text-sm mb-2">
            <Bot className="w-5 h-5" /> 자동 매칭 지원 활성화됨
          </div>
          <CardTitle>프로젝트 정보</CardTitle>
          <CardDescription>상세하게 작성할수록 AI 추천의 정확도가 높아집니다.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>프로젝트 제목</FormLabel>
                    <FormControl>
                      <Input placeholder="예: 빈즈엉 A사 스마트팩토리 자재 운송 로봇 및 MES 연동" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="demandCompany"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>수요 기업명</FormLabel>
                      <FormControl>
                        <Input placeholder="예: 베트남 삼성전자 협력사 A사" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>카테고리</FormLabel>
                      <FormControl>
                        <Input placeholder="예: 물류자동화" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="budget"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>예산 (선택)</FormLabel>
                      <FormControl>
                        <Input placeholder="예: $50,000 ~ $80,000" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="deadline"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>마감일 (선택)</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-3 p-4 bg-muted/30 rounded-lg border border-border">
                <FormLabel className="text-base font-semibold">필요 역량 태그 <span className="text-destructive">*</span></FormLabel>
                <FormDescription>이 프로젝트를 수행하는 데 필요한 핵심 기술과 장비를 입력하세요. AI 매칭의 핵심 기준이 됩니다.</FormDescription>
                
                <div className="flex flex-wrap gap-2 my-3">
                  {tags.map(tag => (
                    <Badge key={tag} variant="default" className="px-2 py-1 text-sm bg-primary/20 text-primary border-primary/30 hover:bg-primary/30">
                      {tag}
                      <button type="button" onClick={() => removeTag(tag)} className="ml-2 focus:outline-none">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                  {tags.length === 0 && <span className="text-sm text-muted-foreground italic">등록된 태그가 없습니다.</span>}
                </div>
                
                <div className="flex items-center gap-2">
                  <Input 
                    placeholder="예: AGV, 창고관리시스템, PLC, 머신비전..." 
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={handleAddTag}
                  />
                  <Button 
                    type="button" 
                    variant="secondary" 
                    onClick={() => {
                      if (tagInput.trim() && !tags.includes(tagInput.trim())) {
                        setTags([...tags, tagInput.trim()]);
                        setTagInput("");
                      }
                    }}
                  >
                    추가
                  </Button>
                </div>
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>프로젝트 상세 설명</FormLabel>
                    <FormControl>
                      <Textarea placeholder="현재 직면한 문제점, 도입하려는 솔루션의 구체적인 형태, 현장 제약사항 등을 자세히 적어주세요." className="h-40" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end pt-6 border-t">
                <Button type="submit" disabled={createProject.isPending} size="lg" className="w-full sm:w-auto">
                  {createProject.isPending ? "분석 및 등록 중..." : "프로젝트 등록 및 AI 파트너 분석"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
