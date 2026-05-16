
"use client";

import * as React from "react";
import {
  Loader2,
  GitFork,
  TrendingUp,
  Target,
  BarChart2,
  Calendar,
  Frown,
  TrendingDown,
  RefreshCw,
  Medal,
  Trophy,
  Award,
  Gem,
} from "lucide-react";
import {
  collection,
  getDocs,
  query,
  orderBy as firestoreOrderBy,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type {
  Goal,
  GoalType,
  PeriodGroup,
  Branch,
  Period,
  GoalLevelTargets,
} from "@/lib/definitions";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { getGroupStatus } from "@/lib/period-helpers";
import { differenceInBusinessDays, isAfter, isBefore, parseISO } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card } from "@/components/ui/card";

type GoalTypeTotals = {
    goalType: GoalType;
    totalRealizado: number;
    totalMeta: number;
    totalAchievement: number;
    totalProjection: number;
    totalLevelTargets: GoalLevelTargets;
    daysPassed: number;
    daysTotal: number;
    dailyGoal: number;
    nextLevel: { name: keyof GoalLevelTargets; value: number } | null;
    remainingForNextLevel: number;
}

type BranchReportData = {
  branch: Branch;
  goals: ProcessedGoal[];
  goalTypeTotals: GoalTypeTotals[];
};

type ProcessedGoal = {
  goal: Goal;
  goalType: GoalType;
  period: Period;
  metrics: GoalMetrics;
};

type GoalMetrics = {
  daysTotal: number;
  daysPassed: number;
  dailyGoal: number;
  projection: number;
  achievement: number;
  levelAchievements: { [key in keyof GoalLevelTargets]?: number };
  nextLevel: { name: keyof GoalLevelTargets; value: number } | null;
  remainingForNextLevel: number;
  remainingForTotal: number;
  totalLevelTarget: number;
};

const orderedLevels: Array<keyof GoalLevelTargets> = ['Bronze', 'Prata', 'Ouro', 'Diamante'];

const levelIcons: Record<keyof GoalLevelTargets, React.ReactNode> = {
    Bronze: <Medal className="h-4 w-4 text-orange-600" />,
    Prata: <Trophy className="h-4 w-4 text-slate-500" />,
    Ouro: <Award className="h-4 w-4 text-yellow-500" />,
    Diamante: <Gem className="h-4 w-4 text-sky-400" />,
};


export default function BranchesReportPage() {
  const { toast } = useToast();
  const [loading, setLoading] = React.useState(true);
  const [reportData, setReportData] = React.useState<BranchReportData[]>([]);
  const [periodGroups, setPeriodGroups] = React.useState<PeriodGroup[]>([]);
  const [selectedPeriodGroupId, setSelectedPeriodGroupId] = React.useState<string | null>(null);

  const [allData, setAllData] = React.useState<{
      goals: Goal[],
      goalTypes: GoalType[],
      branches: Branch[],
  } | null>(null);

  const formatCurrency = (value: number | undefined) => {
    if (value === undefined || isNaN(value)) return "R$ 0,00";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };
  
  const formatPercentage = (value: number | undefined) => {
      if(value === undefined || isNaN(value)) return "0,00%";
      return `${value.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}%`;
  }

  const processData = React.useCallback(() => {
    if (!allData || !selectedPeriodGroupId) {
        setReportData([]);
        return;
    };
    
    const { goals, goalTypes, branches } = allData;

    const selectedGroup = periodGroups.find(p => p.id === selectedPeriodGroupId);
    
    if (!selectedGroup) {
        setReportData([]);
        return;
    }
    const targetPeriods = selectedGroup.periods;
    const targetPeriodIds = new Set(targetPeriods.map(p => p.id));

    const isFreteType = (gt: GoalType) => gt.name.toLowerCase().includes('frete');
    const isMercantilType = (gt: GoalType) => gt.name.toLowerCase().includes('mercantil');

    const branchReports = branches.map(branch => {
      const branchGoals = goals.filter(g => 
        g.branchId === branch.id &&
        targetPeriodIds.has(g.periodId)
      );
      
      const goalTypeTotalsMap: Map<string, Omit<GoalTypeTotals, 'totalAchievement'>> = new Map();

      const processedGoals: ProcessedGoal[] = branchGoals.map(goal => {
        const goalType = goalTypes.find(gt => gt.id === goal.goalTypeId)!;
        const period = targetPeriods.find(p => p.id === goal.periodId)!;
        const realizado = goal.realizado ?? 0;
        
        const today = new Date();
        today.setHours(0,0,0,0);
        const startDate = parseISO(period.startDate);
        const endDate = parseISO(period.endDate);
        
        const daysTotal = differenceInBusinessDays(endDate, startDate) + 1;
        let daysPassed = differenceInBusinessDays(today, startDate) + 1;
        if (isBefore(today, startDate)) daysPassed = 0;
        if (isAfter(today, endDate)) daysPassed = daysTotal;

        let targetValue = goal.targetValue ?? 0;
        let totalLevelTarget = 0;
        let achievement = 0;
        const originalGoal = {...goal};
        
        if (isFreteType(goalType)) {
          const mercantilGoal = branchGoals.find(g => {
            const gt = goalTypes.find(t => t.id === g.goalTypeId);
            return g.periodId === goal.periodId && gt && isMercantilType(gt);
          });
          const mercantilRealizado = mercantilGoal?.realizado ?? 0;
          const freightTargetPercentage = goal.targetValue ?? 0;
          const calculatedTarget = (mercantilRealizado * freightTargetPercentage) / 100;
          targetValue = calculatedTarget;
          originalGoal.targetValue = calculatedTarget;
        } else if (isMercantilType(goalType) && goal.hasLevels && goal.levelTargets) {
            totalLevelTarget = goal.levelTargets.Diamante || 0;
            targetValue = totalLevelTarget;
            originalGoal.targetValue = targetValue;
        }

        if (targetValue > 0) {
            achievement = (realizado / targetValue) * 100;
        } else {
            achievement = realizado > 0 ? 100 : 0;
        }

        const dailyGoal = targetValue > 0 && daysTotal > 0 ? targetValue / daysTotal : 0;
        const projection = daysPassed > 0 ? (realizado / daysPassed) * daysTotal : 0;
        const remainingForTotal = Math.max(0, targetValue - realizado);
        
        if (!goalTypeTotalsMap.has(goal.goalTypeId)) {
          goalTypeTotalsMap.set(goal.goalTypeId, {
            goalType,
            totalRealizado: 0,
            totalMeta: 0,
            totalLevelTargets: { Bronze: 0, Prata: 0, Ouro: 0, Diamante: 0 },
            totalProjection: 0,
            daysPassed: 0,
            daysTotal: 0,
            dailyGoal: 0,
            nextLevel: null,
            remainingForNextLevel: 0,
          });
        }
        
        const totals = goalTypeTotalsMap.get(goal.goalTypeId)!;
        totals.totalRealizado += realizado;
        totals.totalProjection += projection;
        totals.totalMeta += targetValue;
        
        totals.daysPassed = Math.max(totals.daysPassed, daysPassed);
        totals.daysTotal = Math.max(totals.daysTotal, daysTotal);

        if (goal.hasLevels && goal.levelTargets) {
            totals.totalLevelTargets.Bronze += goal.levelTargets.Bronze || 0;
            totals.totalLevelTargets.Prata += goal.levelTargets.Prata || 0;
            totals.totalLevelTargets.Ouro += goal.levelTargets.Ouro || 0;
            totals.totalLevelTargets.Diamante += goal.levelTargets.Diamante || 0;
        }
        
        const levelAchievements: { [key in keyof GoalLevelTargets]?: number } = {};
        if (goal.hasLevels && goal.levelTargets) {
            for (const level of orderedLevels) {
                const levelTarget = goal.levelTargets[level];
                if (levelTarget && levelTarget > 0) {
                    levelAchievements[level] = (realizado / levelTarget) * 100;
                }
            }
        }

        let nextLevel: { name: keyof GoalLevelTargets; value: number } | null = null;
        let remainingForNextLevel = 0;
        if (goal.hasLevels && goal.levelTargets) {
            for (const level of orderedLevels) {
                const levelTarget = goal.levelTargets[level];
                if (levelTarget && realizado < levelTarget) {
                    nextLevel = { name: level, value: levelTarget };
                    remainingForNextLevel = levelTarget - realizado;
                    break;
                }
            }
        }

        return {
          goal: originalGoal,
          goalType,
          period,
          metrics: {
            daysTotal,
            daysPassed,
            dailyGoal,
            projection,
            achievement,
            levelAchievements,
            nextLevel,
            remainingForNextLevel,
            remainingForTotal,
            totalLevelTarget
          }
        };
      }).sort((a,b) => {
        const periodComparison = a.period.name.localeCompare(b.period.name, undefined, { numeric: true });
        if (periodComparison !== 0) return periodComparison;
        return (a.goalType.order ?? 99) - (b.goalType.order ?? 99);
      });
      
      const goalTypeTotalsArray: GoalTypeTotals[] = Array.from(goalTypeTotalsMap.values()).map(total => {
        let nextLevel: { name: keyof GoalLevelTargets; value: number } | null = null;
        let remainingForNextLevel = 0;

        if (Object.values(total.totalLevelTargets).some(v => v > 0)) {
           for (const level of orderedLevels) {
                const levelTarget = total.totalLevelTargets[level];
                if (levelTarget && total.totalRealizado < levelTarget) {
                    nextLevel = { name: level, value: levelTarget };
                    remainingForNextLevel = levelTarget - total.totalRealizado;
                    break;
                }
            }
        }

        return {
            ...total,
            totalAchievement: total.totalMeta > 0 ? (total.totalRealizado / total.totalMeta) * 100 : (total.totalRealizado > 0 ? 100 : 0),
            dailyGoal: total.totalMeta > 0 && total.daysTotal > 0 ? total.totalMeta / total.daysTotal : 0,
            nextLevel,
            remainingForNextLevel,
        }
      }).sort((a, b) => (a.goalType.order ?? 99) - (b.goalType.order ?? 99));

      return {
        branch,
        goals: processedGoals,
        goalTypeTotals: goalTypeTotalsArray
      };
    });

    setReportData(branchReports.filter(r => r.goals.length > 0));

  }, [allData, selectedPeriodGroupId, periodGroups]);

  const fetchData = React.useCallback(async () => {
    try {
      setLoading(true);
      const [
        goalsSnap,
        typesSnap,
        periodsSnap,
        branchesSnap,
      ] = await Promise.all([
        getDocs(collection(db, "goals")),
        getDocs(query(collection(db, "goaltypes"), firestoreOrderBy("order"))),
        getDocs(collection(db, "periodgroups")),
        getDocs(collection(db, "branches")),
      ]);

      const goals = goalsSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Goal);
      const goalTypes = typesSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as GoalType);
      const fetchedPeriodGroups = periodsSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as PeriodGroup);
      const branches = branchesSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Branch);
      
      setAllData({ goals, goalTypes, branches });
      
      const statusOrder = { "Ativo": 1, "Agendado": 2, "Encerrado": 3, "Vazio": 4 };
      fetchedPeriodGroups.sort((a, b) => {
        const statusA = getGroupStatus(a).text;
        const statusB = getGroupStatus(b).text;
        const orderA = statusOrder[statusA as keyof typeof statusOrder] || 99;
        const orderB = statusOrder[statusB as keyof typeof statusOrder] || 99;
        if (orderA !== orderB) return orderA - orderB;
        const aLatest = a.periods?.length > 0 ? Math.max(...a.periods.map(p => new Date(p.startDate || 0).getTime())) : 0;
        const bLatest = b.periods?.length > 0 ? Math.max(...b.periods.map(p => new Date(p.startDate || 0).getTime())) : 0;
        return bLatest - aLatest;
      });
      setPeriodGroups(fetchedPeriodGroups);

      if (!selectedPeriodGroupId) {
          const firstActiveGroup = fetchedPeriodGroups.find(g => getGroupStatus(g).text === "Ativo");
          if (firstActiveGroup) {
            setSelectedPeriodGroupId(firstActiveGroup.id);
          } else if (fetchedPeriodGroups.length > 0) {
            setSelectedPeriodGroupId(fetchedPeriodGroups[0].id);
          }
      }

    } catch (error) {
      console.error(error);
      toast({
        title: "Erro ao buscar dados",
        description: "Não foi possível carregar os dados para o relatório.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast, selectedPeriodGroupId]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  React.useEffect(() => {
    if (!loading) {
      processData();
    }
  }, [selectedPeriodGroupId, loading, processData]);

  // ─── Design helpers ───
  const getAchievementColor = (pct: number) => {
    if (pct >= 100) return 'text-emerald-500';
    if (pct >= 75)  return 'text-blue-500';
    if (pct >= 50)  return 'text-amber-500';
    return 'text-rose-500';
  };

  const getProgressColor = (pct: number) => {
    if (pct >= 100) return '[&>div]:bg-emerald-500';
    if (pct >= 75)  return '[&>div]:bg-blue-500';
    if (pct >= 50)  return '[&>div]:bg-amber-500';
    return '[&>div]:bg-rose-500';
  };

  const getAchievementBg = (pct: number) => {
    if (pct >= 100) return 'bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:border-emerald-800';
    if (pct >= 75)  return 'bg-blue-500/10 text-blue-600 border-blue-200 dark:border-blue-800';
    if (pct >= 50)  return 'bg-amber-500/10 text-amber-600 border-amber-200 dark:border-amber-800';
    return 'bg-rose-500/10 text-rose-600 border-rose-200 dark:border-rose-800';
  };

  const renderMetricCard = (label: string, value: string | React.ReactNode, icon: React.ReactNode, tooltip?: string, highlight?: boolean) => (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`flex flex-col gap-1 rounded-xl p-3 border cursor-help transition-colors hover:bg-muted/40 ${ highlight ? 'border-primary/30 bg-primary/5' : 'bg-muted/20' }`}>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
              {icon}
              {label}
            </span>
            <span className="text-base font-bold tracking-tight">{value}</span>
          </div>
        </TooltipTrigger>
        {tooltip && <TooltipContent side="top"><p className="max-w-xs">{tooltip}</p></TooltipContent>}
      </Tooltip>
    </TooltipProvider>
  );

  const selectedGroupName = periodGroups.find(g => g.id === selectedPeriodGroupId)?.name || 'Nenhum';
  const selectedGroupStatus = periodGroups.find(g => g.id === selectedPeriodGroupId)
    ? getGroupStatus(periodGroups.find(g => g.id === selectedPeriodGroupId)!)
    : null;

  return (
    <div className="flex flex-col gap-8">

      {/* ─── Header ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Relatório de Filiais
          </h1>
          <p className="text-muted-foreground mt-1">
            Acompanhe o desempenho de cada filial no grupo
            {selectedGroupName !== 'Nenhum' && (
              <span className="font-semibold text-foreground ml-1">{selectedGroupName}</span>
            )}
            {selectedGroupStatus && (
              <Badge variant={selectedGroupStatus.variant} className="ml-2 align-middle">{selectedGroupStatus.text}</Badge>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedPeriodGroupId || ''} onValueChange={(value) => setSelectedPeriodGroupId(value)}>
            <SelectTrigger className="w-[280px]">
              <SelectValue placeholder="Selecione um Grupo" />
            </SelectTrigger>
            <SelectContent>
              {periodGroups.map(group => {
                const status = getGroupStatus(group);
                return (
                  <SelectItem key={group.id} value={group.id}>
                    <div className="flex items-center justify-between w-full">
                      <span>{group.name}</span>
                      <Badge variant={status.variant} className="ml-4">{status.text}</Badge>
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => fetchData()} disabled={loading}>
            <RefreshCw className={loading ? "animate-spin h-4 w-4" : "h-4 w-4"} />
          </Button>
        </div>
      </div>

      {/* ─── Content ─── */}
      {loading ? (
        <div className="flex flex-col justify-center items-center h-96 gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-muted-foreground text-sm">Carregando dados do relatório...</p>
        </div>
      ) : reportData.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-80 rounded-2xl border border-dashed gap-4">
          <div className="rounded-full bg-muted p-5">
            <Frown className="h-10 w-10 text-muted-foreground" />
          </div>
          <div className="text-center">
            <h2 className="text-xl font-semibold">Nenhum dado encontrado</h2>
            <p className="mt-1 text-sm text-muted-foreground">Não há metas para filiais no grupo '{selectedGroupName}'.</p>
          </div>
        </div>
      ) : (
        <Accordion type="multiple" className="space-y-5" defaultValue={reportData.map(r => r.branch.id)}>
          {reportData.map(({ branch, goals, goalTypeTotals }) => {
            const goalsByPeriod = goals.reduce((acc, goal) => {
              const periodName = goal.period.name;
              if (!acc[periodName]) acc[periodName] = [];
              acc[periodName].push(goal);
              return acc;
            }, {} as Record<string, ProcessedGoal[]>);

            const overallAchievement = goalTypeTotals.length > 0
              ? goalTypeTotals.reduce((sum, t) => sum + t.totalAchievement, 0) / goalTypeTotals.length
              : 0;

            return (
              <AccordionItem value={branch.id} key={branch.id} className="border-0">
                <Card className="overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300">

                  {/* Thin top gradient accent bar */}
                  <div className={`h-1 w-full ${
                    overallAchievement >= 100 ? 'bg-gradient-to-r from-emerald-400 to-emerald-600' :
                    overallAchievement >= 75  ? 'bg-gradient-to-r from-blue-400 to-blue-600' :
                    overallAchievement >= 50  ? 'bg-gradient-to-r from-amber-400 to-amber-600' :
                    'bg-gradient-to-r from-rose-400 to-rose-600'
                  }`} />

                  <AccordionTrigger className="px-6 py-5 hover:no-underline [&>svg]:shrink-0">
                    <div className="flex items-center justify-between w-full gap-4">
                      {/* Left: icon + name */}
                      <div className="flex items-center gap-4">
                        <div className={`p-0.5 rounded-xl ${
                          overallAchievement >= 100 ? 'bg-gradient-to-br from-emerald-400 to-emerald-600' :
                          overallAchievement >= 75  ? 'bg-gradient-to-br from-blue-400 to-blue-600' :
                          overallAchievement >= 50  ? 'bg-gradient-to-br from-amber-400 to-amber-600' :
                          'bg-gradient-to-br from-rose-400 to-rose-600'
                        }`}>
                          <div className="flex h-12 w-12 items-center justify-center rounded-[10px] bg-background">
                            <GitFork className="h-6 w-6" style={{
                              color: overallAchievement >= 100 ? '#10b981' :
                                     overallAchievement >= 75  ? '#3b82f6' :
                                     overallAchievement >= 50  ? '#f59e0b' : '#f43f5e'
                            }} />
                          </div>
                        </div>
                        <div className="text-left">
                          <p className="font-bold text-base leading-tight">{branch.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {goals.length} meta{goals.length !== 1 ? 's' : ''} • {Object.keys(goalsByPeriod).length} período{Object.keys(goalsByPeriod).length !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>

                      {/* Right: achievement badge */}
                      <div className="mr-2">
                        <div className={`text-sm font-bold px-3 py-1.5 rounded-full border ${getAchievementBg(overallAchievement)}`}>
                          {formatPercentage(overallAchievement)}
                        </div>
                      </div>
                    </div>
                  </AccordionTrigger>

                  <AccordionContent className="px-6 pb-6">
                    {/* ─── Period Sections ─── */}
                    <div className="space-y-6">
                      {Object.entries(goalsByPeriod).map(([periodName, periodGoals]) => (
                        <div key={periodName}>
                          {/* Period label */}
                          <div className="flex items-center gap-3 mb-4">
                            <div className="h-px flex-1 bg-border" />
                            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground px-2">{periodName}</span>
                            <div className="h-px flex-1 bg-border" />
                          </div>

                          {/* Goals grid */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {periodGoals.map(({ goal, goalType, metrics }) => {
                              const isFreight = goalType.name.toLowerCase().includes('frete');
                              const isMercantil = goalType.name.toLowerCase().includes('mercantil');
                              const isCurrency = goalType.valueType === 'currency';
                              const formatFunction = isCurrency ? formatCurrency : formatPercentage;
                              const pct = metrics.achievement;

                              return (
                                <div key={goal.id} className="rounded-2xl border bg-card p-5 space-y-4 hover:shadow-sm transition-shadow">
                                  {/* Goal header */}
                                  <div className="flex items-start justify-between gap-2">
                                    <div>
                                      <h4 className="font-bold text-sm text-primary">{goalType.name}</h4>
                                      <p className="text-xs text-muted-foreground mt-0.5">{goal.name}</p>
                                    </div>
                                    <div className={`text-xs font-bold px-2.5 py-1 rounded-full border shrink-0 ${getAchievementBg(pct)}`}>
                                      {formatPercentage(pct)}
                                    </div>
                                  </div>

                                  {/* Progress bars */}
                                  {goal.hasLevels && goal.levelTargets ? (
                                    <div className="space-y-2.5">
                                      {orderedLevels.map(level => {
                                        const levelTarget = goal.levelTargets?.[level];
                                        if (!levelTarget || levelTarget <= 0) return null;
                                        const lvlPct = metrics.levelAchievements[level] ?? 0;
                                        return (
                                          <div key={level}>
                                            <div className="flex items-center justify-between mb-1">
                                              <div className="flex items-center gap-1.5 text-xs font-medium">
                                                {levelIcons[level]}
                                                <span>{level}</span>
                                              </div>
                                              <span className="text-xs font-mono text-muted-foreground">
                                                <span className={`font-bold ${getAchievementColor(lvlPct)}`}>{formatFunction(goal.realizado ?? 0)}</span>
                                                {' '}/ {formatFunction(levelTarget)}
                                              </span>
                                            </div>
                                            <Progress value={lvlPct} className={`h-2 ${getProgressColor(lvlPct)}`} />
                                          </div>
                                        );
                                      })}
                                    </div>
                                  ) : (
                                    <div>
                                      <div className="flex justify-between text-xs mb-1">
                                        <span className="text-muted-foreground">Realizado / Meta</span>
                                        <span className="font-mono">
                                          <span className={`font-bold ${getAchievementColor(pct)}`}>{formatCurrency(goal.realizado ?? 0)}</span>
                                          {' '}/ {formatCurrency(goal.targetValue)}
                                        </span>
                                      </div>
                                      <Progress value={pct} className={`h-2 ${getProgressColor(pct)}`} />
                                    </div>
                                  )}

                                  {/* Metric chips */}
                                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    {renderMetricCard(
                                      "Meta Diária",
                                      isFreight ? formatCurrency(metrics.dailyGoal) : formatFunction(metrics.dailyGoal),
                                      <Target className="h-3.5 w-3.5" />,
                                      "Valor que precisa ser vendido por dia útil para atingir a meta."
                                    )}
                                    {renderMetricCard(
                                      "Projeção",
                                      isFreight ? formatCurrency(metrics.projection) : formatFunction(metrics.projection),
                                      metrics.projection >= (goal.targetValue ?? 0)
                                        ? <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                                        : <TrendingDown className="h-3.5 w-3.5 text-rose-500" />,
                                      "Estimativa de resultado no final do período com base no desempenho atual."
                                    )}
                                    {renderMetricCard(
                                      "Dias",
                                      <span>{metrics.daysPassed}<span className="text-muted-foreground font-normal">/{metrics.daysTotal}</span></span>,
                                      <Calendar className="h-3.5 w-3.5" />,
                                      "Dias úteis decorridos / Total de dias úteis no período."
                                    )}
                                    {isMercantil && metrics.totalLevelTarget > 0 ? (
                                      <>
                                        {renderMetricCard(
                                          "Meta Diamante",
                                          formatCurrency(metrics.totalLevelTarget),
                                          <Gem className="h-3.5 w-3.5 text-sky-400" />,
                                          "Valor da meta Diamante."
                                        )}
                                        {metrics.nextLevel ? renderMetricCard(
                                          `Próx. (${metrics.nextLevel.name})`,
                                          formatCurrency(metrics.remainingForNextLevel),
                                          levelIcons[metrics.nextLevel.name],
                                          `Faltam ${formatCurrency(metrics.remainingForNextLevel)} para ${metrics.nextLevel.name}`
                                        ) : renderMetricCard("Nível máx. atingido!", <span className="text-emerald-500">✓</span>, <Gem className="h-3.5 w-3.5 text-sky-400" />, "Todos os níveis foram atingidos!", true)}
                                        {renderMetricCard(
                                          "Falta Diamante",
                                          formatCurrency(Math.max(0, metrics.totalLevelTarget - (goal.realizado ?? 0))),
                                          <BarChart2 className="h-3.5 w-3.5" />,
                                          "Valor restante para atingir a meta Diamante."
                                        )}
                                      </>
                                    ) : goal.hasLevels ? (
                                      metrics.nextLevel ? renderMetricCard(
                                        `Próx. (${metrics.nextLevel.name})`,
                                        formatFunction(metrics.remainingForNextLevel),
                                        <BarChart2 className="h-3.5 w-3.5" />,
                                        `Faltam ${formatFunction(metrics.remainingForNextLevel)} para ${metrics.nextLevel.name}`
                                      ) : renderMetricCard("Nível máx. atingido!", <span className="text-emerald-500">✓</span>, <Gem className="h-3.5 w-3.5 text-sky-400" />, "Todos os níveis foram atingidos!", true)
                                    ) : renderMetricCard(
                                      "Falta para a Meta",
                                      isFreight ? formatCurrency(metrics.remainingForTotal) : formatFunction(metrics.remainingForTotal),
                                      <BarChart2 className="h-3.5 w-3.5" />,
                                      `Falta para atingir a meta total de ${isFreight ? formatCurrency(goal.targetValue) : formatFunction(goal.targetValue)}`
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* ─── Summary Totals ─── */}
                    <Accordion type="single" collapsible className="w-full mt-6">
                      <AccordionItem value="summary" className="border rounded-2xl overflow-hidden">
                        <AccordionTrigger className="px-5 py-4 hover:no-underline bg-muted/30">
                          <div className="flex items-center gap-2">
                            <BarChart2 className="h-5 w-5 text-primary" />
                            <h3 className="text-base font-semibold">Resumo Total do Grupo</h3>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="px-5 pb-5 pt-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {goalTypeTotals.map(total => (
                              <div key={total.goalType.id} className="rounded-xl border bg-card p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                  <h4 className="font-semibold text-sm">{total.goalType.name}</h4>
                                  <div className={`text-xs font-bold px-2 py-0.5 rounded-full border ${getAchievementBg(total.totalAchievement)}`}>
                                    {formatPercentage(total.totalAchievement)}
                                  </div>
                                </div>
                                <div>
                                  <div className="flex justify-between text-xs mb-1.5">
                                    <span className="text-muted-foreground">Realizado / Meta</span>
                                    <span className="font-mono">
                                      <span className={`font-bold ${getAchievementColor(total.totalAchievement)}`}>{formatCurrency(total.totalRealizado)}</span>
                                      {' '}/ {formatCurrency(total.totalMeta)}
                                    </span>
                                  </div>
                                  <Progress value={total.totalAchievement} className={`h-2 ${getProgressColor(total.totalAchievement)}`} />
                                </div>
                                <div className="grid grid-cols-2 gap-2 pt-1">
                                  {renderMetricCard(
                                    "Atingimento Total",
                                    formatPercentage(total.totalAchievement),
                                    <Award className="h-3.5 w-3.5" />
                                  )}
                                  {renderMetricCard(
                                    "Projeção Total",
                                    formatCurrency(total.totalProjection),
                                    total.totalProjection >= total.totalMeta
                                      ? <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                                      : <TrendingDown className="h-3.5 w-3.5 text-rose-500" />,
                                    "Estimativa de resultado total no final do grupo."
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>

                  </AccordionContent>
                </Card>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}
    </div>
  );
}