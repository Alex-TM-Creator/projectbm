
"use client";

import * as React from "react";
import {
  Loader2,
  GitFork,
  TrendingUp,
  TrendingDown,
  Target,
  Frown,
  RefreshCw,
  User,
  BriefcaseBusiness,
  ChevronDown,
  X,
  Award,
  DollarSign,
  BarChart2,
  Calendar,
  Filter,
} from "lucide-react";
import {
  collection,
  getDocs,
  query,
  orderBy as firestoreOrderBy,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type {
  Goal,
  GoalType,
  PeriodGroup,
  User as UserType,
  Role,
  Branch,
} from "@/lib/definitions";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { getGroupStatus } from "@/lib/period-helpers";

type ReportData = {
  responsibleName: string;
  responsibleType: 'user' | 'branch' | 'role';
  periodName: string;
  goalTypeName: string;
  target: number;
  realizado: number;
  achievement: number;
};

const MultiSelectFilter = ({
  placeholder,
  options,
  selectedValues,
  onSelectionChange,
  icon: Icon,
}: {
  placeholder: string;
  options: { value: string; label: string }[];
  selectedValues: string[];
  onSelectionChange: (value: string) => void;
  icon?: any;
}) => {
    
  const handleSelectAll = () => {
    if (selectedValues.length === options.length) {
      selectedValues.forEach(value => onSelectionChange(value));
    } else {
      options.forEach(opt => {
        if (!selectedValues.includes(opt.value)) {
          onSelectionChange(opt.value);
        }
      });
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="w-full justify-between h-11 border-dashed hover:border-primary/50 transition-colors">
          <div className="flex items-center gap-2 truncate">
            {Icon && <Icon className="h-4 w-4 text-muted-foreground shrink-0" />}
            <span className="truncate">{selectedValues.length > 0 ? `${selectedValues.length} selecionado(s)` : placeholder}</span>
          </div>
          <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64 max-h-80 overflow-y-auto" align="start">
        <DropdownMenuLabel className="flex items-center gap-2">
            {Icon && <Icon className="h-4 w-4" />}
            {placeholder}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem
          checked={options.length > 0 && selectedValues.length === options.length}
          onCheckedChange={handleSelectAll}
          onSelect={e => e.preventDefault()}
          className="font-medium"
        >
          Selecionar Todos
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        {options.map((option) => (
          <DropdownMenuCheckboxItem
            key={option.value}
            checked={selectedValues.includes(option.value)}
            onCheckedChange={() => onSelectionChange(option.value)}
            onSelect={e => e.preventDefault()}
          >
            {option.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
};


export default function GeneralReportPage() {
  const { toast } = useToast();
  const [loading, setLoading] = React.useState(true);
  
  const [allData, setAllData] = React.useState<{
    goals: Goal[];
    goalTypes: GoalType[];
    users: UserType[];
    roles: Role[];
    branches: Branch[];
    periodGroups: PeriodGroup[];
  } | null>(null);

  // Filters
  const [selectedPeriodGroupIds, setSelectedPeriodGroupIds] = React.useState<string[]>([]);
  const [selectedBranchIds, setSelectedBranchIds] = React.useState<string[]>([]);
  const [selectedRoleIds, setSelectedRoleIds] = React.useState<string[]>([]);
  const [selectedUserIds, setSelectedUserIds] = React.useState<string[]>([]);
  const [selectedGoalTypeIds, setSelectedGoalTypeIds] = React.useState<string[]>([]);

  const formatCurrency = (value: number | undefined) => {
    if (value === undefined || isNaN(value)) return "R$ 0,00";
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  };
  
  const formatPercentage = (value: number | undefined) => {
    if (value === undefined || isNaN(value)) return "0,00%";
    return `${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
  };

  const getAchievementColor = (pct: number) => {
    if (pct >= 100) return 'text-emerald-500';
    if (pct >= 75)  return 'text-blue-500';
    if (pct >= 50)  return 'text-amber-500';
    return 'text-rose-500';
  };

  const getProgressColor = (pct: number) => {
    if (pct >= 100) return '[&>div]:bg-emerald-500';
    if (pct >= 75)  return '[&>div]:bg-blue-500';
    if (pct >= 50)  return '[&>div]:bg-amber-500';
    return '[&>div]:bg-rose-500';
  };

  const getAchievementBg = (pct: number) => {
    if (pct >= 100) return 'bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:border-emerald-800';
    if (pct >= 75)  return 'bg-blue-500/10 text-blue-600 border-blue-200 dark:border-blue-800';
    if (pct >= 50)  return 'bg-amber-500/10 text-amber-600 border-amber-200 dark:border-amber-800';
    return 'bg-rose-500/10 text-rose-600 border-rose-200 dark:border-rose-800';
  };

  const fetchData = React.useCallback(async () => {
    try {
      setLoading(true);
      const [
        goalsSnap,
        typesSnap,
        periodsSnap,
        usersSnap,
        rolesSnap,
        branchesSnap,
      ] = await Promise.all([
        getDocs(collection(db, "goals")),
        getDocs(query(collection(db, "goaltypes"), firestoreOrderBy("order"))),
        getDocs(collection(db, "periodgroups")),
        getDocs(query(collection(db, "users"))),
        getDocs(query(collection(db, "roles"))),
        getDocs(query(collection(db, "branches"))),
      ]);

      const goals = goalsSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Goal);
      const goalTypes = typesSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as GoalType);
      const fetchedPeriodGroups = periodsSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as PeriodGroup);
      const users = usersSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as UserType);
      const roles = rolesSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Role);
      const branches = branchesSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as Branch);
      
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
      
      setAllData({ goals, goalTypes, users, roles, branches, periodGroups: fetchedPeriodGroups });

      if (selectedPeriodGroupIds.length === 0 && fetchedPeriodGroups.length > 0) {
        const firstActiveGroup = fetchedPeriodGroups.find(g => getGroupStatus(g).text === "Ativo");
        if (firstActiveGroup) {
          setSelectedPeriodGroupIds([firstActiveGroup.id]);
        }
      }

    } catch (error) {
      console.error(error);
      toast({ title: "Erro ao buscar dados", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast, selectedPeriodGroupIds]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleFilterChange = (setter: React.Dispatch<React.SetStateAction<string[]>>) => (id: string) => {
    setter(prev => {
        const newSelection = [...prev];
        const index = newSelection.indexOf(id);
        if (index > -1) {
            newSelection.splice(index, 1);
        } else {
            newSelection.push(id);
        }
        return newSelection;
    });
  };

  const filteredReportData = React.useMemo((): ReportData[] => {
    if (!allData) return [];
    
    let filteredGoals = allData.goals;
    
    if (selectedPeriodGroupIds.length > 0) {
      const periodIds = new Set(
        allData.periodGroups
          .filter(g => selectedPeriodGroupIds.includes(g.id))
          .flatMap(g => g.periods.map(p => p.id))
      );
      filteredGoals = filteredGoals.filter(g => periodIds.has(g.periodId));
    }
    
    if (selectedGoalTypeIds.length > 0) {
      filteredGoals = filteredGoals.filter(g => selectedGoalTypeIds.includes(g.goalTypeId));
    }
    if (selectedBranchIds.length > 0) {
      filteredGoals = filteredGoals.filter(g => g.branchId && selectedBranchIds.includes(g.branchId));
    }
    if (selectedRoleIds.length > 0) {
      filteredGoals = filteredGoals.filter(g => g.roleId && selectedRoleIds.includes(g.roleId));
    }
    if (selectedUserIds.length > 0) {
      filteredGoals = filteredGoals.filter(g => g.userId && selectedUserIds.includes(g.userId));
    }


    const isFreteType = (gt: GoalType) => gt.name.toLowerCase().includes('frete');

    return filteredGoals.map(goal => {
        let responsibleName = "N/A";
        let responsibleType: 'user' | 'branch' | 'role' = 'user';
        if (goal.userId) {
            responsibleName = allData.users.find(u => u.id === goal.userId)?.name || "N/A";
            responsibleType = 'user';
        } else if (goal.branchId) {
            responsibleName = allData.branches.find(b => b.id === goal.branchId)?.name || "N/A";
            responsibleType = 'branch';
        } else if (goal.roleId) {
            responsibleName = allData.roles.find(r => r.id === goal.roleId)?.name || "N/A";
            responsibleType = 'role';
        }

        const periodGroup = allData.periodGroups.find(pg => pg.id === goal.periodGroupId);
        const period = periodGroup?.periods.find(p => p.id === goal.periodId);
        
        let target = goal.targetValue || 0;
        const goalType = allData.goalTypes.find(gt => gt.id === goal.goalTypeId);

        if(goal.hasLevels && goal.levelTargets) {
            target = goal.levelTargets.Diamante || 0;
        } else if (goalType && isFreteType(goalType)) {
             const mercantilGoal = allData.goals.find(g => {
                const mercantilGoalType = allData.goalTypes.find(t => t.id === g.goalTypeId && t.name.toLowerCase().includes('mercantil'));
                return g.periodId === goal.periodId && mercantilGoalType && 
                       g.branchId === goal.branchId && 
                       g.roleId === goal.roleId && 
                       g.userId === goal.userId;
            });
            const mercantilRealizado = mercantilGoal?.realizado ?? 0;
            const freightTargetPercentage = goal.targetValue ?? 0;
            target = (mercantilRealizado * freightTargetPercentage) / 100;
        }


        const realizado = goal.realizado || 0;
        const achievement = target > 0 ? (realizado / target) * 100 : 0;
        
        return {
            responsibleName,
            responsibleType,
            periodName: period?.name || 'N/A',
            goalTypeName: goalType?.name || "N/A",
            target: target,
            realizado: realizado,
            achievement: achievement,
        };
    }).sort((a,b) => a.responsibleName.localeCompare(b.responsibleName) || a.periodName.localeCompare(b.periodName));
  }, [allData, selectedPeriodGroupIds, selectedBranchIds, selectedRoleIds, selectedUserIds, selectedGoalTypeIds]);


  const clearAllFilters = () => {
    setSelectedPeriodGroupIds([]);
    setSelectedBranchIds([]);
    setSelectedRoleIds([]);
    setSelectedUserIds([]);
    setSelectedGoalTypeIds([]);
  }


  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center h-96 gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-muted-foreground text-sm">Carregando dados do relatório...</p>
      </div>
    );
  }
  
  return (
    <div className="flex flex-col gap-8 pb-10">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Relatório Geral
          </h1>
          <p className="text-muted-foreground mt-1">
            Analise os resultados consolidados com filtros dinâmicos.
          </p>
        </div>
        <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={() => fetchData()} disabled={loading} className="shrink-0 shadow-sm">
                <RefreshCw className={loading ? "animate-spin h-4 w-4" : "h-4 w-4"} />
            </Button>
        </div>
      </div>


      {/* Modern Filter Bar */}
      <Card className="border-none shadow-sm overflow-hidden bg-card/50 backdrop-blur-sm">
        <CardHeader className="bg-muted/10 pb-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-primary" />
            <span className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Filtros Avançados</span>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
            <MultiSelectFilter
              placeholder="Períodos"
              icon={Calendar}
              options={allData?.periodGroups.map(g => ({value: g.id, label: g.name})) || []}
              selectedValues={selectedPeriodGroupIds}
              onSelectionChange={handleFilterChange(setSelectedPeriodGroupIds)}
            />
            <MultiSelectFilter
              placeholder="Metas"
              icon={BarChart2}
              options={allData?.goalTypes.map(gt => ({value: gt.id, label: gt.name})) || []}
              selectedValues={selectedGoalTypeIds}
              onSelectionChange={handleFilterChange(setSelectedGoalTypeIds)}
            />
             <MultiSelectFilter
              placeholder="Filiais"
              icon={GitFork}
              options={allData?.branches.map(b => ({value: b.id, label: b.name})) || []}
              selectedValues={selectedBranchIds}
              onSelectionChange={handleFilterChange(setSelectedBranchIds)}
            />
             <MultiSelectFilter
              placeholder="Cargos"
              icon={BriefcaseBusiness}
              options={allData?.roles.map(r => ({value: r.id, label: r.name})) || []}
              selectedValues={selectedRoleIds}
              onSelectionChange={handleFilterChange(setSelectedRoleIds)}
            />
             <MultiSelectFilter
              placeholder="Vendedores"
              icon={User}
              options={allData?.users.filter(u => u.roleId).map(u => ({value: u.id, label: u.name})) || []}
              selectedValues={selectedUserIds}
              onSelectionChange={handleFilterChange(setSelectedUserIds)}
            />
          </div>
          <div className="mt-4 flex justify-end items-center gap-4">
            <p className="text-xs text-muted-foreground mr-auto italic">
                {filteredReportData.length} resultados encontrados.
            </p>
            {(selectedPeriodGroupIds.length > 0 || selectedGoalTypeIds.length > 0 || selectedBranchIds.length > 0 || selectedRoleIds.length > 0 || selectedUserIds.length > 0) && (
              <Button variant="ghost" size="sm" onClick={clearAllFilters} className="text-rose-500 hover:text-rose-600 hover:bg-rose-50 h-9 transition-colors group">
                    <X className="mr-1.5 h-3.5 w-3.5 group-hover:rotate-90 transition-transform duration-300" />
                    Limpar Filtros
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Results Table */}
      <Card className="border-none shadow-sm overflow-hidden">
        <CardContent className="p-0">
           {filteredReportData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 px-4 text-center border-2 border-dashed rounded-xl m-6">
                <div className="rounded-full bg-muted p-5 mb-4 group hover:scale-110 transition-transform duration-300">
                    <Frown className="h-10 w-10 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold">Nenhum resultado encontrado</h3>
                <p className="mt-1 text-sm text-muted-foreground max-w-xs mx-auto">Tente ajustar os filtros ou limpar a seleção para ver os dados.</p>
                <Button variant="outline" onClick={clearAllFilters} className="mt-6 font-semibold">
                    Limpar todos os filtros
                </Button>
            </div>
           ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow className="hover:bg-transparent border-b">
                    <TableHead className="py-4 font-bold text-muted-foreground px-6">Responsável</TableHead>
                    <TableHead className="py-4 font-bold text-muted-foreground">Tipo de Meta</TableHead>
                    <TableHead className="py-4 font-bold text-muted-foreground text-center">Período</TableHead>
                    <TableHead className="py-4 font-bold text-muted-foreground text-right">Meta</TableHead>
                    <TableHead className="py-4 font-bold text-muted-foreground text-right">Realizado</TableHead>
                    <TableHead className="py-4 font-bold text-muted-foreground text-right px-6 min-w-[200px]">Atingimento</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReportData.map((item, index) => {
                    const pct = item.achievement;
                    return (
                      <TableRow key={index} className="group hover:bg-muted/20 transition-colors border-b last:border-0">
                        <TableCell className="font-bold py-4 px-6 flex items-center gap-2.5">
                            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0 border border-border group-hover:border-primary/30 transition-colors">
                                {item.responsibleType === 'user' ? <User className="h-4 w-4" /> :
                                 item.responsibleType === 'branch' ? <GitFork className="h-4 w-4" /> :
                                 <BriefcaseBusiness className="h-4 w-4" />}
                            </div>
                            <span className="truncate max-w-[180px] sm:max-w-none">{item.responsibleName}</span>
                        </TableCell>
                        <TableCell className="py-4 font-medium text-muted-foreground">
                            {item.goalTypeName}
                        </TableCell>
                        <TableCell className="py-4 text-center font-mono text-xs">
                          <Badge variant="outline" className="font-normal bg-background/50 border-border/50">
                            {item.periodName}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-4 text-right font-mono font-medium">
                            {formatCurrency(item.target)}
                        </TableCell>
                        <TableCell className="py-4 text-right font-bold text-foreground font-mono">
                            {formatCurrency(item.realizado)}
                        </TableCell>
                        <TableCell className="py-4 text-right px-6">
                            <div className="flex flex-col gap-1.5 ml-auto w-fit">
                                <div className="flex items-center justify-end gap-2 text-xs font-bold">
                                    <div className={`px-2 py-0.5 rounded-full border ${getAchievementBg(pct)}`}>
                                        {formatPercentage(pct)}
                                    </div>
                                </div>
                                <div className="w-[120px] ml-auto">
                                    <Progress value={pct} className={`h-1.5 ${getProgressColor(pct)}`} />
                                </div>
                            </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
           )}
        </CardContent>
      </Card>
    </div>
  );
}
