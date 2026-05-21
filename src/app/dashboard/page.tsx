
"use client";

import * as React from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Target, TrendingUp, Award, Loader2, Frown, Rocket, GitFork, BriefcaseBusiness, Medal, Trophy, Gem } from "lucide-react"
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";
import type { Company, User, Goal, GoalType, PeriodGroup, Role, Branch } from "@/lib/definitions";
import { collection, getDocs, limit, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { seedNavigation } from '@/lib/navigation-data';
import { getGroupStatus } from "@/lib/period-helpers";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { parseISO } from "date-fns";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type DashboardStats = {
  activeGoals: number;
  totalTarget: number;
  totalAchieved: number;
  overallAchievement: number;
};

type ChartData = {
  name: string;
  meta: number;
  realizado: number;
};

type TopSeller = {
  seller: User;
  totalRealizado: number;
  totalMeta: number;
  achievement: number;
  roleName: string;
};

type HighlightedGoal = {
    goal: Goal;
    goalType: GoalType;
    seller: User;
    achievement: number;
};

export default function DashboardPage() {
  const { toast } = useToast();
  const [loading, setLoading] = React.useState(true);
  
  // Raw Data States
  const [goals, setGoals] = React.useState<Goal[]>([]);
  const [goalTypes, setGoalTypes] = React.useState<GoalType[]>([]);
  const [users, setUsers] = React.useState<User[]>([]);
  const [roles, setRoles] = React.useState<Role[]>([]);
  const [periodGroups, setPeriodGroups] = React.useState<PeriodGroup[]>([]);
  const [branches, setBranches] = React.useState<Branch[]>([]);

  // Period Selection per Tab
  const [activeTab, setActiveTab] = React.useState<string>("filiais");
  const [selectedBranchGroupId, setSelectedBranchGroupId] = React.useState<string>("");
  const [selectedSellerGroupId, setSelectedSellerGroupId] = React.useState<string>("");
  const [selectedRoleGroupId, setSelectedRoleGroupId] = React.useState<string>("");

  React.useEffect(() => {
    seedNavigation();
  }, []);
  
  const formatCurrency = (value: number) => {
    if (isNaN(value)) return "R$ 0,00";
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  }

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [goalsSnap, goalTypesSnap, usersSnap, rolesSnap, periodGroupsSnap, branchesSnap] = await Promise.all([
          getDocs(collection(db, "goals")),
          getDocs(query(collection(db, "goaltypes"), orderBy("order"))),
          getDocs(collection(db, "users")),
          getDocs(query(collection(db, "roles"))),
          getDocs(collection(db, "periodgroups")),
          getDocs(collection(db, "branches")),
        ]);
        
        const fetchedGoals = goalsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Goal));
        const fetchedGoalTypes = goalTypesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as GoalType));
        const fetchedUsers = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
        const fetchedRoles = rolesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Role));
        const fetchedBranches = branchesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Branch));
        
        const statusOrder = { "Ativo": 1, "Agendado": 2, "Encerrado": 3, "Vazio": 4 };
        const fetchedGroups = periodGroupsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as PeriodGroup));
        fetchedGroups.sort((a, b) => {
          const statusA = statusOrder[getGroupStatus(a).text as keyof typeof statusOrder] || 99;
          const statusB = statusOrder[getGroupStatus(b).text as keyof typeof statusOrder] || 99;
          if (statusA !== statusB) return statusA - statusB;
          const dateA = a.periods?.[0]?.startDate ? parseISO(a.periods[0].startDate).getTime() : 0;
          const dateB = b.periods?.[0]?.startDate ? parseISO(b.periods[0].startDate).getTime() : 0;
          return dateB - dateA;
        });

        setGoals(fetchedGoals);
        setGoalTypes(fetchedGoalTypes);
        setUsers(fetchedUsers);
        setRoles(fetchedRoles);
        setPeriodGroups(fetchedGroups);
        setBranches(fetchedBranches);

        const defaultGroup = fetchedGroups.find(g => getGroupStatus(g).text === "Ativo")
          || fetchedGroups.find(g => getGroupStatus(g).text === "Agendado")
          || fetchedGroups[0];

        if (defaultGroup) {
          setSelectedBranchGroupId(defaultGroup.id);
          setSelectedSellerGroupId(defaultGroup.id);
          setSelectedRoleGroupId(defaultGroup.id);
        }

      } catch (error) {
        toast({
          title: "Erro ao carregar o painel",
          description: "Não foi possível buscar os dados do sistema.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [toast]);

  // Active Group Id dynamically based on the selected period of the active tab
  const activeGroupId = React.useMemo(() => {
    if (activeTab === "filiais") return selectedBranchGroupId;
    if (activeTab === "vendedores") return selectedSellerGroupId;
    return selectedRoleGroupId;
  }, [activeTab, selectedBranchGroupId, selectedSellerGroupId, selectedRoleGroupId]);

  // Selected Period Group Name for UI text representation
  const selectedGroupName = React.useMemo(() => {
    const group = periodGroups.find(g => g.id === activeGroupId);
    return group ? group.name : "período selecionado";
  }, [periodGroups, activeGroupId]);

  // Selected dimension label for UI text representation
  const dimensionLabel = React.useMemo(() => {
    if (activeTab === "filiais") return "filiais";
    if (activeTab === "vendedores") return "vendedores";
    return "funções";
  }, [activeTab]);

  // Selected Branch Period Group Name for UI text representation
  const selectedBranchGroupName = React.useMemo(() => {
    const group = periodGroups.find(g => g.id === selectedBranchGroupId);
    return group ? group.name : "período selecionado";
  }, [periodGroups, selectedBranchGroupId]);

  // Branch Performance Data with levels
  const branchPerformanceData = React.useMemo(() => {
    if (!selectedBranchGroupId) return [];
    const group = periodGroups.find(g => g.id === selectedBranchGroupId);
    const periodIds = group ? group.periods.map(p => p.id) : [];
    const filteredGoals = goals.filter(g => periodIds.includes(g.periodId) && g.branchId);

    const isMercantilType = (gt: GoalType) => gt.name.toLowerCase().includes('mercantil');

    return branches.map(branch => {
      const branchGoals = filteredGoals.filter(g => g.branchId === branch.id);
      
      const mercantilGoals = branchGoals.filter(g => {
        const gt = goalTypes.find(type => type.id === g.goalTypeId);
        return gt && isMercantilType(gt);
      });

      const processedGoals = mercantilGoals.map(goal => {
        const goalType = goalTypes.find(gt => gt.id === goal.goalTypeId)!;
        const realizado = goal.realizado || 0;
        
        let targetValue = goal.targetValue || 0;
        if (goal.hasLevels && goal.levelTargets) {
          targetValue = goal.levelTargets.Diamante || 0;
        }

        const achievement = targetValue > 0 ? (realizado / targetValue) * 100 : (realizado > 0 ? 100 : 0);

        // Level achievements
        const levelAchievements: { Bronze?: number; Prata?: number; Ouro?: number; Diamante?: number } = {};
        if (goal.hasLevels && goal.levelTargets) {
          const levels: Array<'Bronze' | 'Prata' | 'Ouro' | 'Diamante'> = ['Bronze', 'Prata', 'Ouro', 'Diamante'];
          levels.forEach(lvl => {
            const tgt = goal.levelTargets?.[lvl];
            if (tgt && tgt > 0) {
              levelAchievements[lvl] = (realizado / tgt) * 100;
            }
          });
        }

        // Determine current achieved level and next level
        let achievedLevel: 'Bronze' | 'Prata' | 'Ouro' | 'Diamante' | null = null;
        let nextLevel: { name: 'Bronze' | 'Prata' | 'Ouro' | 'Diamante'; value: number } | null = null;
        
        if (goal.hasLevels && goal.levelTargets) {
          const levels: Array<'Bronze' | 'Prata' | 'Ouro' | 'Diamante'> = ['Bronze', 'Prata', 'Ouro', 'Diamante'];
          for (let i = 0; i < levels.length; i++) {
            const lvl = levels[i];
            const tgt = goal.levelTargets[lvl];
            if (tgt && realizado >= tgt) {
              achievedLevel = lvl;
            } else if (tgt && realizado < tgt) {
              nextLevel = { name: lvl, value: tgt };
              break;
            }
          }
        }

        return {
          goal,
          goalType,
          realizado,
          targetValue,
          achievement,
          levelAchievements,
          achievedLevel,
          nextLevel,
        };
      });

      const overallAchievement = processedGoals.length > 0
        ? processedGoals.reduce((sum, g) => sum + g.achievement, 0) / processedGoals.length
        : 0;

      return {
        branch,
        goals: processedGoals,
        overallAchievement,
      };
    }).filter(item => item.goals.length > 0)
      .sort((a, b) => b.overallAchievement - a.overallAchievement);
  }, [branches, goals, goalTypes, periodGroups, selectedBranchGroupId]);

  // Calculations for KPIs based on current filtered goals and selected dimension (activeTab)
  const stats = React.useMemo(() => {
    if (!activeGroupId) return null;
    const activeGroup = periodGroups.find(g => g.id === activeGroupId);
    const activePeriodIds = activeGroup ? activeGroup.periods.map(p => p.id) : [];
    const activeGoals = goals.filter(g => activePeriodIds.includes(g.periodId));

    const dimensionGoals = activeGoals.filter(g => {
      if (activeTab === "filiais") {
        return !!g.branchId;
      } else if (activeTab === "vendedores") {
        return !!g.userId;
      } else {
        return !!g.roleId && !g.userId && !g.branchId;
      }
    });

    const mercantilGoals = dimensionGoals.filter(g => {
      const goalType = goalTypes.find(gt => gt.id === g.goalTypeId);
      return goalType && goalType.name.toLowerCase().includes('mercantil');
    });

    const totalTarget = mercantilGoals.reduce((sum, goal) => {
      let target = goal.targetValue || 0;
      if (goal.hasLevels && goal.levelTargets) {
        target = goal.levelTargets.Diamante || 0;
      }
      return sum + target;
    }, 0);
    
    const totalAchieved = mercantilGoals.reduce((sum, goal) => sum + (goal.realizado || 0), 0);
    const overallAchievement = totalTarget > 0 ? (totalAchieved / totalTarget) * 100 : 0;

    return {
      activeGoals: dimensionGoals.length,
      totalTarget,
      totalAchieved,
      overallAchievement
    };
  }, [goals, goalTypes, periodGroups, activeGroupId, activeTab]);

  // Chart Data for Sellers
  const chartData = React.useMemo(() => {
    if (!selectedSellerGroupId) return [];
    const group = periodGroups.find(g => g.id === selectedSellerGroupId);
    const periodIds = group ? group.periods.map(p => p.id) : [];
    const filteredGoals = goals.filter(g => periodIds.includes(g.periodId));

    return goalTypes.map(goalType => {
      const goalsForType = filteredGoals.filter(g => g.goalTypeId === goalType.id && !!g.userId);

      const totals = goalsForType.reduce((acc, goal) => {
        let target = goal.targetValue || 0;
        if (goal.hasLevels && goal.levelTargets) {
          target = goal.levelTargets.Diamante || 0;
        }
        acc.meta += target;
        acc.realizado += goal.realizado || 0;
        return acc;
      }, { meta: 0, realizado: 0 });

      return {
        name: goalType.name,
        meta: totals.meta,
        realizado: totals.realizado,
      };
    }).filter(item => item.meta > 0 || item.realizado > 0);
  }, [goals, goalTypes, periodGroups, selectedSellerGroupId]);

  // Chart Data for Branches
  const branchChartData = React.useMemo(() => {
    if (!selectedBranchGroupId) return [];
    const group = periodGroups.find(g => g.id === selectedBranchGroupId);
    const periodIds = group ? group.periods.map(p => p.id) : [];
    const filteredGoals = goals.filter(g => periodIds.includes(g.periodId));

    return goalTypes.map(goalType => {
      const goalsForType = filteredGoals.filter(g => g.goalTypeId === goalType.id && !!g.branchId);

      const totals = goalsForType.reduce((acc, goal) => {
        let target = goal.targetValue || 0;
        if (goal.hasLevels && goal.levelTargets) {
          target = goal.levelTargets.Diamante || 0;
        }
        acc.meta += target;
        acc.realizado += goal.realizado || 0;
        return acc;
      }, { meta: 0, realizado: 0 });

      return {
        name: goalType.name,
        meta: totals.meta,
        realizado: totals.realizado,
      };
    }).filter(item => item.meta > 0 || item.realizado > 0);
  }, [goals, goalTypes, periodGroups, selectedBranchGroupId]);

  // Chart Data for Roles
  const roleChartData = React.useMemo(() => {
    if (!selectedRoleGroupId) return [];
    const group = periodGroups.find(g => g.id === selectedRoleGroupId);
    const periodIds = group ? group.periods.map(p => p.id) : [];
    const filteredGoals = goals.filter(g => periodIds.includes(g.periodId));

    return goalTypes.map(goalType => {
      const goalsForType = filteredGoals.filter(g => g.goalTypeId === goalType.id && g.roleId && !g.userId && !g.branchId);

      const totals = goalsForType.reduce((acc, goal) => {
        let target = goal.targetValue || 0;
        if (goal.hasLevels && goal.levelTargets) {
          target = goal.levelTargets.Diamante || 0;
        }
        acc.meta += target;
        acc.realizado += goal.realizado || 0;
        return acc;
      }, { meta: 0, realizado: 0 });

      return {
        name: goalType.name,
        meta: totals.meta,
        realizado: totals.realizado,
      };
    }).filter(item => item.meta > 0 || item.realizado > 0);
  }, [goals, goalTypes, periodGroups, selectedRoleGroupId]);

  // Top Sellers
  const topSellers = React.useMemo(() => {
    if (!activeGroupId) return [];
    const activeGroup = periodGroups.find(g => g.id === activeGroupId);
    const activePeriodIds = activeGroup ? activeGroup.periods.map(p => p.id) : [];
    const activeGoals = goals.filter(g => activePeriodIds.includes(g.periodId));

    const sellerPerformance: { [sellerId: string]: { totalRealizado: number; totalMeta: number } } = {};
    const allSellers = users.filter(u => u.roleId);

    allSellers.forEach(seller => {
      const sellerGoals = activeGoals.filter(g => 
        (g.userId === seller.id || (g.roleId === seller.roleId && !g.userId && !g.branchId))
      );

      if (sellerGoals.length === 0) return;

      const totals = sellerGoals.reduce((acc, goal) => {
        const goalType = goalTypes.find(gt => gt.id === goal.goalTypeId);
        if (!goalType || !goalType.name.toLowerCase().includes('mercantil')) return acc;

        const realizado = goal.realizado || 0;
        let target = goal.targetValue || 0;

        if (goal.hasLevels && goal.levelTargets) {
          target = goal.levelTargets.Diamante || 0;
        }
        
        acc.realizado += realizado;
        acc.meta += target;
        return acc;
      }, { realizado: 0, meta: 0 });
      
      if (totals.meta > 0 || totals.realizado > 0) {
        if (!sellerPerformance[seller.id]) {
          sellerPerformance[seller.id] = { totalRealizado: 0, totalMeta: 0 };
        }
        sellerPerformance[seller.id].totalRealizado += totals.realizado;
        sellerPerformance[seller.id].totalMeta += totals.meta;
      }
    });

    return Object.entries(sellerPerformance)
      .map(([sellerId, { totalRealizado, totalMeta }]) => {
        const seller = users.find(u => u.id === sellerId);
        const roleName = roles.find(r => r.id === seller?.roleId)?.name || "N/A";
        const achievement = totalMeta > 0 ? (totalRealizado / totalMeta) * 100 : 0;
        return {
          seller: seller!,
          totalRealizado,
          totalMeta,
          achievement,
          roleName,
        };
      })
      .filter(item => item.seller)
      .sort((a, b) => b.achievement - a.achievement)
      .slice(0, 5);
  }, [goals, goalTypes, users, roles, periodGroups, activeGroupId]);

  // Highlighted Goals (near completion)
  const highlightedGoals = React.useMemo(() => {
    if (!activeGroupId) return [];
    const activeGroup = periodGroups.find(g => g.id === activeGroupId);
    const activePeriodIds = activeGroup ? activeGroup.periods.map(p => p.id) : [];
    const activeGoals = goals.filter(g => activePeriodIds.includes(g.periodId));

    return activeGoals
      .map(goal => {
        const goalType = goalTypes.find(gt => gt.id === goal.goalTypeId);
        const seller = users.find(u => u.id === goal.userId);
        if (!goalType || !seller || !goal.hasLevels || !goal.levelTargets) return null;

        const target = goal.levelTargets.Diamante || 0;
        if (target === 0) return null;
        
        const achievement = ((goal.realizado || 0) / target) * 100;
        return { goal, goalType, seller, achievement };
      })
      .filter(item => item && item.achievement >= 75 && item.achievement < 100)
      .sort((a, b) => b!.achievement - a!.achievement)
      .slice(0, 5) as HighlightedGoal[];
  }, [goals, goalTypes, users, periodGroups, activeGroupId]);


  if (loading) {
    return (
      <div className="flex min-h-[calc(100vh-10rem)] w-full items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  const currentHour = new Date().getHours();
  const greeting = currentHour < 12 ? 'Bom dia' : currentHour < 18 ? 'Boa tarde' : 'Boa noite';

  return (
    <div className="flex flex-col gap-8 pb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
       <div className="flex flex-col space-y-1">
         <h1 className="text-4xl font-extrabold font-headline tracking-tight bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">Painel de Controle</h1>
         <p className="text-muted-foreground text-lg">{greeting}! Acompanhe seus indicadores e o desempenho da equipe em tempo real.</p>
       </div>
       
       <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {/* Card 1 */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 p-6 text-white shadow-lg transition-transform hover:-translate-y-1 hover:shadow-xl duration-300">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-indigo-100">Metas</p>
            <div className="rounded-full bg-white/20 p-2 backdrop-blur-md">
              <Target className="h-5 w-5 text-white" />
            </div>
          </div>
          <div className="mt-4 relative z-10">
            <h3 className="text-4xl font-bold tracking-tight">{stats?.activeGoals || 0}</h3>
            <p className="mt-1 text-sm text-indigo-100/80">Total de metas de {dimensionLabel} em {selectedGroupName}</p>
          </div>
          <div className="absolute -right-6 -top-6 h-32 w-32 rounded-full bg-white/10 blur-2xl"></div>
          <div className="absolute -left-6 -bottom-6 h-24 w-24 rounded-full bg-purple-500/20 blur-xl"></div>
        </div>

        {/* Card 2 */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 p-6 text-white shadow-lg transition-transform hover:-translate-y-1 hover:shadow-xl duration-300">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-emerald-100">Total Realizado</p>
            <div className="rounded-full bg-white/20 p-2 backdrop-blur-md">
              <TrendingUp className="h-5 w-5 text-white" />
            </div>
          </div>
          <div className="mt-4 relative z-10">
            <h3 className="text-3xl font-bold tracking-tight">{formatCurrency(stats?.totalAchieved || 0)}</h3>
            <p className="mt-1 text-sm text-emerald-100/80">Soma de realizados de {dimensionLabel} em {selectedGroupName}</p>
          </div>
          <div className="absolute -right-6 -top-6 h-32 w-32 rounded-full bg-white/10 blur-2xl"></div>
        </div>

        {/* Card 3 */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-orange-400 to-rose-500 p-6 text-white shadow-lg transition-transform hover:-translate-y-1 hover:shadow-xl duration-300">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-rose-100">Total da Meta</p>
            <div className="rounded-full bg-white/20 p-2 backdrop-blur-md">
              <BriefcaseBusiness className="h-5 w-5 text-white" />
            </div>
          </div>
          <div className="mt-4 relative z-10">
            <h3 className="text-3xl font-bold tracking-tight">{formatCurrency(stats?.totalTarget || 0)}</h3>
            <p className="mt-1 text-sm text-rose-100/80">Alvo total de {dimensionLabel} ({selectedGroupName})</p>
          </div>
          <div className="absolute -right-6 -top-6 h-32 w-32 rounded-full bg-white/10 blur-2xl"></div>
        </div>

        {/* Card 4 */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-600 p-6 text-white shadow-lg transition-transform hover:-translate-y-1 hover:shadow-xl duration-300">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-blue-100">Atingimento Geral</p>
            <div className="rounded-full bg-white/20 p-2 backdrop-blur-md">
              <Award className="h-5 w-5 text-white" />
            </div>
          </div>
          <div className="mt-4 relative z-10">
            <h3 className="text-4xl font-bold tracking-tight">{stats?.overallAchievement.toFixed(2) || '0.00'}%</h3>
            <p className="mt-1 text-sm text-blue-100/80">Progresso geral de {dimensionLabel} em {selectedGroupName}</p>
          </div>
          <div className="absolute -right-6 -top-6 h-32 w-32 rounded-full bg-white/10 blur-2xl"></div>
        </div>
      </div>
      <Card className="overflow-hidden border-none shadow-xl transition-all duration-300 hover:shadow-2xl">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <CardHeader className="border-b bg-muted/30 pb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="space-y-1">
              <CardTitle className="font-headline text-lg">Visão Geral de Desempenho</CardTitle>
              <CardDescription>Meta vs. Realizado estratificado por dimensões da empresa nos períodos selecionados.</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Select
                value={
                  activeTab === "filiais"
                    ? selectedBranchGroupId
                    : activeTab === "vendedores"
                    ? selectedSellerGroupId
                    : selectedRoleGroupId
                }
                onValueChange={(val) => {
                  if (activeTab === "filiais") setSelectedBranchGroupId(val);
                  else if (activeTab === "vendedores") setSelectedSellerGroupId(val);
                  else setSelectedRoleGroupId(val);
                }}
              >
                <SelectTrigger className="w-[200px] h-10 bg-background/85 shadow-sm border-border/50 font-medium">
                  <SelectValue placeholder="Selecione o período" />
                </SelectTrigger>
                <SelectContent>
                  {periodGroups.map((group) => {
                    const status = getGroupStatus(group).text;
                    return (
                      <SelectItem key={group.id} value={group.id}>
                        {group.name} {status ? `(${status})` : ""}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>

              <TabsList className="bg-background/80 shadow-sm border border-border/50">
                <TabsTrigger value="filiais">Filiais</TabsTrigger>
                <TabsTrigger value="vendedores">Vendedores</TabsTrigger>
                <TabsTrigger value="funcoes">Funções</TabsTrigger>
              </TabsList>
            </div>
          </CardHeader>
          <CardContent className="pt-6 pl-2">
            <TabsContent value="filiais" className="mt-0">
                {branchChartData.length > 0 ? (
                     <ResponsiveContainer width="100%" height={350}>
                        <BarChart data={branchChartData}>
                            <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false}/>
                            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => formatCurrency(value as number)}/>
                            <Tooltip
                                cursor={{ fill: "hsl(var(--card-foreground), 0.1)" }}
                                content={({ active, payload, label }) => {
                                    if (active && payload && payload.length) {
                                    return (
                                        <div className="rounded-lg border bg-background p-2 shadow-sm">
                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="flex flex-col space-y-1">
                                            <span className="text-[0.70rem] uppercase text-muted-foreground">{label}</span>
                                            <span className="font-bold text-muted-foreground">Meta</span>
                                            <span className="font-bold">{formatCurrency(payload[0].value as number)}</span>
                                            </div>
                                            <div className="flex flex-col space-y-1">
                                                <span className="text-[0.70rem] uppercase text-muted-foreground">&nbsp;</span>
                                                <span className="font-bold text-muted-foreground">Realizado</span>
                                                <span className="font-bold text-primary">{formatCurrency(payload[1].value as number)}</span>
                                            </div>
                                        </div>
                                        </div>
                                    )
                                    }
                                    return null
                                }}
                            />
                            <Legend />
                            <Bar dataKey="meta" name="Meta" fill="hsl(var(--secondary))" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="realizado" name="Realizado" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="flex h-[350px] flex-col items-center justify-center">
                        <Frown className="h-12 w-12 text-muted-foreground" />
                        <p className="mt-4 text-muted-foreground">Nenhum dado de meta de filial para exibir.</p>
                    </div>
                )}
            </TabsContent>
            
            <TabsContent value="vendedores" className="mt-0">
                {chartData.length > 0 ? (
                     <ResponsiveContainer width="100%" height={350}>
                        <BarChart data={chartData}>
                            <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false}/>
                            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => formatCurrency(value as number)}/>
                            <Tooltip
                                cursor={{ fill: "hsl(var(--card-foreground), 0.1)" }}
                                content={({ active, payload, label }) => {
                                    if (active && payload && payload.length) {
                                    return (
                                        <div className="rounded-lg border bg-background p-2 shadow-sm">
                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="flex flex-col space-y-1">
                                            <span className="text-[0.70rem] uppercase text-muted-foreground">{label}</span>
                                            <span className="font-bold text-muted-foreground">Meta</span>
                                            <span className="font-bold">{formatCurrency(payload[0].value as number)}</span>
                                            </div>
                                            <div className="flex flex-col space-y-1">
                                                <span className="text-[0.70rem] uppercase text-muted-foreground">&nbsp;</span>
                                                <span className="font-bold text-muted-foreground">Realizado</span>
                                                <span className="font-bold text-primary">{formatCurrency(payload[1].value as number)}</span>
                                            </div>
                                        </div>
                                        </div>
                                    )
                                    }
                                    return null
                                }}
                            />
                            <Legend />
                            <Bar dataKey="meta" name="Meta" fill="hsl(var(--secondary))" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="realizado" name="Realizado" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="flex h-[350px] flex-col items-center justify-center">
                        <Frown className="h-12 w-12 text-muted-foreground" />
                        <p className="mt-4 text-muted-foreground">Nenhum dado de meta para exibir.</p>
                    </div>
                )}
            </TabsContent>

            <TabsContent value="funcoes" className="mt-0">
                {roleChartData.length > 0 ? (
                     <ResponsiveContainer width="100%" height={350}>
                        <BarChart data={roleChartData}>
                            <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false}/>
                            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => formatCurrency(value as number)}/>
                            <Tooltip
                                cursor={{ fill: "hsl(var(--card-foreground), 0.1)" }}
                                content={({ active, payload, label }) => {
                                    if (active && payload && payload.length) {
                                    return (
                                        <div className="rounded-lg border bg-background p-2 shadow-sm">
                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="flex flex-col space-y-1">
                                            <span className="text-[0.70rem] uppercase text-muted-foreground">{label}</span>
                                            <span className="font-bold text-muted-foreground">Meta</span>
                                            <span className="font-bold">{formatCurrency(payload[0].value as number)}</span>
                                            </div>
                                            <div className="flex flex-col space-y-1">
                                                <span className="text-[0.70rem] uppercase text-muted-foreground">&nbsp;</span>
                                                <span className="font-bold text-muted-foreground">Realizado</span>
                                                <span className="font-bold text-primary">{formatCurrency(payload[1].value as number)}</span>
                                            </div>
                                        </div>
                                        </div>
                                    )
                                    }
                                    return null
                                }}
                            />
                            <Legend />
                            <Bar dataKey="meta" name="Meta" fill="hsl(var(--secondary))" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="realizado" name="Realizado" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="flex h-[350px] flex-col items-center justify-center">
                        <Frown className="h-12 w-12 text-muted-foreground" />
                        <p className="mt-4 text-muted-foreground">Nenhum dado de meta de função para exibir.</p>
                    </div>
                )}
            </TabsContent>
          </CardContent>
        </Tabs>
      </Card>

      {/* Resultado das Filiais Separadamente */}
      <Card className="overflow-hidden border-none shadow-xl hover:shadow-2xl transition-all duration-300">
          <CardHeader className="pb-4 border-b border-border/50">
              <CardTitle className="font-headline text-xl flex items-center gap-2">
                  <GitFork className="h-5 w-5 text-primary" />
                  Resultado das Filiais
              </CardTitle>
              <CardDescription>
                  Acompanhamento das metas mercantil e atingimento por nível de cada filial em {selectedBranchGroupName}.
              </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
              {branchPerformanceData.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {branchPerformanceData.map(({ branch, goals: branchGoals, overallAchievement }) => (
                          <div key={branch.id} className="relative rounded-2xl border bg-background/50 p-5 space-y-4 shadow-sm hover:shadow-md hover:border-primary/30 transition-all overflow-hidden">
                              {/* Top colored accent bar */}
                              <div className={`absolute top-0 left-0 right-0 h-1.5 ${
                                  overallAchievement >= 100 ? 'bg-gradient-to-r from-emerald-400 to-emerald-600' :
                                  overallAchievement >= 75  ? 'bg-gradient-to-r from-blue-400 to-blue-600' :
                                  overallAchievement >= 50  ? 'bg-gradient-to-r from-amber-400 to-amber-600' :
                                  'bg-gradient-to-r from-rose-400 to-rose-600'
                              }`} />

                              <div className="flex items-center justify-between">
                                  <div>
                                      <h4 className="font-bold text-lg text-foreground flex items-center gap-2">
                                          {branch.name}
                                      </h4>
                                      <p className="text-xs text-muted-foreground">
                                          {branchGoals.length} meta{branchGoals.length !== 1 ? 's' : ''} mercantil
                                      </p>
                                  </div>
                                  <Badge variant="secondary" className={`font-bold text-xs px-2.5 py-1 rounded-full border ${
                                      overallAchievement >= 100 ? 'bg-emerald-500/10 text-emerald-600 border-emerald-200' :
                                      overallAchievement >= 75  ? 'bg-blue-500/10 text-blue-600 border-blue-200' :
                                      overallAchievement >= 50  ? 'bg-amber-500/10 text-amber-600 border-amber-200' :
                                      'bg-rose-500/10 text-rose-600 border-rose-200'
                                  }`}>
                                      Média: {overallAchievement.toFixed(1)}%
                                  </Badge>
                              </div>

                              <div className="space-y-4 divide-y divide-border/50">
                                  {branchGoals.map(({ goal, goalType, realizado, targetValue, achievement, levelAchievements, achievedLevel, nextLevel }) => {
                                      return (
                                          <div key={goal.id} className="space-y-3 pt-3 first:pt-0 first:border-t-0">
                                              <div className="flex items-center justify-between text-sm">
                                                  <span className="font-bold text-primary">{goalType.name}</span>
                                                  <span className="font-mono text-xs text-muted-foreground">
                                                      Realizado: <span className="font-bold text-foreground">{formatCurrency(realizado)}</span>
                                                  </span>
                                              </div>

                                              {goal.hasLevels && goal.levelTargets ? (
                                                  <div className="space-y-2.5">
                                                      {/* Levels grid */}
                                                      <div className="grid grid-cols-4 gap-1.5">
                                                          {(['Bronze', 'Prata', 'Ouro', 'Diamante'] as const).map(lvl => {
                                                              const lvlTarget = goal.levelTargets?.[lvl] || 0;
                                                              const isAchieved = realizado >= lvlTarget && lvlTarget > 0;

                                                              return (
                                                                  <div
                                                                      key={lvl}
                                                                      className={`flex flex-col items-center justify-center p-1.5 rounded-xl border text-center transition-all ${
                                                                          isAchieved
                                                                              ? lvl === 'Bronze' ? 'bg-orange-500/10 border-orange-200 text-orange-700 font-semibold' :
                                                                                lvl === 'Prata' ? 'bg-slate-500/10 border-slate-200 text-slate-700 font-semibold' :
                                                                                lvl === 'Ouro' ? 'bg-yellow-500/10 border-yellow-200 text-yellow-700 font-semibold' :
                                                                                'bg-sky-500/10 border-sky-200 text-sky-700 font-semibold'
                                                                              : 'bg-muted/10 border-border/50 text-muted-foreground/60 opacity-60'
                                                                      }`}
                                                                  >
                                                                      <span className="text-[9px] uppercase font-bold tracking-wider flex items-center gap-0.5">
                                                                          {lvl === 'Bronze' && <Medal className="h-3 w-3 text-orange-600" />}
                                                                          {lvl === 'Prata' && <Trophy className="h-3 w-3 text-slate-500" />}
                                                                          {lvl === 'Ouro' && <Award className="h-3 w-3 text-yellow-500" />}
                                                                          {lvl === 'Diamante' && <Gem className="h-3 w-3 text-sky-400" />}
                                                                          {lvl}
                                                                      </span>
                                                                      <span className="text-[9px] mt-0.5 font-mono">{formatCurrency(lvlTarget)}</span>
                                                                  </div>
                                                              );
                                                          })}
                                                      </div>

                                                      {/* Progress bar showing progress to next level */}
                                                      <div className="space-y-1">
                                                          <div className="flex justify-between text-xs text-muted-foreground">
                                                              <span>
                                                                  {achievedLevel ? (
                                                                      <span className="flex items-center gap-1 font-medium text-emerald-600">
                                                                          ✓ Nível {achievedLevel} Atingido
                                                                      </span>
                                                                  ) : (
                                                                      <span>Nenhum nível atingido</span>
                                                                  )}
                                                              </span>
                                                              <span>
                                                                  {nextLevel ? (
                                                                      <span>Próximo: <span className="font-semibold text-primary">{nextLevel.name}</span> ({((realizado / nextLevel.value) * 100).toFixed(0)}%)</span>
                                                                  ) : (
                                                                      <span className="text-sky-600 font-bold">★ Nível Diamante!</span>
                                                                  )}
                                                              </span>
                                                          </div>
                                                          <Progress
                                                              value={nextLevel ? Math.min(100, (realizado / nextLevel.value) * 100) : 100}
                                                              className={`h-1.5 ${
                                                                  nextLevel
                                                                      ? nextLevel.name === 'Bronze' ? '[&>div]:bg-orange-500' :
                                                                        nextLevel.name === 'Prata' ? '[&>div]:bg-slate-500' :
                                                                        nextLevel.name === 'Ouro' ? '[&>div]:bg-yellow-500' :
                                                                        '[&>div]:bg-sky-400'
                                                                      : '[&>div]:bg-emerald-500'
                                                              }`}
                                                          />
                                                      </div>
                                                  </div>
                                              ) : (
                                                  <div className="space-y-1.5">
                                                      <div className="flex justify-between text-xs text-muted-foreground">
                                                          <span>Alvo: {formatCurrency(targetValue)}</span>
                                                          <span>Atingimento: {achievement.toFixed(1)}%</span>
                                                      </div>
                                                      <Progress
                                                          value={achievement}
                                                          className={`h-1.5 ${
                                                              achievement >= 100 ? '[&>div]:bg-emerald-500' :
                                                              achievement >= 75  ? '[&>div]:bg-blue-500' :
                                                              achievement >= 50  ? '[&>div]:bg-amber-500' :
                                                              '[&>div]:bg-rose-500'
                                                          }`}
                                                      />
                                                  </div>
                                              )}
                                          </div>
                                      );
                                  })}
                              </div>
                          </div>
                      ))}
                  </div>
              ) : (
                  <div className="flex h-48 flex-col items-center justify-center bg-muted/10 rounded-2xl">
                      <Frown className="h-10 w-10 text-muted-foreground/50" />
                      <p className="mt-4 text-center text-sm font-medium text-muted-foreground/70">
                          Nenhum dado de filiais para exibir neste período.
                      </p>
                  </div>
              )}
          </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="overflow-hidden border-none shadow-xl hover:shadow-2xl transition-all duration-300 relative flex flex-col">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full pointer-events-none"></div>
                <CardHeader className="pb-2">
                    <CardTitle className="font-headline text-xl flex items-center gap-2">
                        <Award className="h-5 w-5 text-yellow-500" />
                        Top 5 Vendedores
                    </CardTitle>
                    <CardDescription>Maior % de atingimento nas metas de mercantil em {selectedGroupName}.</CardDescription>
                </CardHeader>
                <CardContent className="p-0 flex-1">
                    {topSellers.length > 0 ? (
                        <div className="divide-y divide-border/50">
                        {topSellers.map(({ seller, achievement, roleName }, index) => (
                            <div key={seller.id} className="group flex items-center p-5 transition-colors hover:bg-muted/50">
                            <div className={`flex h-8 w-8 items-center justify-center rounded-full font-bold mr-4 transition-transform group-hover:scale-110 shadow-sm
                                ${index === 0 ? 'bg-yellow-100 text-yellow-600 ring-2 ring-yellow-200' : 
                                  index === 1 ? 'bg-slate-200 text-slate-500 ring-2 ring-slate-300' : 
                                  index === 2 ? 'bg-amber-100 text-amber-700 ring-2 ring-amber-200' : 
                                  'bg-primary/10 text-primary'}`}>
                                #{index + 1}
                            </div>
                            <Avatar className="h-12 w-12 ring-2 ring-background shadow-sm transition-transform group-hover:-translate-y-1">
                                <AvatarImage src={seller.avatarUrl} alt={seller.name} data-ai-hint="people avatar"/>
                                <AvatarFallback className="bg-primary/20">{seller.name?.charAt(0) || 'U'}</AvatarFallback>
                            </Avatar>
                            <div className="ml-4 flex-1 space-y-1">
                                <p className="text-base font-semibold leading-none group-hover:text-primary transition-colors">{seller.name}</p>
                                <p className="text-sm text-muted-foreground">{roleName}</p>
                            </div>
                            <div className="flex flex-col items-end">
                                <span className="font-bold text-lg text-primary">{Math.max(0, achievement).toFixed(2)}%</span>
                                <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Atingido</span>
                            </div>
                            </div>
                        ))}
                        </div>
                    ) : (
                        <div className="flex h-64 flex-col items-center justify-center bg-muted/10 rounded-b-xl">
                            <Users className="h-12 w-12 text-muted-foreground/50" />
                            <p className="mt-4 text-center text-sm font-medium text-muted-foreground/70">Nenhum vendedor classificado.</p>
                        </div>
                    )}
                </CardContent>
            </Card>
            
            <Card className="overflow-hidden border-none shadow-xl hover:shadow-2xl transition-all duration-300 flex flex-col relative">
                <div className="absolute bottom-0 right-0 w-32 h-32 bg-primary/5 rounded-tl-full pointer-events-none"></div>
                <CardHeader className="pb-4 border-b border-border/50">
                    <CardTitle className="font-headline text-xl flex items-center gap-2">
                        <Rocket className="h-5 w-5 text-primary" />
                        Metas em Destaque
                    </CardTitle>
                    <CardDescription>Metas em {selectedGroupName} próximas do objetivo (75% ou mais).</CardDescription>
                </CardHeader>
                <CardContent className="p-5 flex-1 bg-muted/10">
                    {highlightedGoals.length > 0 ? (
                        <div className="grid grid-cols-1 gap-4">
                            {highlightedGoals.map(({ goal, goalType, seller, achievement }) => (
                                <div key={goal.id} className="group relative overflow-hidden rounded-xl border bg-background/80 backdrop-blur-sm p-5 shadow-sm transition-all hover:shadow-md hover:border-primary/50">
                                    <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100 pointer-events-none"></div>
                                    <div className="flex items-start justify-between relative z-10">
                                        <div className="space-y-1">
                                            <p className="font-bold text-foreground group-hover:text-primary transition-colors">{goalType.name}</p>
                                            <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                                <Avatar className="h-5 w-5"><AvatarFallback className="text-[10px] bg-primary/20">{seller.name?.charAt(0)}</AvatarFallback></Avatar>
                                                {seller.name}
                                            </p>
                                        </div>
                                        <Badge variant="secondary" className="bg-primary/10 text-primary font-bold shadow-sm">{achievement.toFixed(1)}%</Badge>
                                    </div>
                                    <div className="mt-4 space-y-2 relative z-10">
                                        <Progress value={achievement} className="h-3" />
                                        <div className="flex justify-between text-sm font-medium">
                                            <span className="text-muted-foreground">Arrecadado: <span className="text-foreground">{formatCurrency(goal.realizado || 0)}</span></span>
                                            <span className="text-muted-foreground">Alvo: <span className="text-foreground">{formatCurrency(goal.levelTargets?.Diamante || 0)}</span></span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex h-64 flex-col items-center justify-center">
                            <Target className="h-12 w-12 text-muted-foreground/50" />
                            <p className="mt-4 text-center text-sm font-medium text-muted-foreground/70">Nenhuma meta próxima de ser alcançada.</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    </div>
  )
}
