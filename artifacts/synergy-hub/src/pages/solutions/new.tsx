import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useCreateSolution, useListCompanies, getListSolutionsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { X, Plus, Layers, Factory, Monitor } from "lucide-react";

const formSchema = z.object({
  title: z.string().min(5, "솔루션 이름을 입력해주세요"),
  category: z.string().min(2, "카테고리를 입력해주세요"),
  description: z.string().min(20, "솔루션에 대한 상세 설명을 입력해주세요"),
  outcome: z.string().optional(),
  featured: z.boolean().default(false),
});

export default function NewSolution() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<number[]>([]);

  const { data: companies } = useListCompanies();
  const createSolution = useCreateSolution();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      category: "",
      description: "",
      outcome: "",
      featured: false,
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

  const toggleCompany = (id: number) => {
    if (selectedCompanyIds.includes(id)) {
      setSelectedCompanyIds(selectedCompanyIds.filter(companyId => companyId !== id));
    } else {
      setSelectedCompanyIds([...selectedCompanyIds, id]);
    }
  };

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    if (tags.length === 0) {
      toast({ title: "오류", description: "최소 1개의 핵심 키워드 태그를 추가해주세요.", variant: "destructive" });
      return;
    }

    if (selectedCompanyIds.length < 2) {
      toast({ title: "오류", description: "조인트 솔루션은 최소 2개 이상의 기업이 참여해야 합니다.", variant: "destructive" });
      return;
    }

    // Checking if there is both HW and SW (optional but good practice for synergy hub)
    const selectedCompanies = companies?.filter(c => selectedCompanyIds.includes(c.id)) || [];
    const hasHardware = selectedCompanies.some(c => c.type === 'hardware');
    const hasSoftware = selectedCompanies.some(c => c.type === 'software');

    if (!hasHardware || !hasSoftware) {
      toast({ title: "주의", description: "HW와 SW 기업이 모두 포함되는 것이 진정한 시너지 창출에 유리합니다.", variant: "default" });
    }

    createSolution.mutate({
      data: {
        ...values,
        tags,
        companyIds: selectedCompanyIds,
      }
    }, {
      onSuccess: (newSolution) => {
        queryClient.invalidateQueries({ queryKey: getListSolutionsQueryKey() });
        toast({ title: "솔루션 등록 성공", description: "새로운 조인트 솔루션 패키지가 등록되었습니다." });
        setLocation(`/solutions/${newSolution.id}`);
      },
      onError: () => {
        toast({ title: "오류", description: "솔루션 등록 중 문제가 발생했습니다.", variant: "destructive" });
      }
    });
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">조인트 솔루션 패키지 생성</h1>
        <p className="text-muted-foreground mt-1">협력사들과 함께 만든 통합 솔루션을 시장에 선보이세요.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center"><Layers className="w-5 h-5 mr-2 text-primary" /> 패키지 정보</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6" id="solution-form">
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>솔루션 패키지 이름</FormLabel>
                        <FormControl>
                          <Input placeholder="예: 무인 물류 자동화 통합 솔루션 (AGV + WMS)" {...field} />
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
                        <FormLabel>산업 카테고리</FormLabel>
                        <FormControl>
                          <Input placeholder="예: 스마트 물류, 공정 자동화, 품질 검사" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="space-y-3">
                    <Label>핵심 키워드 태그 (엔터로 추가)</Label>
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
                        placeholder="예: AGV, 딥러닝, 예지보전..." 
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
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>솔루션 소개</FormLabel>
                        <FormControl>
                          <Textarea placeholder="결합된 솔루션이 어떤 문제를 해결하고 어떤 가치를 제공하는지 자세히 적어주세요." className="h-32" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="outcome"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>도입 성과 / 기대 효과 (선택)</FormLabel>
                        <FormControl>
                          <Textarea placeholder="예: 생산성 30% 향상, 불량률 15% 감소 등 구체적인 수치를 포함하면 좋습니다." className="h-24" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="featured"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 bg-muted/20">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>
                            우수 도입 사례 (Featured) 표시
                          </FormLabel>
                          <FormDescription>
                            실제 현장에서 성공적으로 적용된 검증된 솔루션인 경우 체크하세요.
                          </FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="sticky top-6">
            <CardHeader className="bg-secondary/10 pb-4 border-b">
              <CardTitle className="text-lg">참여 파트너 선택</CardTitle>
              <CardDescription>
                솔루션을 함께 구성하는 기업을 선택하세요. (최소 2개)
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[500px] overflow-y-auto p-4 space-y-2">
                {companies?.map(company => {
                  const isSelected = selectedCompanyIds.includes(company.id);
                  return (
                    <div 
                      key={company.id} 
                      className={`flex items-center space-x-3 p-3 rounded-lg border transition-all cursor-pointer ${
                        isSelected ? 'border-primary bg-primary/5 shadow-sm' : 'border-border/50 hover:bg-muted/50'
                      }`}
                      onClick={() => toggleCompany(company.id)}
                    >
                      <Checkbox 
                        checked={isSelected}
                        onCheckedChange={() => toggleCompany(company.id)}
                        id={`company-${company.id}`}
                      />
                      <label 
                        htmlFor={`company-${company.id}`}
                        className="flex-1 flex flex-col cursor-pointer"
                        onClick={(e) => e.preventDefault()}
                      >
                        <span className="font-medium text-sm leading-none mb-1.5">{company.name}</span>
                        <div className="flex items-center text-xs text-muted-foreground">
                          {company.type === 'hardware' ? (
                            <><Factory className="w-3 h-3 mr-1 text-amber-500" /> HW</>
                          ) : (
                            <><Monitor className="w-3 h-3 mr-1 text-blue-500" /> SW</>
                          )}
                        </div>
                      </label>
                    </div>
                  );
                })}
              </div>
              
              <div className="p-4 border-t bg-card mt-auto">
                <div className="flex justify-between items-center mb-4 text-sm">
                  <span className="text-muted-foreground">선택된 기업:</span>
                  <span className="font-bold font-mono text-primary text-base">{selectedCompanyIds.length}개</span>
                </div>
                <Button type="submit" form="solution-form" className="w-full" size="lg" disabled={createSolution.isPending}>
                  {createSolution.isPending ? "등록 중..." : "솔루션 출시하기"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
