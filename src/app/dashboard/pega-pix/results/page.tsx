
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
  RefreshCw,
  Medal,
  Trophy,
  Award,
  Gem,
  Calculator,
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import type { PegaPixGoal, User, Branch, Role, PeriodGroup, GoalLevelTargets, SalesOrder, CompanyBranch } from "@/lib/definitions";
import { format, parseISO, isWithinInterval, startOfDay, endOfDay } from "date-fns";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getGroupStatus } from "@/lib/period-helpers";
import { Switch } from "@/components/ui/switch";
import { usePegaPixAutoSync } from "@/contexts/pega-pix-autosync-context";
import type { AutoSyncInterval } from "@/contexts/pega-pix-autosync-context";
import { ptBR } from "date-fns/locale";
import { format as formatDate } from "date-fns";

const levelIcons: Record<keyof GoalLevelTargets, React.ReactNode> = {
    Bronze: <Medal className="h-4 w-4 text-orange-600" />,
    Prata: <Trophy className="h-4 w-4 text-slate-500" />,
    Ouro: <Award className="h-4 w-4 text-yellow-500" />,
    Diamante: <Gem className="h-4 w-4 text-sky-400" />,
};

export default function PegaPixResultsPage() {
  const { toast } = useToast();
  const { config: autoSyncConfig, setConfig: setAutoSyncConfig, lastSyncAt, isSyncing } = usePegaPixAutoSync();
  // Main data
  const [goals, setGoals] = React.useState<PegaPixGoal[]>([]);
  
  // Related data
  const [periodGroups, setPeriodGroups] = React.useState<PeriodGroup[]>([]);
  const [users, setUsers] = React.useState<User[]>([]);
  const [branches, setBranches] = React.useState<Branch[]>([]);
  const [roles, setRoles] = React.useState<Role[]>([]);

  // UI State
  const [loading, setLoading] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState<string | boolean>(false);
  const [activeTab, setActiveTab] = React.useState("user");
  const [selectedPeriodGroupId, setSelectedPeriodGroupId] = React.useState<string | null>(null);

  // Form state
  const [realizadoValues, setRealizadoValues] = React.useState<{[key: string]: number}>({});
  
  // Calculator State
  const [cachedSalesOrders, setCachedSalesOrders] = React.useState<SalesOrder[] | null>(null);
  const [cachedCompanyBranches, setCachedCompanyBranches] = React.useState<CompanyBranch[] | null>(null);
  const [isCalculating, setIsCalculating] = React.useState<string | false>(false);

  // Derived: is the currently selected period group closed?
  const isSelectedGroupClosed = React.useMemo(() => {
    if (!selectedPeriodGroupId || selectedPeriodGroupId === 'all') return false;
    const selectedGroup = periodGroups.find(g => g.id === selectedPeriodGroupId);
    if (!selectedGroup) return false;
    return getGroupStatus(selectedGroup).text === 'Encerrado';
  }, [selectedPeriodGroupId, periodGroups]);

  // Auto-disable sync when selected period ends
  React.useEffect(() => {
    if (isSelectedGroupClosed && autoSyncConfig.enabled) {
      setAutoSyncConfig({ ...autoSyncConfig, enabled: false });
      toast({
        title: "Auto-Sync Desativado",
        description: "O período selecionado foi encerrado. A atualização automática foi desativada e bloqueada.",
        variant: "default",
      });
    }
  // We intentionally only react to isSelectedGroupClosed changing
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSelectedGroupClosed]);
  
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  }

  const handleRealizadoChange = (goalId: string, e: React.ChangeEvent<HTMLInputElement>) => {
      const rawValue = e.target.value.replace(/\D/g, '');
      if (rawValue === '') {
        setRealizadoValues(prev => ({...prev, [goalId]: 0}));
        return;
      }
      const numericValue = parseInt(rawValue, 10) / 100;
      setRealizadoValues(prev => ({...prev, [goalId]: numericValue}));
  };

  const formatCurrencyForInput = (value: number | undefined) => {
    if (value === undefined || value === null || isNaN(value)) return '';
    return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
  };
  
  const computeGoalNetReceived = (goal: PegaPixGoal, orders: SalesOrder[], companyBranchesMap: CompanyBranch[], pGroup: PeriodGroup) => {
      let totalNetReceived = 0;
      const addValuesIfWithinPeriods = (instDateObj: any, netValue: number) => {
        if (!instDateObj) return;
        const edate = instDateObj?.toDate ? instDateObj.toDate() : new Date(instDateObj || 0);

        for (const p of pGroup.periods) {
           const sDate = (p.startDate as any)?.toDate ? (p.startDate as any).toDate() : new Date(p.startDate || 0);
           const eDate = (p.endDate as any)?.toDate ? (p.endDate as any).toDate() : new Date(p.endDate || 0);
           if (isWithinInterval(edate, { start: startOfDay(sDate), end: endOfDay(eDate) })) {
               totalNetReceived += netValue;
               break;
           }
        }
      };

      orders.forEach(order => {
        if (goal.responsibleType === 'user' && order.createdByUserId !== goal.responsibleId) return;
        if (goal.responsibleType === 'branch') {
            const cb = companyBranchesMap?.find(c => c.id === order.companyBranchId);
            if (!cb || cb.branchId !== goal.responsibleId) return;
        }
        if (goal.responsibleType === 'role') {
            const seller = users.find(u => u.id === order.createdByUserId);
            if (!seller || seller.roleId !== goal.responsibleId) return;
        }

        // Installments
        (order.payments || []).forEach(p => {
          (p.installments || []).forEach(inst => {
            if (inst.paid && inst.paidAt) {
              const receivedRatio = order.total > 0 ? inst.value / order.total : 0;
              const proportionalFreight = (order.freightValue || 0) * receivedRatio;
              let proportionalServicesTotal = 0;
              (order.services || []).forEach(service => {
                  proportionalServicesTotal += service.price * receivedRatio;
              });
              const netValue = inst.value - proportionalFreight - proportionalServicesTotal;
              addValuesIfWithinPeriods(inst.paidAt, netValue);
            }
          });
        });

        // Reversals
        if (order.status === 'cancelled' || order.status === 'returned') {
           const reversalEventDate = order.status === 'cancelled' ? order.cancelledAt : order.returnedAt;
           if (reversalEventDate) {
              let totalPaidBeforeReversal = 0;
              (order.payments || []).forEach(p => {
                  (p.installments || []).forEach(inst => {
                      if (inst.reversalStatus === 'reversal_approved' || inst.paid) {
                          totalPaidBeforeReversal += inst.value;
                      }
                  });
              });

              if (totalPaidBeforeReversal > 0) {
                 const receivedRatio = order.total > 0 ? totalPaidBeforeReversal / order.total : 0;
                 const proportionalFreight = (order.freightValue || 0) * receivedRatio;
                 let proportionalServicesTotal = 0;
                 (order.services || []).forEach(service => {
                    proportionalServicesTotal += service.price * receivedRatio;
                 });
                 const netValueReversal = totalPaidBeforeReversal - proportionalFreight - proportionalServicesTotal;
                 addValuesIfWithinPeriods(reversalEventDate, -netValueReversal);
              }
           }
        }
      }); 
      return totalNetReceived;
  };

  const loadDataForCalculator = async () => {
      let orders = cachedSalesOrders;
      let cbMap = cachedCompanyBranches;
      if (!orders) {
        toast({ title: "Carregando Vendas...", description: "Baixando base de vendas do banco temporariamente..." });
        const ordersSnap = await getDocs(query(collection(db, "salesOrders")));
        orders = ordersSnap.docs.map(d => ({ id: d.id, ...d.data() } as SalesOrder));
        setCachedSalesOrders(orders);
      }
      if (!cbMap) {
        const cbSnap = await getDocs(collection(db, "companyBranches"));
        cbMap = cbSnap.docs.map(d => ({ id: d.id, ...d.data() } as CompanyBranch));
        setCachedCompanyBranches(cbMap);
      }
      return { orders, cbMap };
  };

  const handleCalculateAutomatically = async (goal: PegaPixGoal) => {
    setIsCalculating(goal.id);
    try {
      const { orders, cbMap } = await loadDataForCalculator();

      const pGroup = periodGroups.find(g => g.id === goal.periodGroupId);
      if (!pGroup || !pGroup.periods || pGroup.periods.length === 0) {
        toast({ title: "Erro de Configuração", description: "O Grupo de Período desta meta está vazio.", variant: "destructive" });
        return;
      }

      const totalNetReceived = computeGoalNetReceived(goal, orders, cbMap, pGroup);

      setRealizadoValues(prev => ({...prev, [goal.id]: totalNetReceived}));
      toast({ title: "Cálculo Concluído", description: `R$ ${totalNetReceived.toLocaleString('pt-BR', {minimumFractionDigits: 2})} extraídos das vendas.` });

    } catch (error) {
      console.error(error);
      toast({ title: "Erro de Cálculo", description: "Houve um erro ao processar as vendas.", variant: "destructive" });
    } finally {
      setIsCalculating(false);
    }
  };

  const handleCalculateAllVisible = async () => {
    setIsCalculating('all');
    try {
      const { orders, cbMap } = await loadDataForCalculator();

      const newValues: {[key: string]: number} = {};
      const visibleGoals = goals.filter(g => selectedPeriodGroupId && selectedPeriodGroupId !== 'all' ? g.periodGroupId === selectedPeriodGroupId : true);
      const targets = visibleGoals.filter(g => g.responsibleType === activeTab);
      let count = 0;

      for (const goal of targets) {
        const pGroup = periodGroups.find(g => g.id === goal.periodGroupId);
        if (!pGroup || !pGroup.periods || pGroup.periods.length === 0) continue;
        newValues[goal.id] = computeGoalNetReceived(goal, orders, cbMap, pGroup);
        count++;
      }

      setRealizadoValues(prev => ({...prev, ...newValues}));
      toast({ title: "Cálculo em Lote Concluído", description: `${count} metas extraídas e preenchidas nesta aba.` });

    } catch (error) {
      console.error(error);
      toast({ title: "Erro de Cálculo", description: "Houve um erro ao processar as vendas em lote.", variant: "destructive" });
    } finally {
      setIsCalculating(false);
    }
  };

  

  const fetchData = React.useCallback(async () => {
    try {
      setLoading(true);
      const [goalsSnap, periodsSnap, usersSnap, branchesSnap, rolesSnap] = await Promise.all([
        getDocs(query(collection(db, "pegaPixGoals"), firestoreOrderBy("createdAt", "desc"))),
        getDocs(collection(db, "periodgroups")),
        getDocs(collection(db, "users")),
        getDocs(collection(db, "branches")),
        getDocs(collection(db, "roles"))
      ]);
      
      const goalsList = goalsSnap.docs.map(d => ({id: d.id, ...d.data()}) as PegaPixGoal);
      setGoals(goalsList);
      
      const initialValues: {[key: string]: number} = {};
      goalsList.forEach(g => {
        if(g.realizado !== undefined) {
            initialValues[g.id] = g.realizado;
        }
      });
      setRealizadoValues(initialValues);

      const fetchedPeriodGroups = periodsSnap.docs.map(d => ({id: d.id, ...d.data()}) as PeriodGroup);
      
      // Ordenar do mais atual para o mais antigo (baseado na data de início do primeiro período)
      fetchedPeriodGroups.sort((a, b) => {
        const dateA = a.periods?.[0]?.startDate ? new Date(a.periods[0].startDate).getTime() : 0;
        const dateB = b.periods?.[0]?.startDate ? new Date(b.periods[0].startDate).getTime() : 0;
        return dateB - dateA;
      });

      setPeriodGroups(fetchedPeriodGroups);
      if (!selectedPeriodGroupId) {
        const activeGroup = fetchedPeriodGroups.find(g => getGroupStatus(g).text === 'Ativo');
        setSelectedPeriodGroupId(activeGroup?.id || (fetchedPeriodGroups.length > 0 ? fetchedPeriodGroups[0].id : null));
      }
      
      setUsers(usersSnap.docs.map(d => ({id: d.id, ...d.data()}) as User));
      setBranches(branchesSnap.docs.map(d => ({id: d.id, ...d.data()}) as Branch));
      setRoles(rolesSnap.docs.map(d => ({id: d.id, ...d.data()}) as Role));
      
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
  
  const handleSaveRealizado = async (goalId: string) => {
    if (isSubmitting) return;

    const valueToSave = realizadoValues[goalId];
    if (valueToSave === undefined || isNaN(Number(valueToSave))) {
        toast({ title: "Valor inválido", description: "Por favor, insira um número.", variant: "destructive" });
        return;
    }
    
    setIsSubmitting(goalId);
    try {
        const docRef = doc(db, "pegaPixGoals", goalId);
        await updateDoc(docRef, { realizado: Number(valueToSave) });

        setGoals(prevGoals => prevGoals.map(g => g.id === goalId ? {...g, realizado: Number(valueToSave)} : g));

        toast({
            title: "Valor Salvo!",
            action: <CheckCircle className="text-green-500" />
        });
    } catch (error) {
        console.error("Error saving realizado:", error);
        toast({ title: "Erro ao salvar", description: "Não foi possível registrar o valor.", variant: "destructive"});
    } finally {
        setIsSubmitting(false);
    }
  }

  const handleSaveAllVisible = async () => {
    if (isSubmitting) return;

    const visibleGoals = goals.filter(g => selectedPeriodGroupId && selectedPeriodGroupId !== 'all' ? g.periodGroupId === selectedPeriodGroupId : true);
    const targets = visibleGoals.filter(g => g.responsibleType === activeTab);
    
    const validTargets = targets.filter(g => {
        const val = realizadoValues[g.id];
        return val !== undefined && !isNaN(Number(val)) && Number(val) !== g.realizado;
    });

    if (validTargets.length === 0) {
        toast({ title: "Nenhuma alteração", description: "Não há alterações pendentes nesta aba para salvar.", variant: "default" });
        return;
    }

    setIsSubmitting('all');
    try {
        const batch = writeBatch(db);
        validTargets.forEach(goal => {
            const docRef = doc(db, "pegaPixGoals", goal.id);
            batch.update(docRef, { realizado: Number(realizadoValues[goal.id]) });
        });

        await batch.commit();

        setGoals(prevGoals => prevGoals.map(g => {
            const updateGoal = validTargets.find(t => t.id === g.id);
            if (updateGoal) {
                return {...g, realizado: Number(realizadoValues[g.id])};
            }
            return g;
        }));

        toast({
            title: "Salvo em Lote!",
            description: `${validTargets.length} metas foram atualizadas de uma vez.`,
            action: <CheckCircle className="text-green-500" />
        });
    } catch (error) {
        console.error("Error saving all realizado:", error);
        toast({ title: "Erro ao salvar", description: "Não foi possível registrar os valores em lote.", variant: "destructive"});
    } finally {
        setIsSubmitting(false);
    }
  }

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

  const renderResponsibleAccordion = (
      items: {id: string; name: string; icon: React.ReactNode}[], 
      responsibleType: 'user' | 'branch' | 'role'
    ) => {
    
    const filteredItems = items.filter(item => 
        goals.some(g => 
            g.responsibleId === item.id && 
            g.responsibleType === responsibleType &&
            (selectedPeriodGroupId ? g.periodGroupId === selectedPeriodGroupId : true)
        )
    );

    return (
      <Accordion type="multiple" className="w-full" defaultValue={items.map(i => i.id)}>
          {filteredItems.map(item => {
              const filteredGoals = goals.filter(goal => 
                goal.responsibleId === item.id && 
                goal.responsibleType === responsibleType &&
                (selectedPeriodGroupId ? goal.periodGroupId === selectedPeriodGroupId : true)
              );
              if(filteredGoals.length === 0) return null;
              
              const periodGroupNames = [...new Set(filteredGoals.map(g => periodGroups.find(pg => pg.id === g.periodGroupId)?.name))].join(', ');
              
              return (
                  <AccordionItem value={item.id} key={item.id}>
                      <AccordionTrigger className="text-lg font-medium hover:no-underline">
                          <div className="flex w-full items-center justify-between pr-4">
                            <div className="flex items-center gap-2">
                                {item.icon}
                                {item.name}
                            </div>
                            <Badge variant="secondary">{filteredGoals.length} meta(s)</Badge>
                          </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Nome da Meta</TableHead>
                                    <TableHead>Grupo de Períodos</TableHead>
                                    <TableHead>Níveis da Meta</TableHead>
                                    <TableHead>Realizado</TableHead>
                                    <TableHead className="w-40 text-right">Ação</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredGoals.map(goal => (
                                    <TableRow key={goal.id}>
                                        <TableCell className="font-medium">{goal.name}</TableCell>
                                        <TableCell>{periodGroupNames}</TableCell>
                                        <TableCell>
                                            <div className="flex flex-wrap gap-2">
                                                {(Object.keys(levelIcons) as Array<keyof GoalLevelTargets>).map(level => (
                                                    goal.levels[level] > 0 && (
                                                    <Badge key={level} variant="outline" className="font-mono">
                                                        <span className="mr-1.5">{levelIcons[level]}</span>
                                                        {formatCurrency(goal.levels[level])}
                                                    </Badge>
                                                    )
                                                ))}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="relative flex-grow">
                                                {isSelectedGroupClosed ? (
                                                    <div className="flex items-center gap-2 text-muted-foreground">
                                                        <Lock className="h-3.5 w-3.5" />
                                                        <span className="text-sm font-medium">{formatCurrencyForInput(realizadoValues[goal.id])}</span>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
                                                        <Input
                                                            type="text"
                                                            className="h-9 pl-8 w-40"
                                                            placeholder="0,00"
                                                            value={formatCurrencyForInput(realizadoValues[goal.id])}
                                                            onChange={(e) => handleRealizadoChange(goal.id, e)}
                                                            disabled={isSubmitting === goal.id}
                                                        />
                                                    </>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {isSelectedGroupClosed ? (
                                                <Badge variant="secondary" className="gap-1">
                                                    <Lock className="h-3 w-3" /> Encerrado
                                                </Badge>
                                            ) : (
                                                <div className="flex gap-2 justify-end">
                                                    <Button size="sm" variant="outline" onClick={() => handleCalculateAutomatically(goal)} disabled={!!isSubmitting || isCalculating === goal.id} title="Auto Calcular via Vendas">
                                                        {isCalculating === goal.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <Calculator className="h-4 w-4" />}
                                                    </Button>
                                                    <Button size="sm" onClick={() => handleSaveRealizado(goal.id)} disabled={!!isSubmitting}>
                                                        {isSubmitting === goal.id ? <Loader2 className="h-4 w-4 animate-spin"/> : <Save className="h-4 w-4" />}
                                                        <span className="sr-only">Salvar</span>
                                                    </Button>
                                                </div>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                      </AccordionContent>
                  </AccordionItem>
              )
          })}
      </Accordion>
    );
  }
  
  return (
    <>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold font-headline tracking-tight">Lançar Realizado Pega Pix</h1>
            <p className="text-muted-foreground">Insira os valores realizados para cada meta Pega Pix.</p>
          </div>
            <Button variant="outline" size="icon" onClick={fetchData} disabled={loading}>
              <RefreshCw className={loading ? "animate-spin h-4 w-4" : "h-4 w-4"} />
            </Button>
        </div>

        {/* Auto-Sync Config Card */}
        <Card className="border-dashed">
          <CardHeader className="py-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                {isSyncing ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : <RefreshCw className="h-5 w-5 text-muted-foreground" />}
                <div>
                  <CardTitle className="text-base">Atualização Automática (Global)</CardTitle>
                  <CardDescription className="text-xs">
                    {lastSyncAt
                      ? `Última atualização: ${formatDate(lastSyncAt, "HH:mm:ss", { locale: ptBR })}`
                      : autoSyncConfig.enabled ? "Aguardando próximo ciclo..." : "Mestre desativado"}
                  </CardDescription>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Intervalo:</span>
                  <Select
                    value={String(autoSyncConfig.intervalMinutes)}
                    onValueChange={(v) => setAutoSyncConfig({ ...autoSyncConfig, intervalMinutes: Number(v) as AutoSyncInterval })}
                    disabled={!autoSyncConfig.enabled || isSelectedGroupClosed}
                  >
                    <SelectTrigger className="w-32 h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5 minutos</SelectItem>
                      <SelectItem value="10">10 minutos</SelectItem>
                      <SelectItem value="30">30 minutos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  {isSelectedGroupClosed ? (
                    <Badge variant="secondary" className="gap-1.5 py-1 px-2">
                      <Lock className="h-3 w-3" />
                      Bloqueado — Período Encerrado
                    </Badge>
                  ) : (
                    <>
                      <Switch
                        id="autosync-toggle"
                        checked={autoSyncConfig.enabled}
                        onCheckedChange={(checked) => setAutoSyncConfig({ ...autoSyncConfig, enabled: checked })}
                      />
                      <label htmlFor="autosync-toggle" className="text-sm font-medium cursor-pointer">
                        {autoSyncConfig.enabled ? "Ativado" : "Desativado"}
                      </label>
                    </>
                  )}
                </div>
              </div>
            </div>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
               <div>
                <CardTitle>Metas Pega Pix</CardTitle>
                <CardDescription>Encontre a meta e insira o valor realizado no período correspondente.</CardDescription>
               </div>
                    <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                        {selectedPeriodGroupId && selectedPeriodGroupId !== 'all' && (
                            <div className="flex items-center gap-2 bg-muted/50 px-3 py-1.5 rounded-xl border border-border/50">
                                <label htmlFor="group-autosync" className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest cursor-pointer">AutoSync</label>
                                <Switch 
                                    id="group-autosync"
                                    checked={periodGroups.find(g => g.id === selectedPeriodGroupId)?.autoSyncEnabled || false}
                                    onCheckedChange={(checked) => toggleGroupAutoSync(selectedPeriodGroupId, !checked)}
                                    disabled={isSubmitting === `autosync-${selectedPeriodGroupId}`}
                                />
                            </div>
                        )}
                        <Button 
                            variant="secondary" 
                            onClick={handleCalculateAllVisible} 
                            disabled={isCalculating !== false || !!isSubmitting}
                            className="w-full sm:w-auto whitespace-nowrap"
                        >
                            {isCalculating === 'all' ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Calculator className="mr-2 h-4 w-4" />}
                            Calcular Tudo da Tela
                        </Button>
                        <Button 
                            onClick={handleSaveAllVisible} 
                            disabled={!!isSubmitting}
                            className="w-full sm:w-auto whitespace-nowrap"
                        >
                            {isSubmitting === 'all' ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />}
                            Salvar Tudo da Tela
                        </Button>
                        <Select value={selectedPeriodGroupId || ''} onValueChange={setSelectedPeriodGroupId}>
                            <SelectTrigger className="w-full sm:w-[280px]">
                                <SelectValue placeholder="Filtrar por Grupo de Período..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos os Grupos</SelectItem>
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
             <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList>
                    <TabsTrigger value="user">Por Vendedor</TabsTrigger>
                    <TabsTrigger value="branch">Por Filial</TabsTrigger>
                    <TabsTrigger value="role">Por Função</TabsTrigger>
                </TabsList>
                 <TabsContent value="user" className="pt-4">
                    {renderResponsibleAccordion(users.map(u => ({...u, icon: <UserIcon className="h-5 w-5"/>})), 'user')}
                </TabsContent>
                <TabsContent value="branch" className="pt-4">
                    {renderResponsibleAccordion(branches.map(b => ({...b, icon: <GitFork className="h-5 w-5"/>})), 'branch')}
                </TabsContent>
                <TabsContent value="role" className="pt-4">
                    {renderResponsibleAccordion(roles.map(r => ({...r, icon: <BriefcaseBusiness className="h-5 w-5"/>})), 'role')}
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
