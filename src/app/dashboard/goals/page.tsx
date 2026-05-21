
"use client";

import * as React from "react";
import { PlusCircle, MoreHorizontal, Trash2, Loader2, Pencil, Target, BriefcaseBusiness, User as UserIcon, GitFork, Medal, Trophy, Award, Gem, Calendar, Copy, Eye, Check, Search } from "lucide-react";
import {
  collection,
  getDocs,
  deleteDoc,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Goal, GoalType, PeriodGroup, User, Company, Branch, Role, GoalLevelTargets, Period, GoalSetting, PeriodValues } from "@/lib/definitions";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { group } from "console";
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { getGroupStatus } from "@/lib/period-helpers";


const levelIcons = {
    Bronze: <Medal className="h-4 w-4 text-orange-600" />,
    Prata: <Trophy className="h-4 w-4 text-slate-500" />,
    Ouro: <Award className="h-4 w-4 text-yellow-500" />,
    Diamante: <Gem className="h-4 w-4 text-sky-400" />,
};

const initialLevelTargets: GoalLevelTargets = {
  Bronze: 0,
  Prata: 0,
  Ouro: 0,
  Diamante: 0,
}

type GoalFormData = {
  id?: string;
  name: string;
  periodGroupId: string;
  responsibleIds: string[];
  goalSettings: GoalSetting[];
  responsibleType: 'branch' | 'user' | 'role';
}

const initialFormData: GoalFormData = {
  name: "",
  periodGroupId: "",
  responsibleIds: [],
  goalSettings: [],
  responsibleType: 'branch',
}

type GroupedGoal = {
    groupKey: string;
    name: string;
    periods: {
        periodId: string;
        periodName: string;
        goal: Goal;
    }[];
}

type EditingGoalGroup = {
    name: string;
    goalSettings: GoalSetting[];
    originalGoals: Goal[];
}

export default function GoalsPage() {
  const { toast } = useToast();
  // Main data
  const [goals, setGoals] = React.useState<Goal[]>([]);
  
  // Related data
  const [goalTypes, setGoalTypes] = React.useState<GoalType[]>([]);
  const [periodGroups, setPeriodGroups] = React.useState<PeriodGroup[]>([]);
  const [users, setUsers] = React.useState<User[]>([]);
  const [branches, setBranches] = React.useState<Branch[]>([]);
  const [roles, setRoles] = React.useState<Role[]>([]);

  // UI State
  const [loading, setLoading] = React.useState(true);
  const [openCreate, setOpenCreate] = React.useState(false);
  const [openEdit, setOpenEdit] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState("branch");
  const [activeCreateTab, setActiveCreateTab] = React.useState("branch");
  const [isViewing, setIsViewing] = React.useState(false);
  const [selectedPeriodGroupId, setSelectedPeriodGroupId] = React.useState<string | null>(null);
  const [responsibleSearch, setResponsibleSearch] = React.useState("");


  // Form & Dialog state
  const [currentGoal, setCurrentGoal] = React.useState<GoalFormData>(initialFormData);
  const [editingGoalGroup, setEditingGoalGroup] = React.useState<EditingGoalGroup | null>(null);
  const [goalGroupToDelete, setGoalGroupToDelete] = React.useState<GroupedGoal | null>(null);
  
  const formatDate = (dateString: string) => {
    if(!dateString) return "N/A";
    try {
      return format(parseISO(dateString), "dd/MM/yyyy");
    } catch {
      return dateString; // Return original if parsing fails
    }
  }

  const formatCurrencyForInput = (value: number | undefined) => {
    if (value === undefined || value === null) return '';
    const formatted = new Intl.NumberFormat('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(value);
    return formatted;
  };

  const handleCurrencyChange = (setter: (value: number) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, '');
    if (rawValue === '') {
      setter(0);
      return;
    }
    const numericValue = parseInt(rawValue, 10) / 100;
    setter(numericValue);
  };
  
  const handleNumericChange = (setter: (value: number) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setter(parseFloat(e.target.value) || 0);
  }

  const fetchData = React.useCallback(async () => {
    try {
      setLoading(true);
      const [goalsSnap, typesSnap, periodsSnap, usersSnap, branchesSnap, rolesSnap] = await Promise.all([
        getDocs(collection(db, "goals")),
        getDocs(query(collection(db, "goaltypes"), firestoreOrderBy("order"))),
        getDocs(collection(db, "periodgroups")),
        getDocs(collection(db, "users")),
        getDocs(collection(db, "branches")),
        getDocs(collection(db, "roles"))
      ]);
      
      setGoals(goalsSnap.docs.map(d => ({id: d.id, ...d.data()}) as Goal));
      setGoalTypes(typesSnap.docs.map(d => ({id: d.id, ...d.data()}) as GoalType));
      
      const fetchedPeriodGroups = periodsSnap.docs.map(d => ({id: d.id, ...d.data()}) as PeriodGroup);
      const statusOrder = { "Ativo": 1, "Agendado": 2, "Encerrado": 3, "Vazio": 4 };
      fetchedPeriodGroups.sort((a, b) => {
        const statusA = getGroupStatus(a).text;
        const statusB = getGroupStatus(b).text;
        const orderA = statusOrder[statusA as keyof typeof statusOrder] || 99;
        const orderB = statusOrder[statusB as keyof typeof statusOrder] || 99;
        if (orderA !== orderB) {
            return orderA - orderB;
        }
        const dateA = a.periods.length > 0 ? a.periods[0].startDate : "";
        const dateB = b.periods.length > 0 ? b.periods[0].startDate : "";
        return dateB.localeCompare(dateA);
      });
      setPeriodGroups(fetchedPeriodGroups);
      
      if (!selectedPeriodGroupId && fetchedPeriodGroups.length > 0) {
        const firstActiveGroup = fetchedPeriodGroups.find(g => getGroupStatus(g).text === "Ativo");
        if (firstActiveGroup) {
          setSelectedPeriodGroupId(firstActiveGroup.id);
        } else {
          setSelectedPeriodGroupId(fetchedPeriodGroups[0].id);
        }
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
  
  const getNameById = (collection: {id: string, name: string}[], id: string | undefined) => collection.find(item => item.id === id)?.name || "N/A";
  
  const getPeriodInfo = (periodId: string): { groupName: string, periodName: string, period: Period | undefined } => {
    for (const group of periodGroups) {
        const period = group.periods.find(p => p.id === periodId);
        if (period) return { groupName: group.name, periodName: period.name, period };
    }
    return { groupName: "N/A", periodName: "N/A", period: undefined };
  }
  
  // Create Dialog Logic
  const handleOpenCreateDialog = () => {
    setCurrentGoal(JSON.parse(JSON.stringify(initialFormData)));
    setResponsibleSearch("");
    setOpenCreate(true);
  };
  
  const handleCloseCreateDialog = () => {
    setCurrentGoal(initialFormData);
    setResponsibleSearch("");
    setOpenCreate(false);
  };

  const handleDuplicateGroup = (goalGroup: GroupedGoal) => {
    const firstGoal = goalGroup.periods[0]?.goal;
    if (!firstGoal) return;

    let responsibleId = "";
    let responsibleType: 'branch' | 'user' | 'role' = "branch"; // default
    if(firstGoal.branchId) {
      responsibleId = firstGoal.branchId;
      responsibleType = "branch";
    } else if (firstGoal.userId) {
      responsibleId = firstGoal.userId;
      responsibleType = "user";
    } else if (firstGoal.roleId) {
      responsibleId = firstGoal.roleId;
      responsibleType = "role";
    }

    const { goalSettings } = getGoalSettingsFromGroup(goalGroup);
    
    setCurrentGoal({
      name: `${goalGroup.name} (Cópia)`,
      periodGroupId: firstGoal.periodGroupId,
      responsibleIds: [responsibleId],
      goalSettings: goalSettings,
      responsibleType: responsibleType,
    });
    setActiveCreateTab(responsibleType);
    setResponsibleSearch("");
    setOpenCreate(true);
  };
  
  const getGoalSettingsFromGroup = (goalGroup: GroupedGoal): { goalSettings: GoalSetting[] } => {
    const allGoalsInGroup = goalGroup.periods.map(p => p.goal);
    const goalSettingsMap: Map<string, GoalSetting> = new Map();

    for (const goal of allGoalsInGroup) {
        if (!goalSettingsMap.has(goal.goalTypeId)) {
            goalSettingsMap.set(goal.goalTypeId, {
                goalTypeId: goal.goalTypeId,
                hasLevels: goal.hasLevels,
                periodValues: {}
            });
        }

        const setting = goalSettingsMap.get(goal.goalTypeId)!;
        setting.periodValues[goal.periodId] = {
            targetValue: goal.targetValue,
            levelTargets: goal.levelTargets,
        };
    }
    
    const goalSettings = Array.from(goalSettingsMap.values());
    return { goalSettings };
  }
  
  const handleOpenEditDialog = (goalGroup: GroupedGoal, viewOnly: boolean = false) => {
    const { goalSettings } = getGoalSettingsFromGroup(goalGroup);
    
    setIsViewing(viewOnly);
    setEditingGoalGroup({
      name: goalGroup.name,
      goalSettings: JSON.parse(JSON.stringify(goalSettings)),
      originalGoals: goalGroup.periods.map(p => p.goal),
    });
    setOpenEdit(true);
  }
  
  const handleCloseEditDialog = () => {
    setEditingGoalGroup(null);
    setOpenEdit(false);
    setIsViewing(false);
  }
  
  const handleEditGroupNameChange = (newName: string) => {
    if (editingGoalGroup) {
      setEditingGoalGroup(prev => ({...prev!, name: newName}));
    }
  };

  const handleEditGoalSettingChange = <K extends keyof GoalSetting>(goalTypeId: string, field: K, value: GoalSetting[K]) => {
    if (!editingGoalGroup) return;
    setEditingGoalGroup(prev => ({
        ...prev!,
        goalSettings: prev!.goalSettings.map(gs => 
            gs.goalTypeId === goalTypeId ? { ...gs, [field]: value } : gs
        )
    }));
  };

  const handleEditPeriodValueChange = (goalTypeId: string, periodId: string, value: number) => {
    if (!editingGoalGroup) return;
    setEditingGoalGroup(prev => ({
      ...prev!,
      goalSettings: prev!.goalSettings.map(gs => {
          if (gs.goalTypeId !== goalTypeId) return gs;
          const newPeriodValues = { ...gs.periodValues };
          newPeriodValues[periodId] = {
            ...(newPeriodValues[periodId] || {}),
            targetValue: value,
          };
          return { ...gs, periodValues: newPeriodValues };
      })
    }));
  };

  const handleEditLevelTargetChange = (goalTypeId: string, periodId: string, level: keyof GoalLevelTargets, value: number) => {
    if (!editingGoalGroup) return;
    setEditingGoalGroup(prev => ({
      ...prev!,
      goalSettings: prev!.goalSettings.map(gs => {
          if (gs.goalTypeId !== goalTypeId) return gs;
          const newPeriodValues = { ...gs.periodValues };
          if (!newPeriodValues[periodId]) newPeriodValues[periodId] = {};
          newPeriodValues[periodId].levelTargets = {
              ...(newPeriodValues[periodId].levelTargets || initialLevelTargets),
              [level]: value
          };
          return { ...gs, periodValues: newPeriodValues };
      })
    }));
  }

  const handleInputChange = (field: keyof GoalFormData, value: any) => {
    setCurrentGoal(prev => ({ ...prev, [field]: value }));
  };

  const handleGoalTypeSelection = (goalTypeId: string) => {
    setCurrentGoal(prev => {
        const existingSettingIndex = prev.goalSettings.findIndex(gs => gs.goalTypeId === goalTypeId);
        let newSettings;

        if (existingSettingIndex > -1) {
            newSettings = prev.goalSettings.filter(gs => gs.goalTypeId !== goalTypeId);
        } else {
            const group = periodGroups.find(g => g.id === prev.periodGroupId);
            const periodValues: { [key: string]: any } = {};
            if (group) {
                group.periods.forEach(p => {
                    periodValues[p.id] = { targetValue: 0, levelTargets: JSON.parse(JSON.stringify(initialLevelTargets))};
                });
            }
            newSettings = [...prev.goalSettings, { 
                goalTypeId, 
                hasLevels: false, 
                periodValues 
            }];
        }
        return { ...prev, goalSettings: newSettings };
    });
  }
  
  const handleResponsibleSelection = (id: string) => {
    setCurrentGoal(prev => {
        const newResponsibleIds = [...prev.responsibleIds];
        const index = newResponsibleIds.indexOf(id);
        if (index > -1) {
            newResponsibleIds.splice(index, 1);
        } else {
            newResponsibleIds.push(id);
        }
        return {...prev, responsibleIds: newResponsibleIds};
    });
  };

  const handlePeriodGroupChange = (groupId: string) => {
      const group = periodGroups.find(g => g.id === groupId);
      const newSettings = currentGoal.goalSettings.map(setting => {
        const newPeriodValues: { [key: string]: any } = {};
        if (group) {
          group.periods.forEach(p => {
            newPeriodValues[p.id] = { targetValue: 0, levelTargets: JSON.parse(JSON.stringify(initialLevelTargets)) };
          });
        }
        return { ...setting, periodValues: newPeriodValues };
      });
      setCurrentGoal(prev => ({...prev, periodGroupId: groupId, goalSettings: newSettings }));
  }

  const handleGoalSettingChange = <K extends keyof GoalSetting>(goalTypeId: string, field: K, value: GoalSetting[K]) => {
      setCurrentGoal(prev => ({
          ...prev,
          goalSettings: prev.goalSettings.map(gs => 
              gs.goalTypeId === goalTypeId ? { ...gs, [field]: value } : gs
          )
      }));
  }

  const handlePeriodValueChange = (goalTypeId: string, periodId: string, value: number) => {
      setCurrentGoal(prev => ({
        ...prev,
        goalSettings: prev.goalSettings.map(gs => {
            if (gs.goalTypeId !== goalTypeId) return gs;
            const newPeriodValues = { ...gs.periodValues };
            newPeriodValues[periodId] = {
              ...(newPeriodValues[periodId] || {}),
              targetValue: value,
            };
            return { ...gs, periodValues: newPeriodValues };
        })
      }));
  };

  const handleLevelTargetChange = (goalTypeId: string, periodId: string, level: keyof GoalLevelTargets, value: number) => {
      setCurrentGoal(prev => ({
          ...prev,
          goalSettings: prev.goalSettings.map(gs => {
              if (gs.goalTypeId !== goalTypeId) return gs;
              const newPeriodValues = { ...gs.periodValues };
              if (!newPeriodValues[periodId]) newPeriodValues[periodId] = {};
              newPeriodValues[periodId].levelTargets = {
                  ...(newPeriodValues[periodId].levelTargets || initialLevelTargets),
                  [level]: value
              };
              return { ...gs, periodValues: newPeriodValues };
          })
      }));
  }


  const handleSubmit = async () => {
    const { name, periodGroupId, responsibleIds, responsibleType, goalSettings } = currentGoal;
    
    if (!name || !periodGroupId || responsibleIds.length === 0 || goalSettings.length === 0) {
        toast({ title: "Campos obrigatórios", description: "Por favor, preencha nome, responsável, grupo de períodos e ao menos um tipo de meta.", variant: "destructive" });
        return;
    }
    if (isSubmitting) return;

    setIsSubmitting(true);
    const batch = writeBatch(db);
    try {
        const selectedPeriodGroup = periodGroups.find(p => p.id === periodGroupId);
        if (!selectedPeriodGroup) {
             toast({ title: "Grupo de Períodos não encontrado", variant: "destructive" });
             setIsSubmitting(false);
             return;
        }
        
        responsibleIds.forEach(responsibleId => {
            goalSettings.forEach(setting => {
                selectedPeriodGroup.periods.forEach(period => {
                    const goalId = doc(collection(db, 'goals')).id;
                    const periodData = setting.periodValues[period.id];
                    
                    const baseGoalData: Partial<Goal> = {
                        id: goalId,
                        name: name,
                        goalTypeId: setting.goalTypeId,
                        periodId: period.id,
                        periodGroupId: periodGroupId,
                        userId: responsibleType === 'user' ? responsibleId : "",
                        branchId: responsibleType === 'branch' ? responsibleId : "",
                        roleId: responsibleType === 'role' ? responsibleId : "",
                        hasLevels: setting.hasLevels,
                    };

                    if (responsibleType === 'user') {
                        const user = users.find(u => u.id === responsibleId);
                        if(user) baseGoalData.companyBranchId = user.companyBranchId;
                    }
                    
                    if (setting.hasLevels) {
                        baseGoalData.levelTargets = periodData?.levelTargets ?? initialLevelTargets;
                        delete baseGoalData.targetValue;
                    } else {
                        baseGoalData.targetValue = periodData?.targetValue ?? 0;
                        delete baseGoalData.levelTargets;
                    }
                    
                    const docRef = doc(db, "goals", goalId);
                    batch.set(docRef, baseGoalData);
                });
            });
        });

        await batch.commit();
        
        toast({ title: "Metas Cadastradas!", description: "As metas foram criadas com sucesso para cada responsável, tipo e período." });
      
        handleCloseCreateDialog();
        fetchData();
    } catch (error) {
      console.error(error);
      toast({
        title: "Erro ao cadastrar",
        description: `Não foi possível salvar as metas.`,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateGroup = async () => {
    if (!editingGoalGroup || !editingGoalGroup.name) {
        toast({ title: "Erro", description: "Grupo de meta inválido para atualização.", variant: "destructive" });
        return;
    }
    if (isSubmitting) return;
    setIsSubmitting(true);
    
    const batch = writeBatch(db);
    try {
        editingGoalGroup.originalGoals.forEach(originalGoal => {
            const docRef = doc(db, "goals", originalGoal.id);
            
            const updatedSetting = editingGoalGroup.goalSettings.find(s => s.goalTypeId === originalGoal.goalTypeId);
            if (!updatedSetting) return; // Should not happen if logic is correct
            
            const periodValues = updatedSetting.periodValues[originalGoal.periodId];
            if (!periodValues) return; // Should not happen either

            const dataToUpdate: Partial<Goal> = {
                name: editingGoalGroup.name,
                hasLevels: updatedSetting.hasLevels,
            };

            if (updatedSetting.hasLevels) {
                dataToUpdate.levelTargets = periodValues.levelTargets ?? initialLevelTargets;
                delete (dataToUpdate as any).targetValue; // Ensure clean data
            } else {
                dataToUpdate.targetValue = periodValues.targetValue;
                 delete (dataToUpdate as any).levelTargets; // Ensure clean data
            }
            batch.update(docRef, dataToUpdate as any);
        });
        
        await batch.commit();

        toast({ title: "Grupo de Metas Atualizado!", description: "As metas foram atualizadas com sucesso." });
        handleCloseEditDialog();
        fetchData();

    } catch (error) {
        console.error("Error updating goal group:", error);
        toast({ title: "Erro ao atualizar", description: "Não foi possível salvar as alterações.", variant: "destructive" });
    } finally {
        setIsSubmitting(false);
    }
  };


  const handleDeleteGroup = async () => {
    if (!goalGroupToDelete) return;
    const batch = writeBatch(db);
    try {
        goalGroupToDelete.periods.forEach(period => {
            const docRef = doc(db, "goals", period.goal.id);
            batch.delete(docRef);
        });
        await batch.commit();
        toast({
            title: "Grupo de Metas Deletado",
            description: `O grupo "${goalGroupToDelete.name}" foi removido com sucesso.`,
            variant: "destructive",
        });
        fetchData();
    } catch (error) {
        console.error("Error deleting goal group:", error);
        toast({
            title: "Erro ao deletar grupo",
            description: "Não foi possível remover o grupo de metas.",
            variant: "destructive",
        });
    } finally {
        setGoalGroupToDelete(null);
    }
  };

  const salespeople = React.useMemo(() => users.filter(u => u.roleId && u.roleId.trim() !== ""), [users]);

  const responsibleLabel = React.useMemo(() => {
    switch (currentGoal.responsibleType) {
      case 'branch': return 'Filial';
      case 'user': return 'Vendedor';
      case 'role': return 'Função';
    }
  }, [currentGoal.responsibleType]);
  
  const selectedPeriods = React.useMemo(() => {
    if (!currentGoal.periodGroupId) return [];
    const group = periodGroups.find(g => g.id === currentGoal.periodGroupId);
    return group ? [...group.periods].sort((a, b) => b.startDate.localeCompare(a.startDate)) : [];
  }, [currentGoal.periodGroupId, periodGroups]);
  
  const responsibleOptions = React.useMemo(() => {
    switch (currentGoal.responsibleType) {
      case 'branch': return branches;
      case 'user': return salespeople;
      case 'role': return roles;
      default: return [];
    }
  }, [currentGoal.responsibleType, branches, salespeople, roles]);

  const filteredResponsibleOptions = React.useMemo(() => {
    if (!responsibleSearch) return responsibleOptions;
    const lowerSearch = responsibleSearch.toLowerCase();
    return responsibleOptions.filter(opt =>
      opt.name.toLowerCase().includes(lowerSearch)
    );
  }, [responsibleOptions, responsibleSearch]);

  const getResponsibleNameById = (id: string) => {
    return responsibleOptions.find(opt => opt.id === id)?.name || "Desconhecido";
  }
  
  const groupGoals = (goalsToGroup: Goal[]): GroupedGoal[] => {
    const grouped = goalsToGroup.reduce((acc, goal) => {
        let key = goal.name;
        if(goal.branchId) key += `-${goal.branchId}`;
        if(goal.userId) key += `-${goal.userId}`;
        if(goal.roleId) key += `-${goal.roleId}`;

        if (!acc[key]) {
            acc[key] = {
                groupKey: key,
                name: goal.name,
                periods: [],
            };
        }
        const periodInfo = getPeriodInfo(goal.periodId);
        acc[key].periods.push({
            periodId: goal.periodId,
            periodName: periodInfo.periodName,
            goal: goal,
        });
        return acc;
    }, {} as {[key: string]: GroupedGoal});

    return Object.values(grouped).sort((a, b) => a.name.localeCompare(b.name));
  }


  const renderGoalsTable = (goals: Goal[]) => {
     let filteredGoals = goals;
     if (selectedPeriodGroupId) {
       filteredGoals = goals.filter(g => g.periodGroupId === selectedPeriodGroupId);
     }
     const groupedGoals = groupGoals(filteredGoals);

     if (groupedGoals.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 rounded-2xl border-2 border-dashed bg-muted/10 gap-4 text-center">
                <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center">
                    <Target className="h-7 w-7 text-muted-foreground/40" />
                </div>
                <p className="text-sm text-muted-foreground font-medium">Nenhuma meta encontrada para o período selecionado.</p>
            </div>
        )
     }

     return (
     <AlertDialog>
        <TooltipProvider>
        <div className="flex flex-col gap-3">
            {groupedGoals.map((group) => {
                const uniquePeriodGroupNames = [...new Set(group.periods.map(p => getPeriodInfo(p.goal.periodId).groupName))];
                const uniqueGoalTypeNames = [...new Set(group.periods.map(p => getNameById(goalTypes, p.goal.goalTypeId)))];
                const uniqueResponsibleNames = [...new Set(group.periods.map(p => {
                    const goal = p.goal;
                    if(goal.userId) {
                       const user = users.find(u => u.id === goal.userId);
                       const role = roles.find(r => r.id === user?.roleId);
                       return user ? `${user.name} (${role?.name || 'Sem Função'})` : "N/A";
                    }
                    if(goal.branchId) return getNameById(branches, goal.branchId);
                    if(goal.roleId) return getNameById(roles, goal.roleId);
                    return "N/A";
                }))]

                return (
                    <div key={group.groupKey} className="group flex items-center gap-4 p-4 rounded-xl border bg-card hover:shadow-md hover:border-primary/20 transition-all duration-200">
                        <div className="h-10 w-10 shrink-0 rounded-xl bg-primary/5 border border-primary/10 flex items-center justify-center">
                            <Target className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm tracking-tight truncate">{group.name}</p>
                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                                {uniqueGoalTypeNames.map(name => (
                                    <Badge key={name} variant="secondary" className="text-[10px] font-semibold rounded-full px-2">{name}</Badge>
                                ))}
                                {uniqueResponsibleNames.map(name => (
                                    <Badge key={name} variant="outline" className="text-[10px] font-medium rounded-full px-2 text-muted-foreground">{name}</Badge>
                                ))}
                            </div>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenEditDialog(group, true)}>
                                        <Eye className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent><p>Visualizar</p></TooltipContent>
                            </Tooltip>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenEditDialog(group)}>
                                        <Pencil className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent><p>Editar</p></TooltipContent>
                            </Tooltip>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDuplicateGroup(group)}>
                                        <Copy className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent><p>Duplicar</p></TooltipContent>
                            </Tooltip>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => setGoalGroupToDelete(group)}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </AlertDialogTrigger>
                                </TooltipTrigger>
                                <TooltipContent><p>Excluir</p></TooltipContent>
                            </Tooltip>
                        </div>
                    </div>
                )
            })}
        </div>
        </TooltipProvider>
        {goalGroupToDelete && (
            <AlertDialogContent className="rounded-2xl">
                <AlertDialogHeader>
                    <AlertDialogTitle>Excluir grupo de metas?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Essa ação não pode ser desfeita. Isso irá deletar permanentemente o grupo de metas
                        <strong className="mx-1 text-foreground">{goalGroupToDelete.name}</strong>
                        e todos os seus períodos e metas associadas.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setGoalGroupToDelete(null)}>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteGroup} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Sim, excluir</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        )}
    </AlertDialog>
     )
  }

  const renderAccordion = (
      items: (User | Branch | Role)[], 
      groupingKey: 'branchId' | 'userId' | 'roleId'
    ) => {
    
    const sortedItems = [...items].sort((a,b) => a.name.localeCompare(b.name));

    return (
      <Accordion type="multiple" className="w-full space-y-3" defaultValue={items.map(i => i.id)}>
          {sortedItems.map(item => {
              let filteredGoals: Goal[];
              if (groupingKey === 'userId') {
                const user = item as User;
                filteredGoals = goals.filter(goal => goal.userId === user.id);
              } else {
                filteredGoals = goals.filter(goal => goal[groupingKey] === item.id && !goal.userId);
              }

              // Apply period filter for visibility check
              const visibleGoals = selectedPeriodGroupId
                ? filteredGoals.filter(g => g.periodGroupId === selectedPeriodGroupId)
                : filteredGoals;

              if(visibleGoals.length === 0) return null;
              
              let name = item.name;
              let icon: React.ReactNode;

              switch(groupingKey) {
                case 'userId':
                    const user = item as User;
                    const role = roles.find(r => r.id === user.roleId);
                    name = role ? `${user.name} (${role.name})` : user.name;
                    icon = <UserIcon className="h-4 w-4"/>;
                    break;
                case 'branchId':
                    icon = <GitFork className="h-4 w-4"/>;
                    break;
                case 'roleId':
                    icon = <BriefcaseBusiness className="h-4 w-4"/>;
                    break;
              }

              const visibleCount = groupGoals(filteredGoals.filter(g => selectedPeriodGroupId ? g.periodGroupId === selectedPeriodGroupId : true)).length;

              return (
                  <AccordionItem value={item.id} key={item.id} className="border rounded-xl overflow-hidden bg-card shadow-sm">
                      <AccordionTrigger className="px-5 py-4 hover:no-underline hover:bg-muted/30 transition-colors group/trigger">
                          <div className="flex items-center gap-3 w-full">
                              <div className="h-9 w-9 rounded-lg bg-primary/5 border border-primary/10 flex items-center justify-center text-primary shrink-0 group-data-[state=open]/trigger:bg-primary group-data-[state=open]/trigger:text-primary-foreground group-data-[state=open]/trigger:border-primary transition-all">
                                  {icon}
                              </div>
                              <span className="font-bold text-base tracking-tight flex-1 text-left">{name}</span>
                              <Badge variant="secondary" className="mr-2 text-xs font-bold rounded-full">{visibleCount} grupo(s)</Badge>
                          </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-5 pb-4 pt-2">
                          {renderGoalsTable(filteredGoals)}
                      </AccordionContent>
                  </AccordionItem>
              )
          })}
      </Accordion>
    )
  };
  
  const renderCreateGoalInputs = (goalTypeId: string, periodId: string, valueType: 'currency' | 'percentage') => {
      const setting = currentGoal.goalSettings.find(s => s.goalTypeId === goalTypeId);
      if (!setting) return null;
      
      const period = selectedPeriods.find(p => p.id === periodId);
      if (!period) return null;

      const handleValueChange = valueType === 'currency' ? handleCurrencyChange : handleNumericChange;
      const formatFunction = valueType === 'currency' ? formatCurrencyForInput : (val: number | undefined) => val?.toString() ?? '';
      const inputType = valueType === 'currency' ? 'text' : 'number';
      const placeholder = valueType === 'currency' ? '0,00' : '0';
      const inputClass = valueType === 'currency' ? 'pl-7' : '';
      
      const levelValues = setting.periodValues[periodId]?.levelTargets || initialLevelTargets;
      const totalSum = Object.values(levelValues).reduce((acc, val) => acc + (val || 0), 0);

      return (
        <div key={periodId} className="p-4 rounded-md bg-muted/50">
            <div className="mb-4">
              <h4 className="font-medium">{period.name}</h4>
              <p className="text-xs text-muted-foreground">
                {formatDate(period.startDate)} - {formatDate(period.endDate)}
              </p>
            </div>
            {setting.hasLevels ? (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    {(Object.keys(levelIcons) as Array<keyof GoalLevelTargets>).map(level => (
                        <div key={level} className="space-y-2">
                            <Label htmlFor={`level-${setting.goalTypeId}-${periodId}-${level}`} className="flex items-center gap-2 text-sm">{levelIcons[level]} {level}</Label>
                            <div className="relative">
                               {valueType === 'currency' && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>}
                                <Input
                                    id={`level-${setting.goalTypeId}-${periodId}-${level}`}
                                    type={inputType}
                                    value={formatFunction(setting.periodValues[periodId]?.levelTargets?.[level])}
                                    onChange={handleValueChange(value => handleLevelTargetChange(setting.goalTypeId, periodId, level, value))}
                                    className={`text-sm ${inputClass}`}
                                    placeholder={placeholder}
                                    disabled={isSubmitting}
                                />
                            </div>
                        </div>
                    ))}
                    <div className="space-y-2">
                        <Label htmlFor="total-sum" className="flex items-center gap-2 text-sm">Total</Label>
                        <div className="relative">
                             {valueType === 'currency' && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>}
                             <Input
                                id="total-sum"
                                type="text"
                                value={formatFunction(totalSum)}
                                readOnly
                                disabled
                                className={`text-sm font-bold bg-muted/50 ${inputClass}`}
                             />
                        </div>
                    </div>
                </div>
            ) : (
                <div className="space-y-2">
                    <Label htmlFor={`targetValue-${setting.goalTypeId}-${periodId}`}>Valor Alvo</Label>
                    <div className="relative">
                        {valueType === 'currency' && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>}
                        <Input 
                            id={`targetValue-${setting.goalTypeId}-${periodId}`} 
                            type={inputType} 
                            value={formatFunction(setting.periodValues[periodId]?.targetValue)} 
                            onChange={handleValueChange(value => handlePeriodValueChange(setting.goalTypeId, periodId, value))} 
                            className={inputClass}
                            placeholder={placeholder} 
                            disabled={isSubmitting}
                        />
                         {valueType === 'percentage' && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>}
                    </div>
                </div>
            )}
        </div>
      );
  }
  
  const renderEditGroupInputs = () => {
    if (!editingGoalGroup) return null;
    const isReadOnly = isViewing || isSubmitting;
    
    // Sort goalSettings based on goalTypes order
    const goalTypeOrderMap = new Map(goalTypes.map(gt => [gt.id, gt.order]));
    const sortedGoalSettings = [...editingGoalGroup.goalSettings].sort((a, b) => {
        const orderA = goalTypeOrderMap.get(a.goalTypeId) ?? 999;
        const orderB = goalTypeOrderMap.get(b.goalTypeId) ?? 999;
        return orderA - orderB;
    });


    return (
      <div className="space-y-4">
        <div className="space-y-2">
            <Label htmlFor="edit-group-name">Nome do Grupo de Metas</Label>
            <Input id="edit-group-name" value={editingGoalGroup.name} onChange={(e) => handleEditGroupNameChange(e.target.value)} disabled={isReadOnly} />
        </div>
        
        {sortedGoalSettings.map(setting => {
            const goalType = goalTypes.find(gt => gt.id === setting.goalTypeId);
            if (!goalType) return null;

            const valueType = goalType.valueType;
            const handleValueChange = valueType === 'currency' ? handleCurrencyChange : handleNumericChange;
            const formatFunction = valueType === 'currency' ? formatCurrencyForInput : (val: number | undefined) => val?.toString() ?? '';
            const inputType = valueType === 'currency' ? 'text' : 'number';
            const placeholder = valueType === 'currency' ? '0,00' : '0';
            const inputClass = valueType === 'currency' ? 'pl-7' : '';

            // Find all periods for this goal type
            const periodIdsForGoalType = Object.keys(setting.periodValues);
            const periodsForGoalType = periodIdsForGoalType
                .map(pid => {
                    const { periodName, period } = getPeriodInfo(pid);
                    return {
                        periodId: pid,
                        periodName: periodName,
                        startDate: period?.startDate,
                        endDate: period?.endDate,
                    };
                })
                .sort((a,b) => a.periodName.localeCompare(b.periodName, undefined, { numeric: true }));

            return (
                <Card key={`edit-card-${setting.goalTypeId}`}>
                    <CardHeader>
                        <div className="flex justify-between items-center">
                            <CardTitle>{goalType.name}</CardTitle>
                            <div className="flex items-center space-x-2">
                                <Label htmlFor={`edit-has-levels-${setting.goalTypeId}`}>Meta por Nível?</Label>
                                <Switch id={`edit-has-levels-${setting.goalTypeId}`} checked={setting.hasLevels} onCheckedChange={(c) => handleEditGoalSettingChange(setting.goalTypeId, 'hasLevels', c)} disabled={isReadOnly} />
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {periodsForGoalType.map(period => {
                            const levelValues = setting.periodValues[period.periodId]?.levelTargets || initialLevelTargets;
                            const totalSum = Object.values(levelValues).reduce((acc, val) => acc + (val || 0), 0);

                            return (
                                <div key={`edit-${setting.goalTypeId}-${period.periodId}`} className="p-4 rounded-md bg-muted/50">
                                    <div className="mb-4">
                                    <h4 className="font-medium">{period.periodName}</h4>
                                    <p className="text-xs text-muted-foreground">
                                        {formatDate(period.startDate!)} - {formatDate(period.endDate!)}
                                    </p>
                                    </div>
                                    {setting.hasLevels ? (
                                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                            {(Object.keys(levelIcons) as Array<keyof GoalLevelTargets>).map(level => (
                                                <div key={level} className="space-y-2">
                                                    <Label htmlFor={`edit-level-${setting.goalTypeId}-${period.periodId}-${level}`} className="flex items-center gap-2 text-sm">{levelIcons[level]} {level}</Label>
                                                    <div className="relative">
                                                        {valueType === 'currency' && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>}
                                                        <Input
                                                            id={`edit-level-${setting.goalTypeId}-${period.periodId}-${level}`}
                                                            type={inputType}
                                                            value={formatFunction(setting.periodValues[period.periodId]?.levelTargets?.[level])}
                                                            onChange={handleValueChange(value => handleEditLevelTargetChange(setting.goalTypeId, period.periodId, level, value))}
                                                            className={`text-sm ${inputClass}`}
                                                            placeholder={placeholder}
                                                            disabled={isReadOnly}
                                                        />
                                                    </div>
                                                </div>
                                            ))}
                                            <div className="space-y-2">
                                                <Label htmlFor={`total-sum-edit-${period.periodId}`} className="flex items-center gap-2 text-sm">Total</Label>
                                                <div className="relative">
                                                    {valueType === 'currency' && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>}
                                                    <Input
                                                        id={`total-sum-edit-${period.periodId}`}
                                                        type="text"
                                                        value={formatFunction(totalSum)}
                                                        readOnly
                                                        disabled
                                                        className={`text-sm font-bold bg-muted/50 ${inputClass}`}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            <Label htmlFor={`edit-targetValue-${setting.goalTypeId}-${period.periodId}`}>Valor Alvo</Label>
                                            <div className="relative">
                                                {valueType === 'currency' && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>}
                                                <Input
                                                    id={`edit-targetValue-${setting.goalTypeId}-${period.periodId}`}
                                                    type={inputType}
                                                    value={formatFunction(setting.periodValues[period.periodId]?.targetValue)}
                                                    onChange={handleValueChange(value => handleEditPeriodValueChange(setting.goalTypeId, period.periodId, value))}
                                                    className={inputClass}
                                                    placeholder={placeholder}
                                                    disabled={isReadOnly}
                                                />
                                                {valueType === 'percentage' && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </CardContent>
                </Card>
            )
        })}
      </div>
    )
  }

  return (
    <>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold font-headline tracking-tight text-zinc-900 dark:text-zinc-50">Metas</h1>
            <p className="text-muted-foreground mt-1">Gerencie os objetivos e metas da sua equipe por período.</p>
          </div>
          <Dialog open={openCreate} onOpenChange={setOpenCreate}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2 shadow-md hover:shadow-lg transition-all" onClick={() => handleOpenCreateDialog()}>
                <PlusCircle className="h-4 w-4" />
                <span>Cadastrar Meta</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-4xl rounded-2xl" onCloseAutoFocus={handleCloseCreateDialog}>
              <DialogHeader>
                <DialogTitle>Cadastrar Novas Metas</DialogTitle>
                <DialogDescription>
                  Defina os valores da meta para cada tipo e período.
                </DialogDescription>
              </DialogHeader>
              <ScrollArea className="max-h-[70vh] p-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 py-4 pr-6">
                
                <div className="flex flex-col gap-4 md:col-span-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">Nome da Meta</Label>
                            <Input id="name" value={currentGoal.name || ""} onChange={(e) => handleInputChange('name', e.target.value)} placeholder="Ex: Vendas do Produto X" disabled={isSubmitting}/>
                        </div>
                        
                        <div className="space-y-2">
                            <Label>Grupo de Períodos</Label>
                            <Select value={currentGoal.periodGroupId} onValueChange={handlePeriodGroupChange} disabled={isSubmitting}>
                                <SelectTrigger><SelectValue placeholder="Selecione o grupo" /></SelectTrigger>
                                <SelectContent>{periodGroups.map(g => <SelectItem key={g.id} value={g.id}>{g.name} ({g.periods.length} {g.periods.length !== 1 ? 'períodos' : 'período'})</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>Responsável pela Meta</Label>
                        <Tabs value={currentGoal.responsibleType} onValueChange={(v) => { handleInputChange('responsibleType', v as 'branch' | 'user' | 'role'); setResponsibleSearch(""); }} className="w-full">
                          <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="branch">Por Filial</TabsTrigger>
                            <TabsTrigger value="user">Por Vendedor</TabsTrigger>
                            <TabsTrigger value="role">Por Função</TabsTrigger>
                          </TabsList>
                          <div className="pt-4">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" className="w-full justify-start font-normal">
                                        {currentGoal.responsibleIds.length > 0 ? `${currentGoal.responsibleIds.length} selecionado(s)` : `Selecione ${responsibleLabel}(s)`}
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width] max-h-60 overflow-y-auto">
                                    <div className="p-2 border-b flex items-center gap-2 sticky top-0 bg-popover z-10">
                                        <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                        <input
                                            placeholder={`Pesquisar ${responsibleLabel.toLowerCase()}...`}
                                            value={responsibleSearch}
                                            onChange={(e) => setResponsibleSearch(e.target.value)}
                                            onKeyDown={(e) => e.stopPropagation()}
                                            onClick={(e) => e.stopPropagation()}
                                            className="w-full text-xs bg-transparent outline-none border-none placeholder:text-muted-foreground"
                                        />
                                    </div>
                                    <DropdownMenuLabel>Responsáveis</DropdownMenuLabel>
                                    {filteredResponsibleOptions.map(opt => (
                                        <DropdownMenuCheckboxItem
                                            key={opt.id}
                                            checked={currentGoal.responsibleIds.includes(opt.id)}
                                            onSelect={(e) => e.preventDefault()}
                                            onCheckedChange={() => handleResponsibleSelection(opt.id)}
                                        >
                                            {opt.name}
                                        </DropdownMenuCheckboxItem>
                                    ))}
                                    {filteredResponsibleOptions.length === 0 && (
                                        <div className="p-4 text-xs text-center text-muted-foreground">
                                            Nenhum resultado encontrado
                                        </div>
                                    )}
                                </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </Tabs>
                    </div>
                     <div className="space-y-2">
                        <Label>Tipos de Meta</Label>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="outline" className="w-full justify-start font-normal">
                                    {currentGoal.goalSettings.length > 0 
                                    ? `${currentGoal.goalSettings.length} selecionado(s)`
                                    : "Selecione os tipos de meta"
                                    }
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-full">
                                <DropdownMenuLabel>Tipos de Meta</DropdownMenuLabel>
                                {goalTypes.map(gt => (
                                    <DropdownMenuCheckboxItem
                                        key={gt.id}
                                        checked={currentGoal.goalSettings.some(gs => gs.goalTypeId === gt.id)}
                                        onSelect={(e) => e.preventDefault()}
                                        onCheckedChange={() => handleGoalTypeSelection(gt.id)}
                                    >
                                        {gt.name}
                                    </DropdownMenuCheckboxItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>

                <div className="flex flex-col gap-4 md:col-span-2">
                  <h3 className="text-lg font-medium">Configuração das Metas</h3>
                  {currentGoal.goalSettings.length > 0 ? currentGoal.goalSettings.map(setting => {
                    const goalType = goalTypes.find(gt => gt.id === setting.goalTypeId);
                    if(!goalType) return null;
                    
                    return (
                    <Card key={setting.goalTypeId}>
                        <CardHeader>
                            <div className="flex justify-between items-center">
                                <CardTitle>{goalType.name}</CardTitle>
                                <div className="flex items-center space-x-2">
                                    <Label htmlFor={`has-levels-${setting.goalTypeId}`}>Meta por Nível?</Label>
                                    <Switch id={`has-levels-${setting.goalTypeId}`} checked={setting.hasLevels} onCheckedChange={(c) => handleGoalSettingChange(setting.goalTypeId, 'hasLevels', c)} disabled={isSubmitting} />
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {selectedPeriods.length > 0 ? selectedPeriods.map(period => (
                                renderCreateGoalInputs(setting.goalTypeId, period.id, goalType.valueType)
                            )) : (
                               <div className="text-center text-sm text-muted-foreground py-4">Selecione um Grupo de Períodos</div>
                            )}
                        </CardContent>
                    </Card>
                    )
                  }) : (
                     <div className="flex items-center justify-center h-full rounded-md border border-dashed text-sm text-muted-foreground py-10">
                       Selecione um ou mais Tipos de Meta
                     </div>
                  )}
                </div>
              </div>
              </ScrollArea>
              <DialogFooter>
                <Button variant="outline" onClick={handleCloseCreateDialog} disabled={isSubmitting}>Cancelar</Button>
                <Button onClick={handleSubmit} disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="animate-spin" /> : "Salvar Metas"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="border-none shadow-premium bg-white/40 dark:bg-zinc-900/40 backdrop-blur-md">
          <CardHeader className="pb-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <CardTitle className="text-xl flex items-center gap-2">
                        <Target className="text-primary w-5 h-5" />
                        Lista de Metas
                    </CardTitle>
                    <CardDescription>Total de <strong>{goals.length}</strong> registros individuais cadastrados.</CardDescription>
                </div>
                <div className="w-full sm:w-auto">
                   <Select value={selectedPeriodGroupId || ''} onValueChange={(value) => setSelectedPeriodGroupId(value)}>
                      <SelectTrigger className="w-full sm:w-[280px] rounded-xl">
                        <SelectValue placeholder="Selecione um Grupo de Período" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {periodGroups.map(group => {
                          const status = getGroupStatus(group);
                          return (
                            <SelectItem key={group.id} value={group.id}>
                              <div className="flex items-center justify-between gap-3">
                                <span>{group.name}</span>
                                <Badge variant={status.variant} className="text-[10px]">{status.text}</Badge>
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
              <div className="flex flex-col justify-center items-center h-40 gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Carregando metas...</p>
              </div>
            ) : (
             <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="rounded-xl">
                  <TabsTrigger value="branch" className="rounded-lg">Por Filial</TabsTrigger>
                  <TabsTrigger value="user" className="rounded-lg">Por Vendedor</TabsTrigger>
                  <TabsTrigger value="role" className="rounded-lg">Por Função</TabsTrigger>
                </TabsList>
                <TabsContent value="branch" className="pt-4">
                  {renderAccordion(branches, 'branchId')}
                </TabsContent>
                <TabsContent value="user" className="pt-4">
                  {renderAccordion(salespeople, 'userId')}
                </TabsContent>
                <TabsContent value="role" className="pt-4">
                  {renderAccordion(roles, 'roleId')}
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Edit/View Dialog */}
      <Dialog open={openEdit} onOpenChange={(open) => {
        if (!open) {
          handleCloseEditDialog();
        } else {
          setOpenEdit(true);
        }
      }}>
        <DialogContent className="sm:max-w-4xl" onCloseAutoFocus={handleCloseEditDialog}>
          <DialogHeader>
            <DialogTitle>{isViewing ? 'Visualizar Grupo de Metas' : 'Editar Grupo de Metas'}</DialogTitle>
            <DialogDescription>
              {isViewing ? 'Visualize os detalhes do grupo de metas.' : 'Ajuste o nome e os valores para cada período do grupo de metas.'}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh] p-1">
             <div className="py-4 pr-4">
              {renderEditGroupInputs()}
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseEditDialog} disabled={isSubmitting}>
              {isViewing ? 'Fechar' : 'Cancelar'}
            </Button>
            {!isViewing && (
              <Button onClick={handleUpdateGroup} disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="animate-spin" /> : "Salvar Alterações"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

    

    