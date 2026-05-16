
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
  TrendingDown,
  BarChart2,
  ChevronRight,
  Zap,
  ArrowRight,
} from "lucide-react";
import {
  collection,
  getDocs,
  query,
  where,
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
import { getGroupStatus, getPeriodStatus } from "@/lib/period-helpers";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import { differenceInBusinessDays, isAfter, isBefore, parseISO } from "date-fns";


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

const levelCardConfig: Record<keyof GoalLevelTargets, { icon: React.ReactNode, color: string, bgColor: string, borderColor: string, description: string }> = {
    Bronze: { 
        icon: <Medal className="h-10 w-10 sm:h-12 sm:w-12" />, 
        color: "text-orange-600", 
        bgColor: "bg-orange-500/10",
        borderColor: "border-orange-500/20",
        description: "Você está no caminho certo! Continue assim para alcançar voos mais altos." 
    },
    Prata: { 
        icon: <Trophy className="h-10 w-10 sm:h-12 sm:w-12" />, 
        color: "text-slate-500", 
        bgColor: "bg-slate-500/10",
        borderColor: "border-slate-500/20",
        description: "Ótimo trabalho! Você superou o primeiro desafio e está avançando." 
    },
    Ouro: { 
        icon: <Award className="h-10 w-10 sm:h-12 sm:w-12" />, 
        color: "text-yellow-500", 
        bgColor: "bg-yellow-500/10",
        borderColor: "border-yellow-500/20",
        description: "Desempenho de ouro! Você está entre os melhores, parabéns pela dedicação." 
    },
    Diamante: { 
        icon: <Gem className="h-10 w-10 sm:h-12 sm:w-12" />, 
        color: "text-sky-400", 
        bgColor: "bg-sky-500/10",
        borderColor: "border-sky-500/20",
        description: "Incrível! Você alcançou o nível máximo, um verdadeiro diamante." 
    },
};

const WelcomeSection = ({ userName }: { userName: string }) => {
  const [greeting, setGreeting] = React.useState('');

  React.useEffect(() => {
    const getGreeting = () => {
      const currentHour = new Date().getHours();
      if (currentHour < 12) return "Bom dia";
      if (currentHour < 18) return "Boa tarde";
      return "Boa noite";
    };
    setGreeting(getGreeting());
  }, []);
  
  if (!greeting) return null;

  return (
    <Card className="relative overflow-hidden border-none shadow-lg bg-gradient-to-r from-primary/10 via-background to-primary/5 rounded-3xl">
      <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none hidden sm:block">
          <Zap className="h-24 w-24 text-primary" />
      </div>
      <CardHeader className="p-6 sm:p-8">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-xl rotate-3 transform transition-transform hover:rotate-0">
            <Zap className="h-7 w-7 sm:h-8 sm:w-8 fill-current" />
          </div>
          <div>
            <CardTitle className="text-2xl sm:text-3xl font-black text-primary tracking-tight">
              {greeting}, {userName.split(' ')[0]}!
            </CardTitle>
            <CardDescription className="text-sm sm:text-base font-medium text-muted-foreground/80">
                Acompanhe e supere seus limites. Seu desempenho hoje define seu prêmio amanhã.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
    </Card>
  );
};

type SellerReportData = {
    seller: User;
    goals: ProcessedGoal[];
    goalTypeTotals: GoalTypeTotals[];
    overallAchievedLevelInfo: OverallAchievedLevelInfo;
    periodLevels: PeriodLevelResult[];
}

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

type OverallAchievedLevelInfo = {
  level: keyof GoalLevelTargets;
  periodName: string;
  periodStatus: { text: string; variant: "default" | "secondary" | "outline" | "destructive" };
} | null;

type PeriodLevelResult = {
    periodId: string;
    periodName: string;
    achievedLevel: keyof GoalLevelTargets | null;
};


export default function MyPerformancePage() {
  const { toast } = useToast();
  const [user, authLoading] = useAuthState(auth);
  const [loading, setLoading] = React.useState(true);
  const [reportData, setReportData] = React.useState<SellerReportData | null>(null);
  const [periodGroups, setPeriodGroups] = React.useState<PeriodGroup[]>([]);
  const [selectedPeriodGroupId, setSelectedPeriodGroupId] = React.useState<string | null>(null);

  const [allData, setAllData] = React.useState<{
      goals: Goal[],
      goalTypes: GoalType[],
      currentUser: User | null,
      roles: Role[],
      users: User[],
  } | null>(null);

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

  const processData = React.useCallback(() => {
    if (!allData || !selectedPeriodGroupId || !user) {
        setReportData(null);
        return;
    };
    
    const { goals, goalTypes, currentUser } = allData;
    if (!currentUser) { setReportData(null); return; }
    
    const selectedGroup = periodGroups.find(p => p.id === selectedPeriodGroupId);
    if (!selectedGroup) { setReportData(null); return; }

    const targetPeriods = selectedGroup.periods;
    const targetPeriodIds = new Set(targetPeriods.map(p => p.id));

    const isFreteType = (gt: GoalType) => gt.name.toLowerCase().includes('frete');
    const isMercantilType = (gt: GoalType) => gt.name.toLowerCase().includes('mercantil');

    const sellerGoals = goals.filter(g => 
        (g.userId === currentUser.id || (!g.userId && g.roleId === currentUser.roleId)) &&
        targetPeriodIds.has(g.periodId)
    );
      
    const goalTypeTotalsMap: Map<string, Omit<GoalTypeTotals, 'totalAchievement'>> = new Map();
    const periodLevelMap = new Map<string, { highestLevelIndex: number; periodName: string, periodInfo: Period }>();

    const processedGoals: ProcessedGoal[] = sellerGoals.map(goal => {
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
        const mercantilGoal = sellerGoals.find(g => {
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

    achievement = targetValue > 0 ? (realizado / targetValue) * 100 : (realizado > 0 ? 100 : 0);
    const dailyGoal = targetValue > 0 && daysTotal > 0 ? targetValue / daysTotal : 0;
    const projection = daysPassed > 0 ? (realizado / daysPassed) * daysTotal : 0;
    const remainingForTotal = Math.max(0, targetValue - realizado);
    
    if (!goalTypeTotalsMap.has(goal.goalTypeId)) {
        goalTypeTotalsMap.set(goal.goalTypeId, {
          goalType, totalRealizado: 0, totalMeta: 0, totalLevelTargets: { Bronze: 0, Prata: 0, Ouro: 0, Diamante: 0 },
          totalProjection: 0, daysPassed: 0, daysTotal: 0, dailyGoal: 0, nextLevel: null, remainingForNextLevel: 0,
        });
    }
    
    const totals = goalTypeTotalsMap.get(goal.goalTypeId)!;
    totals.totalRealizado += realizado;
    totals.totalProjection += projection;
    
    let currentMetaForTotal = targetValue;
    if (goal.hasLevels && goal.levelTargets && isMercantilType(goalType)) {
        currentMetaForTotal = goal.levelTargets.Diamante || 0;
    }
    totals.totalMeta += currentMetaForTotal;
    
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
        if (!periodLevelMap.has(period.id)) {
            periodLevelMap.set(period.id, { highestLevelIndex: -1, periodName: period.name, periodInfo: period });
        }
        const periodLevelData = periodLevelMap.get(period.id)!;

        for (const level of orderedLevels) {
            const levelTarget = goal.levelTargets[level];
            if (levelTarget && levelTarget > 0) {
                levelAchievements[level] = (realizado / levelTarget) * 100;
                 if (realizado >= levelTarget) {
                    const currentLevelIndex = orderedLevels.indexOf(level);
                    if(currentLevelIndex > periodLevelData.highestLevelIndex) {
                        periodLevelData.highestLevelIndex = currentLevelIndex;
                    }
                }
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
        metrics: { daysTotal, daysPassed, dailyGoal, projection, achievement, levelAchievements, nextLevel, remainingForNextLevel, remainingForTotal, totalLevelTarget }
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

    let overallHighestLevelIndex = -1;
    let overallAchievedPeriodName = "";
    let overallAchievedPeriodInfo: Period | undefined;
    
    const periodLevelsResult: PeriodLevelResult[] = [];
    for(const [periodId, data] of periodLevelMap.entries()) {
        const periodStatus = getPeriodStatus(data.periodInfo);
        
        if(data.highestLevelIndex > -1) {
            periodLevelsResult.push({ periodId: periodId, periodName: data.periodName, achievedLevel: orderedLevels[data.highestLevelIndex] });
            if (periodStatus.text === 'Ativo') {
                if (data.highestLevelIndex > overallHighestLevelIndex) {
                    overallHighestLevelIndex = data.highestLevelIndex;
                    overallAchievedPeriodName = data.periodName;
                    overallAchievedPeriodInfo = data.periodInfo;
                }
            }
        }
    }
    
    periodLevelsResult.sort((a, b) => a.periodName.localeCompare(b.periodName, undefined, { numeric: true }));

    const overallAchievedLevelInfo: OverallAchievedLevelInfo = overallHighestLevelIndex > -1 && overallAchievedPeriodInfo
        ? { level: orderedLevels[overallHighestLevelIndex], periodName: overallAchievedPeriodName, periodStatus: getPeriodStatus(overallAchievedPeriodInfo) } 
        : null;

    setReportData({
        seller: currentUser,
        goals: processedGoals,
        goalTypeTotals: goalTypeTotalsArray,
        overallAchievedLevelInfo: overallAchievedLevelInfo,
        periodLevels: periodLevelsResult,
    });

  }, [allData, selectedPeriodGroupId, periodGroups, user]);

  const fetchData = React.useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const goalsRef = collection(db, "goals");
      const userDocRef = doc(db, "users", user.uid);
      
      const [ typesSnap, periodsSnap, userSnap ] = await Promise.all([
        getDocs(query(collection(db, "goaltypes"), firestoreOrderBy("order"))),
        getDocs(collection(db, "periodgroups")),
        getDoc(userDocRef),
      ]);

      const goalTypes = typesSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as GoalType);
      const allPeriodGroups = periodsSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as PeriodGroup);
      const currentUser = userSnap.exists() ? userSnap.data() as User : null;

      if (!currentUser) { toast({ title: "Usuário não encontrado", variant: "destructive" }); setLoading(false); return; }
      
      const goalsQuery = query(goalsRef, where('userId', '==', user.uid));
      const roleGoalsQuery = query(goalsRef, where('roleId', '==', currentUser.roleId), where('userId', '==', ''));
      const [goalsSnap, roleGoalsSnap] = await Promise.all([getDocs(goalsQuery), getDocs(roleGoalsQuery)]);
      const allGoals = [...goalsSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Goal), ...roleGoalsSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Goal)];

      setAllData({ goals: allGoals, goalTypes, currentUser, roles: [], users: [] });
      
      const relevantPeriodGroupIds = new Set(allGoals.map(g => g.periodGroupId));
      const relevantPeriodGroups = allPeriodGroups.filter(g => relevantPeriodGroupIds.has(g.id));
      
      const statusOrder = { "Ativo": 1, "Agendado": 2, "Encerrado": 3, "Vazio": 4 };
      relevantPeriodGroups.sort((a, b) => {
        const orderA = statusOrder[getGroupStatus(a).text as keyof typeof statusOrder] || 99;
        const orderB = statusOrder[getGroupStatus(b).text as keyof typeof statusOrder] || 99;
        if (orderA !== orderB) return orderA - orderB;
        return b.periods?.[0]?.startDate?.localeCompare(a.periods?.[0]?.startDate) || 0;
      });
      setPeriodGroups(relevantPeriodGroups);

      if (!selectedPeriodGroupId || !relevantPeriodGroupIds.has(selectedPeriodGroupId)) {
          const firstActiveGroup = relevantPeriodGroups.find(g => getGroupStatus(g).text === "Ativo");
          setSelectedPeriodGroupId(firstActiveGroup?.id || relevantPeriodGroups[0]?.id || null);
      }
    } catch (error) {
      console.error(error);
      toast({ title: "Erro ao buscar dados", description: "Não foi possível carregar os seus dados de desempenho.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast, user, selectedPeriodGroupId]);

  React.useEffect(() => { if(!authLoading && user) fetchData(); }, [fetchData, authLoading, user]);
  React.useEffect(() => { if (!loading && !authLoading && user) processData(); }, [selectedPeriodGroupId, loading, authLoading, user, processData]);

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
        {tooltip && <TooltipContent side="top" className="max-w-xs p-3 rounded-xl shadow-xl"><p className="text-xs leading-relaxed">{tooltip}</p></TooltipContent>}
      </Tooltip>
    </TooltipProvider>
  );
  
  const overallLevelInfo = reportData?.overallAchievedLevelInfo;
  const defaultOpenPeriod = React.useMemo(() => {
    if (!reportData) return [];
    const activePeriod = reportData.goals.find(g => getPeriodStatus(g.period).text === 'Ativo');
    return activePeriod ? [activePeriod.period.name] : [];
  }, [reportData]);

  if (loading || authLoading) {
    return (
      <div className="flex flex-col justify-center items-center h-96 gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-muted-foreground text-sm font-medium">Processando seu desempenho global...</p>
      </div>
    );
  }
  
  return (
    <div className="flex flex-col gap-8 pb-10">
        {/* Welcome Section */}
        {reportData?.seller && <WelcomeSection userName={reportData.seller.name} />}
        
        {/* Header & Filter */}
        <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">Meu Desempenho</h1>
            <p className="text-muted-foreground mt-1 text-base">Análise detalhada de metas, projeções e níveis conquistados.</p>
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

        {/* Level Highlight Cards */}
        {(overallLevelInfo || (reportData && reportData.periodLevels.length > 0)) && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {overallLevelInfo && (
                    <Card className={cn("lg:col-span-5 relative overflow-hidden border-none shadow-xl rounded-3xl group", levelCardConfig[overallLevelInfo.level].bgColor)}>
                        <div className="absolute -top-6 -right-6 p-4 opacity-5 group-hover:opacity-10 transition-opacity duration-500 pointer-events-none">
                            {levelCardConfig[overallLevelInfo.level].icon}
                        </div>
                        <CardHeader className="p-6 sm:p-8">
                           <div className="flex flex-col gap-5">
                                <div className={cn("flex h-16 w-16 items-center justify-center rounded-2xl bg-background/80 backdrop-blur-sm shadow-lg border-2", levelCardConfig[overallLevelInfo.level].borderColor)}>
                                    <div className={levelCardConfig[overallLevelInfo.level].color}>
                                        {levelCardConfig[overallLevelInfo.level].icon}
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <CardTitle className="text-2xl sm:text-3xl font-black tracking-tight">
                                        Nível <span className={levelCardConfig[overallLevelInfo.level].color}>{overallLevelInfo.level}</span>!
                                    </CardTitle>
                                    <CardDescription className="text-sm sm:text-base font-medium text-foreground/70 leading-relaxed">
                                      {levelCardConfig[overallLevelInfo.level].description}
                                    </CardDescription>
                                    <div className="pt-2 flex flex-wrap gap-2">
                                        <Badge variant="outline" className="bg-background/50 border-none font-bold text-[10px] uppercase tracking-wider py-1">
                                            {overallLevelInfo.periodName}
                                        </Badge>
                                        <Badge variant={overallLevelInfo.periodStatus.variant} className="text-[10px] uppercase tracking-wider py-1 font-bold">
                                            {overallLevelInfo.periodStatus.text}
                                        </Badge>
                                    </div>
                                </div>
                           </div>
                        </CardHeader>
                    </Card>
                )}
                
                {reportData && reportData.periodLevels.length > 0 && (
                    <Card className={cn("relative overflow-hidden border-none shadow-lg rounded-3xl bg-card/50", overallLevelInfo ? "lg:col-span-7" : "lg:col-span-12")}>
                        <CardHeader className="p-6 sm:p-8">
                            <div className="flex items-center gap-2 mb-4">
                                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                    <Trophy className="h-4 w-4 text-primary" />
                                </div>
                                <CardTitle className="text-lg font-bold">Níveis por Período</CardTitle>
                            </div>
                            <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 gap-3">
                                {reportData.periodLevels.map(p => (
                                    <div key={p.periodId} className="flex flex-col items-center justify-center p-3 rounded-2xl bg-background/40 border border-dashed text-center gap-1 group/badge hover:bg-background/60 transition-colors">
                                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter truncate w-full">{p.periodName}</span>
                                        {p.achievedLevel ? (
                                            <div className={cn("mt-1 p-2 rounded-full", levelCardConfig[p.achievedLevel].bgColor)}>
                                                {levelIcons[p.achievedLevel]}
                                            </div>
                                        ) : (
                                            <div className="mt-1 p-2 rounded-full bg-muted/30">
                                                <Target className="h-4 w-4 text-muted-foreground/30" />
                                            </div>
                                        )}
                                        <span className={cn("text-xs font-black tracking-tight", p.achievedLevel ? levelCardConfig[p.achievedLevel].color : "text-muted-foreground/40")}>
                                            {p.achievedLevel || "Pendente"}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </CardHeader>
                    </Card>
                )}
            </div>
        )}
        
        {/* Main Content Sections */}
        {!reportData || reportData.goals.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 rounded-3xl border-2 border-dashed bg-muted/10 gap-5 text-center px-6">
            <div className="rounded-full bg-muted p-6 text-muted-foreground grayscale opacity-30">
                <Medal className="h-12 w-12" />
            </div>
            <div className="max-w-md">
                <h2 className="text-2xl font-bold">Sem metas definidas</h2>
                <p className="mt-2 text-muted-foreground">Não encontramos objetivos de desempenho vinculados ao seu perfil para este grupo de períodos.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center gap-2 px-2">
                <div className="h-2 w-2 rounded-full bg-primary" />
                <h3 className="text-lg font-bold tracking-tight">Detalhamento por Período</h3>
            </div>
            
            <Accordion type="multiple" className="space-y-4" defaultValue={defaultOpenPeriod} key={selectedPeriodGroupId}>
                {Object.entries(reportData.goals.reduce((acc, goal) => {
                    const periodName = goal.period.name;
                    if (!acc[periodName]) acc[periodName] = [];
                    acc[periodName].push(goal);
                    return acc;
                }, {} as Record<string, ProcessedGoal[]>)).map(([periodName, periodGoals]) => (
                    <AccordionItem value={periodName} key={periodName} className="border-none">
                         <Card className="overflow-hidden shadow-md rounded-2xl border-none bg-card/60 backdrop-blur-sm">
                            <AccordionTrigger className="py-5 px-6 hover:no-underline hover:bg-muted/30 transition-colors group">
                                <div className="flex items-center gap-4 w-full">
                                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20 group-data-[state=open]:bg-primary group-data-[state=open]:text-primary-foreground transition-all duration-300">
                                        <Calendar className="h-5 w-5" />
                                    </div>
                                    <div className="flex flex-col items-start text-left">
                                        <h3 className="font-bold text-lg tracking-tight">{periodName}</h3>
                                        <Badge variant="outline" className="text-[10px] font-bold uppercase py-0 border-none text-muted-foreground">
                                            {periodGoals.length} Metas vinculadas
                                        </Badge>
                                    </div>
                                    <div className="ml-auto mr-4 hidden sm:flex items-center gap-2 text-muted-foreground group-data-[state=open]:text-primary">
                                        <span className="text-xs font-bold uppercase">Ver detalhes</span>
                                        <ChevronRight className="h-4 w-4 group-data-[state=open]:rotate-90 transition-transform" />
                                    </div>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent className="px-6 pb-6 pt-2">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {periodGoals.map(({ goal, goalType, period, metrics }) => {
                                        const pct = metrics.achievement;
                                        const isCurrency = goalType.valueType === 'currency' || goalType.name.toLowerCase().includes('frete');
                                        const formatFunction = isCurrency ? formatCurrency : formatPercentage;

                                        return (
                                        <Card key={goal.id} className="relative overflow-hidden border-none bg-muted/20 rounded-2xl group/goal shadow-inner">
                                            <div className={cn("h-1.5 w-full absolute top-0 left-0", getProgressColor(pct))} />
                                            
                                            <CardHeader className="pb-3 px-5 pt-6">
                                                <div className="flex justify-between items-start gap-3">
                                                    <div className="flex items-center gap-2">
                                                        <div className="p-1.5 rounded-lg bg-card border group-hover/goal:border-primary/30 transition-colors">
                                                            <BarChart2 className="h-4 w-4 text-primary" />
                                                        </div>
                                                        <h4 className="font-bold text-base text-foreground tracking-tight leading-tight">{goalType.name}</h4>
                                                    </div>
                                                    <Badge variant="outline" className={cn("rounded-full px-2 py-1 font-black text-xs border shadow-sm", getAchievementBg(pct))}>
                                                        {formatPercentage(pct)}
                                                    </Badge>
                                                </div>
                                            </CardHeader>
                                            
                                            <CardContent className="px-5 pb-6 space-y-6">
                                                {/* Progress Section */}
                                                <div className="space-y-4">
                                                    {goal.hasLevels && goal.levelTargets ? (
                                                        <div className="grid grid-cols-1 gap-4">
                                                            {orderedLevels.map(level => {
                                                                const levelTarget = goal.levelTargets?.[level];
                                                                if (!levelTarget || levelTarget <= 0) return null;
                                                                const levelAchievement = metrics.levelAchievements[level] ?? 0;
                                                                return (
                                                                <div key={level} className="space-y-1.5">
                                                                    <div className="flex items-center justify-between text-[10px] sm:text-xs">
                                                                        <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-muted-foreground">
                                                                            {levelIcons[level]}
                                                                            <span>{level}</span>
                                                                        </div>
                                                                        <div className="text-muted-foreground font-mono flex items-center gap-1">
                                                                            <span className={cn("font-black", levelAchievement >= 100 ? "text-foreground" : "")}>
                                                                                {formatFunction(goal.realizado ?? 0)}
                                                                            </span>
                                                                            <span className="opacity-40">/</span>
                                                                            <span className="opacity-60">{formatFunction(levelTarget)}</span>
                                                                        </div>
                                                                    </div>
                                                                    <Progress value={levelAchievement} className={cn("h-1.5", getProgressColor(levelAchievement))} />
                                                                </div>
                                                                )
                                                            })}
                                                        </div>
                                                    ) : (
                                                        <div className="space-y-2.5">
                                                            <div className="flex justify-between items-end">
                                                                <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-muted-foreground">Progresso Global</span>
                                                                <div className="text-muted-foreground font-mono text-[10px] sm:text-xs flex items-center gap-1">
                                                                    <span className="font-black text-foreground">{formatFunction(goal.realizado ?? 0)}</span>
                                                                    <span className="opacity-40">/</span>
                                                                    <span className="opacity-60">{formatFunction(goal.targetValue)}</span>
                                                                </div>
                                                            </div>
                                                            <Progress value={pct} className={cn("h-2", getProgressColor(pct))} />
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Metrics Grid */}
                                                <div className="grid grid-cols-2 md:grid-cols-2 gap-3 transition-all">
                                                    {renderMetricCard(
                                                        "Meta Diária", 
                                                        formatFunction(metrics.dailyGoal), 
                                                        <Target className="h-3 w-3" />,
                                                        "Necessário por dia útil para atingir o objetivo Diamante (ou Meta Total)."
                                                    )}
                                                    {renderMetricCard(
                                                        "Projeção", 
                                                        formatFunction(metrics.projection), 
                                                        metrics.projection >= (goal.targetValue ?? 0) ? <TrendingUp className="h-3 w-3 text-emerald-500"/> : <TrendingDown className="h-3 w-3 text-rose-500" />,
                                                        "Estimativa de resultado baseada no ritmo atual de vendas.",
                                                        metrics.projection >= (goal.targetValue ?? 0)
                                                    )}
                                                    {renderMetricCard(
                                                        "Tempo Decorrido", 
                                                        `${metrics.daysPassed}/${metrics.daysTotal} dias`, 
                                                        <Calendar className="h-3 w-3" />,
                                                        "Dias úteis já passados em relação ao total do período."
                                                    )}
                                                    {goal.hasLevels ? (
                                                        metrics.nextLevel ? (
                                                            renderMetricCard(
                                                                `Para ${metrics.nextLevel.name}`,
                                                                formatFunction(metrics.remainingForNextLevel),
                                                                levelIcons[metrics.nextLevel.name],
                                                                `Faltam ${formatFunction(metrics.remainingForNextLevel)} para alcançar o nível ${metrics.nextLevel.name}.`
                                                            )
                                                        ) : (
                                                            renderMetricCard(
                                                                "Status",
                                                                "Nível Máximo!",
                                                                <Gem className="h-3 w-3 text-sky-400" />,
                                                                "Parabéns! Você alcançou o nível Diamante nesta meta.",
                                                                true
                                                            )
                                                        )
                                                    ) : (
                                                        renderMetricCard(
                                                            "Restante",
                                                            formatFunction(metrics.remainingForTotal),
                                                            <BarChart2 className="h-3 w-3" />,
                                                            `Valor restante para atingir o objetivo de ${formatFunction(goal.targetValue || 0)}.`
                                                        )
                                                    )}
                                                </div>
                                            </CardContent>
                                        </Card>
                                        )
                                    })}
                                </div>
                            </AccordionContent>
                        </Card>
                    </AccordionItem>
                ))}
            </Accordion>
            
            {/* Total Group Summary */}
             <Accordion type="single" collapsible className="w-full pt-10">
              <AccordionItem value="item-1" className="border-none">
                <AccordionTrigger className="hover:no-underline px-4 py-4 rounded-2xl bg-muted/30 border border-dashed hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                        <TrendingUp className="h-4 w-4" />
                      </div>
                      <h3 className="text-base sm:text-lg font-bold tracking-tight">Consolidado Total do Grupo</h3>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                  {reportData.goalTypeTotals.map(total => {
                      const isMercantil = total.goalType.name.toLowerCase().includes('mercantil');
                      const summaryMeta = isMercantil && total.totalLevelTargets ? total.totalLevelTargets.Diamante : total.totalMeta;
                      const summaryPct = total.totalAchievement;

                      return (
                        <Card key={total.goalType.id} className="relative overflow-hidden border-none bg-card shadow-lg rounded-2xl">
                             <div className={cn("h-1 w-full absolute top-0 left-0", getProgressColor(summaryPct))} />
                             <CardHeader className="px-6 pt-6 pb-4 flex flex-row items-center justify-between">
                                 <div>
                                    <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">Resumo Consolidado</p>
                                    <CardTitle className="text-lg font-bold">{total.goalType.name}</CardTitle>
                                 </div>
                                 <Badge className={cn("font-black", getAchievementBg(summaryPct))}>{formatPercentage(summaryPct)}</Badge>
                             </CardHeader>
                             <CardContent className="px-6 pb-6 space-y-4">
                                  <div className="space-y-1.5">
                                      <div className="flex justify-between text-xs font-mono">
                                          <span className="font-bold">{formatCurrency(total.totalRealizado)}</span>
                                          <span className="opacity-50">/ {formatCurrency(summaryMeta)}</span>
                                      </div>
                                      <Progress value={summaryPct} className={cn("h-2", getProgressColor(summaryPct))} />
                                  </div>
                                  <div className="grid grid-cols-2 gap-4">
                                      <div className="space-y-1">
                                          <p className="text-[9px] font-bold uppercase text-muted-foreground">Projeção Consolidada</p>
                                          <div className="flex items-center gap-1.5">
                                             <span className="text-sm font-bold">{formatCurrency(total.totalProjection)}</span>
                                             {total.totalProjection >= summaryMeta ? <TrendingUp className="h-3 w-3 text-emerald-500"/> : <TrendingDown className="h-3 w-3 text-rose-500" />}
                                          </div>
                                      </div>
                                      <div className="space-y-1">
                                          <p className="text-[9px] font-bold uppercase text-muted-foreground">Atingimento Médio</p>
                                          <p className="text-sm font-bold text-foreground">{formatPercentage(summaryPct)}</p>
                                      </div>
                                  </div>
                             </CardContent>
                        </Card>
                      )
                    })}
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        )}
    </div>
  );
}
