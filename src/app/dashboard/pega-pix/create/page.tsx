
"use client";

import * as React from "react";
import {
  Loader2,
  GitFork,
  User as UserIcon,
  BriefcaseBusiness,
  Save,
  Target,
  Medal,
  Trophy,
  Award,
  Gem,
  Check,
} from "lucide-react";
import {
  collection,
  getDocs,
  query,
  orderBy,
  writeBatch,
  doc,
  serverTimestamp,
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
import { useToast } from "@/hooks/use-toast";
import type { PegaPixGoal, PeriodGroup, User, Branch, Role, GoalLevelTargets } from "@/lib/definitions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getGroupStatus } from "@/lib/period-helpers";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";

const initialLevelTargets: GoalLevelTargets = { Bronze: 0, Prata: 0, Ouro: 0, Diamante: 0 };

const levelIcons: Record<keyof GoalLevelTargets, React.ReactNode> = {
    Bronze: <Medal className="h-4 w-4 text-orange-600" />,
    Prata: <Trophy className="h-4 w-4 text-slate-500" />,
    Ouro: <Award className="h-4 w-4 text-yellow-500" />,
    Diamante: <Gem className="h-4 w-4 text-sky-400" />,
};

type FormData = {
  name: string;
  periodGroupId: string;
  responsibleType: 'user' | 'branch' | 'role';
  responsibleIds: string[];
  levels: { [responsibleId: string]: GoalLevelTargets };
}

const initialFormData: FormData = {
  name: "",
  periodGroupId: "",
  responsibleType: "user",
  responsibleIds: [],
  levels: {}
};

export default function CreatePegaPixGoalPage() {
  const { toast } = useToast();
  const [formData, setFormData] = React.useState<FormData>(initialFormData);
  const [loading, setLoading] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Data from Firestore
  const [periodGroups, setPeriodGroups] = React.useState<PeriodGroup[]>([]);
  const [users, setUsers] = React.useState<User[]>([]);
  const [branches, setBranches] = React.useState<Branch[]>([]);
  const [roles, setRoles] = React.useState<Role[]>([]);

  const salespeople = React.useMemo(() => users.filter(u => u.roleId && u.roleId.trim() !== ""), [users]);

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [groupsSnap, usersSnap, branchesSnap, rolesSnap] = await Promise.all([
          getDocs(query(collection(db, "periodgroups"), orderBy("name"))),
          getDocs(query(collection(db, "users"), orderBy("name"))),
          getDocs(query(collection(db, "branches"), orderBy("name"))),
          getDocs(query(collection(db, "roles"), orderBy("name"))),
        ]);
        const groupsRaw = groupsSnap.docs.map(d => ({ id: d.id, ...d.data() } as PeriodGroup));
        const sortedGroups = groupsRaw.sort((a, b) => {
           const aLatest = a.periods?.length > 0 ? Math.max(...a.periods.map(p => new Date(p.startDate || 0).getTime())) : 0;
           const bLatest = b.periods?.length > 0 ? Math.max(...b.periods.map(p => new Date(p.startDate || 0).getTime())) : 0;
           return bLatest - aLatest;
        });
        setPeriodGroups(sortedGroups);
        setUsers(usersSnap.docs.map(d => ({ id: d.id, ...d.data() } as User)));
        setBranches(branchesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Branch)));
        setRoles(rolesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Role)));
      } catch (error) {
        console.error("Error fetching data:", error);
        toast({ title: "Erro ao buscar dados", description: "Não foi possível carregar as opções para criar a meta.", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [toast]);

  const handleInputChange = (field: keyof FormData, value: any) => {
    if (field === 'responsibleType') {
        setFormData(prev => ({ ...prev, [field]: value, responsibleIds: [], levels: {} }));
    } else {
        setFormData(prev => ({ ...prev, [field]: value }));
    }
  };
  
  const handleLevelTargetChange = (responsibleId: string, level: keyof GoalLevelTargets, value: number) => {
    setFormData(prev => ({
        ...prev,
        levels: {
            ...prev.levels,
            [responsibleId]: {
                ...(prev.levels[responsibleId] || initialLevelTargets),
                [level]: value
            }
        }
    }));
  }

  const handleResponsibleSelection = (id: string) => {
    setFormData(prev => {
        const newResponsibleIds = [...prev.responsibleIds];
        const newLevels = { ...prev.levels };
        const index = newResponsibleIds.indexOf(id);
        
        if (index > -1) {
            newResponsibleIds.splice(index, 1);
            delete newLevels[id]; // Remove levels for the deselected responsible
        } else {
            newResponsibleIds.push(id);
            newLevels[id] = { ...initialLevelTargets }; // Add initial levels for the new responsible
        }
        return {...prev, responsibleIds: newResponsibleIds, levels: newLevels};
    })
  }

  const handleCurrencyLikeChange = (responsibleId: string, level: keyof GoalLevelTargets) => (e: React.ChangeEvent<HTMLInputElement>) => {
      let rawValue = e.target.value.replace(/[^0-9]/g, '');
      const numericValue = rawValue ? parseInt(rawValue, 10) / 100 : 0;
      handleLevelTargetChange(responsibleId, level, numericValue);
  };
  
  const formatCurrencyForInput = (value: number | undefined) => {
    if (value === undefined || value === null || isNaN(value)) return '';
    return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  const handleSubmit = async () => {
    const { name, periodGroupId, responsibleIds, responsibleType, levels } = formData;

    if (!name || !periodGroupId || responsibleIds.length === 0) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha nome, grupo de períodos e selecione ao menos um responsável.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    const batch = writeBatch(db);
    
    try {
      responsibleIds.forEach(responsibleId => {
        const docRef = doc(collection(db, "pegaPixGoals"));
        
        const newGoal: Omit<PegaPixGoal, 'id'> = {
          name,
          periodGroupId,
          responsibleId,
          responsibleType,
          levels: levels[responsibleId] || initialLevelTargets,
          realizado: 0,
          createdAt: serverTimestamp(),
        };

        batch.set(docRef, newGoal);
      })
      
      await batch.commit();

      toast({ title: `Metas 'Pega Pix' Salvas!`, description: `${responsibleIds.length} meta(s) foram cadastradas com sucesso.` });
      setFormData(initialFormData);

    } catch (error) {
      console.error("Error saving goal:", error);
      toast({ title: "Erro ao Salvar", description: "Não foi possível cadastrar as metas.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const responsibleOptions = React.useMemo(() => {
    switch (formData.responsibleType) {
      case 'branch': return branches;
      case 'user': return salespeople;
      case 'role': return roles;
      default: return [];
    }
  }, [formData.responsibleType, branches, salespeople, roles]);

  const getResponsibleNameById = (id: string) => {
    return responsibleOptions.find(opt => opt.id === id)?.name || "Desconhecido";
  }

  if (loading) {
    return <div className="flex justify-center items-center h-96"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-headline tracking-tight">Criar Meta Pega Pix</h1>
          <p className="text-muted-foreground">Defina os níveis e o responsável para a nova meta.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Target className="h-5 w-5"/> Nova Meta Pega Pix</CardTitle>
          <CardDescription>Preencha os campos para definir a nova meta. Você pode criar metas para vários responsáveis de uma vez.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                  <Label htmlFor="name">Nome da Meta</Label>
                  <Input id="name" value={formData.name} onChange={(e) => handleInputChange('name', e.target.value)} placeholder="Ex: Pega Pix - T1 2024" disabled={isSubmitting}/>
              </div>
              <div className="space-y-2">
                  <Label htmlFor="periodGroupId">Grupo de Períodos</Label>
                  <Select value={formData.periodGroupId} onValueChange={v => handleInputChange('periodGroupId', v)}>
                    <SelectTrigger><SelectValue placeholder="Selecione o grupo" /></SelectTrigger>
                    <SelectContent>
                      {periodGroups.map(g => {
                        const status = getGroupStatus(g);
                        return (
                          <SelectItem key={g.id} value={g.id}>
                            <div className="flex items-center justify-between w-full">
                                <span>{g.name}</span>
                                <Badge variant={status.variant} className="ml-4">{status.text}</Badge>
                            </div>
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
              </div>
          </div>
          <div className="space-y-4">
            <Label>Responsável(is) pela Meta</Label>
            <Tabs value={formData.responsibleType} onValueChange={(v) => handleInputChange('responsibleType', v as 'user' | 'branch' | 'role')} className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="user"><UserIcon className="mr-2 h-4 w-4" /> Por Vendedor</TabsTrigger>
                <TabsTrigger value="branch"><GitFork className="mr-2 h-4 w-4" /> Por Filial</TabsTrigger>
                <TabsTrigger value="role"><BriefcaseBusiness className="mr-2 h-4 w-4" /> Por Função</TabsTrigger>
              </TabsList>
            </Tabs>
             <Card>
                <CardContent className="p-4">
                  <ScrollArea className="h-48">
                    <div className="space-y-3">
                      {responsibleOptions.map(opt => (
                        <div key={opt.id} className="flex items-center space-x-3">
                          <Checkbox
                            id={`resp-${opt.id}`}
                            checked={formData.responsibleIds.includes(opt.id)}
                            onCheckedChange={() => handleResponsibleSelection(opt.id)}
                          />
                          <Label htmlFor={`resp-${opt.id}`} className="font-normal cursor-pointer flex-1">
                            {opt.name}
                          </Label>
                        </div>
                      ))}
                      {responsibleOptions.length === 0 && (
                        <div className="text-center text-sm text-muted-foreground pt-16">
                          Nenhum responsável disponível.
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
                <CardFooter className="text-sm text-muted-foreground border-t pt-3">
                  {formData.responsibleIds.length} responsável(is) selecionado(s).
                </CardFooter>
            </Card>
          </div>
          {formData.responsibleIds.length > 0 && (
            <Card>
                <CardHeader>
                    <CardTitle>Níveis da Meta</CardTitle>
                    <CardDescription>Defina os valores para cada nível e para cada responsável selecionado.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {formData.responsibleIds.map(responsibleId => (
                        <Card key={responsibleId} className="bg-muted/50">
                            <CardHeader>
                                <CardTitle className="text-base">{getResponsibleNameById(responsibleId)}</CardTitle>
                            </CardHeader>
                            <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                {(Object.keys(levelIcons) as Array<keyof GoalLevelTargets>).map(level => (
                                    <div key={level} className="space-y-2">
                                        <Label htmlFor={`${responsibleId}-${level}`} className="flex items-center gap-2">{levelIcons[level]} {level}</Label>
                                        <Input 
                                            id={`${responsibleId}-${level}`} 
                                            type="text" 
                                            placeholder="0,00"
                                            value={formatCurrencyForInput(formData.levels[responsibleId]?.[level])}
                                            onChange={handleCurrencyLikeChange(responsibleId, level)}
                                        />
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    ))}
                </CardContent>
            </Card>
          )}
        </CardContent>
        <CardFooter>
            <Button className="w-full" size="lg" onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>}
                Salvar Meta Pega Pix
            </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
