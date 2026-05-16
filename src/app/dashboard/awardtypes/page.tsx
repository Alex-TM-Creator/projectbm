

"use client";

import * as React from "react";
import { PlusCircle, MoreHorizontal, Trash2, Loader2, Pencil, Award, Gem, Trophy, Medal, Diamond, BriefcaseBusiness, X, Plus, Target, Copy, GitFork } from "lucide-react";
import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
  query,
  orderBy,
  setDoc,
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import type { AwardType, AwardLevel, AwardTypeOption, Role, SalesRange, AwardTypeCategory, GoalType, FreightTargetType, Branch } from "@/lib/definitions";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"


const levelIcons: {[key: string]: React.ReactNode } = {
    Bronze: <Medal className="h-4 w-4 text-orange-600" />,
    Prata: <Trophy className="h-4 w-4 text-slate-500" />,
    Ouro: <Award className="h-4 w-4 text-yellow-500" />,
    Diamante: <Gem className="h-4 w-4 text-sky-400" />,
};

const orderedLevels: Array<AwardLevel['name']> = ['Bronze', 'Prata', 'Ouro', 'Diamante'];

const initialLevels: AwardLevel[] = [
    { name: 'Bronze', value: 0 },
    { name: 'Prata', value: 0 },
    { name: 'Ouro', value: 0 },
    { name: 'Diamante', value: 0 },
];

const initialRanges: SalesRange[] = [];

const awardTypeDetails = {
    fixedBonusByLevel: {
        name: "Bônus Fixo por Nível",
        description: "Define um valor de bônus fixo (R$) para cada nível de meta atingido (Bronze, Prata, Ouro, Diamante).",
        cardTitle: "Níveis de Premiação (Bônus Fixo)",
        cardDescription: "Defina o valor do bônus para cada nível.",
        isCurrency: true,
    },
    percentageByLevel: {
        name: "% sobre Realizado por Nível",
        description: "Define uma porcentagem de comissão sobre o valor total realizado, de acordo com o nível de meta atingido.",
        cardTitle: "Níveis de Premiação (% Premiação)",
        cardDescription: "Defina a porcentagem de premiação para cada nível.",
        isCurrency: false,
    },
    salesRangeBonus: {
        name: "Premiação por Faixas de Venda (%)",
        description: "Cria diferentes faixas de vendas com uma porcentagem de bônus sobre o realizado.",
        cardTitle: "Faixas de Premiação (% Bônus)",
        cardDescription: "Defina os limites e bônus para cada faixa.",
        isCurrency: false,
    },
    fixedBonusBySalesRange: {
        name: "Premiação por Faixas de Venda (R$)",
        description: "Cria diferentes faixas de vendas com um valor fixo (R$) de bônus.",
        cardTitle: "Faixas de Premiação (Bônus Fixo)",
        cardDescription: "Defina os limites e bônus para cada faixa.",
        isCurrency: true,
    },
    freightConversionBonus: {
        name: "Bônus por Conversão de Frete",
        description: "Premia com um percentual ou valor fixo sobre o valor do frete se a relação frete/vendas atingir uma meta.",
        cardTitle: "Premiação por Conversão de Frete",
        cardDescription: "Defina a meta de conversão e a premiação a ser paga.",
        isCurrency: false, // This will be handled dynamically
    },
    bonusByCumulativeLevel: {
        name: "Bônus por Nível Acumulado",
        description: "Paga um bônus fixo se um nível de meta for atingido um número X de vezes dentro de um grupo de períodos.",
        cardTitle: "Configuração do Bônus Acumulado",
        cardDescription: "Defina o nível, a frequência necessária e o valor do bônus.",
        isCurrency: true,
    }
}

export default function AwardTypesPage() {
  const { toast } = useToast();
  const [awardTypes, setAwardTypes] = React.useState<AwardType[]>([]);
  const [roles, setRoles] = React.useState<Role[]>([]);
  const [branches, setBranches] = React.useState<Branch[]>([]);
  const [goalTypes, setGoalTypes] = React.useState<GoalType[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [open, setOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const [currentAwardType, setCurrentAwardType] = React.useState<Partial<AwardType>>({ type: 'fixedBonusByLevel', category: 'award', levels: initialLevels, ranges: initialRanges, freightTargetType: 'percentage', freightTargetValue: 0, freightCommissionType: 'percentage', commissionPercentage: 0, goalTypeIds: [], cumulativeLevelTarget: 'Diamante', cumulativeOccurrences: 1, cumulativeBonusValue: 0 });
  const [awardTypeToDelete, setAwardTypeToDelete] = React.useState<AwardType | null>(null);

  const isEditing = !!currentAwardType.id;
  const currentDetails = awardTypeDetails[currentAwardType.type || 'fixedBonusByLevel'];
  const isRangeBased = (award: Partial<AwardType>) => award.type === 'salesRangeBonus' || award.type === 'fixedBonusBySalesRange';
  const isLevelBased = (award: Partial<AwardType>) => award.type === 'fixedBonusByLevel' || award.type === 'percentageByLevel';
  const isFreightConversion = (award: Partial<AwardType>) => award.type === 'freightConversionBonus';
  const isCumulativeBonus = (award: Partial<AwardType>) => award.type === 'bonusByCumulativeLevel';
  
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  }
  
  const formatPercentage = (value: number) => {
      return `${(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
  }
  
  const formatCurrencyForInput = (value: number | undefined) => {
    if (value === undefined || value === null) return '';
    const formatted = new Intl.NumberFormat('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(value);
    return formatted;
  };
  
  const handleCurrencyInputChange = (setter: (value: number) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
      const rawValue = e.target.value.replace(/\D/g, '');
      if (rawValue === '') {
        setter(0);
        return;
      }
      const numericValue = parseInt(rawValue, 10) / 100;
      setter(numericValue);
  };
  
  const formatPercentageForInput = (value: number | undefined) => {
    if (value === undefined || value === null || isNaN(value)) return '';
    const formatted = value.toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
    return formatted;
  };

  const handlePercentageInputChange = (setter: (value: number) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
      let rawValue = e.target.value.replace(/[^0-9]/g, '');
      if (rawValue === '') {
        setter(0);
        return;
      }
      const numericValue = parseFloat(rawValue) / 100;
      setter(numericValue);
  };

  const handleValueChange = (setter: (value: number) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
      setter(parseFloat(e.target.value) || 0);
  }

  const handleLevelValueChange = (levelName: AwardLevel['name'], value: number) => {
    setCurrentAwardType(prev => ({
        ...prev,
        levels: (prev!.levels || []).map(level => 
            level.name === levelName ? { ...level, value: value } : level
        )
    }));
  };
  
  const handleRangeChange = (rangeId: string, field: keyof SalesRange, value: any) => {
    setCurrentAwardType(prev => ({
        ...prev,
        ranges: (prev?.ranges || []).map(range => 
            range.id === rangeId ? {...range, [field]: value } : range
        )
    }));
  };

  const handleAddRange = () => {
    const newRange: SalesRange = {
      id: `range-${Date.now()}`,
      from: 0,
      to: 0,
      value: 0
    };
    setCurrentAwardType(prev => ({...prev, ranges: [...(prev?.ranges || []), newRange]}));
  };
  
  const handleRemoveRange = (rangeId: string) => {
    setCurrentAwardType(prev => ({...prev, ranges: (prev?.ranges || []).filter(r => r.id !== rangeId)}));
  }

  const handleGoalTypeSelection = (goalTypeId: string) => {
    setCurrentAwardType(prev => {
      const newGoalTypeIds = [...(prev?.goalTypeIds || [])];
      const index = newGoalTypeIds.indexOf(goalTypeId);
      if (index > -1) {
        newGoalTypeIds.splice(index, 1);
      } else {
        newGoalTypeIds.push(goalTypeId);
      }
      return { ...prev, goalTypeIds: newGoalTypeIds };
    });
  }


  const fetchData = React.useCallback(async () => {
    try {
      setLoading(true);
      
      const [awardTypesSnap, rolesSnap, branchesSnap, goalTypesSnap] = await Promise.all([
        getDocs(query(collection(db, "awardtypes"), orderBy("name"))),
        getDocs(query(collection(db, "roles"), orderBy("name"))),
        getDocs(query(collection(db, "branches"), orderBy("name"))),
        getDocs(query(collection(db, "goaltypes"), orderBy("order"))),
      ]);
      
      const awardTypesList = awardTypesSnap.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as AwardType)
      );
      setAwardTypes(awardTypesList);
      
      const rolesList = rolesSnap.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as Role)
      );
      setRoles(rolesList);

      const branchesList = branchesSnap.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as Branch)
      );
      setBranches(branchesList);
      
      const goalTypesList = goalTypesSnap.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as GoalType)
      );
      setGoalTypes(goalTypesList);


    } catch (error) {
      toast({
        title: "Erro ao buscar dados",
        description: "Não foi possível carregar as listas.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleOpenDialog = (awardType?: AwardType) => {
    if (awardType) {
        const deepCopy = JSON.parse(JSON.stringify(awardType));
        // Set defaults for new fields if they don't exist
        if (deepCopy.type === 'freightConversionBonus') {
            deepCopy.freightTargetType = deepCopy.freightTargetType || 'percentage';
            deepCopy.freightTargetValue = deepCopy.freightTargetValue ?? deepCopy.conversionTargetPercentage ?? 0;
            deepCopy.freightCommissionType = deepCopy.freightCommissionType || 'percentage';
            delete deepCopy.conversionTargetPercentage; // remove old field
        }
        if (deepCopy.type === 'bonusByCumulativeLevel') {
            deepCopy.cumulativeLevelTarget = deepCopy.cumulativeLevelTarget || 'Diamante';
            deepCopy.cumulativeOccurrences = deepCopy.cumulativeOccurrences || 1;
            deepCopy.cumulativeBonusValue = deepCopy.cumulativeBonusValue || 0;
        }
        setCurrentAwardType(deepCopy);
    } else {
        const defaultType = 'fixedBonusByLevel';
        setCurrentAwardType({
            name: "", 
            description: awardTypeDetails[defaultType].description, 
            type: defaultType,
            category: 'award',
            levels: JSON.parse(JSON.stringify(initialLevels)),
            ranges: JSON.parse(JSON.stringify(initialRanges)),
            roleId: undefined,
            branchId: undefined,
            goalTypeIds: [],
            freightTargetType: 'percentage',
            freightTargetValue: 0,
            freightCommissionType: 'percentage',
            commissionPercentage: 0,
            cumulativeLevelTarget: 'Diamante',
            cumulativeOccurrences: 1,
            cumulativeBonusValue: 0,
        });
    }
    setOpen(true);
  };
  
  const handleDuplicate = (awardType: AwardType) => {
    const newAwardType = JSON.parse(JSON.stringify(awardType));
    delete newAwardType.id; // Remove ID to create a new document
    newAwardType.name = `${newAwardType.name} (Cópia)`;
    handleOpenDialog(newAwardType);
  }
  
  const handleCloseDialog = () => {
    setCurrentAwardType({ type: 'fixedBonusByLevel', category: 'award', levels: initialLevels, ranges: initialRanges, goalTypeIds: [], freightTargetType: 'percentage', freightTargetValue: 0, freightCommissionType: 'percentage', commissionPercentage: 0, cumulativeLevelTarget: 'Diamante', cumulativeOccurrences: 1, cumulativeBonusValue: 0 });
    setOpen(false);
  };
  
  const handleTypeChange = (type: AwardTypeOption) => {
      setCurrentAwardType(prev => ({
          ...prev,
          type: type,
          description: awardTypeDetails[type].description,
          levels: JSON.parse(JSON.stringify(initialLevels)),
          ranges: JSON.parse(JSON.stringify(initialRanges)),
          freightTargetType: prev?.freightTargetType || 'percentage',
          freightTargetValue: prev?.freightTargetValue || 0,
          freightCommissionType: prev?.freightCommissionType || 'percentage',
          commissionPercentage: prev?.commissionPercentage || 0,
          cumulativeLevelTarget: prev?.cumulativeLevelTarget || 'Diamante',
          cumulativeOccurrences: prev?.cumulativeOccurrences || 1,
          cumulativeBonusValue: prev?.cumulativeBonusValue || 0,
      }))
  }

  const handleSubmit = async () => {
    if (!currentAwardType.name || currentAwardType.name.trim() === "" || isSubmitting) {
        toast({ title: "Título é obrigatório", description: "Por favor, preencha o título da premiação.", variant: "destructive"});
        return;
    };

    setIsSubmitting(true);
    try {
      const data: any = {
          name: currentAwardType.name!,
          description: currentAwardType.description!,
          type: currentAwardType.type!,
          category: currentAwardType.category!,
          roleId: currentAwardType.roleId || null,
          branchId: currentAwardType.branchId || null,
          goalTypeIds: currentAwardType.goalTypeIds || []
      };

      if (data.roleId) {
        data.branchId = null;
      } else if (data.branchId) {
        data.roleId = null;
      }
      
      if(isLevelBased(currentAwardType)) data.levels = currentAwardType.levels || [];
      if(isRangeBased(currentAwardType)) data.ranges = currentAwardType.ranges || [];
      if(isFreightConversion(currentAwardType)) {
        data.freightTargetType = currentAwardType.freightTargetType || 'percentage';
        data.freightTargetValue = currentAwardType.freightTargetValue || 0;
        data.freightCommissionType = currentAwardType.freightCommissionType || 'percentage';
        data.commissionPercentage = currentAwardType.commissionPercentage || 0;
      }
      if(isCumulativeBonus(currentAwardType)) {
        data.cumulativeLevelTarget = currentAwardType.cumulativeLevelTarget || 'Diamante';
        data.cumulativeOccurrences = currentAwardType.cumulativeOccurrences || 1;
        data.cumulativeBonusValue = currentAwardType.cumulativeBonusValue || 0;
      }


      const awardTypeData = { ...data };

      if (isEditing) {
        const docRef = doc(db, "awardtypes", currentAwardType.id!);
        await updateDoc(docRef, awardTypeData as any);
        toast({
          title: "Tipo de Premiação Atualizado!",
          description: "O tipo de premiação foi atualizado com sucesso.",
        });
      } else {
        const docRef = doc(collection(db, "awardtypes"));
        await setDoc(docRef, { ...awardTypeData, id: docRef.id });
        toast({
          title: "Tipo de Premiação Cadastrado!",
          description: "O novo tipo de premiação foi adicionado com sucesso.",
        });
      }
      handleCloseDialog();
      fetchData(); // Refresh the list
    } catch (error) {
        console.error("Error saving award type: ", error);
      toast({
        title: isEditing ? "Erro ao atualizar" : "Erro ao cadastrar",
        description: `Não foi possível salvar os dados.`,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!awardTypeToDelete) return;
    try {
      await deleteDoc(doc(db, "awardtypes", awardTypeToDelete.id));
      toast({
        title: "Tipo de Premiação Deletado",
        description: "O registro foi removido com sucesso.",
        variant: "destructive",
      });
      fetchData(); // Refresh the list
    } catch (error) {
      toast({
        title: "Erro ao deletar",
        description: "Não foi possível remover o registro.",
        variant: "destructive",
      });
    } finally {
      setAwardTypeToDelete(null);
    }
  };
  
  const getRoleName = (roleId?: string) => {
    if(!roleId) return null;
    return roles.find(r => r.id === roleId)?.name;
  }

  const getBranchName = (branchId?: string) => {
    if(!branchId) return null;
    return branches.find(b => b.id === branchId)?.name;
  }
  
  const getGoalTypeNamesByIds = (ids?: string[]) => {
      if (!ids || ids.length === 0) return [];
      return ids.map(id => goalTypes.find(gt => gt.id === id)?.name).filter(Boolean) as string[];
  }
  
  const renderFreightBonusDetails = (award: AwardType) => {
      const targetValue = award.freightTargetValue ?? 0;
      const targetDisplay = award.freightTargetType === 'currency'
        ? formatCurrency(targetValue)
        : formatPercentage(targetValue);

      const commissionValue = award.commissionPercentage ?? 0;
      const commissionDisplay = award.freightCommissionType === 'currency'
        ? formatCurrency(commissionValue)
        : formatPercentage(commissionValue);

      return (
        <div className="flex flex-col gap-1 text-xs text-muted-foreground font-mono">
            <span>Meta: <strong className="text-foreground">{targetDisplay}</strong></span>
            <span>Premiação: <strong className="text-foreground">{commissionDisplay}</strong></span>
        </div>
      )
  }
  
  const renderCumulativeBonusDetails = (award: AwardType) => {
    return (
        <div className="flex flex-col gap-1 text-xs text-muted-foreground font-mono">
            <span>Nível: <strong className="text-foreground">{award.cumulativeLevelTarget}</strong></span>
            <span>Ocorrências: <strong className="text-foreground">{award.cumulativeOccurrences}x</strong></span>
            <span>Bônus: <strong className="text-foreground">{formatCurrency(award.cumulativeBonusValue || 0)}</strong></span>
        </div>
    )
  }

  const groupedAwardTypes = React.useMemo(() => {
    const groupedByRole: { [key: string]: AwardType[] } = {};
    const groupedByBranch: { [key: string]: AwardType[] } = {};
    const unassigned: AwardType[] = [];

    awardTypes.forEach(award => {
      if (award.roleId) {
        if (!groupedByRole[award.roleId]) {
          groupedByRole[award.roleId] = [];
        }
        groupedByRole[award.roleId].push(award);
      } else if (award.branchId) {
        if (!groupedByBranch[award.branchId]) {
          groupedByBranch[award.branchId] = [];
        }
        groupedByBranch[award.branchId].push(award);
      } else {
        unassigned.push(award);
      }
    });
    
    // Convert to an array of objects for easier rendering
    const rolesGroupedArray = roles
        .filter(role => groupedByRole[role.id])
        .map(role => ({
            id: role.id,
            name: role.name,
            type: 'role' as const,
            awards: groupedByRole[role.id]
        }));
        
    const branchesGroupedArray = branches
        .filter(branch => groupedByBranch[branch.id])
        .map(branch => ({
            id: branch.id,
            name: branch.name,
            type: 'branch' as const,
            awards: groupedByBranch[branch.id]
        }));
    
    const unassignedGroup = unassigned.length > 0 ? [{
        id: 'unassigned',
        name: 'Global (não atribuído)',
        type: 'unassigned' as const,
        awards: unassigned
    }] : [];
    
    return [...rolesGroupedArray, ...branchesGroupedArray, ...unassignedGroup];

  }, [awardTypes, roles, branches]);
  

  const renderAwardCards = (awards: AwardType[]) => (
    <AlertDialog>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-1">
        {awards.map((awardType) => {
          const isRangeType = awardType.type === 'salesRangeBonus' || awardType.type === 'fixedBonusBySalesRange';
          const goalTypeNames = getGoalTypeNamesByIds(awardType.goalTypeIds);
          const isBonus = awardType.category === 'bonus';

          return (
            <Card key={awardType.id} className="group relative overflow-hidden transition-all hover:shadow-lg border-muted/60 hover:border-primary/30">
              <div className={cn(
                "absolute top-0 left-0 w-1.5 h-full transition-colors",
                isBonus ? "bg-amber-400" : "bg-primary"
              )} />
              
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <Badge variant={isBonus ? "secondary" : "default"} className={cn(
                      "mb-1 uppercase tracking-wider text-[10px] font-bold",
                      isBonus ? "bg-amber-50 text-amber-700 hover:bg-amber-50" : ""
                    )}>
                      {isBonus ? 'Bônus' : 'Premiação'}
                    </Badge>
                    <CardTitle className="text-lg leading-tight font-headline">{awardType.name}</CardTitle>
                    <CardDescription className="line-clamp-2 text-xs min-h-[2.5rem]">
                      {awardType.description}
                    </CardDescription>
                  </div>
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="icon" variant="ghost" className="h-8 w-8 -mt-1 -mr-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Ações</DropdownMenuLabel>
                      <DropdownMenuItem onClick={() => handleOpenDialog(awardType)}>
                        <Pencil className="mr-2 h-4 w-4" /> Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDuplicate(awardType)}>
                        <Copy className="mr-2 h-4 w-4" /> Duplicar
                      </DropdownMenuItem>
                      <AlertDialogTrigger asChild>
                        <DropdownMenuItem className="text-red-600" onSelect={(e) => { e.preventDefault(); setAwardTypeToDelete(awardType); }}>
                          <Trash2 className="mr-2 h-4 w-4" /> Deletar
                        </DropdownMenuItem>
                      </AlertDialogTrigger>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              
              <CardContent className="space-y-4">
                {/* Section: Goal Types Mapping */}
                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Aplicável a</span>
                  <div className="flex flex-wrap gap-1">
                    {goalTypeNames.length > 0 ? (
                      goalTypeNames.map(name => (
                        <Badge key={name} variant="outline" className="text-[10px] py-0 h-5 border-primary/20 bg-primary/5 text-primary">
                          <Target className="h-2.5 w-2.5 mr-1"/>{name}
                        </Badge>
                      ))
                    ) : (
                      <Badge variant="outline" className="text-[10px] py-0 h-5 border-muted-foreground/30 bg-muted/30 text-muted-foreground">
                        Todos os tipos
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Section: Reward Configuration */}
                <div className="pt-2 border-t border-muted/50">
                  {isRangeBased(awardType) ? (
                    <div className="space-y-3">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Escalonamento por Faixas</span>
                      <div className="space-y-2 max-h-[140px] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-muted">
                        {(awardType.ranges || []).map((range, idx) => (
                          <div key={range.id} className="flex items-center justify-between text-xs p-2 rounded-md bg-muted/30 group/range hover:bg-muted/50 transition-colors">
                            <div className="flex flex-col">
                              <span className="text-[10px] text-muted-foreground font-semibold">DE {formatCurrency(range.from)}</span>
                              <span className="text-[10px] text-muted-foreground font-semibold uppercase">ATÉ {formatCurrency(range.to)}</span>
                            </div>
                            <div className="text-sm font-bold text-primary font-mono">
                              {awardType.type === 'salesRangeBonus' ? formatPercentage(range.value) : formatCurrency(range.value)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : awardType.type === 'freightConversionBonus' ? (
                    <div className="space-y-3">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Conversão de Frete</span>
                      <div className="bg-primary/5 rounded-lg p-3 border border-primary/10 space-y-2">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-muted-foreground">Meta atingir:</span>
                          <span className="font-bold font-mono">
                            {awardType.freightTargetType === 'currency' ? formatCurrency(awardType.freightTargetValue || 0) : formatPercentage(awardType.freightTargetValue || 0)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-muted-foreground font-semibold">Premiação:</span>
                          <span className="font-bold font-mono text-primary text-sm">
                            {awardType.freightCommissionType === 'currency' ? formatCurrency(awardType.commissionPercentage || 0) : formatPercentage(awardType.commissionPercentage || 0)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : awardType.type === 'bonusByCumulativeLevel' ? (
                    <div className="space-y-3">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Bônus Acumulado</span>
                      <div className="bg-amber-50/50 rounded-lg p-3 border border-amber-200/50 space-y-2">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-muted-foreground">Nível Alvo:</span>
                          <span className="flex items-center gap-1.5 font-bold">
                            {levelIcons[awardType.cumulativeLevelTarget || 'Diamante']}
                            {awardType.cumulativeLevelTarget}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-muted-foreground">Frequência:</span>
                          <span className="font-bold">{awardType.cumulativeOccurrences}x no período</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-muted-foreground font-semibold">Bônus:</span>
                          <span className="font-bold font-mono text-amber-700 text-sm">
                            {formatCurrency(awardType.cumulativeBonusValue || 0)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Premiação por Nível</span>
                      <div className="grid grid-cols-2 gap-2">
                        {(awardType.levels || []).map(level => (
                          <div key={level.name} className="flex items-center gap-2 p-1.5 rounded-md bg-muted/40 hover:bg-muted/60 transition-colors">
                            <div className="p-1 rounded-full bg-white shadow-sm ring-1 ring-muted/50">
                              {levelIcons[level.name]}
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[9px] uppercase font-bold text-muted-foreground">{level.name}</span>
                              <span className="text-xs font-mono font-bold leading-none">
                                {awardType.type === 'fixedBonusByLevel' ? formatCurrency(level.value) : formatPercentage(level.value)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {awardTypeToDelete && (
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>
              Essa ação não pode ser desfeita. Isso irá deletar permanentemente o tipo de premiação <strong className="mx-1">{awardTypeToDelete.name}</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setAwardTypeToDelete(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">Sim, deletar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      )}
    </AlertDialog>
  );


  return (
    <>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold font-headline tracking-tight">
              Tipos de Premiação
            </h1>
            <p className="text-muted-foreground">
              Gerencie as formas de recompensa para o atingimento de metas.
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1" onClick={() => handleOpenDialog()}>
                <PlusCircle className="h-3.5 w-3.5" />
                <span>Cadastrar Tipo</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[625px]" onCloseAutoFocus={() => handleCloseDialog()}>
              <DialogHeader>
                <DialogTitle>{isEditing ? 'Editar Tipo de Premiação' : 'Cadastrar Novo Tipo de Premiação'}</DialogTitle>
                <DialogDescription>
                  Preencha os detalhes para {isEditing ? 'editar o' : 'criar um novo'} tipo de premiação.
                </DialogDescription>
              </DialogHeader>
              <ScrollArea className="max-h-[70vh] p-1">
              <div className="grid gap-6 py-4 pr-4">
                 <div className="space-y-2">
                  <Label htmlFor="type">Tipo</Label>
                  <Select 
                    value={currentAwardType.type} 
                    onValueChange={(v) => handleTypeChange(v as AwardTypeOption)}
                    disabled={isSubmitting || isEditing}
                    >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="fixedBonusByLevel">{awardTypeDetails.fixedBonusByLevel.name}</SelectItem>
                        <SelectItem value="percentageByLevel">{awardTypeDetails.percentageByLevel.name}</SelectItem>
                        <SelectItem value="salesRangeBonus">{awardTypeDetails.salesRangeBonus.name}</SelectItem>
                        <SelectItem value="fixedBonusBySalesRange">{awardTypeDetails.fixedBonusBySalesRange.name}</SelectItem>
                        <SelectItem value="freightConversionBonus">{awardTypeDetails.freightConversionBonus.name}</SelectItem>
                        <SelectItem value="bonusByCumulativeLevel">{awardTypeDetails.bonusByCumulativeLevel.name}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                 <div className="space-y-2">
                    <Label>Categoria</Label>
                    <RadioGroup 
                        value={currentAwardType.category} 
                        onValueChange={(v) => setCurrentAwardType(p => ({...p, category: v as AwardTypeCategory}))}
                        className="flex items-center gap-4"
                        disabled={isSubmitting}
                    >
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="award" id="cat-award"/>
                            <Label htmlFor="cat-award">Premiação</Label>
                        </div>
                         <div className="flex items-center space-x-2">
                            <RadioGroupItem value="bonus" id="cat-bonus"/>
                            <Label htmlFor="cat-bonus">Bônus</Label>
                        </div>
                    </RadioGroup>
                 </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Título da Premiação</Label>
                  <Input id="name" value={currentAwardType.name || ""} onChange={(e) => setCurrentAwardType(p => ({...p, name: e.target.value}))} placeholder="Ex: Bônus Vendedor ou Comissão Gerente" disabled={isSubmitting}/>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="roleId">Função Aplicável (Opcional)</Label>
                    <Select 
                        value={currentAwardType.roleId || "none"} 
                        onValueChange={(v) => setCurrentAwardType(p => ({...p, roleId: v === 'none' ? undefined : v, branchId: undefined }))}
                        disabled={isSubmitting}
                        >
                        <SelectTrigger><SelectValue placeholder="Aplicável a todos por padrão" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none">Nenhuma (Global)</SelectItem>
                            {roles.map(role => (
                                <SelectItem key={role.id} value={role.id}>{role.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="branchId">Filial Aplicável (Opcional)</Label>
                    <Select 
                        value={currentAwardType.branchId || "none"} 
                        onValueChange={(v) => setCurrentAwardType(p => ({...p, branchId: v === 'none' ? undefined : v, roleId: undefined }))}
                        disabled={isSubmitting}
                        >
                        <SelectTrigger><SelectValue placeholder="Aplicável a todos por padrão" /></SelectTrigger>
                        <SelectContent>
                             <SelectItem value="none">Nenhuma (Global)</SelectItem>
                            {branches.map(branch => (
                                <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="goalTypeId">Tipos de Meta Vinculados (Opcional)</Label>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                          <Button variant="outline" className="w-full justify-start font-normal">
                              {currentAwardType.goalTypeIds && currentAwardType.goalTypeIds.length > 0 
                               ? `${currentAwardType.goalTypeIds.length} selecionado(s)`
                               : "Aplicável a todos os tipos"
                              }
                          </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="w-full">
                         <DropdownMenuLabel>Tipos de Meta</DropdownMenuLabel>
                         {goalTypes.map(gt => (
                            <DropdownMenuCheckboxItem
                                key={gt.id}
                                checked={currentAwardType.goalTypeIds?.includes(gt.id)}
                                onSelect={(e) => e.preventDefault()}
                                onCheckedChange={() => handleGoalTypeSelection(gt.id)}
                            >
                                {gt.name}
                            </DropdownMenuCheckboxItem>
                         ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                 </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea id="description" value={currentAwardType.description || ""} onChange={(e) => setCurrentAwardType(p => ({...p, description: e.target.value}))} placeholder="Explique como funciona esta premiação." disabled={isSubmitting}/>
                </div>
                
                <Card>
                    <CardHeader>
                        <CardTitle>{currentDetails.cardTitle}</CardTitle>
                        <CardDescription>{currentDetails.cardDescription}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {isRangeBased(currentAwardType) ? (
                        <div className="space-y-4">
                          {(currentAwardType.ranges || []).map((range) => (
                             <div key={range.id} className="grid grid-cols-12 items-end gap-2 p-3 rounded-md bg-muted/50">
                                <div className="col-span-4 space-y-1">
                                    <Label htmlFor={`range-from-${range.id}`}>De (R$)</Label>
                                     <Input 
                                      id={`range-from-${range.id}`} 
                                      type="text" 
                                      placeholder="R$ 0,00" 
                                      value={formatCurrencyForInput(range.from)} 
                                      onChange={handleCurrencyInputChange(value => handleRangeChange(range.id, 'from', value))}
                                      disabled={isSubmitting}
                                    />
                                </div>
                                <div className="col-span-4 space-y-1">
                                   <Label htmlFor={`range-to-${range.id}`}>Até (R$)</Label>
                                   <Input 
                                     id={`range-to-${range.id}`} 
                                     type="text" 
                                     placeholder="R$ 5.000,00" 
                                     value={formatCurrencyForInput(range.to)}
                                     onChange={handleCurrencyInputChange(value => handleRangeChange(range.id, 'to', value))}
                                     disabled={isSubmitting}
                                   />
                               </div>
                                <div className="col-span-3 space-y-1">
                                   <Label htmlFor={`range-value-${range.id}`}>{currentDetails.isCurrency ? 'Bônus (R$)' : 'Bônus (%)'}</Label>
                                   {currentDetails.isCurrency ? (
                                      <Input 
                                        id={`range-value-${range.id}`} 
                                        type="text" 
                                        placeholder="R$ 100,00" 
                                        value={formatCurrencyForInput(range.value)} 
                                        onChange={handleCurrencyInputChange(value => handleRangeChange(range.id, 'value', value))}
                                        disabled={isSubmitting}
                                      />
                                   ) : (
                                     <Input 
                                       id={`range-value-${range.id}`} 
                                       type="text"
                                       value={formatPercentageForInput(range.value)}
                                       onChange={handlePercentageInputChange(value => handleRangeChange(range.id, 'value', value))}
                                       placeholder="0,00" 
                                       disabled={isSubmitting}
                                     />
                                   )}
                               </div>
                                <div className="col-span-1 flex items-end justify-end">
                                    <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 hover:text-destructive h-9 w-9" onClick={() => handleRemoveRange(range.id)} disabled={isSubmitting}>
                                        <X className="h-4 w-4"/>
                                    </Button>
                                </div>
                           </div>
                          ))}
                          <Button variant="outline" size="sm" onClick={handleAddRange} disabled={isSubmitting} className="mt-4">
                            <Plus className="h-4 w-4 mr-2"/>
                            Adicionar Faixa
                          </Button>
                        </div>
                      ) : isLevelBased(currentAwardType) ? (
                        <div className="grid grid-cols-2 gap-4">
                          {(currentAwardType.levels || []).map(level => (
                              <div key={level.name} className="space-y-2">
                                  <Label htmlFor={`level-${level.name}`} className="flex items-center gap-2">{levelIcons[level.name]} {level.name}</Label>
                                  {currentDetails.isCurrency ? (
                                      <Input 
                                          id={`level-${level.name}`} 
                                          type="text"
                                          value={formatCurrencyForInput(level.value)}
                                          onChange={handleCurrencyInputChange(value => handleLevelValueChange(level.name, value))}
                                          placeholder="R$ 0,00" 
                                          disabled={isSubmitting}
                                      />
                                  ) : (
                                       <Input 
                                          id={`level-${level.name}`} 
                                          type="text"
                                          value={formatPercentageForInput(level.value)}
                                          onChange={handlePercentageInputChange(value => handleLevelValueChange(level.name, value))}
                                          placeholder="0,00" 
                                          disabled={isSubmitting}
                                      />
                                  )}
                              </div>
                          ))}
                        </div>
                      ) : isFreightConversion(currentAwardType) ? (
                         <div className="space-y-6">
                            <div className="space-y-3">
                                <Label>Meta de Conversão de Frete</Label>
                                <RadioGroup 
                                    value={currentAwardType.freightTargetType} 
                                    onValueChange={(v) => setCurrentAwardType(p => ({...p, freightTargetType: v as FreightTargetType}))}
                                    className="flex items-center gap-4"
                                    disabled={isSubmitting}
                                >
                                    <div className="flex items-center space-x-2"><RadioGroupItem value="percentage" id="target-percentage"/><Label htmlFor="target-percentage">Percentual (%)</Label></div>
                                    <div className="flex items-center space-x-2"><RadioGroupItem value="currency" id="target-currency"/><Label htmlFor="target-currency">Valor (R$)</Label></div>
                                </RadioGroup>
                                {currentAwardType.freightTargetType === 'currency' ? (
                                    <Input 
                                       type="text" 
                                       value={formatCurrencyForInput(currentAwardType.freightTargetValue)} 
                                       onChange={handleCurrencyInputChange(value => setCurrentAwardType(p => ({...p, freightTargetValue: value})))}
                                       placeholder="R$ 0,00"
                                       disabled={isSubmitting}
                                   />
                                ) : (
                                    <Input
                                        type="text"
                                        value={formatPercentageForInput(currentAwardType.freightTargetValue)}
                                        onChange={handlePercentageInputChange(value => setCurrentAwardType(p => ({...p, freightTargetValue: value})))}
                                        placeholder="0,00"
                                        disabled={isSubmitting}
                                    />
                                )}
                            </div>
                             <div className="space-y-3">
                                <Label>Premiação sobre Frete</Label>
                                 <RadioGroup 
                                    value={currentAwardType.freightCommissionType} 
                                    onValueChange={(v) => setCurrentAwardType(p => ({...p, freightCommissionType: v as FreightTargetType}))}
                                    className="flex items-center gap-4"
                                    disabled={isSubmitting}
                                >
                                    <div className="flex items-center space-x-2"><RadioGroupItem value="percentage" id="commission-percentage"/><Label htmlFor="commission-percentage">Percentual (%)</Label></div>
                                    <div className="flex items-center space-x-2"><RadioGroupItem value="currency" id="commission-currency"/><Label htmlFor="commission-currency">Valor (R$)</Label></div>
                                </RadioGroup>
                                {currentAwardType.freightCommissionType === 'currency' ? (
                                     <Input 
                                       type="text" 
                                       value={formatCurrencyForInput(currentAwardType.commissionPercentage)} 
                                       onChange={handleCurrencyInputChange(value => setCurrentAwardType(p => ({...p, commissionPercentage: value})))}
                                       placeholder="R$ 0,00"
                                       disabled={isSubmitting}
                                   />
                                ) : (
                                   <Input
                                        type="text"
                                        value={formatPercentageForInput(currentAwardType.commissionPercentage)}
                                        onChange={handlePercentageInputChange(value => setCurrentAwardType(p => ({...p, commissionPercentage: value})))}
                                        placeholder="0,00"
                                        disabled={isSubmitting}
                                   />
                                )}
                           </div>
                         </div>
                      ) : isCumulativeBonus(currentAwardType) ? (
                         <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="cumulativeLevel">Nível Alvo</Label>
                                <Select value={currentAwardType.cumulativeLevelTarget} onValueChange={(v) => setCurrentAwardType(p => ({...p, cumulativeLevelTarget: v as AwardLevel['name']}))}>
                                    <SelectTrigger id="cumulativeLevel"><SelectValue/></SelectTrigger>
                                    <SelectContent>
                                        {orderedLevels.map(level => (
                                            <SelectItem key={level} value={level}>
                                                <div className="flex items-center gap-2">{levelIcons[level]} {level}</div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="cumulativeOccurrences">Ocorrências</Label>
                                <Input 
                                    id="cumulativeOccurrences" 
                                    type="number"
                                    value={currentAwardType.cumulativeOccurrences}
                                    onChange={handleValueChange(v => setCurrentAwardType(p => ({...p, cumulativeOccurrences: v})))}
                                    placeholder="Ex: 3"
                                    min="1"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="cumulativeBonus">Bônus (R$)</Label>
                                <Input 
                                    id="cumulativeBonus" 
                                    type="text"
                                    value={formatCurrencyForInput(currentAwardType.cumulativeBonusValue)}
                                    onChange={handleCurrencyInputChange(v => setCurrentAwardType(p => ({...p, cumulativeBonusValue: v})))}
                                    placeholder="R$ 0,00"
                                />
                            </div>
                         </div>
                      ) : null }
                    </CardContent>
                </Card>

              </div>
              </ScrollArea>
              <DialogFooter>
                <Button variant="outline" onClick={handleCloseDialog} disabled={isSubmitting}>Cancelar</Button>
                <Button onClick={handleSubmit} disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="animate-spin" /> : "Salvar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Lista de Tipos de Premiação</CardTitle>
            <CardDescription>Total de {awardTypes.length} tipos cadastrados.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center items-center h-40">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
                <Accordion type="multiple" className="w-full">
                    {groupedAwardTypes.map(group => (
                        <AccordionItem value={group.id} key={group.id} className="border-b border-muted group">
                            <AccordionTrigger className="text-lg font-medium hover:no-underline py-6">
                                <div className="flex w-full items-center justify-between pr-4">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 rounded-xl bg-primary/5 text-primary group-hover:bg-primary group-hover:text-white transition-all duration-300">
                                            {group.type === 'role' && <BriefcaseBusiness className="h-5 w-5" />}
                                            {group.type === 'branch' && <GitFork className="h-5 w-5" />}
                                            {group.type === 'unassigned' && <Award className="h-5 w-5" />}
                                        </div>
                                        <div className="flex flex-col items-start translate-y-0.5">
                                            <span className="font-headline tracking-tight">{group.name}</span>
                                            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest leading-none mt-1">
                                                {group.type === 'role' ? 'Atribuído por Função' : group.type === 'branch' ? 'Atribuído por Filial' : 'Disponibilidade Global'}
                                            </span>
                                        </div>
                                        <Badge variant="outline" className="ml-2 bg-muted/30 border-muted-foreground/10 text-muted-foreground rounded-full px-2.5">
                                            {group.awards.length} {group.awards.length === 1 ? 'item' : 'itens'}
                                        </Badge>
                                    </div>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent className="pb-8">
                                {renderAwardCards(group.awards)}
                            </AccordionContent>
                        </AccordionItem>
                    ))}
                </Accordion>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
