
"use client";

import * as React from "react";
import {
  Loader2,
  GitFork,
  User as UserIcon,
  BriefcaseBusiness,
  Save,
  Target,
  BarChart,
  Calendar,
  RefreshCcw,
  Medal,
  Trophy,
  Award,
  Gem,
  Calculator,
  Lightbulb,
  Percent,
} from "lucide-react";
import {
  collection,
  getDocs,
  query,
  orderBy,
  writeBatch,
  doc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import type { Goal, GoalFormData, PeriodGroup, User, Branch, Role, GoalType, GoalLevelTargets, Period, PeriodTarget } from "@/lib/definitions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { suggestWeeklyDistribution, WeeklyDistributionInput } from "@/ai/flows/suggest-weekly-distribution-flow";
import { getGroupStatus } from "@/lib/period-helpers";
import { parseISO } from "date-fns";

const initialLevelTargets: GoalLevelTargets = { Bronze: 0, Prata: 0, Ouro: 0, Diamante: 0 };
const initialPeriodTarget: PeriodTarget = { isLevelGoal: false, targetValue: 0, levelTargets: initialLevelTargets };

const initialFormData: GoalFormData = {
  responsibleType: 'branch',
  responsibleId: '',
  periodGroupId: '',
  goalTypeId: '',
  periodTargets: {},
};

const levelIcons: Record<keyof GoalLevelTargets, React.ReactNode> = {
    Bronze: <Medal className="h-4 w-4 text-orange-600" />,
    Prata: <Trophy className="h-4 w-4 text-slate-500" />,
    Ouro: <Award className="h-4 w-4 text-yellow-500" />,
    Diamante: <Gem className="h-4 w-4 text-sky-400" />,
};

export default function CreateGoalPage() {
  const { toast } = useToast();
  const [formData, setFormData] = React.useState<GoalFormData>(initialFormData);
  const [loading, setLoading] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isSuggesting, setIsSuggesting] = React.useState(false);
  const [geminiApiKey, setGeminiApiKey] = React.useState("");

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const savedKey = localStorage.getItem("gemini_api_key") || "";
      setGeminiApiKey(savedKey);
    }
  }, []);

  // State for the calculator
  const [realizadoAnterior, setRealizadoAnterior] = React.useState(0);
  const [inflacao, setInflacao] = React.useState(0);
  const [crescimento, setCrescimento] = React.useState(0);
  const [taxaAumentoNivel, setTaxaAumentoNivel] = React.useState(0);
  const [metaBaseCalculada, setMetaBaseCalculada] = React.useState(0);
  
  // State for distribution
  const [pesos, setPesos] = React.useState<Record<string, number>>({});
  const [totalPeso, setTotalPeso] = React.useState(0);

  // Data from Firestore
  const [periodGroups, setPeriodGroups] = React.useState<PeriodGroup[]>([]);
  const [users, setUsers] = React.useState<User[]>([]);
  const [branches, setBranches] = React.useState<Branch[]>([]);
  const [roles, setRoles] = React.useState<Role[]>([]);
  const [goalTypes, setGoalTypes] = React.useState<GoalType[]>([]);

  const salespeople = React.useMemo(() => users.filter(u => u.roleId && u.roleId.trim() !== ""), [users]);

  const selectedPeriods = React.useMemo(() => {
    if (!formData.periodGroupId) return [];
    const group = periodGroups.find(g => g.id === formData.periodGroupId);
    return group ? group.periods.sort((a,b) => a.name.localeCompare(b.name, undefined, { numeric: true })) : [];
  }, [formData.periodGroupId, periodGroups]);

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [groupsSnap, usersSnap, branchesSnap, rolesSnap, typesSnap] = await Promise.all([
          getDocs(collection(db, "periodgroups")),
          getDocs(query(collection(db, "users"), orderBy("name"))),
          getDocs(query(collection(db, "branches"), orderBy("name"))),
          getDocs(query(collection(db, "roles"), orderBy("name"))),
          getDocs(query(collection(db, "goaltypes"), orderBy("order"))),
        ]);
        const statusOrder = { "Ativo": 1, "Agendado": 2, "Encerrado": 3, "Vazio": 4 };
        const fetchedGroups = groupsSnap.docs.map(d => ({ id: d.id, ...d.data() } as PeriodGroup));
        fetchedGroups.sort((a, b) => {
          const statusA = statusOrder[getGroupStatus(a).text as keyof typeof statusOrder] || 99;
          const statusB = statusOrder[getGroupStatus(b).text as keyof typeof statusOrder] || 99;
          if (statusA !== statusB) return statusA - statusB;
          // Within same status, sort by most recent start date descending
          const dateA = a.periods?.[0]?.startDate ? parseISO(a.periods[0].startDate).getTime() : 0;
          const dateB = b.periods?.[0]?.startDate ? parseISO(b.periods[0].startDate).getTime() : 0;
          return dateB - dateA;
        });
        setPeriodGroups(fetchedGroups);
        setUsers(usersSnap.docs.map(d => ({ id: d.id, ...d.data() } as User)));
        setBranches(branchesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Branch)));
        setRoles(rolesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Role)));
        setGoalTypes(typesSnap.docs.map(d => ({ id: d.id, ...d.data() } as GoalType)));
      } catch (error) {
        console.error("Error fetching data:", error);
        toast({ title: "Erro ao buscar dados", description: "Não foi possível carregar as opções para criar a meta.", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [toast]);

  // Recalculate meta whenever calculator inputs change
  React.useEffect(() => {
    const metaComInflacao = realizadoAnterior * (1 + inflacao / 100);
    const metaFinal = metaComInflacao * (1 + crescimento / 100);
    setMetaBaseCalculada(metaFinal);
  }, [realizadoAnterior, inflacao, crescimento]);
  
  // Recalculate total weight
  React.useEffect(() => {
    const total = Object.values(pesos).reduce((sum, p) => sum + p, 0);
    setTotalPeso(total);
  }, [pesos]);
  
  // Reset and initialize weights and targets when periods change
  React.useEffect(() => {
    if (selectedPeriods.length > 0) {
      const newPesos: Record<string, number> = {};
      const newTargets: Record<string, PeriodTarget> = {};
      const evenWeight = 100 / selectedPeriods.length;

      selectedPeriods.forEach((period, index) => {
        newPesos[period.id] = parseFloat(evenWeight.toFixed(2));
        newTargets[period.id] = { ...initialPeriodTarget };
      });

      // Adjust last period's weight to sum to 100
      const sumOfWeights = Object.values(newPesos).reduce((sum, weight) => sum + weight, 0);
      const lastPeriodId = selectedPeriods[selectedPeriods.length - 1].id;
      newPesos[lastPeriodId] = parseFloat((newPesos[lastPeriodId] + (100 - sumOfWeights)).toFixed(2));

      setPesos(newPesos);
      setFormData(prev => ({...prev, periodTargets: newTargets}));
    } else {
      setPesos({});
      setFormData(prev => ({...prev, periodTargets: {}}));
    }
  }, [selectedPeriods]);

  const handleApplyDistribution = () => {
    if (Math.round(totalPeso) !== 100) {
      toast({ title: "Soma dos Pesos Inválida", description: `A soma dos pesos deve ser 100%. Atualmente é ${totalPeso.toFixed(2)}%.`, variant: "destructive" });
      return;
    }
    
    if (metaBaseCalculada <= 0) {
      toast({ title: "Meta não calculada", description: "Use a calculadora primeiro para definir um valor de meta base.", variant: "destructive" });
      return;
    }

    const newPeriodTargets = { ...formData.periodTargets };
    
    selectedPeriods.forEach(period => {
      const peso = pesos[period.id] / 100;
      const metaPeriodo = metaBaseCalculada * peso;

      if (newPeriodTargets[period.id].isLevelGoal) {
        const metaBronze = metaPeriodo;
        const aumento = 1 + taxaAumentoNivel / 100;
        const metaPrata = metaBronze * aumento;
        const metaOuro = metaPrata * aumento;
        const metaDiamante = metaOuro * aumento;
        newPeriodTargets[period.id].levelTargets = {
          Bronze: metaBronze,
          Prata: metaPrata,
          Ouro: metaOuro,
          Diamante: metaDiamante,
        };
      } else {
        newPeriodTargets[period.id].targetValue = metaPeriodo;
      }
    });

    setFormData(prev => ({...prev, periodTargets: newPeriodTargets }));
    toast({ title: "Distribuição Aplicada!", description: "Os valores das metas foram preenchidos com base nos cálculos." });
  };

  const handleInputChange = (field: keyof GoalFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handlePeriodTargetChange = (periodId: string, field: keyof PeriodTarget, value: any) => {
    setFormData(prev => ({
      ...prev,
      periodTargets: {
        ...prev.periodTargets,
        [periodId]: {
          ...prev.periodTargets[periodId],
          [field]: value,
        },
      },
    }));
  };

  const handleLevelTargetChange = (periodId: string, level: keyof GoalLevelTargets, value: number) => {
    setFormData(prev => ({
        ...prev,
        periodTargets: {
            ...prev.periodTargets,
            [periodId]: {
                ...prev.periodTargets[periodId],
                levelTargets: {
                    ...prev.periodTargets[periodId].levelTargets,
                    [level]: value
                }
            }
        }
    }));
  }
  
  const handleReset = () => {
    setFormData(initialFormData);
    setRealizadoAnterior(0);
    setInflacao(0);
    setCrescimento(0);
    setTaxaAumentoNivel(0);
    setPesos({});
    toast({
      title: "Formulário Reiniciado",
      description: "Você pode começar a definir uma nova meta do zero.",
    });
  };

  const handleCurrencyLikeChange = (setter: (v: number) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
      let rawValue = e.target.value.replace(/\D/g, '');
      if (rawValue === '') {
        setter(0);
        return;
      }
      const numericValue = parseInt(rawValue, 10) / 100;
      setter(numericValue);
  };
  
  const handlePercentageInputChange = (setter: (v: number) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
      let rawValue = e.target.value.replace(/[^0-9]/g, '');
      if (rawValue === '') {
        setter(0);
        return;
      }
      const numericValue = parseFloat(rawValue) / 100;
      setter(numericValue);
  };
  
  const formatCurrencyLikeForInput = (value: number | undefined) => {
    if (value === undefined || value === null || isNaN(value)) return '';
    return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  const formatPercentageForInput = (value: number | undefined) => {
    if (value === undefined || value === null || isNaN(value)) return '';
    return value.toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  }
  
  const handleGetSuggestion = async () => {
      const goalType = goalTypes.find(gt => gt.id === formData.goalTypeId);
      
      if (!goalType || selectedPeriods.length === 0) {
          toast({ title: "Faltam informações", description: "Selecione um tipo de meta e um grupo de períodos primeiro.", variant: "destructive"});
          return;
      }
      if (!geminiApiKey) {
          toast({ title: "Chave API não configurada", description: "Por favor, insira a chave da API Gemini no campo de distribuição.", variant: "destructive"});
          return;
      }
      setIsSuggesting(true);
      try {
          const input: WeeklyDistributionInput = {
              goalType: goalType.name,
              periods: selectedPeriods.map(p => ({ id: p.id, name: p.name })),
          };
          const suggestion = await suggestWeeklyDistribution(input, geminiApiKey);
          
          const newPesos: Record<string, number> = {};
          suggestion.distribution.forEach(item => {
              newPesos[item.periodId] = item.weight;
          });
          setPesos(newPesos);

          toast({ title: "Sugestão recebida!", description: "Os pesos foram preenchidos com a sugestão da IA." });
      } catch (error) {
          console.error("Error getting suggestion:", error);
          toast({ title: "Erro na Sugestão", description: "Não foi possível obter uma sugestão da IA.", variant: "destructive" });
      } finally {
          setIsSuggesting(false);
      }
  }
  
  const handleSubmit = async () => {
    const { responsibleType, responsibleId, periodGroupId, goalTypeId, periodTargets } = formData;

    if (!responsibleId || !periodGroupId || !goalTypeId) {
      toast({
        title: "Campos obrigatórios",
        description: "Selecione responsável, grupo de períodos e tipo de meta.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    const batch = writeBatch(db);
    
    try {
      const periodsToCreate = selectedPeriods;
      periodsToCreate.forEach(period => {
        const targetData = periodTargets[period.id];
        if (!targetData) return;

        const goalDocRef = doc(collection(db, "goals"));

        const newGoal: Omit<Goal, 'id' | 'name'> & Partial<Pick<Goal, 'name'>> = {
          goalTypeId,
          periodId: period.id,
          periodGroupId,
          userId: responsibleType === 'user' ? responsibleId : "",
          branchId: responsibleType === 'branch' ? responsibleId : "",
          roleId: responsibleType === 'role' ? responsibleId : "",
          companyBranchId: "", // This might need to be sourced from the user/branch/role
          hasLevels: targetData.isLevelGoal,
          targetValue: !targetData.isLevelGoal ? targetData.targetValue : 0,
          levelTargets: targetData.isLevelGoal ? targetData.levelTargets : initialLevelTargets,
          realizado: 0,
        };
        
        if (responsibleType === 'user') {
            const user = users.find(u => u.id === responsibleId);
            if(user) newGoal.companyBranchId = user.companyBranchId;
        }

        // This is a temporary solution for the goal name. A better approach would be to have a dedicated name field.
        const goalTypeName = goalTypes.find(gt => gt.id === goalTypeId)?.name || "Meta";
        const responsibleName = 
            responsibleType === 'user' ? users.find(u => u.id === responsibleId)?.name :
            responsibleType === 'branch' ? branches.find(b => b.id === responsibleId)?.name :
            roles.find(r => r.id === responsibleId)?.name;
        newGoal.name = `${goalTypeName} - ${responsibleName}`;


        batch.set(goalDocRef, newGoal);
      });

      await batch.commit();
      toast({ title: "Metas Salvas!", description: "As novas metas foram cadastradas com sucesso." });
      handleReset();

    } catch (error) {
      console.error("Error saving goals:", error);
      toast({ title: "Erro ao Salvar", description: "Não foi possível cadastrar as metas.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const responsibleLabel = React.useMemo(() => {
    switch (formData.responsibleType) {
      case 'branch': return 'Filial';
      case 'user': return 'Vendedor';
      case 'role': return 'Função';
    }
  }, [formData.responsibleType]);
  
  const responsibleOptions = React.useMemo(() => {
    switch (formData.responsibleType) {
      case 'branch': return branches;
      case 'user': return salespeople;
      case 'role': return roles;
    }
  }, [formData.responsibleType, branches, salespeople, roles]);

  const renderPeriodInputs = (period: Period) => {
    const periodData = formData.periodTargets[period.id];
    if (!periodData) return null;

    const goalType = goalTypes.find(gt => gt.id === formData.goalTypeId);
    const isFreightGoal = goalType?.name.toLowerCase().includes('frete');
    const valueType = isFreightGoal ? 'percentage' : (goalType?.valueType || 'currency');


    return (
        <Card key={period.id}>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle>{period.name}</CardTitle>
                     <div className="flex items-center space-x-2">
                        <Label htmlFor={`isLevelGoal-${period.id}`}>Meta por Nível</Label>
                        <Switch id={`isLevelGoal-${period.id}`} checked={periodData.isLevelGoal} onCheckedChange={v => handlePeriodTargetChange(period.id, 'isLevelGoal', v)} />
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {periodData.isLevelGoal ? (
                     <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {(Object.keys(levelIcons) as Array<keyof GoalLevelTargets>).map(level => (
                            <div key={`${period.id}-${level}`} className="space-y-2">
                                <Label htmlFor={`${period.id}-${level}`} className="flex items-center gap-2">{levelIcons[level]} {level}</Label>
                                <Input 
                                    id={`${period.id}-${level}`} 
                                    type="text" 
                                    placeholder="0,00"
                                    value={formatCurrencyLikeForInput(periodData.levelTargets[level])}
                                    onChange={handleCurrencyLikeChange(value => handleLevelTargetChange(period.id, level, value))}
                                />
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="space-y-2">
                        <Label htmlFor={`targetValue-${period.id}`}>Meta do Período</Label>
                        {valueType === 'percentage' ? (
                          <Input 
                            id={`targetValue-${period.id}`} 
                            type="text" 
                            placeholder="0,00"
                            value={formatPercentageForInput(periodData.targetValue)}
                            onChange={handlePercentageInputChange(value => handlePeriodTargetChange(period.id, 'targetValue', value))}
                          />
                        ) : (
                          <Input 
                            id={`targetValue-${period.id}`} 
                            type="text" 
                            placeholder="0,00"
                            value={formatCurrencyLikeForInput(periodData.targetValue)}
                            onChange={handleCurrencyLikeChange(value => handlePeriodTargetChange(period.id, 'targetValue', value))}
                          />
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    )
  }

  if (loading) {
    return <div className="flex justify-center items-center h-96"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-headline tracking-tight">Criar Metas</h1>
          <p className="text-muted-foreground">Preencha os campos para definir e calcular uma nova meta.</p>
        </div>
        <Button variant="outline" onClick={handleReset}>
          <RefreshCcw className="mr-2 h-4 w-4" />
          Reiniciar
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-8">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Target className="h-5 w-5"/> Informações da Meta</CardTitle>
              <CardDescription>Selecione para quem é a meta, o período e o tipo.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Responsável pela Meta</Label>
                <Tabs value={formData.responsibleType} onValueChange={(v) => handleInputChange('responsibleType', v)} className="w-full">
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="branch"><GitFork className="mr-2 h-4 w-4" /> Por Filial</TabsTrigger>
                    <TabsTrigger value="user"><UserIcon className="mr-2 h-4 w-4" /> Por Vendedor</TabsTrigger>
                    <TabsTrigger value="role"><BriefcaseBusiness className="mr-2 h-4 w-4" /> Por Função</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2 md:col-span-1">
                  <Label htmlFor="responsibleId">{responsibleLabel}</Label>
                  <Select value={formData.responsibleId} onValueChange={v => handleInputChange('responsibleId', v)}>
                    <SelectTrigger><SelectValue placeholder={`Selecione ${responsibleLabel}`} /></SelectTrigger>
                    <SelectContent>
                      {responsibleOptions.map(opt => <SelectItem key={opt.id} value={opt.id}>{opt.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 md:col-span-1">
                  <Label htmlFor="periodGroupId">Grupo de Períodos</Label>
                  <Select value={formData.periodGroupId} onValueChange={v => handleInputChange('periodGroupId', v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione o grupo" /></SelectTrigger>
                    <SelectContent>
                      {periodGroups.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 md:col-span-1">
                  <Label htmlFor="goalTypeId">Tipo de Meta</Label>
                   <Select value={formData.goalTypeId} onValueChange={v => handleInputChange('goalTypeId', v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
                    <SelectContent>
                      {goalTypes.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

           <Card>
              <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Calculator className="h-5 w-5"/> Calculadora de Meta (Opcional)</CardTitle>
                  <CardDescription>Use esta seção para calcular um valor de meta base para distribuir nos períodos.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                          <Label htmlFor="realizadoAnterior">Realizado Anterior</Label>
                          <Input id="realizadoAnterior" type="text" placeholder="R$ 0,00" value={formatCurrencyLikeForInput(realizadoAnterior)} onChange={handleCurrencyLikeChange(setRealizadoAnterior)} />
                      </div>
                      <div className="space-y-2">
                          <Label htmlFor="inflacao">Inflação (%)</Label>
                          <Input id="inflacao" type="text" placeholder="0,00" value={formatCurrencyLikeForInput(inflacao)} onChange={handleCurrencyLikeChange(setInflacao)} />
                      </div>
                      <div className="space-y-2">
                          <Label htmlFor="crescimento">Taxa de Crescimento (%)</Label>
                          <Input id="crescimento" type="text" placeholder="0,00" value={formatCurrencyLikeForInput(crescimento)} onChange={handleCurrencyLikeChange(setCrescimento)} />
                      </div>
                  </div>
                   <div className="space-y-2 pt-4 border-t">
                      <Label htmlFor="taxaAumentoNivel">Taxa de Aumento por Nível (%)</Label>
                      <Input id="taxaAumentoNivel" type="text" className="w-full md:w-1/3" placeholder="0,00" value={formatCurrencyLikeForInput(taxaAumentoNivel)} onChange={handleCurrencyLikeChange(setTaxaAumentoNivel)} />
                      <p className="text-xs text-muted-foreground">Essa taxa será aplicada caso você opte por metas por nível, calculando Prata, Ouro e Diamante a partir do valor de Bronze.</p>
                  </div>
              </CardContent>
              <CardFooter className="bg-muted/50 p-4 rounded-b-lg">
                  <div className="flex flex-col">
                    <p className="text-sm text-muted-foreground">Meta Base Calculada</p>
                    <p className="text-2xl font-bold">{formatCurrency(metaBaseCalculada)}</p>
                  </div>
              </CardFooter>
          </Card>
          
           <Card>
               <CardHeader>
                   <CardTitle className="flex items-center gap-2"><BarChart className="h-5 w-5"/> Distribuição (Opcional)</CardTitle>
               </CardHeader>
               <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                     Distribua o peso da meta ao longo dos períodos. A soma deve ser 100%.
                  </p>
                  
                  <div className="flex flex-col md:flex-row gap-4 items-end bg-muted/40 p-4 rounded-xl border">
                    <div className="flex-1 space-y-2 w-full">
                      <Label htmlFor="geminiApiKey" className="text-xs font-semibold text-muted-foreground flex justify-between items-center w-full">
                        <span>Chave da API Gemini</span>
                        <a 
                          href="https://aistudio.google.com/app/apikey" 
                          target="_blank" 
                          rel="noreferrer" 
                          className="text-[10px] text-primary hover:underline font-normal"
                        >
                          Obter chave no Google AI Studio
                        </a>
                      </Label>
                      <Input
                        id="geminiApiKey"
                        type="password"
                        placeholder="Insira sua API Key do Gemini (salva no navegador)"
                        value={geminiApiKey}
                        onChange={(e) => {
                          const val = e.target.value;
                          setGeminiApiKey(val);
                          localStorage.setItem("gemini_api_key", val);
                        }}
                        className="bg-background h-9 rounded-lg"
                      />
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={handleGetSuggestion} 
                      disabled={isSuggesting || selectedPeriods.length === 0 || !geminiApiKey}
                      className="h-9 font-medium"
                    >
                      {isSuggesting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Lightbulb className="mr-2 h-4 w-4 text-amber-500"/>}
                      Sugerir Distribuição
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 items-end">
                      {selectedPeriods.map(period => (
                          <div key={period.id} className="space-y-2">
                              <Label htmlFor={period.id}>{period.name} (%)</Label>
                              <Input id={period.id} type="text" value={formatCurrencyLikeForInput(pesos[period.id])} onChange={handleCurrencyLikeChange(value => setPesos(prev => ({...prev, [period.id]: value})))} />
                          </div>
                      ))}
                      <div className="space-y-2">
                        <Label>Total</Label>
                         <Badge variant={Math.round(totalPeso) !== 100 ? 'destructive' : 'default'} className="text-lg w-full flex justify-center py-2">
                            <Percent className="h-4 w-4 mr-1"/>{totalPeso.toFixed(2)}
                          </Badge>
                      </div>
                  </div>
                  <Button onClick={handleApplyDistribution} className="w-full">Aplicar Distribuição na Estrutura de Metas</Button>
              </CardContent>
          </Card>

           <Card>
             <CardHeader>
                <CardTitle className="flex items-center gap-2"><Calendar className="h-5 w-5"/> Estrutura da Meta por Período</CardTitle>
                <CardDescription>Defina os valores de meta para cada período. Você pode usar um valor único ou metas por nível.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {selectedPeriods.length > 0 ? selectedPeriods.map(renderPeriodInputs) : (
                  <div className="text-center text-muted-foreground py-10">Selecione um Grupo de Períodos para começar.</div>
                )}
            </CardContent>
            <CardFooter>
                 <Button className="w-full" size="lg" onClick={handleSubmit} disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>}
                    Salvar Meta
                </Button>
            </CardFooter>
           </Card>
        </div>
      </div>
    </div>
  );
}
