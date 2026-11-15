import { useState } from "react";
import { useListPerformanceLogs, useListCompanies, useListProjects, useCreatePerformanceLog, getListPerformanceLogsQueryKey, getGetCompanyLeaderboardQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { BarChart, Trophy, Plus, PieChart, DollarSign, Building2 } from "lucide-react";

const logSchema = z.object({
  projectId: z.coerce.number().min(1, "프로젝트를 선택해주세요"),
  companyId: z.coerce.number().min(1, "기업을 선택해주세요"),
  role: z.string().min(2, "수행한 역할을 입력해주세요"),
  contributionPercent: z.coerce.number().min(1).max(100, "기여도는 1-100 사이여야 합니다"),
  revenue: z.string().optional(),
  notes: z.string().optional(),
});

export default function PerformanceList() {
  const [projectIdFilter, setProjectIdFilter] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: logs, isLoading: isLogsLoading } = useListPerformanceLogs({
    projectId: projectIdFilter !== "all" ? parseInt(projectIdFilter) : undefined
  });
  
  const { data: companies } = useListCompanies();
  const { data: projects } = useListProjects();
  const createLog = useCreatePerformanceLog();

  const form = useForm<z.infer<typeof logSchema>>({
    resolver: zodResolver(logSchema),
    defaultValues: {
      projectId: 0,
      companyId: 0,
      role: "",
      contributionPercent: 50,
      revenue: "",
      notes: "",
    },
  });

  const onSubmit = (values: z.infer<typeof logSchema>) => {
    createLog.mutate({ data: values }, {
      onSuccess: () => {
        toast({ title: "성과 등록 완료", description: "기여 내역이 성공적으로 기록되었습니다." });
        queryClient.invalidateQueries({ queryKey: getListPerformanceLogsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetCompanyLeaderboardQueryKey() });
        setIsDialogOpen(false);
        form.reset();
      },
      onError: () => {
        toast({ title: "오류", description: "성과 등록 중 문제가 발생했습니다.", variant: "destructive" });
      }
    });
  };

  // Group logs by project to calculate total contribution
  const projectContributions = logs?.reduce((acc, log) => {
    if (!acc[log.projectId]) acc[log.projectId] = 0;
    acc[log.projectId] += log.contributionPercent;
    return acc;
  }, {} as Record<number, number>) || {};

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">성과 및 기여도 보드</h1>
          <p className="text-muted-foreground mt-1">프로젝트별 각 파트너사의 기여도를 측정하고 공정한 이익 분배를 관리합니다.</p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              수행 성과 기록
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>프로젝트 수행 성과 기록</DialogTitle>
              <DialogDescription>
                파트너사의 프로젝트 기여도와 매출 발생 내역을 등록합니다. 이 기록은 신뢰 점수(Trust Score)에 반영됩니다.
              </DialogDescription>
            </DialogHeader>
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                <FormField
                  control={form.control}
                  name="projectId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>프로젝트</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value ? String(field.value) : undefined}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="참여한 프로젝트 선택" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {projects?.map(p => (
                            <SelectItem key={p.id} value={String(p.id)}>{p.title}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="companyId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>수행 파트너사</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value ? String(field.value) : undefined}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="파트너사 선택" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {companies?.map(c => (
                            <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="role"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>담당 역할</FormLabel>
                        <FormControl>
                          <Input placeholder="예: MES 개발 및 연동" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="contributionPercent"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>기여도 (%)</FormLabel>
                        <FormControl>
                          <Input type="number" min="1" max="100" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="revenue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>발생 매출 (선택)</FormLabel>
                      <FormControl>
                        <Input placeholder="예: $30,000" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end pt-4">
                  <Button type="submit" disabled={createLog.isPending}>
                    {createLog.isPending ? "기록 중..." : "성과 등록"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-4 bg-card p-4 border rounded-lg shadow-sm">
        <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">프로젝트 필터:</span>
        <Select value={projectIdFilter} onValueChange={setProjectIdFilter}>
          <SelectTrigger className="w-[300px]">
            <SelectValue placeholder="모든 프로젝트" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">모든 프로젝트</SelectItem>
            {projects?.map(p => (
              <SelectItem key={p.id} value={String(p.id)}>{p.title}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center"><BarChart className="w-5 h-5 mr-2 text-primary" /> 기여도 산정 내역</CardTitle>
          <CardDescription>합동 수주 프로젝트에서 각 파트너사의 구체적인 기여 퍼센트와 매출을 표시합니다.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLogsLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : logs?.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Trophy className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
              등록된 성과 내역이 없습니다.
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead>프로젝트</TableHead>
                    <TableHead>파트너사</TableHead>
                    <TableHead>담당 역할</TableHead>
                    <TableHead className="text-right">기여도</TableHead>
                    <TableHead className="text-right">매출 배분</TableHead>
                    <TableHead className="text-right">등록일</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs?.map((log) => {
                    const totalProjContribution = projectContributions[log.projectId] || 0;
                    const isOver100 = totalProjContribution > 100;
                    
                    return (
                      <TableRow key={log.id} className="hover:bg-muted/30">
                        <TableCell className="font-medium max-w-[250px] truncate">
                          {log.project?.title || `프로젝트 #${log.projectId}`}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-muted-foreground" />
                            {log.company?.name || `기업 #${log.companyId}`}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{log.role}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 h-2 bg-secondary rounded-full overflow-hidden">
                              <div className="h-full bg-primary" style={{ width: `${log.contributionPercent}%` }}></div>
                            </div>
                            <span className={`font-mono font-bold ${isOver100 ? 'text-destructive' : 'text-primary'}`}>
                              {log.contributionPercent}%
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono font-medium text-emerald-600">
                          {log.revenue || '-'}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground text-sm">
                          {new Date(log.createdAt).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
