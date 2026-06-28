import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useCreateCompany, getListCompaniesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { X, Plus, Factory } from "lucide-react";

const formSchema = z.object({
  name: z.string().min(2, "기업명을 입력해주세요"),
  type: z.enum(["hardware", "software"]),
  description: z.string().min(10, "기업 소개를 자세히 입력해주세요"),
  location: z.string().min(2, "위치를 입력해주세요"),
  contactEmail: z.string().email("유효한 이메일 주소를 입력해주세요"),
  techSpecs: z.string().min(5, "기술 스펙을 입력해주세요"),
});

export default function NewCompany() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");

  const createCompany = useCreateCompany();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      type: "hardware",
      description: "",
      location: "",
      contactEmail: "",
      techSpecs: "",
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
      toast({ title: "오류", description: "최소 1개의 역량 태그를 추가해주세요.", variant: "destructive" });
      return;
    }

    createCompany.mutate({
      data: {
        ...values,
        capabilityTags: tags,
      }
    }, {
      onSuccess: (newCompany) => {
        queryClient.invalidateQueries({ queryKey: getListCompaniesQueryKey() });
        toast({ title: "성공", description: "기업이 성공적으로 등록되었습니다." });
        setLocation(`/companies/${newCompany.id}`);
      },
      onError: () => {
        toast({ title: "오류", description: "기업 등록 중 문제가 발생했습니다.", variant: "destructive" });
      }
    });
  };

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">새 기업 등록</h1>
        <p className="text-muted-foreground mt-1">시너지 허브 네트워크에 귀사를 등록하고 파트너를 만나보세요.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>기업 프로필 정보</CardTitle>
          <CardDescription>정확한 정보는 더 나은 파트너 매칭을 보장합니다.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>기업명</FormLabel>
                      <FormControl>
                        <Input placeholder="예: 비엣테크 솔루션즈" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>기업 유형</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="유형 선택" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="hardware">하드웨어 (장비, 로봇, 금형 등)</SelectItem>
                          <SelectItem value="software">소프트웨어 (MES, ERP, 비전 등)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>위치 (지역)</FormLabel>
                      <FormControl>
                        <Input placeholder="예: 호치민 하이테크 파크" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="contactEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>담당자 이메일</FormLabel>
                      <FormControl>
                        <Input placeholder="contact@example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>기업 소개</FormLabel>
                    <FormControl>
                      <Textarea placeholder="주요 사업 영역과 강점을 설명해주세요." className="h-24" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-3">
                <FormLabel>역량 태그 (엔터로 추가)</FormLabel>
                <div className="flex flex-wrap gap-2 mb-2">
                  {tags.map(tag => (
                    <Badge key={tag} variant="secondary" className="px-2 py-1 text-sm">
                      {tag}
                      <button type="button" onClick={() => removeTag(tag)} className="ml-2 hover:text-destructive focus:outline-none">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <Input 
                    placeholder="예: CNC가공, MES구축, 머신비전..." 
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={handleAddTag}
                  />
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => {
                      if (tagInput.trim() && !tags.includes(tagInput.trim())) {
                        setTags([...tags, tagInput.trim()]);
                        setTagInput("");
                      }
                    }}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <FormField
                control={form.control}
                name="techSpecs"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>기술 스펙 상세</FormLabel>
                    <FormControl>
                      <Textarea placeholder="장비 사양, 사용 스택, 호환성 등 기술적 세부사항을 입력하세요." className="h-32 font-mono text-sm" {...field} />
                    </FormControl>
                    <FormDescription>이 정보는 AI 매칭 엔진이 최적의 파트너를 찾는 데 사용됩니다.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end pt-4">
                <Button type="submit" disabled={createCompany.isPending} size="lg">
                  {createCompany.isPending ? "등록 중..." : "기업 등록 완료"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
