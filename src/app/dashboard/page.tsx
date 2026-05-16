
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
import { Users, Target, TrendingUp, Award, Loader2, Frown, Rocket, GitFork, BriefcaseBusiness } from "lucide-react"
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
  const [stats, setStats] = React.useState<DashboardStats | null>(null);
  const [chartData, setChartData] = React.useState<ChartData[]>([]);
  const [branchChartData, setBranchChartData] = React.useState<ChartData[]>([]);
  const [roleChartData, setRoleChartData] = React.useState<ChartData[]>([]);
  const [topSellers, setTopSellers] = React.useState<TopSeller[]>([]);
  const [highlightedGoals, setHighlightedGoals] = React.useState<HighlightedGoal[]>([]);

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
        
        const goals = goalsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Goal));
        const goalTypes = goalTypesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as GoalType));
        const users = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as User));
        const roles = rolesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Role));
        const periodGroups = periodGroupsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as PeriodGroup));
        const branches = branchesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Branch));
        
        // --- Process Data for Dashboard ---
        const activeGroup = periodGroups.find(g => getGroupStatus(g).text === "Ativo");
        const activePeriodIds = activeGroup ? activeGroup.periods.map(p => p.id) : [];

        const activeGoals = goals.filter(g => activePeriodIds.includes(g.periodId));
        
        const isMercantilType = (gt: GoalType) => gt.name.toLowerCase().includes('mercantil');

        // 1. Dashboard Stats
        const mercantilGoalsForSellers = activeGoals.filter(g => {
            const goalType = goalTypes.find(gt => gt.id === g.goalTypeId);
            return goalType && isMercantilType(goalType) && g.userId;
        });

        const totalTarget = mercantilGoalsForSellers.reduce((sum, goal) => {
            let target = goal.targetValue || 0;
            if (goal.hasLevels && goal.levelTargets) {
                target = goal.levelTargets.Diamante || 0;
            }
            return sum + target;
        }, 0);
        
        const totalAchieved = mercantilGoalsForSellers.reduce((sum, goal) => sum + (goal.realizado || 0), 0);

        const overallAchievement = totalTarget > 0 ? (totalAchieved / totalTarget) * 100 : 0;
        
        setStats({
          activeGoals: activeGoals.length,
          totalTarget,
          totalAchieved,
          overallAchievement
        });

        // 2. Chart Data for Sellers
        const dataForChart = goalTypes.map(goalType => {
            const goalsForType = activeGoals.filter(g => g.goalTypeId === goalType.id && !!g.userId);
            
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
        
        setChartData(dataForChart);
        
        // 2.5 Chart Data for Branches
        const dataForBranchChart = goalTypes.map(goalType => {
            const goalsForType = activeGoals.filter(g => g.goalTypeId === goalType.id && !!g.branchId);

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
        
        setBranchChartData(dataForBranchChart);

        // 2.6 Chart Data for Roles
        const dataForRoleChart = goalTypes.map(goalType => {
            const goalsForType = activeGoals.filter(g => g.goalTypeId === goalType.id && g.roleId && !g.userId && !g.branchId);

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
        
        setRoleChartData(dataForRoleChart);


        // 3. Top Sellers
        const sellerPerformance: { [sellerId: string]: { totalRealizado: number; totalMeta: number } } = {};
        
        const allSellers = users.filter(u => u.roleId);

        allSellers.forEach(seller => {
            const sellerGoals = activeGoals.filter(g => 
                (g.userId === seller.id || (g.roleId === seller.roleId && !g.userId && !g.branchId))
            );

            if (sellerGoals.length === 0) return;

            const totals = sellerGoals.reduce((acc, goal) => {
                const goalType = goalTypes.find(gt => gt.id === goal.goalTypeId);
                if (!goalType || !isMercantilType(goalType)) return acc;

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
        
        const topSellersList = Object.entries(sellerPerformance)
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
                }
            })
            .filter(item => item.seller)
            .sort((a, b) => b.achievement - a.achievement)
            .slice(0, 5);
        setTopSellers(topSellersList);
        
        // 4. Highlighted Goals (near completion)
        const highlighted = activeGoals
            .map(goal => {
                const goalType = goalTypes.find(gt => gt.id === goal.goalTypeId);
                const seller = users.find(u => u.id === goal.userId);
                if (!goalType || !seller || !goal.hasLevels || !goal.levelTargets) return null;

                const target = goal.levelTargets.Diamante || 0;
                
                if (target === 0) return null;
                
                const achievement = ((goal.realizado || 0) / target) * 100;
                
                return { goal, goalType, seller, achievement };
            })
            .filter(item => item && item.achievement >= 75 && item.achievement < 100) // Between 75% and 99.9%
            .sort((a, b) => b!.achievement - a!.achievement)
            .slice(0, 5) as HighlightedGoal[];
        
        setHighlightedGoals(highlighted);


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
            <p className="text-sm font-medium text-indigo-100">Metas Ativas</p>
            <div className="rounded-full bg-white/20 p-2 backdrop-blur-md">
              <Target className="h-5 w-5 text-white" />
            </div>
          </div>
          <div className="mt-4 relative z-10">
            <h3 className="text-4xl font-bold tracking-tight">{stats?.activeGoals || 0}</h3>
            <p className="mt-1 text-sm text-indigo-100/80">Metas em períodos ativos</p>
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
            <p className="mt-1 text-sm text-emerald-100/80">Soma de valores realizados</p>
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
            <p className="mt-1 text-sm text-rose-100/80">Alvo total dos vendedores</p>
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
            <p className="mt-1 text-sm text-blue-100/80">Progresso geral da operação</p>
          </div>
          <div className="absolute -right-6 -top-6 h-32 w-32 rounded-full bg-white/10 blur-2xl"></div>
        </div>
      </div>
      <Card className="overflow-hidden border-none shadow-xl transition-all duration-300 hover:shadow-2xl">
        <Tabs defaultValue="filiais" className="w-full">
          <CardHeader className="border-b bg-muted/30 pb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="space-y-1">
              <CardTitle className="font-headline text-lg">Visão Geral de Desempenho</CardTitle>
              <CardDescription>Meta vs. Realizado estratificado por dimensões da empresa nos períodos ativos.</CardDescription>
            </div>
            <TabsList className="bg-background/80 shadow-sm border border-border/50">
              <TabsTrigger value="filiais">Filiais</TabsTrigger>
              <TabsTrigger value="vendedores">Vendedores</TabsTrigger>
              <TabsTrigger value="funcoes">Funções</TabsTrigger>
            </TabsList>
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="overflow-hidden border-none shadow-xl hover:shadow-2xl transition-all duration-300 relative flex flex-col">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full pointer-events-none"></div>
                <CardHeader className="pb-2">
                    <CardTitle className="font-headline text-xl flex items-center gap-2">
                        <Award className="h-5 w-5 text-yellow-500" />
                        Top 5 Vendedores
                    </CardTitle>
                    <CardDescription>Maior % de atingimento nas metas de mercantil.</CardDescription>
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
                    <CardDescription>Metas que estão próximas de serem alcançadas (75% ou mais).</CardDescription>
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
