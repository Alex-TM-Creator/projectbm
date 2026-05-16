
"use client";

import * as React from "react";
import {
  Loader2,
  TrendingUp,
  Target,
  Frown,
  RefreshCw,
  Medal,
  Trophy,
  Award,
  Gem,
  DollarSign,
  Info,
  Calendar,
  BarChart2,
  TrendingDown,
  ArrowRight,
} from "lucide-react";
import {
  collection,
  getDocs,
  query,
  orderBy as firestoreOrderBy,
  doc,
  getDoc,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useAuthState } from "react-firebase-hooks/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  User,
  Role,
  Period,
  AwardType,
  AwardLevel,
  GoalLevelTargets,
} from "@/lib/definitions";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { getGroupStatus } from "@/lib/period-helpers";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

type PeriodResult = {
  periodId: string;
  periodName: string;
  periodInfo: Period;
  goalResults: GoalResult[];
  totalAward: number;
  totalBonus: number;
};

type GoalResult = {
  goal: Goal;
  goalType?: GoalType;
  awardTypes: AwardType[];
  achievement: number;
  awardValue: number;
  bonusValue: number;
  appliedRule: string;
};

type GroupBonus = {
    award: AwardType;
    isAchieved: boolean;
    achievedCount: number;
    value: number;
}

const levelIcons: Record<keyof GoalLevelTargets, React.ReactNode> = {
    Bronze: <Medal className="h-4 w-4 text-orange-600" />,
    Prata: <Trophy className="h-4 w-4 text-slate-500" />,
    Ouro: <Award className="h-4 w-4 text-yellow-500" />,
    Diamante: <Gem className="h-4 w-4 text-sky-400" />,
};

const orderedLevels: Array<keyof GoalLevelTargets> = ['Bronze', 'Prata', 'Ouro', 'Diamante'];

export default function MyAwardsPage() {
  const { toast } = useToast();
  const [user, authLoading] = useAuthState(auth);
  // Main data
  const [goals, setGoals] = React.useState<Goal[]>([]);
  const [awardTypes, setAwardTypes] = React.useState<AwardType[]>([]);

  // Related data
  const [goalTypes, setGoalTypes] = React.useState<GoalType[]>([]);
  const [periodGroups, setPeriodGroups] = React.useState<PeriodGroup[]>([]);
  const [roles, setRoles] = React.useState<Role[]>([]);
  const [currentUserData, setCurrentUserData] = React.useState<User | null>(null);

  // UI State
  const [loading, setLoading] = React.useState(true);
  const [selectedPeriodGroupId, setSelectedPeriodGroupId] = React.useState<string | null>(null);

  const formatCurrency = (value: number | undefined) => {
    if (value === undefined || isNaN(value)) return "R$ 0,00";
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  };
  
  const formatPercentage = (value: number | undefined) => {
      if(value === undefined || isNaN(value)) return "0,00%";
      return `${value.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}%`;
  }

  const getAchievementColor = (pct: number) => {
    if (pct >= 100) return 'text-emerald-500';
    if (pct >= 75) return 'text-blue-500';
    if (pct >= 50) return 'text-amber-500';
    return 'text-rose-500';
  };

  const getProgressColor = (pct: number) => {
    if (pct >= 100) return '[&>div]:bg-emerald-500';
    if (pct >= 75) return '[&>div]:bg-blue-500';
    if (pct >= 50) return '[&>div]:bg-amber-500';
    return '[&>div]:bg-rose-500';
  };

  const getAchievementBg = (pct: number) => {
    if (pct >= 100) return 'bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:border-emerald-800';
    if (pct >= 75) return 'bg-blue-500/10 text-blue-600 border-blue-200 dark:border-blue-800';
    if (pct >= 50) return 'bg-amber-500/10 text-amber-600 border-amber-200 dark:border-amber-800';
    return 'bg-rose-500/10 text-rose-600 border-rose-200 dark:border-rose-800';
  };

  const fetchData = React.useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const [
        goalsSnap,
        awardTypesSnap,
        typesSnap,
        periodsSnap,
        rolesSnap,
        userSnap
      ] = await Promise.all([
        getDocs(collection(db, "goals")),
        getDocs(collection(db, "awardtypes")),
        getDocs(query(collection(db, "goaltypes"), firestoreOrderBy("order"))),
        getDocs(collection(db, "periodgroups")),
        getDocs(collection(db, "roles")),
        getDoc(doc(db, 'users', user.uid)),
      ]);

      const allGoals = goalsSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Goal);
      const allPeriodGroups = periodsSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as PeriodGroup);
      const currentUser = userSnap.exists() ? userSnap.data() as User : null;

      setGoals(allGoals);
      setAwardTypes(awardTypesSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as AwardType));
      setGoalTypes(typesSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as GoalType));
      setRoles(rolesSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Role));
      setCurrentUserData(currentUser);

      let relevantPeriodGroups = allPeriodGroups;
      // Filter period groups for non-admin users
      if (currentUser && !currentUser.isAdmin) {
          const userGoals = allGoals.filter(g => g.userId === currentUser.id || (g.roleId === currentUser.roleId && !g.userId));
          const userGroupIds = new Set(userGoals.map(g => g.periodGroupId));
          relevantPeriodGroups = allPeriodGroups.filter(g => userGroupIds.has(g.id));
      }
      
      const statusOrder = { "Ativo": 1, "Agendado": 2, "Encerrado": 3, "Vazio": 4 };
      relevantPeriodGroups.sort((a, b) => {
        const statusA = getGroupStatus(a).text;
        const statusB = getGroupStatus(b).text;
        const orderA = statusOrder[statusA as keyof typeof statusOrder] || 99;
        const orderB = statusOrder[statusB as keyof typeof statusOrder] || 99;
        if (orderA !== orderB) {
            return orderA - orderB;
        }
        // Search for the latest period start date in this group to sort by recency
        const aLatest = a.periods?.length > 0 ? Math.max(...a.periods.map(p => new Date(p.startDate || 0).getTime())) : 0;
        const bLatest = b.periods?.length > 0 ? Math.max(...b.periods.map(p => new Date(p.startDate || 0).getTime())) : 0;
        return bLatest - aLatest;
      });
      setPeriodGroups(relevantPeriodGroups);

      // Smart default selection for period group
      if (!selectedPeriodGroupId && relevantPeriodGroups.length > 0) {
          const firstActiveGroup = relevantPeriodGroups.find(g => getGroupStatus(g).text === "Ativo");
          if (firstActiveGroup) {
              setSelectedPeriodGroupId(firstActiveGroup.id);
          } else {
              setSelectedPeriodGroupId(relevantPeriodGroups[0].id);
          }
      }


    } catch (error) {
      console.error(error);
      toast({
        title: "Erro ao buscar dados",
        description: "Não foi possível carregar os dados para suas premiações.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast, user, selectedPeriodGroupId]);

  React.useEffect(() => {
    if(!authLoading){
        fetchData();
    }
  }, [fetchData, authLoading]);

  const getPeriodInfo = (periodId: string): { groupName: string; periodName: string; period: Period | undefined } => {
    for (const group of periodGroups) {
      const period = group.periods.find((p) => p.id === periodId);
      if (period) return { groupName: group.name, periodName: period.name, period };
    }
    return { groupName: "N/A", periodName: "N/A", period: undefined };
  };

  const getApplicableAwardTypes = React.useCallback((goal: Goal) => {
    if (!currentUserData) return [];
    return awardTypes.filter(at => {
      const isTypeMatch = !at.goalTypeIds || at.goalTypeIds.length === 0 || at.goalTypeIds?.includes(goal.goalTypeId);
      if (!isTypeMatch) return false;
      const isGlobal = !at.roleId && !at.branchId;
      return isGlobal || at.roleId === currentUserData.roleId;
    });
  }, [awardTypes, currentUserData]);

  const calculatedResults = React.useMemo((): {periodResults: PeriodResult[], groupBonuses: GroupBonus[]} | null => {
      if (!currentUserData || !selectedPeriodGroupId || loading) return null;

      const userGoals = goals.filter(g => 
        (g.userId === currentUserData.id || (!g.userId && g.roleId === currentUserData.roleId)) &&
        g.periodGroupId === selectedPeriodGroupId
      );

      if (userGoals.length === 0) {
        return { periodResults: [], groupBonuses: [] };
      }

      const resultsByPeriod: { [periodId: string]: PeriodResult } = {};
      const allGoalResults: (GoalResult & { achievedLevelName?: string })[] = [];

      const isMercantilType = (gt: GoalType) => gt.name.toLowerCase().includes('mercantil');
      const isFreteType = (gt: GoalType) => gt.name.toLowerCase().includes('frete');

      userGoals.forEach(goal => {
          const realizado = goal.realizado ?? 0;
          const goalType = goalTypes.find(gt => gt.id === goal.goalTypeId);
          if (!goalType) return;

          const applicableAwardTypes = getApplicableAwardTypes(goal);
          if (applicableAwardTypes.length === 0) return;

          let target = goal.targetValue ?? 0;
          let achievement = 0;
          const modifiedGoal = { ...goal };
          
          if (isMercantilType(goalType) && goal.hasLevels && goal.levelTargets) {
              target = goal.levelTargets.Diamante ?? 0;
              modifiedGoal.targetValue = target; 
          } else if (isFreteType(goalType)) {
              const mercantilGoal = userGoals.find(g => {
                const gt = goalTypes.find(t => t.id === g.goalTypeId);
                return g.periodId === goal.periodId && gt && isMercantilType(gt);
              });
              if (mercantilGoal) {
                const mercantilRealizado = mercantilGoal.realizado ?? 0;
                const freightTargetPercentage = goal.targetValue ?? 0;
                target = (mercantilRealizado * freightTargetPercentage) / 100;
                modifiedGoal.targetValue = target; 
              } else {
                target = 0; 
              }
          }
          
          achievement = target > 0 ? (realizado / target) * 100 : (realizado > 0 ? 100 : 0);

          let finalAwardValue = 0;
          let finalBonusValue = 0;
          let finalAppliedRule = "Nenhuma regra aplicável";
          let achievedLevelName: AwardLevel['name'] | undefined = undefined;

          for (const award of applicableAwardTypes) {
              let currentAward = 0;
              let appliedRule = "N/A";
              let ruleValueDisplay = "";

              switch (award.type) {
                  case 'fixedBonusByLevel':
                  case 'percentageByLevel': {
                      if (!goal.hasLevels || !goal.levelTargets || realizado <= 0) break;
                      let achievedLevel: AwardLevel | null = null;
                      
                      for (const levelName of orderedLevels) {
                           if (realizado >= (goal.levelTargets?.[levelName] ?? Infinity)) {
                              const foundLevel = award.levels.find(l => l.name === levelName) ?? null;
                               if (foundLevel && foundLevel.value > 0) { 
                                  achievedLevel = foundLevel;
                              }
                          }
                      }
                      
                      if(achievedLevel) {
                          if (award.type === 'fixedBonusByLevel') {
                              currentAward = achievedLevel.value;
                              ruleValueDisplay = formatCurrency(currentAward);
                          } else {
                              currentAward = (realizado * achievedLevel.value) / 100;
                              ruleValueDisplay = formatPercentage(achievedLevel.value);
                          }
                          appliedRule = `Nível ${achievedLevel.name} (${ruleValueDisplay})`;
                          achievedLevelName = achievedLevel.name;
                      }
                      break;
                  }
                  case 'salesRangeBonus':
                  case 'fixedBonusBySalesRange': {
                      const range = award.ranges.find(r => realizado >= r.from && realizado <= r.to);
                      if (range) {
                          if (award.type === 'fixedBonusBySalesRange') {
                              currentAward = range.value;
                              ruleValueDisplay = formatCurrency(currentAward);
                          } else {
                              currentAward = (realizado * range.value) / 100;
                              ruleValueDisplay = formatPercentage(range.value);
                          }
                          appliedRule = `Faixa (${ruleValueDisplay})`;
                      }
                      break;
                  }
                   case 'freightConversionBonus': {
                      if (achievement >= 100 && realizado > 0) {
                         if(award.freightCommissionType === 'currency') {
                             currentAward = award.commissionPercentage ?? 0;
                             ruleValueDisplay = formatCurrency(currentAward);
                         } else {
                             currentAward = (realizado * (award.commissionPercentage ?? 0)) / 100;
                             ruleValueDisplay = formatPercentage(award.commissionPercentage);
                         }
                         appliedRule = `Meta Atingida (${ruleValueDisplay})`;
                      } else {
                        appliedRule = "Meta Não Atingida";
                      }
                      break;
                   }
              }
              
              if(currentAward > 0) {
                 if (award.category === 'bonus') {
                    finalBonusValue += currentAward;
                 } else {
                    finalAwardValue += currentAward;
                 }
                 finalAppliedRule = appliedRule;
              } else if (appliedRule !== 'N/A' && finalAppliedRule === 'Nenhuma regra aplicável') {
                 finalAppliedRule = appliedRule;
              }
          }
          
          const { periodName, period } = getPeriodInfo(goal.periodId);
          if(!period) return;
          
          if(!resultsByPeriod[goal.periodId]) {
              resultsByPeriod[goal.periodId] = {
                  periodId: goal.periodId, periodName, periodInfo: period,
                  goalResults: [], totalAward: 0, totalBonus: 0
              }
          }

          const goalResult: GoalResult & { achievedLevelName?: string } = {
              goal: modifiedGoal, goalType, awardTypes: applicableAwardTypes, achievement, awardValue: finalAwardValue,
              bonusValue: finalBonusValue, appliedRule: finalAppliedRule, achievedLevelName
          };

          resultsByPeriod[goal.periodId].goalResults.push(goalResult);
          allGoalResults.push(goalResult);
      });
      
      const groupBonuses: GroupBonus[] = [];
      const cumulativeAwards = awardTypes.filter(at => at.type === 'bonusByCumulativeLevel' && at.cumulativeLevelTarget);
      cumulativeAwards.forEach(award => {
          if (!award.cumulativeLevelTarget) return;
          const achievedCount = allGoalResults.filter(gr => gr.achievedLevelName === award.cumulativeLevelTarget).length;
          const isAchieved = achievedCount >= (award.cumulativeOccurrences ?? 1);
          groupBonuses.push({ award, isAchieved, achievedCount, value: isAchieved ? (award.cumulativeBonusValue ?? 0) : 0 });
      });

      Object.values(resultsByPeriod).forEach(periodResult => {
          periodResult.totalAward = periodResult.goalResults.reduce((acc, res) => acc + res.awardValue, 0);
          periodResult.totalBonus = periodResult.goalResults.reduce((acc, res) => acc + res.bonusValue, 0);
          periodResult.goalResults.sort((a,b) => (a.goalType?.order ?? 99) - (b.goalType?.order ?? 99));
      });
      
      const periodResults = Object.values(resultsByPeriod).sort((a,b) => a.periodName.localeCompare(b.periodName, undefined, { numeric: true }));

      return { periodResults, groupBonuses };

  }, [loading, currentUserData, goals, awardTypes, goalTypes, periodGroups, selectedPeriodGroupId, getApplicableAwardTypes]);

  const renderMetricCard = (label: string, value: string | React.ReactNode, icon: React.ReactNode, tooltip?: string, highlight?: boolean) => (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`flex flex-col gap-1 rounded-xl p-3 border cursor-help transition-colors hover:bg-muted/40 ${highlight ? 'border-emerald-500/30 bg-emerald-500/5' : 'bg-muted/20'}`}>
            <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
              {icon}
              {label}
            </span>
            <span className={`text-sm font-bold tracking-tight ${highlight ? 'text-emerald-600' : 'text-foreground'}`}>{value}</span>
          </div>
        </TooltipTrigger>
        {tooltip && <TooltipContent side="top"><p className="max-w-xs">{tooltip}</p></TooltipContent>}
      </Tooltip>
    </TooltipProvider>
  );

  if (loading || authLoading) {
    return (
      <div className="flex flex-col justify-center items-center h-96 gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-muted-foreground text-sm font-medium">Calculando suas premiações...</p>
      </div>
    );
  }

  const totalGains = (calculatedResults?.periodResults.reduce((acc, r) => acc + r.totalAward + r.totalBonus, 0) ?? 0) + 
                     (calculatedResults?.groupBonuses.reduce((acc, gb) => acc + gb.value, 0) ?? 0);
  
  return (
    <div className="flex flex-col gap-8 pb-10">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Minhas Premiações
          </h1>
          <p className="text-muted-foreground mt-1 text-base">
            Acompanhe suas conquistas, bônus e evolução de ganhos por período.
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Select value={selectedPeriodGroupId || ''} onValueChange={(value) => setSelectedPeriodGroupId(value)}>
            <SelectTrigger className="w-full sm:w-[280px] h-11">
              <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Selecione um Grupo" />
            </SelectTrigger>
            <SelectContent>
              {periodGroups.map(group => {
                const status = getGroupStatus(group);
                return (
                  <SelectItem key={group.id} value={group.id}>
                    <div className="flex items-center justify-between w-full">
                      <span className="truncate">{group.name}</span>
                      <Badge variant={status.variant} className="ml-4 text-[10px]">{status.text}</Badge>
                    </div>
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={fetchData} disabled={loading} className="h-11 w-11 shrink-0 shadow-sm border-dashed hover:border-primary/50">
            <RefreshCw className={loading ? "animate-spin h-4 w-4 text-primary" : "h-4 w-4"} />
          </Button>
        </div>
      </div>
      
      {!calculatedResults || (calculatedResults.periodResults.length === 0 && calculatedResults.groupBonuses.length === 0) ? (
          <div className="flex flex-col items-center justify-center py-24 rounded-3xl border-2 border-dashed bg-muted/10 gap-5 text-center px-6">
            <div className="rounded-full bg-muted p-6">
                <Frown className="h-12 w-12 text-muted-foreground" />
            </div>
            <div className="max-w-md">
                <h2 className="text-2xl font-bold">Resumo não disponível</h2>
                <p className="mt-2 text-muted-foreground">Não encontramos premiações ou metas vinculadas ao seu perfil no grupo de período selecionado.</p>
            </div>
            <Button variant="outline" className="mt-4 font-semibold" onClick={fetchData}>
                Tentar Recarregar
            </Button>
          </div>
      ) : (
        <>
            {/* Main Total Highlight */}
            <Card className="relative overflow-hidden border-none shadow-xl bg-gradient-to-br from-primary/10 via-background to-primary/5 rounded-3xl">
                <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                    <Trophy className="h-40 w-40 text-primary" />
                </div>
                <CardHeader className="text-left pt-6 sm:pt-10 px-5 sm:px-8">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="bg-primary/20 p-1.5 sm:p-2 rounded-lg">
                            <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                        </div>
                        <CardDescription className="text-[10px] sm:text-sm font-bold uppercase tracking-widest">Saldo Total do Grupo</CardDescription>
                    </div>
                    <div className="flex flex-col gap-1">
                        <span className="text-4xl xs:text-5xl sm:text-6xl lg:text-7xl font-black text-primary tracking-tighter transition-all">
                            {formatCurrency(totalGains)}
                        </span>
                        <div className="flex items-center gap-2 text-muted-foreground font-medium text-xs sm:text-base">
                            <Badge variant="outline" className="bg-background/80 backdrop-blur-sm px-2 sm:px-3 py-0.5 sm:py-1 text-[10px] sm:text-sm rounded-full">
                                {calculatedResults.periodResults.length} Período(s)
                            </Badge>
                            <span className="truncate">de metas contabilizadas</span>
                        </div>
                    </div>
                </CardHeader>
                <div className="h-1.5 w-full bg-primary/20">
                    <div className="h-full bg-primary w-full animate-in slide-in-from-left duration-1000" />
                </div>
            </Card>

            <div className="grid grid-cols-1 gap-8">
                {/* Period Detailed Sections */}
                {calculatedResults.periodResults.map(periodResult => (
                    <div key={periodResult.periodId} className="space-y-4">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-2 gap-3">
                            <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20 shrink-0">
                                    <Calendar className="h-5 w-5 text-primary" />
                                </div>
                                <div>
                                    <h3 className="text-base sm:text-lg font-bold tracking-tight">{periodResult.periodName}</h3>
                                    <span className="text-[10px] sm:text-xs text-muted-foreground font-medium uppercase tracking-widest">{periodResult.goalResults.length} metas no período</span>
                                </div>
                            </div>
                            <div className="w-full sm:w-auto flex items-center justify-between sm:justify-end gap-2 px-4 py-2 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
                                <span className="text-[10px] sm:text-xs font-bold text-emerald-600 uppercase tracking-tighter">Ganhos do Período</span>
                                <span className="text-base sm:text-lg font-black text-emerald-600">{formatCurrency(periodResult.totalAward + periodResult.totalBonus)}</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {periodResult.goalResults.map(res => {
                                const pct = res.achievement;
                                return (
                                    <Card key={res.goal.id} className="group relative overflow-hidden border-none shadow-md hover:shadow-lg transition-all duration-300 rounded-2xl bg-card/60 backdrop-blur-sm">
                                        {/* Accent top bar */}
                                        <div className={`h-1.5 w-full ${getProgressColor(pct)} opacity-80`} />
                                        
                                        <CardHeader className="pb-3 px-5 sm:px-6 pt-5 sm:pt-6">
                                            <div className="flex justify-between items-start gap-4">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <BarChart2 className="h-3.5 w-3.5 text-muted-foreground" />
                                                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground truncate max-w-[120px] sm:max-w-[150px]">{res.goalType?.name}</p>
                                                    </div>
                                                    <h4 className="font-bold text-sm sm:text-base text-foreground leading-tight line-clamp-2">{res.goal.name}</h4>
                                                </div>
                                                <Badge variant="outline" className={`shrink-0 rounded-full px-2 py-0.5 sm:py-1 font-bold text-[10px] sm:text-xs ${getAchievementBg(pct)}`}>
                                                    {pct >= 100 ? <TrendingUp className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-1" /> : <TrendingDown className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-1" />}
                                                    {formatPercentage(pct)}
                                                </Badge>
                                            </div>
                                        </CardHeader>
                                        
                                        <CardContent className="px-5 sm:px-6 pb-5 sm:pb-6 space-y-4 sm:space-y-5">
                                            <div className="space-y-2">
                                                <div className="flex justify-between items-end">
                                                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Progresso da Meta</span>
                                                    <span className={`text-[10px] sm:text-xs font-mono font-bold ${getAchievementColor(pct)}`}>
                                                        {pct.toFixed(2)}%
                                                    </span>
                                                </div>
                                                <Progress value={pct} className={`h-1.5 sm:h-2 ${getProgressColor(pct)} bg-muted/50`} />
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                                                {renderMetricCard(
                                                    "Conquistado",
                                                    formatCurrency(res.awardValue + res.bonusValue),
                                                    <Medal className="h-3 w-3" />,
                                                    "Valor total de prêmios e bônus acumulados nesta meta.",
                                                    (res.awardValue + res.bonusValue) > 0
                                                )}
                                                {renderMetricCard(
                                                    "Realizado / Meta",
                                                    <div className="flex items-center gap-1 overflow-hidden">
                                                        <span className="text-[9px] sm:text-[10px] text-muted-foreground truncate">{formatCurrency(res.goal.realizado)}</span>
                                                        <ArrowRight className="h-2 w-2 text-muted-foreground shrink-0" />
                                                        <span className="truncate">{formatCurrency(res.goal.targetValue)}</span>
                                                    </div>,
                                                    <Target className="h-3 w-3" />,
                                                    "Relação entre o valor realizado e o objetivo final da meta."
                                                )}
                                            </div>

                                            {/* Rule Badge */}
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <div className="flex items-center gap-2 p-2 sm:p-2.5 rounded-xl border border-dashed hover:border-primary/50 transition-colors cursor-help group/rule">
                                                            <div className="bg-muted p-1 sm:p-1.5 rounded-lg group-hover/rule:bg-primary/10 transition-colors shrink-0">
                                                                <Info className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-muted-foreground group-hover/rule:text-primary" />
                                                            </div>
                                                            <div className="flex-1 overflow-hidden">
                                                                <p className="text-[9px] sm:text-[10px] font-bold uppercase text-muted-foreground tracking-tighter">Regra de Cálculo</p>
                                                                <p className="text-[11px] sm:text-xs font-semibold truncate">{res.appliedRule}</p>
                                                            </div>
                                                        </div>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="bottom" className="w-64 p-3 rounded-xl shadow-xl">
                                                        <p className="text-xs font-bold uppercase text-muted-foreground mb-2">Premiações Disponíveis</p>
                                                        <div className="space-y-2">
                                                            {res.awardTypes.map((award) => (
                                                                <div key={award.id} className="p-2 bg-muted/50 rounded-lg border">
                                                                    <p className="font-bold text-xs">{award.name}</p>
                                                                    <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{award.description}</p>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        </CardContent>
                                    </Card>
                                )
                            })}
                        </div>
                    </div>
                ))}

                 {/* Group Bonuses Section */}
                 {calculatedResults.groupBonuses.length > 0 && calculatedResults.groupBonuses.some(gb => gb.isAchieved && gb.value > 0) && (
                    <div className="space-y-4">
                        <div className="flex items-center gap-3 px-2">
                            <div className="h-10 w-10 rounded-full bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
                                <Award className="h-5 w-5 text-amber-500" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold tracking-tight">Bônus Adicionais</h3>
                                <span className="text-xs text-muted-foreground font-medium uppercase tracking-widest">Recompensas por metas cumulativas</span>
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {calculatedResults.groupBonuses.map(gb => gb.isAchieved && (
                                <Card key={gb.award.id} className="relative overflow-hidden border-none shadow-md bg-amber-500/5 rounded-2xl group transition-all duration-300 hover:shadow-lg">
                                    <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none group-hover:scale-125 transition-transform duration-500">
                                        <Medal className="h-20 w-20 text-amber-500" />
                                    </div>
                                    <CardHeader className="p-6">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div className="bg-amber-500/20 p-2.5 rounded-xl">
                                                <Medal className="h-5 w-5 text-amber-600" />
                                            </div>
                                            <div>
                                                <CardTitle className="text-base font-bold">{gb.award.name}</CardTitle>
                                                <CardDescription className="text-xs font-bold text-amber-600/70 uppercase">Bônus Cumulativo</CardDescription>
                                            </div>
                                        </div>
                                        <div className="space-y-4">
                                            <p className="text-sm text-foreground leading-snug font-medium">
                                                Atingido <span className="font-bold text-amber-600">{gb.achievedCount}</span> de {gb.award.cumulativeOccurrences} vezes exigidas (Nível {gb.award.cumulativeLevelTarget}).
                                            </p>
                                            <div className="flex items-center justify-between pt-2 border-t border-amber-500/20">
                                                <span className="text-xs font-bold uppercase text-muted-foreground">Valor Extra</span>
                                                <span className="text-2xl font-black text-amber-600 tracking-tighter">{formatCurrency(gb.value)}</span>
                                            </div>
                                        </div>
                                    </CardHeader>
                                </Card>
                            ))}
                        </div>
                    </div>
                 )}
            </div>
        </>
      )}
    </div>
  );
}