
"use client";

import * as React from "react";
import {
  Loader2,
  GitFork,
  User as UserIcon,
  BriefcaseBusiness,
  Save,
  CheckCircle,
  Lock,
  Unlock,
  RefreshCw,
  Medal,
  Trophy,
  Award,
  Gem,
  Send,
} from "lucide-react";
import {
  collection,
  getDocs,
  query,
  orderBy as firestoreOrderBy,
  addDoc,
  where,
  serverTimestamp,
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
  PaymentOrder
} from "@/lib/definitions";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getGroupStatus } from "@/lib/period-helpers";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { useRouter } from "next/navigation";

type Responsible = User | Branch | Role;

type ResponsibleResult = {
    id: string;
    name: string;
    type: 'user' | 'branch' | 'role';
    totalAward: number;
    icon: React.ReactNode;
    alreadyGenerated: boolean;
}

const levelIcons: Record<keyof GoalLevelTargets, React.ReactNode> = {
    Bronze: <Medal className="h-4 w-4 text-orange-600" />,
    Prata: <Trophy className="h-4 w-4 text-slate-500" />,
    Ouro: <Award className="h-4 w-4 text-yellow-500" />,
    Diamante: <Gem className="h-4 w-4 text-sky-400" />,
};

const orderedLevels: Array<keyof GoalLevelTargets> = ['Bronze', 'Prata', 'Ouro', 'Diamante'];

export default function PaymentOrdersPage() {
  const { toast } = useToast();
  const router = useRouter();
  // Main data
  const [goals, setGoals] = React.useState<Goal[]>([]);
  const [awardTypes, setAwardTypes] = React.useState<AwardType[]>([]);
  const [paymentHistory, setPaymentHistory] = React.useState<PaymentOrder[]>([]);

  // Related data
  const [goalTypes, setGoalTypes] = React.useState<GoalType[]>([]);
  const [periodGroups, setPeriodGroups] = React.useState<PeriodGroup[]>([]);
  const [users, setUsers] = React.useState<User[]>([]);
  const [branches, setBranches] = React.useState<Branch[]>([]);
  const [roles, setRoles] = React.useState<Role[]>([]);

  // UI State
  const [loading, setLoading] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState<string | null>(null);
  const [activeTab, setActiveTab] = React.useState("branch");
  const [selectedPeriodGroupId, setSelectedPeriodGroupId] = React.useState<string | null>(null);
  const [extraValues, setExtraValues] = React.useState<{[id: string]: { bonus: number, discount: number }}>({});


  const formatCurrency = (value: number | undefined) => {
    if (value === undefined || isNaN(value)) return "R$ 0,00";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };
  
  const handleCurrencyInputChange = (responsibleId: string, type: 'bonus' | 'discount') => (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, '');
    let numericValue = 0;
    if (rawValue) {
      numericValue = parseInt(rawValue, 10) / 100;
    }
    
    setExtraValues(prev => ({
      ...prev,
      [responsibleId]: {
        ...(prev[responsibleId] || { bonus: 0, discount: 0 }),
        [type]: numericValue,
      },
    }));
  };

  const formatCurrencyForInput = (value: number | undefined) => {
    if (value === undefined || value === null || isNaN(value)) return '';
    return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
  };

  const fetchData = React.useCallback(async () => {
    try {
      setLoading(true);
      const [
        goalsSnap,
        awardTypesSnap,
        typesSnap,
        periodsSnap,
        usersSnap,
        branchesSnap,
        rolesSnap,
        paymentHistorySnap,
      ] = await Promise.all([
        getDocs(collection(db, "goals")),
        getDocs(collection(db, "awardtypes")),
        getDocs(query(collection(db, "goaltypes"), firestoreOrderBy("order"))),
        getDocs(collection(db, "periodgroups")),
        getDocs(collection(db, "users")),
        getDocs(collection(db, "branches")),
        getDocs(collection(db, "roles")),
        getDocs(query(collection(db, "paymentHistory"))),
      ]);

      const goalsData = goalsSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Goal);
      const awardTypesData = awardTypesSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as AwardType);
      const goalTypesData = typesSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as GoalType);
      const fetchedPeriodGroups = periodsSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as PeriodGroup);
      const usersData = usersSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as User);
      const branchesData = branchesSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Branch);
      const rolesData = rolesSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Role);
      const paymentHistoryData = paymentHistorySnap.docs.map((d) => ({ id: d.id, ...d.data() }) as PaymentOrder);

      setGoals(goalsData);
      setAwardTypes(awardTypesData);
      setGoalTypes(goalTypesData);
      setUsers(usersData);
      setBranches(branchesData);
      setRoles(rolesData);
      setPaymentHistory(paymentHistoryData);
      
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
      
      const newExtraValues: {[id: string]: { bonus: number, discount: number }} = {};
      paymentHistoryData.forEach(p => {
        newExtraValues[p.responsibleId] = {
            bonus: p.extraBonus,
            discount: p.discount,
        };
      });
      setExtraValues(newExtraValues);

      const currentSelectedPeriod = selectedPeriodGroupId || fetchedPeriodGroups.find(g => getGroupStatus(g).text === "Ativo")?.id || (fetchedPeriodGroups.length > 0 ? fetchedPeriodGroups[0].id : null);
      if (currentSelectedPeriod && !selectedPeriodGroupId) {
        setSelectedPeriodGroupId(currentSelectedPeriod);
      }


    } catch (error) {
      console.error(error);
      toast({
        title: "Erro ao buscar dados",
        description: "Não foi possível carregar os dados para gerar as ordens.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast, selectedPeriodGroupId]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getPeriodInfo = (periodId: string): { groupName: string; periodName: string; period: Period | undefined } => {
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
      if (responsible && 'email' in responsible) { // User
        const user = responsible as User;
        const isUserRoleMatch = at.roleId === user.roleId;
        return isGlobal || isUserRoleMatch;
      }
      // Branch or Role goal
      const isBranchMatch = goal.branchId && at.branchId === goal.branchId;
      const isRoleMatch = goal.roleId && at.roleId === goal.roleId;
      return isGlobal || isBranchMatch || isRoleMatch;
    });
    // Remove duplicates
    return Array.from(new Map(allApplicableAwards.map(item => [item.id, item])).values());
  }, [awardTypes]);

  const calculateTotalAwardForResponsible = React.useCallback((responsible: Responsible, type: 'user' | 'branch' | 'role'): number => {
    if (!selectedPeriodGroupId) return 0;
    
    let responsibleGoals: Goal[];
    if (type === 'user') {
      const user = responsible as User;
      responsibleGoals = goals.filter(g =>
        g.periodGroupId === selectedPeriodGroupId &&
        g.userId === user.id
      );
    } else {
      const key = type === 'branch' ? 'branchId' : 'roleId';
      responsibleGoals = goals.filter(g => g.periodGroupId === selectedPeriodGroupId && g[key] === responsible.id);
    }
    if (responsibleGoals.length === 0) return 0;

    const isMercantilType = (gt: GoalType) => gt.name.toLowerCase().includes('mercantil');
    const isFreteType = (gt: GoalType) => gt.name.toLowerCase().includes('frete');
    let totalGain = 0;

    const allGoalResults: { achievedLevelName?: string }[] = [];

    responsibleGoals.forEach(goal => {
        const realizado = goal.realizado ?? 0;
        const goalType = goalTypes.find(gt => gt.id === goal.goalTypeId);
        if (!goalType) return;

        const applicableAwardTypes = getApplicableAwardTypes(goal, responsible);
        if (applicableAwardTypes.length === 0) return;

        let target = goal.targetValue ?? 0;
        let achievement = 0;

        if (goal.hasLevels && goal.levelTargets) {
            const diamanteTarget = goal.levelTargets.Diamante || 0;
            target = diamanteTarget > 0 ? diamanteTarget : target;
            achievement = target > 0 ? (realizado / target) * 100 : (realizado > 0 ? 100 : 0);
        } else if (isFreteType(goalType)) {
            const mercantilGoal = responsibleGoals.find(g => g.periodId === goal.periodId && goalTypes.find(t => t.id === g.goalTypeId && isMercantilType(t)));
            target = (mercantilGoal?.realizado ?? 0) * (goal.targetValue ?? 0) / 100;
            achievement = target > 0 ? (realizado / target) * 100 : 0;
        } else {
            target = goal.targetValue ?? 0;
            achievement = target > 0 ? (realizado / target) * 100 : (realizado > 0 ? 100 : 0);
        }
        
        let achievedLevelName: AwardLevel['name'] | undefined = undefined;

        for (const award of applicableAwardTypes) {
            let currentAward = 0;
            switch (award.type) {
                case 'fixedBonusByLevel':
                case 'percentageByLevel': {
                    if (!goal.hasLevels || !goal.levelTargets || realizado <= 0) break;
                    let achievedLevel: AwardLevel | null = null;
                    for (const levelName of orderedLevels) {
                        if (realizado >= (goal.levelTargets?.[levelName] ?? Infinity)) {
                            const foundLevel = award.levels.find(l => l.name === levelName) ?? null;
                            if (foundLevel && foundLevel.value > 0) achievedLevel = foundLevel;
                        }
                    }
                    if(achievedLevel) {
                        if (award.type === 'fixedBonusByLevel') currentAward = achievedLevel.value;
                        else currentAward = (realizado * achievedLevel.value) / 100;
                        achievedLevelName = achievedLevel.name;
                    }
                    break;
                }
                case 'salesRangeBonus':
                case 'fixedBonusBySalesRange': {
                    const range = award.ranges.find(r => realizado >= r.from && realizado <= r.to);
                    if (range) {
                        if (award.type === 'fixedBonusBySalesRange') currentAward = range.value;
                        else currentAward = (realizado * range.value) / 100;
                    }
                    break;
                }
                case 'freightConversionBonus': {
                    if (achievement >= 100 && realizado > 0) {
                        if (award.freightCommissionType === 'currency') currentAward = award.commissionPercentage ?? 0;
                        else currentAward = (realizado * (award.commissionPercentage ?? 0)) / 100;
                    }
                    break;
                }
            }
            if (currentAward > 0) totalGain += currentAward;
        }
        allGoalResults.push({ achievedLevelName });
    });

    const cumulativeAwards = awardTypes.filter(at => at.type === 'bonusByCumulativeLevel' && at.cumulativeLevelTarget);
    cumulativeAwards.forEach(award => {
        const achievedCount = allGoalResults.filter(gr => gr.achievedLevelName === award.cumulativeLevelTarget).length;
        if (achievedCount >= (award.cumulativeOccurrences ?? 1)) {
            totalGain += award.cumulativeBonusValue ?? 0;
        }
    });

    return totalGain;
  }, [goals, awardTypes, goalTypes, selectedPeriodGroupId, getApplicableAwardTypes]);

  const responsibleData = React.useMemo((): ResponsibleResult[] => {
    if (loading || !selectedPeriodGroupId) return [];
    
    let source: Responsible[] = [];
    let type: 'user' | 'branch' | 'role' = 'user';
    let icon: React.ReactNode = <UserIcon />;

    if (activeTab === 'user') {
      source = users.filter(u => u.roleId && u.roleId.trim() !== "");
      type = 'user';
      icon = <UserIcon />;
    } else if (activeTab === 'branch') {
      source = branches;
      type = 'branch';
      icon = <GitFork />;
    } else {
      source = roles;
      type = 'role';
      icon = <BriefcaseBusiness />;
    }

    const results = source.map(responsible => {
      const totalAward = calculateTotalAwardForResponsible(responsible, type);
      const alreadyGenerated = paymentHistory.some(p => 
        p.responsibleId === responsible.id && 
        p.periodGroupId === selectedPeriodGroupId
      );

      return {
        id: responsible.id,
        name: type === 'user' ? `${responsible.name} (${roles.find(r => r.id === (responsible as User).roleId)?.name || 'N/A'})` : responsible.name,
        type,
        totalAward,
        icon,
        alreadyGenerated
      };
    }).filter(r => r.totalAward > 0).sort((a,b) => b.totalAward - a.totalAward);

    return results;

  }, [loading, activeTab, users, branches, roles, selectedPeriodGroupId, calculateTotalAwardForResponsible, paymentHistory]);

  const handleGenerateOrder = async (responsible: ResponsibleResult) => {
    const bonus = extraValues[responsible.id]?.bonus || 0;
    const discount = extraValues[responsible.id]?.discount || 0;
    const finalAmount = responsible.totalAward + bonus - discount;

    if (!selectedPeriodGroupId || finalAmount <= 0) {
        toast({ title: "Valor inválido", description: "A ordem de pagamento não pode ser gerada com valor zero ou negativo.", variant: "destructive" });
        return;
    }
    
    setIsSubmitting(responsible.id);
    const selectedPeriodGroup = periodGroups.find(g => g.id === selectedPeriodGroupId);

    try {
        const paymentOrderData: Omit<PaymentOrder, 'id'> = {
            responsibleId: responsible.id,
            responsibleType: responsible.type,
            responsibleName: responsible.name,
            periodGroupId: selectedPeriodGroupId,
            periodGroupName: selectedPeriodGroup?.name || "N/A",
            baseAward: responsible.totalAward,
            extraBonus: bonus,
            discount: discount,
            amount: finalAmount,
            status: 'pending',
            generatedAt: new Date().toISOString(),
        };
        const newDocRef = await addDoc(collection(db, "paymentHistory"), paymentOrderData);

        toast({ title: "Ordem de Pagamento Gerada!", description: `Ordem para ${responsible.name} foi gerada com sucesso.` });
        
        router.push(`/dashboard/payment-history-orders-premium/${newDocRef.id}`);

    } catch(error) {
        console.error("Error generating payment order:", error);
        toast({ title: "Erro ao Gerar Ordem", variant: "destructive" });
    } finally {
        setIsSubmitting(null);
    }
  }

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex justify-center items-center h-40">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      );
    }

    if(responsibleData.length === 0) {
       return (
        <div className="text-center text-muted-foreground py-10">
          Nenhum resultado de premiação para o período e filtro selecionados.
        </div>
      )
    }
    
    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Responsável</TableHead>
                    <TableHead>Premiação Total</TableHead>
                    <TableHead>Bônus Extra</TableHead>
                    <TableHead>Desconto</TableHead>
                    <TableHead className="text-right">Valor Final</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {responsibleData.map(res => {
                    const bonus = extraValues[res.id]?.bonus || 0;
                    const discount = extraValues[res.id]?.discount || 0;
                    const finalAmount = res.totalAward + bonus - discount;
                    
                    return (
                    <TableRow key={res.id}>
                        <TableCell>
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-muted rounded-md">{res.icon}</div>
                                <span className="font-medium">{res.name}</span>
                            </div>
                        </TableCell>
                        <TableCell className="font-semibold text-muted-foreground">
                           {formatCurrency(res.totalAward)}
                        </TableCell>
                         <TableCell>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
                            <Input
                              type="text"
                              className="h-9 pl-8 w-32"
                              placeholder="0,00"
                              value={formatCurrencyForInput(extraValues[res.id]?.bonus)}
                              onChange={handleCurrencyInputChange(res.id, 'bonus')}
                              disabled={isSubmitting === res.id || res.alreadyGenerated}
                            />
                          </div>
                        </TableCell>
                         <TableCell>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
                            <Input
                              type="text"
                              className="h-9 pl-8 w-32"
                              placeholder="0,00"
                              value={formatCurrencyForInput(extraValues[res.id]?.discount)}
                              onChange={handleCurrencyInputChange(res.id, 'discount')}
                              disabled={isSubmitting === res.id || res.alreadyGenerated}
                            />
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-bold text-lg text-green-600">
                           {formatCurrency(finalAmount)}
                        </TableCell>
                        <TableCell className="text-right">
                           <Button 
                             onClick={() => handleGenerateOrder(res)}
                             disabled={isSubmitting === res.id || res.alreadyGenerated}
                             variant={res.alreadyGenerated ? "secondary" : "default"}
                           >
                                {isSubmitting === res.id ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                    <Send className="mr-2 h-4 w-4" />
                                )}
                                {res.alreadyGenerated ? 'Já Gerada' : 'Gerar Ordem'}
                           </Button>
                        </TableCell>
                    </TableRow>
                )})}
            </TableBody>
        </Table>
    );
  }

  return (
    <div className="flex flex-col gap-6">
    <div className="flex items-center justify-between">
        <div>
        <h1 className="text-3xl font-bold font-headline tracking-tight">
            Gerar Ordens de Pagamento
        </h1>
        <p className="text-muted-foreground">
            Selecione um grupo de períodos e gere as ordens de pagamento com base nos valores finais.
        </p>
        </div>
    </div>

    <Card>
        <CardHeader>
        <CardTitle>Premiações Consolidadas</CardTitle>
        <CardDescription>
            Os valores abaixo representam o total de premiações e bônus calculados para cada responsável.
        </CardDescription>
        </CardHeader>
        <CardContent>
        <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList>
                    <TabsTrigger value="branch">Por Filial</TabsTrigger>
                    <TabsTrigger value="user">Por Vendedor</TabsTrigger>
                    <TabsTrigger value="role">Por Função</TabsTrigger>
                    </TabsList>
                </Tabs>
                <div className="w-full sm:w-auto flex items-center gap-2">
                <Select value={selectedPeriodGroupId || ''} onValueChange={(value) => setSelectedPeriodGroupId(value)}>
                    <SelectTrigger className="w-full sm:w-[280px]">
                    <SelectValue placeholder="Selecione um Grupo de Período" />
                    </SelectTrigger>
                    <SelectContent>
                    {periodGroups.map(group => {
                        const status = getGroupStatus(group);
                        return (
                        <SelectItem key={group.id} value={group.id}>
                            <div className="flex items-center justify-between">
                            <span>{group.name}</span>
                            <Badge variant={status.variant} className="ml-4">{status.text}</Badge>
                            </div>
                        </SelectItem>
                        )
                    })}
                    </SelectContent>
                </Select>
                <Button variant="outline" size="icon" onClick={() => fetchData()} disabled={loading}>
                    <RefreshCw className={loading ? "animate-spin h-4 w-4" : "h-4 w-4"} />
                </Button>
                </div>
            </div>
            <div className="pt-2">
            {renderContent()}
            </div>
        </div>
        </CardContent>
    </Card>
    </div>
  );
}

    