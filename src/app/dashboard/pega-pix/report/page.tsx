
"use client";

import * as React from "react";
import {
  Loader2,
  GitFork,
  User as UserIcon,
  BriefcaseBusiness,
  Medal,
  Trophy,
  Award,
  Gem,
  TrendingUp,
  Frown,
  RefreshCw,
  Calendar,
  Target,
  BarChart2,
  TrendingDown,
} from "lucide-react";
import {
  collection,
  getDocs,
  query,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import type { PegaPixGoal, PegaPixAward, User, Branch, Role, GoalLevelTargets, PeriodGroup } from "@/lib/definitions";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getGroupStatus } from "@/lib/period-helpers";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const orderedLevels: Array<keyof GoalLevelTargets> = ['Bronze', 'Prata', 'Ouro', 'Diamante'];

const levelIcons: Record<keyof GoalLevelTargets, React.ReactNode> = {
    Bronze: <Medal className="h-4 w-4 text-orange-600" />,
    Prata: <Trophy className="h-4 w-4 text-slate-500" />,
    Ouro: <Award className="h-4 w-4 text-yellow-500" />,
    Diamante: <Gem className="h-4 w-4 text-sky-400" />,
};

type Result = {
  goal: PegaPixGoal;
  achievedLevel: keyof GoalLevelTargets | null;
  nextLevel: keyof GoalLevelTargets | null;
  progressToNextLevel: number;
  awardValue: number;
};

export default function PegaPixReportPage() {
  const { toast } = useToast();
  const [goals, setGoals] = React.useState<PegaPixGoal[]>([]);
  const [awards, setAwards] = React.useState<PegaPixAward[]>([]);
  const [users, setUsers] = React.useState<User[]>([]);
  const [branches, setBranches] = React.useState<Branch[]>([]);
  const [roles, setRoles] = React.useState<Role[]>([]);
  const [periodGroups, setPeriodGroups] = React.useState<PeriodGroup[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [activeTab, setActiveTab] = React.useState("user");
  const [selectedPeriodGroupId, setSelectedPeriodGroupId] = React.useState<string | null>(null);

  const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  const formatPercentage = (value: number) => `${value.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2})}%`;

  const fetchData = React.useCallback(async () => {
    try {
      setLoading(true);
      const [goalsSnap, awardsSnap, usersSnap, branchesSnap, rolesSnap, periodsSnap] = await Promise.all([
        getDocs(query(collection(db, "pegaPixGoals"))),
        getDocs(query(collection(db, "pegaPixAwards"))),
        getDocs(collection(db, "users")),
        getDocs(collection(db, "branches")),
        getDocs(collection(db, "roles")),
        getDocs(collection(db, "periodgroups")),
      ]);
      
      setGoals(goalsSnap.docs.map(d => ({id: d.id, ...d.data()}) as PegaPixGoal));
      setAwards(awardsSnap.docs.map(d => ({id: d.id, ...d.data()}) as PegaPixAward));
      setUsers(usersSnap.docs.map(d => ({id: d.id, ...d.data()}) as User));
      setBranches(branchesSnap.docs.map(d => ({id: d.id, ...d.data()}) as Branch));
      setRoles(rolesSnap.docs.map(d => ({id: d.id, ...d.data()}) as Role));
      
      const fetchedPeriodGroups = periodsSnap.docs.map(d => ({id: d.id, ...d.data()}) as PeriodGroup);
      
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
      if (!selectedPeriodGroupId && fetchedPeriodGroups.length > 0) {
        const activeGroup = fetchedPeriodGroups.find(g => getGroupStatus(g).text === 'Ativo');
        setSelectedPeriodGroupId(activeGroup?.id || fetchedPeriodGroups[0].id);
      }

    } catch (error) {
      toast({ title: "Erro ao buscar dados", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast, selectedPeriodGroupId]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const calculateResults = React.useCallback((goal: PegaPixGoal): Result => {
    const realizado = goal.realizado || 0;
    let achievedLevel: keyof GoalLevelTargets | null = null;

    for (let i = orderedLevels.length - 1; i >= 0; i--) {
      const level = orderedLevels[i];
      if (goal.levels[level] > 0 && realizado >= goal.levels[level]) {
        achievedLevel = level;
        break;
      }
    }
    
    const responsibleAward = awards.find(a => 
        a.responsibleType === goal.responsibleType && 
        a.responsibleIds.includes(goal.responsibleId)
    );

    const awardValue = (achievedLevel && responsibleAward) ? responsibleAward.levels[achievedLevel] : 0;
    
    let nextLevel: keyof GoalLevelTargets | null = null;
    let progressToNextLevel = 0;
    
    if (achievedLevel) {
        const nextLevelIndex = orderedLevels.indexOf(achievedLevel) + 1;
        if (nextLevelIndex < orderedLevels.length) {
            nextLevel = orderedLevels[nextLevelIndex];
            const nextLevelTarget = goal.levels[nextLevel];
            const previousLevelTarget = goal.levels[achievedLevel];
            const range = nextLevelTarget - previousLevelTarget;
            const progressInRange = realizado - previousLevelTarget;
            progressToNextLevel = range > 0 ? (progressInRange / range) * 100 : 0;
        } else {
            progressToNextLevel = 100;
        }
    } else {
        nextLevel = 'Bronze';
        const bronzeTarget = goal.levels.Bronze;
        progressToNextLevel = bronzeTarget > 0 ? (realizado / bronzeTarget) * 100 : 0;
    }

    return {
      goal,
      achievedLevel,
      nextLevel,
      progressToNextLevel: Math.min(100, progressToNextLevel),
      awardValue,
    };
  }, [awards]);

  // Design Helpers
  const getLevelColor = (level: keyof GoalLevelTargets | null) => {
    switch (level) {
      case 'Bronze': return 'text-orange-600';
      case 'Prata': return 'text-slate-500';
      case 'Ouro': return 'text-yellow-500';
      case 'Diamante': return 'text-sky-400';
      default: return 'text-muted-foreground';
    }
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

  const renderMetricCard = (label: string, value: string | React.ReactNode, icon: React.ReactNode, tooltip?: string, highlight?: boolean) => (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`flex flex-col gap-1 rounded-xl p-3 border cursor-help transition-colors hover:bg-muted/40 ${highlight ? 'border-primary/30 bg-primary/5' : 'bg-muted/20'}`}>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium uppercase tracking-wider">
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

  const renderGoalCards = (results: Result[]) => {
    if (results.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-10 text-center gap-4">
          <div className="rounded-full bg-muted p-4">
            <Frown className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground text-sm font-medium">Nenhuma meta encontrada para este grupo.</p>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
        {results.map(result => {
          const { goal, achievedLevel, nextLevel, progressToNextLevel, awardValue } = result;
          const pct = progressToNextLevel;

          return (
            <div key={goal.id} className="rounded-2xl border bg-card p-5 space-y-4 hover:shadow-md transition-all duration-300">
              {/* Card Header */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-col">
                  <h4 className="font-bold text-sm text-primary uppercase tracking-tight">{goal.name}</h4>
                  <div className="flex items-center gap-2 mt-1">
                      {achievedLevel ? (
                        <div className={`flex items-center gap-1.5 text-xs font-bold px-2 py-0.5 rounded-full border ${getAchievementBg(100)}`}>
                            {levelIcons[achievedLevel]}
                            {achievedLevel}
                        </div>
                      ) : (
                        <Badge variant="outline" className="text-[10px] uppercase font-bold">Sem Nível</Badge>
                      )}
                  </div>
                </div>
                <div className={`text-xs font-bold px-2.5 py-1 rounded-full border shrink-0 ${getAchievementBg(pct)}`}>
                  {formatPercentage(pct)}
                </div>
              </div>

              {/* level Trackers */}
              <div className="space-y-3">
                 <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-muted-foreground font-medium">Realizado atual</span>
                    <span className="font-mono font-bold text-emerald-600">{formatCurrency(goal.realizado)}</span>
                 </div>
                 
                 <div className="space-y-2">
                    {orderedLevels.map(level => {
                        const target = goal.levels[level];
                        if (target <= 0) return null;
                        
                        const isReached = goal.realizado >= target;
                        const isCurrentActive = achievedLevel === level;
                        const isNext = nextLevel === level;

                        return (
                            <div key={level} className={`flex items-center gap-3 p-2 rounded-lg border transition-colors ${isReached ? 'bg-muted/30 border-emerald-100 dark:border-emerald-900/50' : isNext ? 'border-primary/20 bg-primary/5' : 'opacity-40 border-dashed'}`}>
                                <div className={`flex h-8 w-8 items-center justify-center rounded-full bg-background border ${isReached ? 'border-emerald-500 shadow-sm shadow-emerald-100' : 'border-border'}`}>
                                    {levelIcons[level]}
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center justify-between">
                                        <span className={`text-xs font-bold ${isReached ? 'text-foreground' : 'text-muted-foreground'}`}>{level}</span>
                                        <span className="text-[10px] font-mono text-muted-foreground">{formatCurrency(target)}</span>
                                    </div>
                                    <div className="mt-1 h-1 w-full bg-muted rounded-full overflow-hidden">
                                        <div 
                                            className={`h-full transition-all duration-500 ${isReached ? 'bg-emerald-500' : 'bg-primary/20'}`}
                                            style={{ width: isReached ? '100%' : nextLevel === level ? `${progressToNextLevel}%` : '0%' }}
                                        />
                                    </div>
                                </div>
                                {isReached && <div className="bg-emerald-500 rounded-full p-0.5"><div className="w-1.5 h-1.5 bg-white rounded-full" /></div>}
                            </div>
                        )
                    })}
                 </div>
              </div>

              {/* Metric Chips */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                 {renderMetricCard(
                    "Prêmio Atual",
                    formatCurrency(awardValue),
                    <Medal className="h-3.5 w-3.5" />,
                    "Valor do prêmio conquistado até o momento.",
                    awardValue > 0
                 )}
                 {nextLevel ? (
                    renderMetricCard(
                        `Próx. Nível (${nextLevel})`,
                        formatCurrency(goal.levels[nextLevel] - goal.realizado),
                        levelIcons[nextLevel],
                        `Faltam ${formatCurrency(goal.levels[nextLevel] - goal.realizado)} para o nível ${nextLevel}.`
                    )
                 ) : (
                    renderMetricCard(
                        "Nível Máximo!",
                        "Concluído",
                        <Gem className="h-3.5 w-3.5 text-sky-400" />,
                        "Todas as metas deste Pega Pix foram atingidas!",
                        true
                    )
                 )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderResponsibleAccordion = (
    items: { id: string; name: string; icon: React.ReactNode }[],
    responsibleType: 'user' | 'branch' | 'role'
  ) => {
    const itemsWithGoals = items.filter(item => goals.some(g => g.responsibleId === item.id && g.responsibleType === responsibleType && (selectedPeriodGroupId ? g.periodGroupId === selectedPeriodGroupId : true)));

    if (itemsWithGoals.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center text-center text-muted-foreground py-20 border-2 border-dashed rounded-2xl gap-4">
          <div className="rounded-full bg-muted p-5">
            <Frown className="h-10 w-10 text-muted-foreground" />
          </div>
          <p className="font-medium">Nenhum resultado encontrado nesta categoria.</p>
        </div>
      );
    }

    return (
      <Accordion type="multiple" className="w-full space-y-4">
        {itemsWithGoals.map(item => {
          const filteredGoals = goals.filter(goal => goal.responsibleId === item.id && goal.responsibleType === responsibleType && (selectedPeriodGroupId ? goal.periodGroupId === selectedPeriodGroupId : true));
          const results = filteredGoals.map(calculateResults);
          const totalAward = results.reduce((sum, r) => sum + r.awardValue, 0);

          return (
            <AccordionItem value={item.id} key={item.id} className="border-0">
              <Card className="overflow-hidden shadow-sm hover:shadow-md transition-all duration-300">
                {/* Top accent bar */}
                <div className={`h-1 w-full ${totalAward > 0 ? 'bg-gradient-to-r from-emerald-400 to-emerald-600' : 'bg-muted'}`} />
                
                <AccordionTrigger className="px-6 py-5 hover:no-underline [&>svg]:shrink-0">
                   <div className="flex items-center justify-between w-full gap-4">
                      <div className="flex items-center gap-4">
                         <div className={`p-0.5 rounded-xl ${totalAward > 0 ? 'bg-gradient-to-br from-emerald-400 to-emerald-600' : 'bg-muted'}`}>
                            <div className="flex h-12 w-12 items-center justify-center rounded-[10px] bg-background">
                               <div className="text-primary">{item.icon}</div>
                            </div>
                         </div>
                         <div className="text-left">
                            <p className="font-bold text-base leading-tight">{item.name}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                {results.length} meta{results.length !== 1 ? 's' : ''} vinculada{results.length !== 1 ? 's' : ''}
                            </p>
                         </div>
                      </div>
                      <div className="mr-2">
                        <div className={`text-xs font-bold px-3 py-1.5 rounded-full border flex items-center gap-1.5 ${totalAward > 0 ? getAchievementBg(100) : 'bg-muted text-muted-foreground border-border'}`}>
                          <Medal className="h-3.5 w-3.5" />
                          {formatCurrency(totalAward)} em total
                        </div>
                      </div>
                   </div>
                </AccordionTrigger>
                <AccordionContent className="px-6 pb-6 pt-2">
                  <div className="h-px bg-border/50 mb-6" />
                  {renderGoalCards(results)}
                </AccordionContent>
              </Card>
            </AccordionItem>
          );
        })}
      </Accordion>
    );
  };

  const selectedGroupName = periodGroups.find(g => g.id === selectedPeriodGroupId)?.name || 'Todos os Grupos';
  const selectedGroupStatus = periodGroups.find(g => g.id === selectedPeriodGroupId) ? getGroupStatus(periodGroups.find(g => g.id === selectedPeriodGroupId)!) : null;

  return (
    <div className="flex flex-col gap-8 pb-10">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Saldos Gerais Pega Pix
          </h1>
          <p className="text-muted-foreground mt-1">
            Gestão de desempenho de níveis e premiações vinculadas.
            {selectedGroupStatus && (
                <Badge variant={selectedGroupStatus.variant} className="ml-2 align-middle">{selectedGroupStatus.text}</Badge>
            )}
          </p>
        </div>
        <div className="w-full sm:w-auto flex items-center gap-2">
          <Select value={selectedPeriodGroupId || 'all'} onValueChange={setSelectedPeriodGroupId}>
            <SelectTrigger className="w-full sm:w-[280px] h-11">
              <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
              <SelectValue placeholder="Filtrar por Grupo..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Ver Todos os Grupos</SelectItem>
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
          <Button variant="outline" size="icon" onClick={fetchData} disabled={loading} className="h-11 w-11 shrink-0 shadow-sm">
            <RefreshCw className={loading ? 'animate-spin h-4 w-4 text-primary' : 'h-4 w-4'} />
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      <Card className="border-none shadow-sm bg-card/50 backdrop-blur-sm overflow-hidden">
        <CardHeader className="bg-muted/10 border-b">
           <div className="flex items-center gap-2">
              <BarChart2 className="h-4 w-4 text-primary" />
              <CardTitle className="text-lg">Relatório de Desempenho por Categoria</CardTitle>
           </div>
           <CardDescription>Visualize conquistas e projeções de premiações totais.</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          {loading ? (
            <div className="flex flex-col justify-center items-center h-80 gap-4">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-muted-foreground text-sm">Atualizando saldos e níveis...</p>
            </div>
          ) : (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
              <TabsList className="bg-muted/50 p-1">
                <TabsTrigger value="user" className="data-[state=active]:bg-background data-[state=active]:shadow-sm px-6 py-2">
                  <UserIcon className="h-4 w-4 mr-2" /> Vendedores
                </TabsTrigger>
                <TabsTrigger value="branch" className="data-[state=active]:bg-background data-[state=active]:shadow-sm px-6 py-2">
                  <GitFork className="h-4 w-4 mr-2" /> Filiais
                </TabsTrigger>
                <TabsTrigger value="role" className="data-[state=active]:bg-background data-[state=active]:shadow-sm px-6 py-2">
                  <BriefcaseBusiness className="h-4 w-4 mr-2" /> Funções
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="user" className="outline-none focus-visible:ring-0">
                {renderResponsibleAccordion(users.map(u => ({ ...u, icon: <UserIcon className="h-5 w-5" /> })), 'user')}
              </TabsContent>
              <TabsContent value="branch" className="outline-none focus-visible:ring-0">
                {renderResponsibleAccordion(branches.map(b => ({ ...b, icon: <GitFork className="h-5 w-5" /> })), 'branch')}
              </TabsContent>
              <TabsContent value="role" className="outline-none focus-visible:ring-0">
                {renderResponsibleAccordion(roles.map(r => ({ ...r, icon: <BriefcaseBusiness className="h-5 w-5" /> })), 'role')}
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
