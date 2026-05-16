
"use client";

import * as React from "react";
import {
  Loader2,
  GitFork,
  User as UserIcon,
  BriefcaseBusiness,
  DollarSign,
  TrendingUp,
  Percent,
  RefreshCw,
  Medal,
  Trophy,
  Award,
  Gem,
  FileText,
  PieChart,
  Target,
  Users,
  Calendar as CalendarIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  collection,
  getDocs,
  query,
  orderBy as firestoreOrderBy,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type {
  Goal,
  GoalType,
  PeriodGroup,
  User,
  Branch,
  Role,
  Period,
  AwardType,
  AwardLevel,
  GoalLevelTargets,
} from "@/lib/definitions";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, parseISO, isBefore, isAfter } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getGroupStatus } from "@/lib/period-helpers";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";


type Responsible = User | Branch | Role;

type PeriodResult = {
  periodId: string;
  periodGroupId: string;
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
  achievedLevelName?: AwardLevel['name'];
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

export default function AwardsPage() {
  const { toast } = useToast();
  // Main data
  const [goals, setGoals] = React.useState<Goal[]>([]);
  const [awardTypes, setAwardTypes] = React.useState<AwardType[]>([]);

  // Related data
  const [goalTypes, setGoalTypes] = React.useState<GoalType[]>([]);
  const [periodGroups, setPeriodGroups] = React.useState<PeriodGroup[]>([]);
  const [users, setUsers] = React.useState<User[]>([]);
  const [branches, setBranches] = React.useState<Branch[]>([]);
  const [roles, setRoles] = React.useState<Role[]>([]);

  // UI State
  const [loading, setLoading] = React.useState(true);
  const [isGoalsLoading, setIsGoalsLoading] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState("branch");
  const [selectedPeriodGroupId, setSelectedPeriodGroupId] = React.useState<string | null>(null);

  const formatCurrency = (value: number | undefined) => {
    if (value === undefined || isNaN(value)) return "R$ 0,00";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const formatPercentage = (value: number | undefined) => {
    if (value === undefined || isNaN(value)) return "0,00%";
    return `${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
  }

  const fetchData = React.useCallback(async () => {
    try {
      setLoading(true);
      const [
        awardTypesSnap,
        typesSnap,
        periodsSnap,
        usersSnap,
        branchesSnap,
        rolesSnap,
      ] = await Promise.all([
        getDocs(collection(db, "awardtypes")),
        getDocs(query(collection(db, "goaltypes"), firestoreOrderBy("order"))),
        getDocs(collection(db, "periodgroups")),
        getDocs(collection(db, "users")),
        getDocs(collection(db, "branches")),
        getDocs(collection(db, "roles")),
      ]);
      setAwardTypes(
        awardTypesSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as AwardType)
      );
      setGoalTypes(
        typesSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as GoalType)
      );
      const fetchedPeriodGroups = periodsSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as PeriodGroup);

      const statusOrder = { "Ativo": 1, "Agendado": 2, "Encerrado": 3, "Vazio": 4 };
      fetchedPeriodGroups.sort((a, b) => {
        const statusA = getGroupStatus(a).text;
        const statusB = getGroupStatus(b).text;
        const orderA = statusOrder[statusA as keyof typeof statusOrder] || 99;
        const orderB = statusOrder[statusB as keyof typeof statusOrder] || 99;
        if (orderA !== orderB) {
          return orderA - orderB;
        }
        // Se status igual, ordena por data de início (mais atual para o mais antigo)
        const dateA = a.periods.length > 0 ? a.periods[0].startDate : "";
        const dateB = b.periods.length > 0 ? b.periods[0].startDate : "";
        return dateB.localeCompare(dateA);
      });

      setPeriodGroups(fetchedPeriodGroups);

      // Find first active group to set as default filter
      const firstActiveGroup = fetchedPeriodGroups.find(g => getGroupStatus(g).text === "Ativo");
      if (firstActiveGroup) {
        setSelectedPeriodGroupId(firstActiveGroup.id);
      } else if (fetchedPeriodGroups.length > 0) {
        setSelectedPeriodGroupId(fetchedPeriodGroups[0].id);
      }

      setUsers(usersSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as User));
      setBranches(
        branchesSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Branch)
      );
      setRoles(rolesSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Role));
    } catch (error) {
      console.error(error);
      toast({
        title: "Erro ao buscar dados",
        description:
          "Não foi possível carregar os dados para o cálculo de premiações.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const fetchGoalsForPeriod = React.useCallback(async (periodGroupId: string) => {
    try {
      setIsGoalsLoading(true);
      const goalsSnap = await getDocs(
        query(
          collection(db, "goals"),
          where("periodGroupId", "==", periodGroupId)
        )
      );
      const fetchedGoals = goalsSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Goal);
      setGoals(fetchedGoals);
    } catch (error) {
      console.error("Error fetching goals:", error);
      toast({
        title: "Erro ao carregar metas",
        description: "Não foi possível carregar as metas para o período selecionado.",
        variant: "destructive",
      });
    } finally {
      setIsGoalsLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    if (selectedPeriodGroupId) {
      fetchGoalsForPeriod(selectedPeriodGroupId);
    }
  }, [selectedPeriodGroupId, fetchGoalsForPeriod]);

  const getPeriodInfo = (
    periodId: string
  ): { groupName: string; periodName: string; period: Period | undefined } => {
    for (const group of periodGroups) {
      const period = group.periods.find((p) => p.id === periodId);
      if (period) return { groupName: group.name, periodName: period.name, period };
    }
    return { groupName: "N/A", periodName: "N/A", period: undefined };
  };

  const getApplicableAwardTypes = React.useCallback((goal: Goal, responsible?: Responsible) => {
    const allApplicableAwards = awardTypes.filter(at => {
      const isTypeMatch = !at.goalTypeIds || at.goalTypeIds.length === 0 || at.goalTypeIds?.includes(goal.goalTypeId);
      if (!isTypeMatch) return false;

      const isGlobal = !at.roleId && !at.branchId;

      if (responsible && 'email' in responsible) { // It's a User
        const user = responsible as User;
        const isUserRoleMatch = at.roleId === user.roleId;
        return isGlobal || isUserRoleMatch;
      }

      // It's a Branch or a Role goal
      const isBranchMatch = goal.branchId && at.branchId === goal.branchId;
      const isRoleMatch = goal.roleId && at.roleId === goal.roleId;
      return isGlobal || isBranchMatch || isRoleMatch;
    });

    // Remove duplicates
    return Array.from(new Map(allApplicableAwards.map(item => [item.id, item])).values());

  }, [awardTypes]);

  const calculateAwards = React.useCallback((responsibleGoals: Goal[], responsible?: Responsible): { periodResults: PeriodResult[], groupBonuses: GroupBonus[] } => {
    const resultsByPeriod: { [periodId: string]: PeriodResult } = {};
    const allGoalResults: GoalResult[] = [];

    responsibleGoals.forEach(goal => {
      const realizado = goal.realizado ?? 0;
      const goalType = goalTypes.find(gt => gt.id === goal.goalTypeId);

      if (!goalType) return;

      const applicableAwardTypes = getApplicableAwardTypes(goal, responsible);

      if (applicableAwardTypes.length === 0) return;

      let target = goal.targetValue ?? 0;
      let achievement = 0;

      const isMercantilType = (gt: GoalType) => gt.name.toLowerCase().includes('mercantil');
      const isFreteType = (gt: GoalType) => gt.name.toLowerCase().includes('frete');

      if (goal.hasLevels && goal.levelTargets) {
        const diamanteTarget = goal.levelTargets.Diamante || 0;
        target = diamanteTarget > 0 ? diamanteTarget : target;
        achievement = target > 0 ? (realizado / target) * 100 : (realizado > 0 ? 100 : 0);
      } else if (isFreteType(goalType)) {
        const mercantilGoal = responsibleGoals.find(g => {
          const gt = goalTypes.find(t => t.id === g.goalTypeId);
          return g.periodId === goal.periodId && gt && isMercantilType(gt) && g.branchId === goal.branchId && g.roleId === goal.roleId && g.userId === goal.userId;
        });
        const mercantilRealizado = mercantilGoal?.realizado ?? 0;
        const freightTargetPercentage = goal.targetValue ?? 0;
        const calculatedTarget = (mercantilRealizado * freightTargetPercentage) / 100;
        target = calculatedTarget;
        achievement = target > 0 ? (realizado / target) * 100 : 0;
      } else {
        target = goal.targetValue ?? 0;
        achievement = target > 0 ? (realizado / target) * 100 : (realizado > 0 ? 100 : 0);
      }

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

            if (achievedLevel) {
              if (award.type === 'fixedBonusByLevel') {
                currentAward = achievedLevel.value;
                ruleValueDisplay = formatCurrency(currentAward);
              } else {
                const calculatedPercentageAward = (realizado * achievedLevel.value) / 100;
                currentAward = calculatedPercentageAward;
                ruleValueDisplay = `${formatPercentage(achievedLevel.value)}`;
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
                ruleValueDisplay = `${formatPercentage(range.value)}`;
              }
              appliedRule = `Faixa ${formatCurrency(range.from)} - ${formatCurrency(range.to)} (${ruleValueDisplay})`;
            }
            break;
          }
          case 'freightConversionBonus': {
            const isTargetAchieved = achievement >= 100;

            if (isTargetAchieved && realizado > 0) {
              if (award.freightCommissionType === 'currency') {
                currentAward = award.commissionPercentage ?? 0;
                ruleValueDisplay = formatCurrency(currentAward);
              } else {
                currentAward = (realizado * (award.commissionPercentage ?? 0)) / 100;
                ruleValueDisplay = `${formatPercentage(award.commissionPercentage)}`;
              }
              appliedRule = `Meta Atingida (${ruleValueDisplay})`;
            } else {
              appliedRule = "Meta Não Atingida";
            }
            break;
          }
        }

        if (currentAward > 0) {
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
      if (!period) return;

      if (!resultsByPeriod[goal.periodId]) {
        resultsByPeriod[goal.periodId] = {
          periodId: goal.periodId,
          periodGroupId: goal.periodGroupId,
          periodName: periodName,
          periodInfo: period,
          goalResults: [],
          totalAward: 0,
          totalBonus: 0
        }
      }

      const displayGoal = { ...goal };
      if (isMercantilType(goalType) && goal.hasLevels) {
        displayGoal.targetValue = target;
      } else if (isFreteType(goalType)) {
        displayGoal.targetValue = target;
      }

      const goalResult: GoalResult = {
        goal: displayGoal,
        goalType,
        awardTypes: applicableAwardTypes,
        achievement,
        awardValue: finalAwardValue,
        bonusValue: finalBonusValue,
        appliedRule: finalAppliedRule,
        achievedLevelName
      };

      resultsByPeriod[goal.periodId].goalResults.push(goalResult);
      allGoalResults.push(goalResult);
    });

    const groupBonuses: GroupBonus[] = [];
    const cumulativeAwards = awardTypes.filter(at => at.type === 'bonusByCumulativeLevel');

    const goalsInSelectedGroup = allGoalResults.filter(gr => gr.goal.periodGroupId === selectedPeriodGroupId);

    cumulativeAwards.forEach(award => {
      const { cumulativeLevelTarget, cumulativeOccurrences = 1, cumulativeBonusValue = 0 } = award;
      if (!cumulativeLevelTarget) return;

      const achievedCount = goalsInSelectedGroup.filter(gr => gr.achievedLevelName === cumulativeLevelTarget).length;

      const isAchieved = achievedCount >= cumulativeOccurrences;

      groupBonuses.push({
        award,
        isAchieved,
        achievedCount,
        value: isAchieved ? cumulativeBonusValue : 0
      });
    });


    Object.values(resultsByPeriod).forEach(periodResult => {
      periodResult.totalAward = periodResult.goalResults.reduce((acc, res) => acc + res.awardValue, 0);
      periodResult.totalBonus = periodResult.goalResults.reduce((acc, res) => acc + res.bonusValue, 0);
      periodResult.goalResults.sort((a, b) => (a.goalType?.order ?? 99) - (b.goalType?.order ?? 99));
    });

    const periodResults = Object.values(resultsByPeriod).sort((a, b) => a.periodName.localeCompare(b.periodName, undefined, { numeric: true }));

    return { periodResults, groupBonuses };

  }, [awardTypes, goalTypes, periodGroups, getApplicableAwardTypes, selectedPeriodGroupId]);

  const salespeople = React.useMemo(() => {
    if (!roles.length || !users.length) return [];
    return users.filter(u => u.roleId && u.roleId.trim() !== "");
  }, [roles, users]);

  // Global summary metrics for the selected period group
  const globalSummaryMetrics = React.useMemo(() => {
    if (!selectedPeriodGroupId || goals.length === 0) return { totalGains: 0, totalAwards: 0, totalBonuses: 0, avgAchievement: 0, totalResponsibles: 0 };

    let totalGains = 0;
    let totalAwards = 0;
    let totalBonuses = 0;
    let totalAchievement = 0;
    let achievementCount = 0;
    const uniqueResponsibles = new Set<string>();

    const responsiblesToProcess = activeTab === 'branch' ? branches : activeTab === 'user' ? salespeople : roles;

    responsiblesToProcess.forEach(resp => {
      let respGoals: Goal[] = [];
      if (activeTab === 'user') {
        respGoals = goals.filter(g => g.userId === resp.id);
      } else if (activeTab === 'role') {
        respGoals = goals.filter(g => g.roleId === resp.id && !g.userId);
      } else {
        respGoals = goals.filter(g => g.branchId === resp.id);
      }

      if (respGoals.length > 0) {
        const { periodResults, groupBonuses } = calculateAwards(respGoals, resp);
        const filteredResults = periodResults.filter(p => p.periodGroupId === selectedPeriodGroupId);
        
        if (filteredResults.length > 0) {
          uniqueResponsibles.add(resp.id);
          filteredResults.forEach(pr => {
            totalAwards += pr.totalAward;
            totalBonuses += pr.totalBonus;
            pr.goalResults.forEach(gr => {
              totalAchievement += gr.achievement;
              achievementCount++;
            });
          });
          groupBonuses.forEach(gb => {
            totalBonuses += gb.value;
          });
        }
      }
    });

    totalGains = totalAwards + totalBonuses;

    return {
      totalGains,
      totalAwards,
      totalBonuses,
      avgAchievement: achievementCount > 0 ? totalAchievement / achievementCount : 0,
      totalResponsibles: uniqueResponsibles.size
    };
  }, [selectedPeriodGroupId, goals, activeTab, branches, salespeople, roles, calculateAwards]);


  const renderResponsibleAccordion = (
    responsibles: Responsible[],
    groupingKey: "branchId" | "userId" | "roleId",
    icon: React.ReactNode
  ) => (
    <Accordion type="multiple" className="w-full">
      {responsibles.map((responsible) => {

        let responsibleGoals: Goal[] = [];
        if (groupingKey === 'userId') {
          const user = responsible as User;
          responsibleGoals = goals.filter(g =>
            g.userId === user.id
          );
        } else if (groupingKey === 'roleId') {
          responsibleGoals = goals.filter(g => g.roleId === responsible.id && !g.userId);
        } else { // branch
          responsibleGoals = goals.filter(g => g[groupingKey] === responsible.id);
        }

        if (responsibleGoals.length === 0) return null;

        let { periodResults, groupBonuses } = calculateAwards(responsibleGoals, responsible);

        if (selectedPeriodGroupId) {
          periodResults = periodResults.filter(p => p.periodGroupId === selectedPeriodGroupId);
        }

        if (periodResults.length === 0) return null;

        let responsibleNameDisplay = responsible.name;
        if (groupingKey === "userId") {
          const user = responsible as User;
          const role = roles.find(r => r.id === user.roleId);
          if (role) {
            responsibleNameDisplay = `${user.name} (${role.name})`;
          }
        }

        const totalPeriodGains = periodResults.reduce((acc, r) => acc + r.totalAward + r.totalBonus, 0);
        const totalGroupBonus = groupBonuses.reduce((acc, gb) => acc + gb.value, 0);
        const totalGains = totalPeriodGains + totalGroupBonus;

        const note = (responsible as User).notes?.[selectedPeriodGroupId || ''] || null;

        return (
          <AccordionItem value={responsible.id} key={responsible.id} className="border-b border-muted group">
            <AccordionTrigger className="text-lg font-medium hover:no-underline py-5">
              <div className="flex w-full items-center justify-between pr-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-primary/5 text-primary group-hover:bg-primary group-hover:text-white transition-all duration-300">
                    {React.cloneElement(icon as React.ReactElement, { className: "h-5 w-5" })}
                  </div>
                  <div className="flex flex-col items-start translate-y-0.5">
                    <span className="font-headline tracking-tight">{responsibleNameDisplay}</span>
                    <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest leading-none mt-1">
                      {totalGains > 0 ? "Com Premiações Atingidas" : "Sem Premiações no Período"}
                    </span>
                  </div>
                  {note && groupingKey === "userId" && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="p-1 rounded-full hover:bg-muted ml-1"
                          >
                            <FileText className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs whitespace-pre-wrap">{note}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </div>
                <div className="flex items-center gap-2 group/gain">
                  <div className="flex flex-col items-end mr-3">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest leading-none mb-1">Total à Receber</span>
                    <span className="text-lg font-bold text-green-600 font-mono tracking-tight leading-none">
                      {formatCurrency(totalGains)}
                    </span>
                  </div>
                  <div className="h-10 w-10 flex items-center justify-center rounded-full bg-green-50 text-green-600 group-hover:bg-green-600 group-hover:text-white transition-colors duration-300">
                    <DollarSign className="h-5 w-5" />
                  </div>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <Accordion type="multiple" className="w-full space-y-4 pb-4 px-1 mt-2">
              {periodResults.map(periodResult => (
                <AccordionItem value={periodResult.periodId} key={periodResult.periodId} className="overflow-hidden rounded-xl border border-muted/60 shadow-sm bg-card data-[state=closed]:border-muted/40">
                  <AccordionTrigger className="bg-muted/30 px-4 py-3 border-b border-muted/60 hover:bg-muted/40 transition-colors hover:no-underline [&[data-state=closed]]:border-b-0">
                    <div className="flex items-center justify-between w-full pr-4">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-primary" />
                        <span className="font-bold text-sm uppercase tracking-tight">{periodResult.periodName}</span>
                      </div>
                      <div className="flex items-center gap-4">
                         <div className="text-right">
                           <span className="text-[10px] text-muted-foreground uppercase font-bold block leading-none mb-1">Total Período</span>
                           <span className="text-sm font-bold text-green-600 font-mono">{formatCurrency(periodResult.totalAward + periodResult.totalBonus)}</span>
                         </div>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pt-0 pb-0 border-t-0">
                    <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-transparent hover:bg-transparent border-muted/40">
                          <TableHead className="text-[10px] uppercase font-bold tracking-wider px-4">Tipo</TableHead>
                          <TableHead className="text-[10px] uppercase font-bold tracking-wider">Meta</TableHead>
                          <TableHead className="text-[10px] uppercase font-bold tracking-wider">Realizado</TableHead>
                          <TableHead className="text-[10px] uppercase font-bold tracking-wider">Atingido</TableHead>
                          <TableHead className="text-[10px] uppercase font-bold tracking-wider">Regra Aplicada</TableHead>
                          <TableHead className="text-right text-[10px] uppercase font-bold tracking-wider">Bônus</TableHead>
                          <TableHead className="text-right text-[10px] uppercase font-bold tracking-wider pr-4">Prêmio</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {periodResult.goalResults.map(res => {
                          let targetDisplay: React.ReactNode = formatCurrency(res.goal.targetValue);
                          if (res.goal.hasLevels) {
                            targetDisplay = (
                              <div className="flex flex-col gap-1 py-1">
                                {orderedLevels.map(level => {
                                  const levelTarget = res.goal.levelTargets?.[level];
                                  if (typeof levelTarget === 'number' && levelTarget > 0) {
                                    const isReached = (res.goal.realizado || 0) >= levelTarget;
                                    return (
                                      <div key={level} className={cn(
                                        "flex items-center gap-2 transition-opacity",
                                        isReached ? "opacity-100" : "opacity-40"
                                      )}>
                                        <div className="flex items-center gap-1 min-w-[32px]">
                                          {levelIcons[level]}
                                          <span className={cn("text-[10px] font-bold", isReached ? "text-foreground" : "text-muted-foreground")}>{level.charAt(0)}</span>
                                        </div>
                                        <span className="text-[10px] font-mono font-bold leading-none">{formatCurrency(levelTarget)}</span>
                                      </div>
                                    );
                                  }
                                  return null;
                                })}
                              </div>
                            );
                          } else if (res.goalType?.name.toLowerCase().includes('frete')) {
                            const calculatedTarget = res.goal.targetValue ?? 0;
                            const originalGoal = goals.find(g => g.id === res.goal.id);
                            const freightPercentage = originalGoal?.targetValue ?? 0;
                            targetDisplay = (
                              <div className="flex flex-col">
                                <span className="font-mono text-xs">{formatCurrency(calculatedTarget)}</span>
                                <span className="text-[9px] text-muted-foreground font-bold">{freightPercentage}% da Venda</span>
                              </div>
                            );
                          }
  
                          let realizadoDisplay: React.ReactNode = (
                            <span className="font-mono text-xs font-medium">{formatCurrency(res.goal.realizado)}</span>
                          );
                          if (res.goalType?.name.toLowerCase().includes('frete')) {
                            const mercantilGoal = responsibleGoals.find(g => {
                              const gt = goalTypes.find(t => t.id === g.goalTypeId);
                              return g.periodId === res.goal.periodId && gt && gt.name.toLowerCase().includes('mercantil');
                            });
                            const mercantilRealizado = mercantilGoal?.realizado ?? 0;
                            const freteRealizado = res.goal.realizado ?? 0;
                            const fretePercentage = mercantilRealizado > 0 ? (freteRealizado / mercantilRealizado) * 100 : 0;
                            realizadoDisplay = (
                              <div className="flex flex-col">
                                <span className="font-mono text-xs font-medium">{formatCurrency(freteRealizado)}</span>
                                {mercantilRealizado > 0 && (
                                  <span className="text-[9px] text-muted-foreground font-bold">Relativo: {fretePercentage.toFixed(2)}%</span>
                                )}
                              </div>
                            );
                          }
  
                          return (
                            <TableRow key={res.goal.id} className="hover:bg-muted/20 border-muted/40 transition-colors group/row">
                              <TableCell className="py-4 px-4">
                                <span className="font-bold text-sm tracking-tight">{res.goalType?.name ?? 'N/A'}</span>
                              </TableCell>
                              <TableCell>{targetDisplay}</TableCell>
                              <TableCell>{realizadoDisplay}</TableCell>
                              <TableCell>
                                <Badge variant={res.achievement >= 100 ? "default" : "secondary"} className={cn(
                                  "gap-1 h-6 px-2 text-[10px] font-bold",
                                  res.achievement >= 100 ? "bg-green-600 hover:bg-green-700" : ""
                                )}>
                                  {res.achievement >= 100 && <Trophy className="h-2.5 w-2.5" />}
                                  {formatPercentage(res.achievement)}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <div className="flex items-center gap-1.5 cursor-pointer group/rule">
                                      {res.achievedLevelName && (
                                        <div className="p-1 rounded-md bg-white shadow-sm ring-1 ring-muted group-hover/rule:ring-primary/40 transition-all">
                                          {levelIcons[res.achievedLevelName as keyof GoalLevelTargets]}
                                        </div>
                                      )}
                                      <span className="text-[11px] font-semibold text-muted-foreground border-b border-dashed border-muted-foreground/30 hover:text-primary hover:border-primary/40 transition-all">
                                        {res.appliedRule}
                                      </span>
                                    </div>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-64 p-3 shadow-xl border-primary/10">
                                    <div className="space-y-3">
                                      <h4 className="font-bold text-xs uppercase tracking-widest text-primary">Regras Aplicadas</h4>
                                      <div className="space-y-2">
                                        {res.awardTypes.map((award) => (
                                          <div key={award.id} className="p-2 rounded-lg bg-muted/30 text-xs">
                                            <p className="font-bold leading-tight mb-1">{award.name}</p>
                                            <p className="text-muted-foreground leading-snug">{award.description}</p>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  </PopoverContent>
                                </Popover>
                              </TableCell>
                              <TableCell className="text-right">
                                <span className={cn(
                                  "font-mono font-bold text-sm",
                                  res.bonusValue > 0 ? "text-sky-600" : "text-muted-foreground/40"
                                )}>
                                  {formatCurrency(res.bonusValue)}
                                </span>
                              </TableCell>
                              <TableCell className="text-right pr-4">
                                <span className={cn(
                                  "font-mono font-bold text-sm",
                                  res.awardValue > 0 ? "text-green-600" : "text-muted-foreground/40"
                                )}>
                                  {formatCurrency(res.awardValue)}
                                </span>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
              </Accordion>

              {groupBonuses.length > 0 && (
                <div className="mt-8 space-y-4">
                  <div className="flex items-center gap-2 px-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                    <h4 className="font-bold text-sm uppercase tracking-widest text-muted-foreground">Bônus de Grupo Adicionais</h4>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {groupBonuses.map(gb => (
                      <Card key={gb.award.id} className={cn(
                        "relative overflow-hidden transition-all duration-300 border-muted/50",
                        gb.isAchieved ? "bg-primary/5 border-primary/20 ring-1 ring-primary/10" : "bg-muted/10 opacity-75"
                      )}>
                        {gb.isAchieved && (
                          <div className="absolute top-0 right-0 p-2">
                             <Trophy className="h-4 w-4 text-primary opacity-50" />
                          </div>
                        )}
                        <CardContent className="p-4 flex items-center justify-between">
                          <div className="space-y-1">
                            <p className="font-bold text-sm leading-tight">{gb.award.name}</p>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-semibold text-muted-foreground uppercase">Status:</span>
                              <Badge variant={gb.isAchieved ? "default" : "secondary"} className="text-[9px] py-0 h-4 uppercase tracking-tighter">
                                {gb.isAchieved ? "Atingido" : "Em Progresso"}
                              </Badge>
                            </div>
                            <p className="text-[10px] text-muted-foreground pt-1 italic">
                              {`Progresso: ${gb.achievedCount} de ${gb.award.cumulativeOccurrences} níveis ${gb.award.cumulativeLevelTarget || 'Diamante'}`}
                            </p>
                          </div>
                          <div className="text-right">
                             <p className={cn("text-lg font-bold font-mono", gb.isAchieved ? "text-primary" : "text-muted-foreground")}>
                               {formatCurrency(gb.value)}
                             </p>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );

  const filterOptions = [
    { value: 'branch', label: 'Por Filial' },
    { value: 'user', label: 'Por Vendedor' },
    { value: 'role', label: 'Por Função' },
  ];


  const renderContent = () => {
    if (loading || isGoalsLoading) {
      return (
        <div className="flex flex-col justify-center items-center h-64 gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-muted-foreground animate-pulse font-medium">
            {isGoalsLoading ? "Calculando premiações do período..." : "Carregando dados..."}
          </p>
        </div>
      );
    }

    return (
      <>
        <div className="hidden sm:block">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsContent value="branch" className="mt-0">
              {renderResponsibleAccordion(
                branches,
                "branchId",
                <GitFork />
              )}
            </TabsContent>
            <TabsContent value="user" className="mt-0">
              {renderResponsibleAccordion(salespeople, "userId", <UserIcon />)}
            </TabsContent>
            <TabsContent value="role" className="mt-0">
              {renderResponsibleAccordion(
                roles,
                "roleId",
                <BriefcaseBusiness />
              )}
            </TabsContent>
          </Tabs>
        </div>
        <div className="block sm:hidden">
          {activeTab === 'branch' && renderResponsibleAccordion(branches, "branchId", <GitFork />)}
          {activeTab === 'user' && renderResponsibleAccordion(salespeople, "userId", <UserIcon />)}
          {activeTab === 'role' && renderResponsibleAccordion(roles, "roleId", <BriefcaseBusiness />)}
        </div>
      </>
    );
  }

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold font-headline tracking-tight">
              Cálculo de Premiações
            </h1>
            <p className="text-muted-foreground">
              Visualize os prêmios calculados com base nas metas e realizados.
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Resultados das Premiações</CardTitle>
            <CardDescription>
              Os valores abaixo são calculados automaticamente.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
                <div className="w-full sm:w-auto hidden sm:flex items-center gap-4">
                  <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList className="bg-muted/50 p-1">
                      <TabsTrigger value="branch" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all">Por Filial</TabsTrigger>
                      <TabsTrigger value="user" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all">Por Vendedor</TabsTrigger>
                      <TabsTrigger value="role" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all">Por Função</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
                <div className="w-full sm:w-auto sm:hidden">
                  <Select value={activeTab} onValueChange={setActiveTab}>
                    <SelectTrigger>
                      <SelectValue placeholder="Filtrar por..." />
                    </SelectTrigger>
                    <SelectContent>
                      {filterOptions.map(option => (
                        <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-full sm:w-auto flex items-center gap-2">
                  <Select value={selectedPeriodGroupId || ""} onValueChange={setSelectedPeriodGroupId}>
                    <SelectTrigger className="w-full sm:w-[280px] h-10 border-muted-foreground/20 focus:ring-primary/20">
                       <div className="flex items-center gap-2">
                          <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                          <SelectValue placeholder="Selecione o Grupo" />
                       </div>
                    </SelectTrigger>
                    <SelectContent>
                      {periodGroups.map(group => {
                        const status = getGroupStatus(group);
                        const statusColor = 
                          status.text === "Ativo" ? "text-green-600 border-green-200" :
                          status.text === "Agendado" ? "text-blue-600 border-blue-200" :
                          status.text === "Encerrado" ? "text-slate-600 border-slate-200" :
                          "text-muted-foreground border-muted";

                        return (
                          <SelectItem key={group.id} value={group.id}>
                            <div className="flex items-center justify-between w-full min-w-[180px]">
                              <span>{group.name}</span>
                              <Badge variant="outline" className={cn(
                                "ml-2 text-[9px] py-0 h-4 uppercase font-bold",
                                statusColor
                              )}>
                                {status.text}
                              </Badge>
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="icon" onClick={() => fetchData()} disabled={loading} className="h-10 w-10 border-muted-foreground/20 text-muted-foreground hover:text-primary transition-colors">
                    <RefreshCw className={loading ? "animate-spin h-4 w-4" : "h-4 w-4"} />
                  </Button>
                </div>
              </div>

              {/* Summary Cards Grid */}
              {!loading && !isGoalsLoading && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-2">
                  <Card className="bg-primary/5 border-primary/10 relative overflow-hidden group hover:scale-[1.02] transition-transform duration-300">
                    <div className="absolute -right-2 -bottom-2 opacity-10 group-hover:scale-110 transition-transform duration-500">
                      <DollarSign className="h-20 w-20 text-primary" />
                    </div>
                    <CardContent className="p-4 flex items-center gap-4 relative">
                      <div className="h-12 w-12 rounded-2xl bg-primary text-white flex items-center justify-center shadow-lg shadow-primary/20">
                        <DollarSign className="h-6 w-6" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-primary/60 uppercase tracking-widest leading-none mb-1">Total Geral</p>
                        <p className="text-xl font-bold font-mono tracking-tight leading-none">{formatCurrency(globalSummaryMetrics.totalGains)}</p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-green-50/50 border-green-200/50 dark:bg-green-500/10 dark:border-green-500/20 relative overflow-hidden group hover:scale-[1.02] transition-transform duration-300">
                    <div className="absolute -right-2 -bottom-2 opacity-10 group-hover:scale-110 transition-transform duration-500">
                      <Award className="h-20 w-20 text-green-600 dark:text-green-400" />
                    </div>
                    <CardContent className="p-4 flex items-center gap-4 relative">
                      <div className="h-12 w-12 rounded-2xl bg-green-600 text-white flex items-center justify-center shadow-lg shadow-green-600/20">
                        <Award className="h-6 w-6" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-green-600/60 dark:text-green-400/60 uppercase tracking-widest leading-none mb-1">Premiações</p>
                        <p className="text-xl font-bold font-mono tracking-tight leading-none text-green-700 dark:text-green-400">{formatCurrency(globalSummaryMetrics.totalAwards)}</p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-sky-50/50 border-sky-200/50 dark:bg-sky-500/10 dark:border-sky-500/20 relative overflow-hidden group hover:scale-[1.02] transition-transform duration-300">
                    <div className="absolute -right-2 -bottom-2 opacity-10 group-hover:scale-110 transition-transform duration-500">
                      <Trophy className="h-20 w-20 text-sky-600 dark:text-sky-400" />
                    </div>
                    <CardContent className="p-4 flex items-center gap-4 relative">
                      <div className="h-12 w-12 rounded-2xl bg-sky-600 text-white flex items-center justify-center shadow-lg shadow-sky-600/20">
                        <Trophy className="h-6 w-6" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-sky-600/60 dark:text-sky-400/60 uppercase tracking-widest leading-none mb-1">Total Bônus</p>
                        <p className="text-xl font-bold font-mono tracking-tight leading-none text-sky-700 dark:text-sky-400">{formatCurrency(globalSummaryMetrics.totalBonuses)}</p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-amber-50/50 border-amber-200/50 dark:bg-amber-500/10 dark:border-amber-500/20 relative overflow-hidden group hover:scale-[1.02] transition-transform duration-300">
                    <div className="absolute -right-2 -bottom-2 opacity-10 group-hover:scale-110 transition-transform duration-500">
                      <Users className="h-20 w-20 text-amber-600 dark:text-amber-400" />
                    </div>
                    <CardContent className="p-4 flex items-center gap-4 relative">
                      <div className="h-12 w-12 rounded-2xl bg-amber-600 text-white flex items-center justify-center shadow-lg shadow-amber-600/20">
                        <Users className="h-6 w-6" />
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-amber-600/60 dark:text-amber-400/60 uppercase tracking-widest leading-none mb-1">Vendedores</p>
                        <p className="text-xl font-bold font-mono tracking-tight leading-none text-amber-700 dark:text-amber-400">{globalSummaryMetrics.totalResponsibles}</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              <div className="pt-2">
                {renderContent()}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}
