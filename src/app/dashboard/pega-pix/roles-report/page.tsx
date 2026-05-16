
"use client";

import * as React from "react";
import {
  Loader2,
  Trophy,
  Award,
  Gem,
  Crown,
  RefreshCw,
  BriefcaseBusiness,
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
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import type { PegaPixGoal, PegaPixAward, Role, GoalLevelTargets, PeriodGroup } from "@/lib/definitions";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { getGroupStatus } from "@/lib/period-helpers";
import { Button } from "@/components/ui/button";

const orderedLevels: Array<keyof GoalLevelTargets> = ['Bronze', 'Prata', 'Ouro', 'Diamante'];

const levelConfig: Record<keyof GoalLevelTargets, { icon: React.ReactNode, color: string, glow: string }> = {
    Bronze: { icon: <Trophy className="h-5 w-5" />, color: "text-orange-600", glow: "shadow-orange-500/50" },
    Prata: { icon: <Trophy className="h-5 w-5" />, color: "text-slate-400", glow: "shadow-slate-400/50" },
    Ouro: { icon: <Award className="h-5 w-5" />, color: "text-yellow-400", glow: "shadow-yellow-400/60" },
    Diamante: { icon: <Gem className="h-5 w-5" />, color: "text-sky-400", glow: "shadow-sky-300/60" },
};

type RoleResult = {
  role: Role;
  goals: PegaPixGoal[];
  totalRealizado: number;
  achievedLevel: keyof GoalLevelTargets | null;
  nextLevel: keyof GoalLevelTargets | null;
  progressToNextLevel: number;
  awardValue: number;
  remainingForNextLevel: number;
};

export default function PegaPixRolesReportPage() {
  const { toast } = useToast();
  const [results, setResults] = React.useState<RoleResult[]>([]);
  const [loading, setLoading] = React.useState(true);
  
  const [allData, setAllData] = React.useState<{
    goals: PegaPixGoal[],
    awards: PegaPixAward[],
    roles: Role[],
    periodGroups: PeriodGroup[],
  } | null>(null);

  const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const processData = React.useCallback(() => {
    if (!allData) return;
    
    const { goals, awards, roles, periodGroups } = allData;
    
    const activePeriodGroupIds = periodGroups
        .filter(g => getGroupStatus(g).text === 'Ativo')
        .map(g => g.id);

    let filteredGoals = goals.filter(g => activePeriodGroupIds.includes(g.periodGroupId));
    
    const roleGoals = filteredGoals.filter(g => g.responsibleType === 'role');
    
    const resultsByRole = new Map<string, RoleResult>();

    for (const goal of roleGoals) {
        const role = roles.find(r => r.id === goal.responsibleId);
        if (!role) continue;

        if (!resultsByRole.has(role.id)) {
             resultsByRole.set(role.id, {
                role,
                goals: [],
                totalRealizado: 0,
                achievedLevel: null,
                nextLevel: null,
                progressToNextLevel: 0,
                awardValue: 0,
                remainingForNextLevel: 0,
             });
        }

        const roleResult = resultsByRole.get(role.id)!;
        roleResult.goals.push(goal);
        roleResult.totalRealizado += goal.realizado || 0;
    }

    const finalResults = Array.from(resultsByRole.values()).map(roleResult => {
        const { goals, totalRealizado } = roleResult;

        const combinedLevels: GoalLevelTargets = goals.reduce((acc, goal) => {
            (Object.keys(goal.levels) as Array<keyof GoalLevelTargets>).forEach(level => {
                acc[level] = (acc[level] || 0) + goal.levels[level];
            });
            return acc;
        }, { Bronze: 0, Prata: 0, Ouro: 0, Diamante: 0 });
        
        let achievedLevel: keyof GoalLevelTargets | null = null;
        for (let i = orderedLevels.length - 1; i >= 0; i--) {
            const level = orderedLevels[i];
            if (combinedLevels[level] > 0 && totalRealizado >= combinedLevels[level]) {
                achievedLevel = level;
                break;
            }
        }
        
        const responsibleAward = awards.find(a => 
            a.responsibleType === 'role' && 
            a.responsibleIds.includes(roleResult.role.id)
        );

        const awardValue = (achievedLevel && responsibleAward) ? responsibleAward.levels[achievedLevel] : 0;
        
        let nextLevel: keyof GoalLevelTargets | null = null;
        let progressToNextLevel = 0;
        let remainingForNextLevel = 0;

        const achievedLevelIndex = achievedLevel ? orderedLevels.indexOf(achievedLevel) : -1;
        const nextLevelIndex = achievedLevelIndex + 1;

        if (nextLevelIndex < orderedLevels.length) {
            nextLevel = orderedLevels[nextLevelIndex];
            const nextLevelTarget = combinedLevels[nextLevel];
            const previousLevelTarget = achievedLevel ? combinedLevels[achievedLevel] : 0;
            
            const range = nextLevelTarget - previousLevelTarget;
            const progressInRange = totalRealizado - previousLevelTarget;
            progressToNextLevel = range > 0 ? (progressInRange / range) * 100 : 0;
            remainingForNextLevel = Math.max(0, nextLevelTarget - totalRealizado);
        } else {
             progressToNextLevel = 100;
        }

        return {
            ...roleResult,
            achievedLevel,
            nextLevel,
            progressToNextLevel: Math.min(100, progressToNextLevel),
            awardValue,
            remainingForNextLevel,
        };
    });

    finalResults.sort((a, b) => {
      if (b.awardValue !== a.awardValue) {
        return b.awardValue - a.awardValue;
      }
      return b.progressToNextLevel - a.progressToNextLevel;
    })

    setResults(finalResults);
  }, [allData]);

  const fetchData = React.useCallback(async () => {
    try {
      setLoading(true);
      const [goalsSnap, awardsSnap, rolesSnap, periodsSnap] = await Promise.all([
        getDocs(query(collection(db, "pegaPixGoals"))),
        getDocs(query(collection(db, "pegaPixAwards"))),
        getDocs(query(collection(db, "roles"))),
        getDocs(collection(db, "periodgroups")),
      ]);
      
      const goals = goalsSnap.docs.map(d => ({id: d.id, ...d.data()}) as PegaPixGoal);
      const awards = awardsSnap.docs.map(d => ({id: d.id, ...d.data()}) as PegaPixAward);
      const roles = rolesSnap.docs.map(d => ({id: d.id, ...d.data()}) as Role);
      const periodGroups = periodsSnap.docs.map(d => ({id: d.id, ...d.data()}) as PeriodGroup);

      setAllData({ goals, awards, roles, periodGroups } as any);
      
    } catch (error) {
      toast({ title: "Erro ao buscar dados", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);
  
  React.useEffect(() => {
    if(!loading) {
        processData();
    }
  }, [loading, processData])

  const LeaderboardCard = ({ result, rank }: { result: RoleResult, rank: number }) => {
    const { role, achievedLevel, awardValue, nextLevel, progressToNextLevel, remainingForNextLevel } = result;
    
    const config = achievedLevel ? levelConfig[achievedLevel] : null;
    const isTopTier = achievedLevel === 'Diamante' || achievedLevel === 'Ouro';
    const hasAward = awardValue > 0;
    
    return (
        <Card className={cn(
            "relative overflow-hidden transition-all duration-300 hover:shadow-lg",
            isTopTier && "shadow-lg",
            isTopTier && config?.glow,
        )}>
            {rank < 3 && (
                 <div className="absolute top-2 right-2 text-primary">
                    <Crown className={cn(
                        "h-8 w-8",
                        rank === 0 && "text-yellow-400",
                        rank === 1 && "text-slate-400",
                        rank === 2 && "text-orange-500",
                    )}/>
                 </div>
            )}
            <CardContent className="p-6 flex flex-col items-center text-center">
                 <div className="flex h-24 w-24 items-center justify-center rounded-full bg-muted border-4 border-muted mb-4">
                    <BriefcaseBusiness className="h-12 w-12 text-muted-foreground" />
                 </div>
                <h3 className="text-xl font-bold text-card-foreground">{role.name}</h3>
                
                <div className="my-6">
                    <p className="text-sm text-muted-foreground">Prêmio Alcançado</p>
                    <p className={cn(
                        "text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r",
                        hasAward ? "from-green-400 to-emerald-600" : "from-muted-foreground to-muted-foreground/80"
                    )}>
                        {formatCurrency(awardValue)}
                    </p>
                </div>
                
                 {achievedLevel && config && (
                    <Badge variant="outline" className={cn("text-base py-1 px-4 mb-6 gap-2 border-2", config.color)}>
                        {config.icon}
                        Nível {achievedLevel}
                    </Badge>
                )}

                {nextLevel && (
                    <div className="w-full text-center mt-auto">
                        <p className="text-xs text-muted-foreground mb-1">Progresso para o próximo nível: {nextLevel}</p>
                        <Progress value={progressToNextLevel} />
                        <p className="text-xs text-muted-foreground mt-1">Faltam <span className="font-semibold text-foreground">{formatCurrency(remainingForNextLevel)}</span></p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
        <div className="relative text-center py-10 md:py-16 rounded-lg overflow-hidden bg-card border">
             <div className="absolute inset-0 -z-10 h-full w-full bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/70">
                PEGA PIX
            </h1>
            <p className="text-muted-foreground mt-2">Ranking por Função (Períodos Ativos)</p>
        </div>
        
        <div className="flex justify-end items-center gap-2">
            <Button variant="outline" size="icon" onClick={fetchData} disabled={loading}>
              <RefreshCw className={loading ? 'animate-spin h-4 w-4' : 'h-4 w-4'}/>
            </Button>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {results.map((result, index) => (
                <LeaderboardCard key={`${result.role.id}`} result={result} rank={index} />
            ))}
             {results.length === 0 && (
              <div className="col-span-full text-center text-muted-foreground py-16">
                  Nenhum resultado encontrado para os períodos ativos.
              </div>
            )}
          </div>
        )}
    </div>
  );
}
