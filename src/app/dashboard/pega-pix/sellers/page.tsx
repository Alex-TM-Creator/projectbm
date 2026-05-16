
"use client";

import * as React from "react";
import {
  Loader2,
  Trophy,
  Award,
  Gem,
  Crown,
  Medal,
  RefreshCw,
  Sparkles,
  TrendingUp,
  ChevronUp,
} from "lucide-react";
import {
  collection,
  getDocs,
  query,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import type { PegaPixGoal, PegaPixAward, User, Role, GoalLevelTargets, PeriodGroup } from "@/lib/definitions";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { getGroupStatus } from "@/lib/period-helpers";
import { Button } from "@/components/ui/button";

const orderedLevels: Array<keyof GoalLevelTargets> = ['Bronze', 'Prata', 'Ouro', 'Diamante'];

const levelConfig: Record<keyof GoalLevelTargets, {
  icon: React.ReactNode;
  color: string;
  bg: string;
  border: string;
  glow: string;
  gradient: string;
  progressColor: string;
}> = {
  Bronze: {
    icon: <Medal className="h-4 w-4" />,
    color: "text-orange-500",
    bg: "bg-orange-500/10",
    border: "border-orange-500/30",
    glow: "shadow-orange-500/20",
    gradient: "from-orange-600 to-amber-500",
    progressColor: "[&>div]:bg-orange-500",
  },
  Prata: {
    icon: <Trophy className="h-4 w-4" />,
    color: "text-slate-400",
    bg: "bg-slate-400/10",
    border: "border-slate-400/30",
    glow: "shadow-slate-400/20",
    gradient: "from-slate-400 to-gray-300",
    progressColor: "[&>div]:bg-slate-400",
  },
  Ouro: {
    icon: <Award className="h-4 w-4" />,
    color: "text-yellow-400",
    bg: "bg-yellow-400/10",
    border: "border-yellow-400/30",
    glow: "shadow-yellow-400/30",
    gradient: "from-yellow-400 to-amber-300",
    progressColor: "[&>div]:bg-yellow-400",
  },
  Diamante: {
    icon: <Gem className="h-4 w-4" />,
    color: "text-sky-400",
    bg: "bg-sky-400/10",
    border: "border-sky-400/30",
    glow: "shadow-sky-400/30",
    gradient: "from-sky-400 to-cyan-300",
    progressColor: "[&>div]:bg-sky-400",
  },
};

const rankConfig = [
  { crown: "text-yellow-400", bg: "from-yellow-400/20 via-amber-300/10 to-transparent", border: "border-yellow-400/40", label: "1º" },
  { crown: "text-slate-400", bg: "from-slate-400/20 via-gray-300/10 to-transparent", border: "border-slate-400/40", label: "2º" },
  { crown: "text-orange-500", bg: "from-orange-500/20 via-amber-700/10 to-transparent", border: "border-orange-500/40", label: "3º" },
];

type SellerResult = {
  user: User;
  roleName: string;
  goals: PegaPixGoal[];
  totalRealizado: number;
  achievedLevel: keyof GoalLevelTargets | null;
  nextLevel: keyof GoalLevelTargets | null;
  progressToNextLevel: number;
  awardValue: number;
  remainingForNextLevel: number;
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

// ── Pódio Top 3 ──────────────────────────────────────────────────────────────
function PodiumCard({ result, rank }: { result: SellerResult; rank: number }) {
  const { user, roleName, achievedLevel, awardValue, nextLevel, progressToNextLevel, remainingForNextLevel } = result;
  const config = achievedLevel ? levelConfig[achievedLevel] : null;
  const rc = rankConfig[rank];
  const hasAward = awardValue > 0;

  const podiumHeight = rank === 0 ? "sm:pt-0" : rank === 1 ? "sm:pt-8" : "sm:pt-14";
  const avatarSize = rank === 0 ? "h-20 w-20 sm:h-24 sm:w-24" : "h-16 w-16 sm:h-20 sm:w-20";
  const crownSize = rank === 0 ? "h-6 w-6 sm:h-8 sm:w-8" : "h-5 w-5 sm:h-6 sm:w-6";

  return (
    <div className={cn("flex flex-col items-center gap-0", podiumHeight)}>
      {/* Crown + rank */}
      <div className="flex flex-col items-center mb-2">
        <Crown className={cn(crownSize, rc.crown, "drop-shadow-md mb-1")} />
        <span className={cn("text-xs font-bold", rc.crown)}>{rc.label} Lugar</span>
      </div>

      {/* Card */}
      <div className={cn(
        "relative w-full rounded-2xl border backdrop-blur-sm overflow-hidden",
        "bg-gradient-to-b", rc.bg, rc.border,
        "shadow-xl transition-all duration-500 hover:scale-[1.02] hover:shadow-2xl",
        config && `hover:${config.glow}`,
        rank === 0 && "ring-2 ring-yellow-400/30"
      )}>
        {/* Sparkle top-right for first place */}
        {rank === 0 && (
          <Sparkles className="absolute top-3 right-3 h-4 w-4 text-yellow-400 opacity-70 animate-pulse" />
        )}

        <div className="p-6 flex flex-col items-center text-center gap-3">
          <Avatar className={cn(avatarSize, "border-4", config ? config.border : "border-muted", "shadow-lg")}>
            <AvatarImage src={user.avatarUrl} alt={user.name} />
            <AvatarFallback className="text-2xl font-bold">{user.name?.charAt(0) || 'U'}</AvatarFallback>
          </Avatar>

          <div>
            <h3 className={cn("font-bold text-card-foreground", rank === 0 ? "text-xl" : "text-lg")}>{user.name}</h3>
            <p className="text-xs text-muted-foreground">{roleName}</p>
          </div>

          {/* Award value */}
          <div className="my-1">
            <p className="text-xs text-muted-foreground mb-0.5">Prêmio</p>
            <p className={cn(
              "font-extrabold bg-clip-text text-transparent bg-gradient-to-r",
              rank === 0 ? "text-4xl" : "text-3xl",
              hasAward ? "from-green-400 to-emerald-300" : "from-muted-foreground to-muted-foreground/50"
            )}>
              {formatCurrency(awardValue)}
            </p>
          </div>

          {/* Level badge */}
          {achievedLevel && config ? (
            <span className={cn(
              "inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full border",
              config.bg, config.border, config.color
            )}>
              {config.icon}
              Nível {achievedLevel}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground italic">Sem nível</span>
          )}

          {/* Progress */}
          {nextLevel && config && (
            <div className="w-full mt-1 space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><ChevronUp className="h-3 w-3" />{nextLevel}</span>
                <span className="font-medium text-foreground">{formatCurrency(remainingForNextLevel)}</span>
              </div>
              <Progress value={progressToNextLevel} className={cn("h-1.5", config.progressColor)} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Card de linha para posições 4+ ───────────────────────────────────────────
function RankRowCard({ result, rank }: { result: SellerResult; rank: number }) {
  const { user, roleName, achievedLevel, awardValue, nextLevel, progressToNextLevel, remainingForNextLevel } = result;
  const config = achievedLevel ? levelConfig[achievedLevel] : null;
  const hasAward = awardValue > 0;

  return (
    <div className={cn(
      "flex items-center gap-4 p-4 rounded-xl border bg-card",
      "transition-all duration-300 hover:shadow-md hover:border-border/80 hover:bg-muted/30",
    )}>
      {/* rank number */}
      <span className="w-8 text-center text-sm font-bold text-muted-foreground">{rank + 1}º</span>

      <Avatar className={cn("h-10 w-10 border-2 shrink-0", config ? config.border : "border-muted")}>
        <AvatarImage src={user.avatarUrl} alt={user.name} />
        <AvatarFallback className="font-bold text-sm">{user.name?.charAt(0) || 'U'}</AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm truncate">{user.name}</p>
        <p className="text-xs text-muted-foreground">{roleName}</p>
        {nextLevel && config && (
          <div className="mt-1.5 flex items-center gap-2">
            <Progress value={progressToNextLevel} className={cn("h-1 flex-1", config.progressColor)} />
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {formatCurrency(remainingForNextLevel)} p/ {nextLevel}
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-col items-end gap-1 shrink-0">
        <p className={cn(
          "text-base font-extrabold bg-clip-text text-transparent bg-gradient-to-r",
          hasAward ? "from-green-400 to-emerald-300" : "from-muted-foreground to-muted-foreground/50"
        )}>
          {formatCurrency(awardValue)}
        </p>
        {achievedLevel && config ? (
          <span className={cn(
            "inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border",
            config.bg, config.border, config.color
          )}>
            {config.icon} {achievedLevel}
          </span>
        ) : (
          <span className="text-[10px] text-muted-foreground italic">Sem nível</span>
        )}
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function PegaPixSellersPage() {
  const { toast } = useToast();
  const [results, setResults] = React.useState<SellerResult[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [allData, setAllData] = React.useState<{
    goals: PegaPixGoal[];
    awards: PegaPixAward[];
    users: User[];
    roles: Role[];
    periodGroups: PeriodGroup[];
  } | null>(null);

  const processData = React.useCallback(() => {
    if (!allData) return;
    const { goals, awards, users, roles, periodGroups } = allData;

    const activePeriodGroupIds = periodGroups
      .filter(g => getGroupStatus(g).text === 'Ativo')
      .map(g => g.id);

    const filteredGoals = goals.filter(g => activePeriodGroupIds.includes(g.periodGroupId));
    const sellerGoals = filteredGoals.filter(g => g.responsibleType === 'user');
    const resultsBySeller = new Map<string, SellerResult>();

    for (const goal of sellerGoals) {
      const user = users.find(u => u.id === goal.responsibleId);
      if (!user) continue;
      if (!resultsBySeller.has(user.id)) {
        const roleName = roles.find(r => r.id === user.roleId)?.name || 'N/A';
        resultsBySeller.set(user.id, {
          user, roleName, goals: [], totalRealizado: 0,
          achievedLevel: null, nextLevel: null, progressToNextLevel: 0,
          awardValue: 0, remainingForNextLevel: 0,
        });
      }
      const sellerResult = resultsBySeller.get(user.id)!;
      sellerResult.goals.push(goal);
      sellerResult.totalRealizado += goal.realizado || 0;
    }

    const finalResults = Array.from(resultsBySeller.values()).map(sellerResult => {
      const { goals, totalRealizado } = sellerResult;
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
        a.responsibleType === 'user' && a.responsibleIds.includes(sellerResult.user.id)
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
        ...sellerResult,
        achievedLevel,
        nextLevel,
        progressToNextLevel: Math.min(100, progressToNextLevel),
        awardValue,
        remainingForNextLevel,
      };
    });

    finalResults.sort((a, b) =>
      b.awardValue !== a.awardValue
        ? b.awardValue - a.awardValue
        : b.progressToNextLevel - a.progressToNextLevel
    );

    setResults(finalResults);
  }, [allData]);

  const fetchData = React.useCallback(async () => {
    try {
      setLoading(true);
      const [goalsSnap, awardsSnap, usersSnap, rolesSnap, periodsSnap] = await Promise.all([
        getDocs(query(collection(db, "pegaPixGoals"))),
        getDocs(query(collection(db, "pegaPixAwards"))),
        getDocs(query(collection(db, "users"))),
        getDocs(query(collection(db, "roles"))),
        getDocs(collection(db, "periodgroups")),
      ]);
      setAllData({
        goals: goalsSnap.docs.map(d => ({ id: d.id, ...d.data() }) as PegaPixGoal),
        awards: awardsSnap.docs.map(d => ({ id: d.id, ...d.data() }) as PegaPixAward),
        users: usersSnap.docs.map(d => ({ id: d.id, ...d.data() }) as User),
        roles: rolesSnap.docs.map(d => ({ id: d.id, ...d.data() }) as Role),
        periodGroups: periodsSnap.docs.map(d => ({ id: d.id, ...d.data() }) as PeriodGroup),
      });
    } catch {
      toast({ title: "Erro ao buscar dados", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => { fetchData(); }, [fetchData]);
  React.useEffect(() => { if (!loading) processData(); }, [loading, processData]);

  const top3 = results.slice(0, 3);
  const rest = results.slice(3);

  const totalDistributed = results.reduce((acc, r) => acc + r.awardValue, 0);
  const countWithAward = results.filter(r => r.awardValue > 0).length;

  return (
    <div className="flex flex-col gap-8 pb-10">

      {/* ── Hero header ── */}
      <div className="relative rounded-2xl overflow-hidden border bg-card">
        {/* animated dot grid */}
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent" />
        <div className="absolute inset-0 -z-10 h-full w-full bg-[linear-gradient(to_right,#80808010_1px,transparent_1px),linear-gradient(to_bottom,#80808010_1px,transparent_1px)] bg-[size:20px_20px]" />

        <div className="relative px-4 sm:px-8 py-6 sm:py-10 flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-6">
          <div className="text-center sm:text-left">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-5 w-5 text-yellow-400" />
              <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Ranking ao vivo</span>
            </div>
            <h1 className="text-4xl sm:text-6xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-primary via-primary/80 to-primary/50">
              PEGA PIX
            </h1>
            <p className="text-muted-foreground mt-1 text-xs sm:text-sm">Vendedores — Períodos Ativos</p>
          </div>

          {/* Stats chips */}
          <div className="flex flex-wrap gap-2 sm:gap-3 justify-center sm:justify-end w-full sm:w-auto">
            <div className="flex flex-col items-center px-3 sm:px-5 py-2 sm:py-3 rounded-xl border bg-background/60 backdrop-blur-sm shadow-sm flex-1 sm:flex-none sm:min-w-[110px]">
              <span className="text-xl sm:text-2xl font-extrabold text-primary">{results.length}</span>
              <span className="text-xs text-muted-foreground">Vendedores</span>
            </div>
            <div className="flex flex-col items-center px-3 sm:px-5 py-2 sm:py-3 rounded-xl border bg-background/60 backdrop-blur-sm shadow-sm flex-1 sm:flex-none sm:min-w-[110px]">
              <span className="text-xl sm:text-2xl font-extrabold text-green-500">{countWithAward}</span>
              <span className="text-xs text-muted-foreground">Com Prêmio</span>
            </div>
            <div className="flex flex-col items-center px-3 sm:px-5 py-2 sm:py-3 rounded-xl border bg-background/60 backdrop-blur-sm shadow-sm flex-1 sm:flex-none sm:min-w-[130px]">
              <span className="text-base sm:text-2xl font-extrabold text-emerald-400 truncate max-w-[120px] sm:max-w-none">{formatCurrency(totalDistributed)}</span>
              <span className="text-xs text-muted-foreground">Total Distribuído</span>
            </div>
            <Button variant="outline" size="icon" onClick={fetchData} disabled={loading} className="self-center shrink-0">
              <RefreshCw className={loading ? 'animate-spin h-4 w-4' : 'h-4 w-4'} />
            </Button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      ) : results.length === 0 ? (
        <div className="text-center text-muted-foreground py-24 border rounded-2xl border-dashed">
          <TrendingUp className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium">Nenhum resultado encontrado</p>
          <p className="text-sm opacity-60">Nenhum período ativo com metas de vendedores.</p>
        </div>
      ) : (
        <>
          {/* ── Pódio Top 3 ── */}
            <div className="relative">
              <div className="flex items-center gap-2 mb-5">
                <Trophy className="h-5 w-5 text-yellow-400" />
                <h2 className="text-lg font-bold">Pódio</h2>
                <div className="h-px flex-1 bg-border" />
              </div>

              {/* Mobile: cards em linha simples */}
              <div className="flex flex-col gap-3 sm:hidden">
                {[
                  top3[0] ? { result: top3[0], rank: 0 } : null,
                  top3[1] ? { result: top3[1], rank: 1 } : null,
                  top3[2] ? { result: top3[2], rank: 2 } : null,
                ].filter(Boolean).map(item => item && (
                  <RankRowCard key={item.result.user.id} result={item.result} rank={item.rank} />
                ))}
              </div>

              {/* Desktop: pódio escalonado 2°|1°|3° */}
              <div className="hidden sm:grid sm:grid-cols-3 gap-4 items-end">
                {[
                  top3[1] ? { result: top3[1], rank: 1 } : null,
                  top3[0] ? { result: top3[0], rank: 0 } : null,
                  top3[2] ? { result: top3[2], rank: 2 } : null,
                ].filter(Boolean).map(item => item && (
                  <PodiumCard key={item.result.user.id} result={item.result} rank={item.rank} />
                ))}
              </div>
            </div>

          {/* ── Demais colocados ── */}
          {rest.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Medal className="h-5 w-5 text-muted-foreground" />
                <h2 className="text-lg font-bold">Demais Colocados</h2>
                <div className="h-px flex-1 bg-border" />
              </div>
              <div className="flex flex-col gap-2">
                {rest.map((result, idx) => (
                  <RankRowCard key={result.user.id} result={result} rank={idx + 3} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
