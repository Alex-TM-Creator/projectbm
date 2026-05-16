
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
  Calculator,
  TrendingUp,
  TrendingDown,
  BarChart2,
  Frown,
  Clock,
} from "lucide-react";
import {
  collection,
  getDocs,
  doc,
  writeBatch,
  query,
  orderBy as firestoreOrderBy,
  updateDoc,
} from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { useAuthState } from "react-firebase-hooks/auth";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import type { Goal, GoalType, PeriodGroup, Role, Period, SalesOrder, SaleType, Service, Branch, CompanyBranch, User as UserType } from "@/lib/definitions";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { format, parseISO, isWithinInterval } from 'date-fns';
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { getGroupStatus } from "@/lib/period-helpers";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useRealizadoAutoSync } from "@/contexts/realizado-autosync-context";
import type { AutoSyncInterval } from "@/contexts/realizado-autosync-context";
import { ptBR } from "date-fns/locale";
import { format as formatDateDateFns } from "date-fns";
import { errorEmitter, FirestorePermissionError } from "@/lib/firebase-error-handler";
import { cn } from "@/lib/utils";

type GroupedGoal = {
  groupKey: string;
  responsibleId: string;
  responsibleName: string;
  responsibleType: 'user' | 'branch' | 'role';
  periods: {
    periodId: string;
    periodName: string;
    goals: Goal[];
  }[];
}

type CalculationDetails = {
  totalVendas: number;
  totalFrete: number;
  totalServicos: number;
};


export default function RealizadoPage() {
  const { toast } = useToast();
  // Main data
  const [goals, setGoals] = React.useState<Goal[]>([]);

  // Related data
  const [goalTypes, setGoalTypes] = React.useState<GoalType[]>([]);
  const [periodGroups, setPeriodGroups] = React.useState<PeriodGroup[]>([]);
  const [users, setUsers] = React.useState<UserType[]>([]);
  const [branches, setBranches] = React.useState<Branch[]>([]);
  const [companyBranches, setCompanyBranches] = React.useState<CompanyBranch[]>([]);
  const [roles, setRoles] = React.useState<Role[]>([]);
  const [salesOrders, setSalesOrders] = React.useState<SalesOrder[]>([]);
  const [saleTypes, setSaleTypes] = React.useState<SaleType[]>([]);
  const [services, setServices] = React.useState<Service[]>([]);


  // UI State
  const { config: autoSyncConfig, setConfig: setAutoSyncConfig, lastSyncAt, isSyncing: isSyncingGlobal, triggerNow } = useRealizadoAutoSync();
  const [user, authLoading] = useAuthState(auth);
  const [loading, setLoading] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState<string | boolean>(false);
  const [isCalculating, setIsCalculating] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState("user");
  const [selectedPeriodGroupId, setSelectedPeriodGroupId] = React.useState<string | null>(null);

  // Form state
  const [realizadoValues, setRealizadoValues] = React.useState<{ [key: string]: number }>({});
  const [calculationDetails, setCalculationDetails] = React.useState<{ [key: string]: CalculationDetails }>({});


  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A";
    try {
      return format(parseISO(dateString), "dd/MM/yyyy");
    } catch {
      return dateString;
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  }

  const handleRealizadoChange = (goalId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, '');
    if (rawValue === '') {
      setRealizadoValues(prev => ({ ...prev, [goalId]: 0 }));
      return;
    }
    const numericValue = parseInt(rawValue, 10) / 100;
    setRealizadoValues(prev => ({ ...prev, [goalId]: numericValue }));
  };

  const handleNumericChange = (goalId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    setRealizadoValues(prev => ({ ...prev, [goalId]: parseFloat(e.target.value) || 0 }));
  }

  const formatPercentage = (value: number | undefined) => {
    if (value === undefined || isNaN(value)) return "0,00%";
    return `${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
  }

  const formatCurrencyForInput = (value: number | undefined) => {
    if (value === undefined || value === null || isNaN(value)) return '';
    const formatted = new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
    return formatted;
  };

  const fetchData = React.useCallback(async () => {
    try {
      setLoading(true);
      const [
        goalsSnap, typesSnap, periodsSnap, usersSnap,
        branchesSnap, companyBranchesSnap, rolesSnap,
        saleTypesSnap, salesOrdersSnap, servicesSnap
      ] = await Promise.all([
        getDocs(collection(db, "goals")),
        getDocs(query(collection(db, "goaltypes"), firestoreOrderBy("order"))),
        getDocs(collection(db, "periodgroups")),
        getDocs(collection(db, "users")),
        getDocs(collection(db, "branches")),
        getDocs(collection(db, "companyBranches")),
        getDocs(collection(db, "roles")),
        getDocs(collection(db, "saleTypes")),
        getDocs(collection(db, "salesOrders")),
        getDocs(collection(db, "services")),
      ]);

      const goalsList = goalsSnap.docs.map(d => ({ id: d.id, ...d.data() }) as Goal);
      setGoals(goalsList);

      const initialValues: { [key: string]: number } = {};
      goalsList.forEach(g => {
        if (g.realizado !== undefined) {
          initialValues[g.id] = g.realizado;
        }
      });
      setRealizadoValues(initialValues);

      setGoalTypes(typesSnap.docs.map(d => ({ id: d.id, ...d.data() }) as GoalType));
      const fetchedPeriodGroups = periodsSnap.docs.map(d => ({ id: d.id, ...d.data() }) as PeriodGroup);

      const statusOrder = { "Ativo": 1, "Agendado": 2, "Encerrado": 3, "Vazio": 4 };
      fetchedPeriodGroups.sort((a, b) => {
        const statusA = getGroupStatus(a).text;
        const statusB = getGroupStatus(b).text;
        const orderA = statusOrder[statusA as keyof typeof statusOrder] || 99;
        const orderB = statusOrder[statusB as keyof typeof statusOrder] || 99;
        if (orderA !== orderB) {
          return orderA - orderB;
        }
        return a.name.localeCompare(b.name);
      });
      setPeriodGroups(fetchedPeriodGroups);

      setUsers(usersSnap.docs.map(d => ({ id: d.id, ...d.data() }) as UserType));
      setBranches(branchesSnap.docs.map(d => ({ id: d.id, ...d.data() }) as Branch));
      setCompanyBranches(companyBranchesSnap.docs.map(d => ({ id: d.id, ...d.data() }) as CompanyBranch));
      setRoles(rolesSnap.docs.map(d => ({ id: d.id, ...d.data() }) as Role));
      setSaleTypes(saleTypesSnap.docs.map(d => ({ id: d.id, ...d.data() } as SaleType)));
      setSalesOrders(salesOrdersSnap.docs.map(d => ({ id: d.id, ...d.data() } as SalesOrder)));
      setServices(servicesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Service)))

      if (!selectedPeriodGroupId && fetchedPeriodGroups.length > 0) {
        const activeGroup = fetchedPeriodGroups.find(g => getGroupStatus(g).text === "Ativo");
        setSelectedPeriodGroupId(activeGroup?.id || fetchedPeriodGroups[0].id);
      }

    } catch (error) {
      console.error(error);
      toast({
        title: "Erro ao buscar dados",
        description: "Não foi possível carregar a lista de metas e dados relacionados.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast, selectedPeriodGroupId]);


  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getPeriodInfo = (periodId: string): { groupName: string, periodName: string, period: Period | undefined } => {
    for (const group of periodGroups) {
      const period = group.periods.find(p => p.id === periodId);
      if (period) return { groupName: group.name, periodName: period.name, period };
    }
    return { groupName: "N/A", periodName: "N/A", period: undefined };
  }

  const handleSaveRealizado = async (goal: Goal) => {
    if (isSubmitting) return;

    const valueToSave = realizadoValues[goal.id];
    if (valueToSave === undefined || isNaN(Number(valueToSave))) {
      toast({ title: "Valor inválido", description: "Por favor, insira um número.", variant: "destructive" });
      return;
    }

    setIsSubmitting(goal.id);
    try {
      const docRef = doc(db, "goals", goal.id);
      await updateDoc(docRef, { realizado: Number(valueToSave) });

      setGoals(prevGoals => prevGoals.map(g => g.id === goal.id ? { ...g, realizado: Number(valueToSave) } : g));

      toast({
        title: "Valor Salvo!",
        action: <CheckCircle className="text-green-500" />
      });
    } catch (error) {
      console.error("Error saving realizado:", error);
      toast({ title: "Erro ao salvar", description: "Não foi possível registrar o valor.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  }

  const handleSaveAll = async (valuesToSave?: { [key: string]: number }) => {
    const values = valuesToSave || realizadoValues;
    setIsSubmitting(true);
    const batch = writeBatch(db);
    let count = 0;
    for (const goalId in values) {
      const goal = goals.find(g => g.id === goalId);
      if (goal && (goal.realizado || 0) !== values[goalId]) {
        const docRef = doc(db, "goals", goalId);
        batch.update(docRef, { realizado: values[goalId] });
        count++;
      }
    }

    if (count === 0) {
      toast({ title: "Nenhuma alteração para salvar." });
      setIsSubmitting(false);
      return;
    }

    try {
      await batch.commit();
      toast({ title: "Sucesso!", description: `${count} registro(s) de realizado foram salvos.` });
      fetchData();
    } catch (error) {
      toast({ title: "Erro ao salvar tudo", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const togglePeriodLock = async (periodId: string, currentLocked: boolean) => {
    try {
      setIsSubmitting(`lock-${periodId}`);

      const group = periodGroups.find(g => g.periods.some(p => p.id === periodId));
      if (!group) throw new Error("Grupo de período não encontrado");

      const updatedPeriods = group.periods.map(p =>
        p.id === periodId ? { ...p, isLocked: !currentLocked } : p
      );

      const groupRef = doc(db, "periodgroups", group.id);
      await updateDoc(groupRef, { periods: updatedPeriods });

      // Update local state for instant feedback
      setPeriodGroups(prev => prev.map(g =>
        g.id === group.id ? { ...g, periods: updatedPeriods } : g
      ));

      toast({
        title: !currentLocked ? "Período Bloqueado" : "Período Liberado",
        description: `As edições para este período foram ${!currentLocked ? "desativadas" : "ativadas"}.`,
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "Erro ao alterar bloqueio",
        description: "Não foi possível atualizar o status do período.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleGroupAutoSync = async (groupId: string, currentState: boolean) => {
    try {
      setIsSubmitting(`autosync-${groupId}`);
      const docRef = doc(db, "periodgroups", groupId);
      await updateDoc(docRef, { autoSyncEnabled: !currentState });
      
      setPeriodGroups(prev => prev.map(g => g.id === groupId ? { ...g, autoSyncEnabled: !currentState } : g));
      
      toast({ 
        title: !currentState ? "Sincronização Ativada" : "Sincronização Desativada",
        description: `O grupo selecionado agora ${!currentState ? "será" : "não será"} atualizado automaticamente.`
      });
    } catch (error) {
      toast({ title: "Erro ao atualizar sincronização", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCalculateAndFill = React.useCallback((): { newValues: { [key: string]: number }; updatedCount: number } => {
    if (!selectedPeriodGroupId) {
      toast({ title: "Selecione um grupo de período", variant: "destructive" });
      return { newValues: {}, updatedCount: 0 };
    }
    setIsCalculating(true);

    const newRealizadoValues: { [key: string]: number } = { ...realizadoValues };
    const newCalculationDetails: { [key: string]: CalculationDetails } = {};
    let updatedCount = 0;

    const calculateNetReceived = (order: SalesOrder): number => {
      const paidInstallments = (order.payments || []).flatMap(p => p.installments || []).filter(inst => inst.paid);
      if (paidInstallments.length === 0) return 0;
      const totalPaid = paidInstallments.reduce((acc, inst) => acc + inst.value, 0);
      const paidRatio = order.total > 0 ? totalPaid / order.total : 0;
      const proportionalFreight = (order.freightValue || 0) * paidRatio;
      const proportionalServices = (order.services || []).reduce((sum, service) => sum + (service.price * paidRatio), 0);
      return totalPaid - proportionalFreight - proportionalServices;
    };

    const calculateReversals = (order: SalesOrder): number => {
      if (order.status !== 'cancelled' && order.status !== 'returned') return 0;
      const paidInstallments = (order.payments || []).flatMap(p => p.installments || []).filter(inst => inst.paid);
      if (paidInstallments.length === 0) return 0;
      const totalPaid = paidInstallments.reduce((acc, inst) => acc + inst.value, 0);
      const paidRatio = order.total > 0 ? totalPaid / order.total : 0;
      const proportionalFreight = (order.freightValue || 0) * paidRatio;
      const proportionalServices = (order.services || []).reduce((sum, service) => sum + (service.price * paidRatio), 0);
      return totalPaid - proportionalFreight - proportionalServices;
    }

    goals.forEach(goal => {
      if (goal.periodGroupId !== selectedPeriodGroupId) return;

      const goalType = goalTypes.find(gt => gt.id === goal.goalTypeId);
      if (!goalType) return;

      const period = periodGroups.flatMap(pg => pg.periods).find(p => p.id === goal.periodId);
      if (!period) return;

      const startDate = parseISO(period.startDate);
      const endDate = parseISO(period.endDate);

      const salesInPeriod = salesOrders.filter(order => {
        const eventDate = order.status === 'cancelled' || order.status === 'returned'
          ? (order.cancelledAt || order.returnedAt)?.toDate()
          : order.createdAt?.toDate();
        if (!eventDate) return false;
        return isWithinInterval(eventDate, { start: startDate, end: endDate });
      });

      let applicableSales: SalesOrder[] = [];

      if (goal.userId) {
        const user = users.find(u => u.id === goal.userId);
        if (user) {
          applicableSales = salesInPeriod.filter(order => {
            if (order.createdByUserId !== user.id) return false;
            const saleType = saleTypes.find(st => st.id === order.saleTypeId);
            // Global (all roles allowed) OR user's role is specifically allowed
            return !saleType?.roleIds || saleType.roleIds.length === 0 || saleType.roleIds.includes(user.roleId);
          });
        }
      } else if (goal.branchId) {
        applicableSales = salesInPeriod.filter(order => {
          const companyBranch = companyBranches.find(cb => cb.id === order.companyBranchId);
          if (companyBranch?.branchId !== goal.branchId) return false;

          const saleType = saleTypes.find(st => st.id === order.saleTypeId);
          // Global for branches (no specific branches linked) OR this branch is specifically linked
          return !saleType?.branchIds || saleType.branchIds.length === 0 || saleType.branchIds.includes(goal.branchId!);
        });
      } else if (goal.roleId) {
        const salesByMembers = salesInPeriod.filter(order => {
          const seller = users.find(u => u.id === order.createdByUserId);
          return seller?.roleId === goal.roleId;
        });

        const saleTypesForRole = saleTypes.filter(st => {
          const isAllowedForRole = !st.roleIds || st.roleIds.length === 0 || st.roleIds.includes(goal.roleId!);
          return isAllowedForRole;
        });
        const saleTypeIdsForRole = new Set(saleTypesForRole.map(st => st.id));

        const salesByRole = salesInPeriod.filter(order => {
          const seller = users.find(u => u.id === order.createdByUserId);
          return seller?.roleId === goal.roleId && saleTypeIdsForRole.has(order.saleTypeId);
        });

        const consolidatedSales = salesInPeriod.filter(order => {
          const saleType = saleTypes.find(st => st.id === order.saleTypeId);
          return saleType?.consolidateToRoleIds?.includes(goal.roleId!) && saleTypeIdsForRole.has(order.saleTypeId);
        });

        const salesMap = new Map<string, SalesOrder>();
        salesByRole.forEach(order => salesMap.set(order.id, order));
        consolidatedSales.forEach(order => salesMap.set(order.id, order));
        applicableSales = Array.from(salesMap.values());
      }

      let realizadoValue = 0;
      const goalTypeNameLower = goalType.name.toLowerCase();
      let totalVendasCalc = 0;
      let totalFreteCalc = 0;
      let totalServicosCalc = 0;


      if (goalTypeNameLower.includes('mercantil')) {
        const mercantilSales = applicableSales.filter(o => saleTypes.find(st => st.id === o.saleTypeId)?.countsTowardsMercantilGoal);
        realizadoValue = mercantilSales.reduce((sum, order) => {
          const netReceived = calculateNetReceived(order);
          const reversalAmount = calculateReversals(order);
          const value = netReceived - reversalAmount;
          totalVendasCalc += value;
          return sum + value;
        }, 0);
      } else if (goalTypeNameLower.includes('frete')) {
        const freightSales = applicableSales.filter(o => saleTypes.find(st => st.id === o.saleTypeId)?.countsTowardsFreightGoal);
        realizadoValue = freightSales.reduce((sum, order) => {
          if (order.status === 'cancelled' || order.status === 'returned') return sum;
          const totalPaid = (order.payments || []).flatMap(p => p.installments).filter(i => i.paid).reduce((acc, i) => acc + i.value, 0);
          const paidRatio = order.total > 0 ? totalPaid / order.total : 0;
          const value = (order.freightValue || 0) * paidRatio;
          totalFreteCalc += value;
          return sum + value;
        }, 0);
      } else if (services.some(s => s.name.toLowerCase() === goalTypeNameLower)) {
        const service = services.find(s => s.name.toLowerCase() === goalTypeNameLower);
        const serviceSales = applicableSales.filter(o => saleTypes.find(st => st.id === o.saleTypeId)?.countsTowardsServiceGoal);
        realizadoValue = serviceSales.reduce((sum, order) => {
          if (order.status === 'cancelled' || order.status === 'returned') return sum;
          const serviceInOrder = (order.services || []).find(s => s.serviceId === service!.id);
          if (!serviceInOrder) return sum;
          const totalPaid = (order.payments || []).flatMap(p => p.installments).filter(i => i.paid).reduce((acc, i) => acc + i.value, 0);
          const paidRatio = order.total > 0 ? totalPaid / order.total : 0;
          const value = serviceInOrder.price * paidRatio;
          totalServicosCalc += value;
          return sum + value;
        }, 0);
      } else {
        const saleTypeForGoal = saleTypes.find(st => st.name.toLowerCase() === goalTypeNameLower);
        if (saleTypeForGoal) {
          const salesForThisType = applicableSales.filter(order => order.saleTypeId === saleTypeForGoal.id);
          realizadoValue = salesForThisType.reduce((sum, order) => sum + calculateNetReceived(order) - calculateReversals(order), 0);
        }
      }

      if (realizadoValue !== (newRealizadoValues[goal.id] || 0)) {
        newRealizadoValues[goal.id] = realizadoValue;
        newCalculationDetails[goal.id] = { totalVendas: totalVendasCalc, totalFrete: totalFreteCalc, totalServicos: totalServicosCalc };
        updatedCount++;
      }
    });

    setRealizadoValues(newRealizadoValues);
    setCalculationDetails(newCalculationDetails);

    if (updatedCount > 0) {
      toast({ title: "Cálculo Concluído!", description: `${updatedCount} campos de 'Realizado' foram preenchidos ou atualizados.` });
    } else {
      toast({ title: "Nenhuma alteração", description: "Os valores calculados são os mesmos já presentes." });
    }
    setIsCalculating(false);
    return { newValues: newRealizadoValues, updatedCount };
  }, [selectedPeriodGroupId, periodGroups, goals, salesOrders, users, saleTypes, services, companyBranches, goalTypes, realizadoValues, toast]);

  const runAutoUpdateAndSave = React.useCallback(async () => {
    const { newValues, updatedCount } = handleCalculateAndFill();
    if (updatedCount > 0) {
      await handleSaveAll(newValues);
    }
  }, [handleCalculateAndFill]);


  const groupGoals = (goalsToGroup: Goal[], responsibleType: 'user' | 'branch' | 'role'): GroupedGoal[] => {
    const grouped = goalsToGroup.reduce((acc, goal) => {
      let key: string | undefined;
      let responsibleId: string | undefined;
      let responsibleName: string | undefined;

      if (responsibleType === 'user' && goal.userId) {
        key = goal.userId;
        responsibleId = goal.userId;
        const user = users.find(u => u.id === key);
        responsibleName = user ? `${user.name} (${roles.find(r => r.id === user.roleId)?.name || 'N/A'})` : 'N/A';
      } else if (responsibleType === 'branch' && goal.branchId && !goal.userId) {
        key = goal.branchId;
        responsibleId = goal.branchId;
        responsibleName = branches.find(b => b.id === key)?.name || 'N/A';
      } else if (responsibleType === 'role' && goal.roleId && !goal.userId && !goal.branchId) {
        key = goal.roleId;
        responsibleId = goal.roleId;
        responsibleName = roles.find(r => r.id === key)?.name || 'N/A';
      } else {
        return acc;
      }

      if (!acc[key]) {
        acc[key] = {
          groupKey: key,
          responsibleId: responsibleId!,
          responsibleName: responsibleName!,
          responsibleType: responsibleType,
          periods: [],
        };
      }

      const { periodName, period } = getPeriodInfo(goal.periodId);
      let periodGroup = acc[key].periods.find(p => p.periodId === goal.periodId);
      if (!periodGroup) {
        periodGroup = { periodId: goal.periodId, periodName: periodName, goals: [] };
        acc[key].periods.push(periodGroup);
      }
      periodGroup.goals.push(goal);

      return acc;
    }, {} as { [key: string]: GroupedGoal });

    const sortedResult = Object.values(grouped).sort((a, b) => a.responsibleName.localeCompare(b.responsibleName));
    sortedResult.forEach(group => {
      group.periods.sort((a, b) => a.periodName.localeCompare(b.periodName, undefined, { numeric: true }));
      group.periods.forEach(period => {
        period.goals.sort((a, b) => {
          const typeA = goalTypes.find(gt => gt.id === a.goalTypeId);
          const typeB = goalTypes.find(gt => gt.id === b.goalTypeId);
          return (typeA?.order || 0) - (typeB?.order || 0);
        });
      });
    });

    return sortedResult;
  }

  const renderGoalsTable = (goalsInPeriod: Goal[], responsibleName: string) => {
    const { period } = getPeriodInfo(goalsInPeriod[0]?.periodId);
    const isLocked = period?.isLocked || false;

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tipo de Meta</TableHead>
            <TableHead>Meta</TableHead>
            <TableHead>Atingido</TableHead>
            <TableHead>Realizado</TableHead>
            <TableHead className="w-40 text-right">Ação</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {goalsInPeriod.map(goal => {
            const goalType = goalTypes.find(gt => gt.id === goal.goalTypeId);
            const valueType = goalType?.valueType || 'currency';
            const isFreight = goalType?.name.toLowerCase().includes('frete');
            const target = (isFreight && (() => {
              const mercantilGoal = goals.find(g => g.periodId === goal.periodId && g.branchId === goal.branchId && g.roleId === goal.roleId && g.userId === goal.userId && goalTypes.find(t => t.id === g.goalTypeId && t.name.toLowerCase().includes('mercantil')));
              return ((realizadoValues[mercantilGoal?.id ?? ''] ?? mercantilGoal?.realizado ?? 0) * (goal.targetValue ?? 0)) / 100;
            })()) || (goal.hasLevels ? goal.levelTargets?.Diamante : goal.targetValue) || 0;

            const realizado = realizadoValues[goal.id] ?? 0;
            const achievement = target > 0 ? (realizado / target) * 100 : 0;
            const details = calculationDetails[goal.id];

            return (
              <TableRow key={goal.id} className={isLocked ? "bg-muted/50" : ""}>
                <TableCell className="font-medium">{goalType?.name}</TableCell>
                <TableCell><Badge variant="outline" className="font-mono">{isFreight ? formatCurrency(target) : (valueType === 'currency' ? formatCurrency(target) : `${target}%`)}</Badge></TableCell>
                <TableCell><Badge variant={achievement >= 100 ? "default" : "secondary"} className="gap-1.5"><TrendingUp className="h-3.5 w-3.5" />{formatPercentage(achievement)}</Badge></TableCell>
                <TableCell>
                  <div className="relative">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="absolute -left-1 top-1/2 -translate-y-1/2 cursor-help">
                            {details && <Calculator className="h-4 w-4 text-muted-foreground" />}
                          </span>
                        </TooltipTrigger>
                        {details && (
                          <TooltipContent>
                            <p>Vendas: {formatCurrency(details.totalVendas)}</p>
                            <p>Frete: {formatCurrency(details.totalFrete)}</p>
                            <p>Serviços: {formatCurrency(details.totalServicos)}</p>
                          </TooltipContent>
                        )}
                      </Tooltip>
                    </TooltipProvider>
                    {(valueType === 'currency' || isFreight) ? (<><span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span><Input type="text" className="h-9 pl-8 w-40" placeholder="0,00" value={formatCurrencyForInput(realizadoValues[goal.id])} onChange={(e) => handleRealizadoChange(goal.id, e)} disabled={isLocked || isSubmitting === goal.id} /></>)
                      : (<><Input type="number" className="h-9 w-40 pr-8" placeholder="0" value={realizadoValues[goal.id] ?? ''} onChange={(e) => handleNumericChange(goal.id, e)} disabled={isLocked || isSubmitting === goal.id} /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span></>)}
                  </div>
                </TableCell>
                <TableCell className="text-right"><Button size="sm" onClick={() => handleSaveRealizado(goal)} disabled={isLocked || !!isSubmitting}>{isSubmitting === goal.id ? <Loader2 className="h-4 w-4 animate-spin" /> : (isLocked ? <Lock className="h-4 w-4" /> : <Save className="h-4 w-4" />)}<span className="sr-only">Salvar</span></Button></TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    )
  };

  const renderResponsibleAccordion = (responsibleType: 'user' | 'branch' | 'role') => {
    let items: { id: string; name: string; icon: React.ReactNode }[];
    switch (responsibleType) {
      case 'user':
        items = users.filter(u => u.roleId && u.roleId.trim() !== "").map(u => ({ ...u, icon: <UserIcon className="h-5 w-5" /> }));
        break;
      case 'branch':
        items = branches.map(b => ({ ...b, icon: <GitFork className="h-5 w-5" /> }));
        break;
      case 'role':
        items = roles.map(r => ({ ...r, icon: <BriefcaseBusiness className="h-5 w-5" /> }));
        break;
      default:
        items = [];
    }

    const sortedItems = [...items].sort((a, b) => a.name.localeCompare(b.name));

    const itemsWithGoals = sortedItems.filter(item =>
      goals.some(g => {
        if (selectedPeriodGroupId && g.periodGroupId !== selectedPeriodGroupId) return false;
        if (responsibleType === 'user') return g.userId === item.id;
        if (responsibleType === 'branch') return g.branchId === item.id && !g.userId;
        if (responsibleType === 'role') return g.roleId === item.id && !g.userId && !g.branchId;
        return false;
      })
    );

    if (itemsWithGoals.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center text-center text-muted-foreground py-16">
          <Frown className="h-10 w-10 mb-4" />
          <p>Nenhuma meta encontrada para esta categoria no período selecionado.</p>
        </div>
      );
    }

    return (
      <Accordion type="multiple" className="w-full">
        {itemsWithGoals.map(item => {
          let filteredGoals: Goal[];
          if (responsibleType === 'user') {
            filteredGoals = goals.filter(goal => goal.userId === item.id);
          } else if (responsibleType === 'branch') {
            filteredGoals = goals.filter(goal => goal.branchId === item.id && !goal.userId);
          } else { // role
            filteredGoals = goals.filter(goal => goal.roleId === item.id && !goal.userId && !goal.branchId);
          }

          if (selectedPeriodGroupId) {
            filteredGoals = filteredGoals.filter(goal => goal.periodGroupId === selectedPeriodGroupId);
          }

          if (filteredGoals.length === 0) return null;

          let name = item.name;
          if (responsibleType === 'user') {
            const user = users.find(u => u.id === item.id);
            const role = roles.find(r => r.id === user?.roleId);
            name = role ? `${user?.name} (${role.name})` : user?.name ?? 'N/A';
          }

          const goalsByPeriod = filteredGoals.reduce((acc, goal) => {
            const { periodName, period } = getPeriodInfo(goal.periodId);
            if (period) {
              if (!acc[period.id]) {
                acc[period.id] = { name: periodName, goals: [], startDate: period.startDate };
              }
              acc[period.id].goals.push(goal);
            }
            return acc;
          }, {} as Record<string, { name: string, goals: Goal[], startDate: string }>);

          // Sort goals in each period by goalType order
          Object.values(goalsByPeriod).forEach(p => {
            p.goals.sort((a, b) => {
              const typeA = goalTypes.find(gt => gt.id === a.goalTypeId);
              const typeB = goalTypes.find(gt => gt.id === b.goalTypeId);
              const orderA = typeA?.order !== undefined ? typeA.order : 999;
              const orderB = typeB?.order !== undefined ? typeB.order : 999;
              return orderA - orderB;
            });
          });

          const sortedPeriods = Object.values(goalsByPeriod).sort((a, b) => a.startDate.localeCompare(b.startDate));

          const totalRealizado = filteredGoals.reduce((sum, goal) => sum + (realizadoValues[goal.id] || 0), 0);
          let totalMeta = filteredGoals.reduce((sum, goal) => {
            const target = (goal.hasLevels ? goal.levelTargets?.Diamante : goal.targetValue) || 0;
            return sum + target;
          }, 0);
          const totalAchievement = totalMeta > 0 ? (totalRealizado / totalMeta) * 100 : 0;

          return (
            <AccordionItem value={item.id} key={item.id}>
              <AccordionTrigger className="text-lg font-medium hover:no-underline">
                <div className="flex w-full items-center justify-between pr-4">
                  <div className="flex items-center gap-2">
                    {item.icon}
                    {name}
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge variant="secondary">Metas: {filteredGoals.length}</Badge>
                    <span className="font-semibold text-primary">{formatPercentage(totalAchievement)}</span>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                {sortedPeriods.map(({ name: periodName, goals: goalsInPeriod, startDate }) => {
                  const { period } = getPeriodInfo(goalsInPeriod[0]?.periodId);
                  const isLocked = period?.isLocked || false;
                  const periodId = goalsInPeriod[0]?.periodId;

                  return (
                    <Card key={periodName} className="mb-4">
                      <CardHeader className="bg-muted/30 p-2 sm:p-3 flex flex-row items-center justify-between space-y-0">
                        <h3 className="font-semibold flex items-center gap-2">
                          {isLocked ? <Lock className="h-4 w-4 text-rose-500" /> : <Unlock className="h-4 w-4 text-emerald-500" />}
                          {periodName}
                        </h3>
                        <Button
                          variant="ghost"
                          size="sm"
                          className={cn(
                            "h-8 px-2 gap-2 text-xs font-bold transition-all",
                            isLocked
                              ? "text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                              : "text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                          )}
                          onClick={() => togglePeriodLock(periodId, isLocked)}
                          disabled={isSubmitting === `lock-${periodId}`}
                        >
                          {isSubmitting === `lock-${periodId}` ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : isLocked ? (
                            <>
                              <Unlock className="h-3.5 w-3.5" />
                              <span className="hidden sm:inline">Liberar Período</span>
                            </>
                          ) : (
                            <>
                              <Lock className="h-3.5 w-3.5" />
                              <span className="hidden sm:inline">Bloquear Período</span>
                            </>
                          )}
                        </Button>
                      </CardHeader>
                      <CardContent className="p-0">
                        {renderGoalsTable(goalsInPeriod, name)}
                      </CardContent>
                    </Card>
                  )
                })}
              </AccordionContent>
            </AccordionItem>
          )
        })}
      </Accordion>
    );
  }

  const filterOptions = [
    { value: 'user', label: 'Por Vendedor' },
    { value: 'branch', label: 'Por Filial' },
    { value: 'role', label: 'Por Função' },
  ];

  if (authLoading) {
    return <div className="flex justify-center items-center h-96"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold font-headline tracking-tight">Lançar Realizado</h1>
            <p className="text-muted-foreground">Insira os valores realizados para cada meta e período.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={handleCalculateAndFill} disabled={isCalculating}>
              {isCalculating ? <Loader2 className="animate-spin mr-2" /> : <Calculator className="mr-2 h-4 w-4" />}
              Calcular Automaticamente
            </Button>
            <Button onClick={() => handleSaveAll()} disabled={!!isSubmitting}>
              {isSubmitting === true ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="mr-2 h-4 w-4" />}
              <span className="hidden sm:inline">Salvar Tudo</span>
            </Button>
            <Button variant="outline" onClick={fetchData} disabled={loading}>
              <RefreshCw className={loading ? "animate-spin h-4 w-4" : "h-4 w-4"} />
            </Button>
          </div>
        </div>

        {/* Auto-Sync Config Card */}
        <Card className="border-dashed border-primary/20 bg-primary/5 shadow-sm">
          <CardHeader className="py-4 px-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                {isSyncingGlobal ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : <RefreshCw className="h-5 w-5 text-muted-foreground" />}
                <div>
                  <CardTitle className="text-base">Sincronização Automática (Global)</CardTitle>
                  <CardDescription className="text-xs">
                    {lastSyncAt
                      ? `Última atualização: ${formatDateDateFns(lastSyncAt, "HH:mm:ss", { locale: ptBR })}`
                      : autoSyncConfig.enabled ? "Aguardando próximo ciclo..." : "Mestre desativado"}
                  </CardDescription>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground font-medium">Intervalo:</span>
                  <Select
                    value={String(autoSyncConfig.intervalMinutes)}
                    onValueChange={(v) => setAutoSyncConfig({ ...autoSyncConfig, intervalMinutes: Number(v) as AutoSyncInterval })}
                    disabled={!autoSyncConfig.enabled}
                  >
                    <SelectTrigger className="w-32 h-9 rounded-xl border-border/50 bg-background/50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="5">5 minutos</SelectItem>
                      <SelectItem value="10">10 minutos</SelectItem>
                      <SelectItem value="30">30 minutos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-3 bg-background/50 px-3 py-1.5 rounded-xl border border-border/50">
                  <Switch
                    id="autosync-toggle"
                    checked={autoSyncConfig.enabled}
                    onCheckedChange={(checked) => setAutoSyncConfig({ ...autoSyncConfig, enabled: checked })}
                  />
                  <label htmlFor="autosync-toggle" className="text-sm font-semibold cursor-pointer">
                    {autoSyncConfig.enabled ? "Ativado" : "Desativado"}
                  </label>
                </div>
              </div>
            </div>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <CardTitle>Metas Cadastradas</CardTitle>
                <CardDescription>Encontre a meta e insira o valor realizado no período correspondente.</CardDescription>
              </div>
              <div className="w-full sm:w-auto flex flex-col sm:flex-row items-end sm:items-center gap-4">
                {selectedPeriodGroupId && (
                  <div className="flex items-center gap-2 bg-muted/50 px-3 py-1.5 rounded-xl border border-border/50">
                    <Label htmlFor="group-autosync" className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest cursor-pointer">AutoSync</Label>
                    <Switch 
                      id="group-autosync"
                      checked={periodGroups.find(g => g.id === selectedPeriodGroupId)?.autoSyncEnabled || false}
                      onCheckedChange={(checked) => toggleGroupAutoSync(selectedPeriodGroupId, !checked)}
                      disabled={isSubmitting === `autosync-${selectedPeriodGroupId}`}
                    />
                  </div>
                )}
                <Select value={selectedPeriodGroupId || ''} onValueChange={setSelectedPeriodGroupId}>
                  <SelectTrigger className="w-full sm:w-[280px]">
                    <SelectValue placeholder="Filtrar por Grupo de Período..." />
                  </SelectTrigger>
                  <SelectContent>
                    {periodGroups.map(group => {
                      const status = getGroupStatus(group);
                      return (
                        <SelectItem key={group.id} value={group.id}>
                          <div className="flex items-center justify-between w-full">
                            <div className="flex items-center gap-2">
                              <span>{group.name}</span>
                              {group.autoSyncEnabled && <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" title="Sincronização Ativa" />}
                            </div>
                            <Badge variant={status.variant} className="ml-4">{status.text}</Badge>
                          </div>
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center items-center h-40">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <>
                <div className="mb-4 hidden sm:block">
                  <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList>
                      <TabsTrigger value="user">Por Vendedor</TabsTrigger>
                      <TabsTrigger value="branch">Por Filial</TabsTrigger>
                      <TabsTrigger value="role">Por Função</TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
                <div className="mb-4 sm:hidden">
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
                <div className="pt-2">
                  <div className={activeTab === 'user' ? 'block' : 'hidden'}>{renderResponsibleAccordion('user')}</div>
                  <div className={activeTab === 'branch' ? 'block' : 'hidden'}>{renderResponsibleAccordion('branch')}</div>
                  <div className={activeTab === 'role' ? 'block' : 'hidden'}>{renderResponsibleAccordion('role')}</div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

