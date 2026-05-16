
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
  PlusCircle,
  Trash2,
  Pencil,
} from "lucide-react";
import {
  collection,
  getDocs,
  query,
  orderBy,
  writeBatch,
  doc,
  serverTimestamp,
  addDoc,
  deleteDoc,
  updateDoc,
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
import { useToast } from "@/hooks/use-toast";
import type { PegaPixAward, User, Branch, Role, GoalLevelTargets } from "@/lib/definitions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Badge } from "@/components/ui/badge";

const initialLevelTargets: GoalLevelTargets = { Bronze: 0, Prata: 0, Ouro: 0, Diamante: 0 };

const levelIcons: Record<keyof GoalLevelTargets, React.ReactNode> = {
    Bronze: <Medal className="h-4 w-4 text-orange-600" />,
    Prata: <Trophy className="h-4 w-4 text-slate-500" />,
    Ouro: <Award className="h-4 w-4 text-yellow-500" />,
    Diamante: <Gem className="h-4 w-4 text-sky-400" />,
};

type FormData = {
  name: string;
  responsibleType: 'user' | 'branch' | 'role';
  responsibleIds: string[];
  levels: GoalLevelTargets;
}

const initialFormData: FormData = {
  name: "",
  responsibleType: "user",
  responsibleIds: [],
  levels: { ...initialLevelTargets }
};

export default function PegaPixAwardsPage() {
  const { toast } = useToast();
  const [formData, setFormData] = React.useState<FormData>(initialFormData);
  const [loading, setLoading] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  
  const [awards, setAwards] = React.useState<PegaPixAward[]>([]);
  const [users, setUsers] = React.useState<User[]>([]);
  const [branches, setBranches] = React.useState<Branch[]>([]);
  const [roles, setRoles] = React.useState<Role[]>([]);

  const [open, setOpen] = React.useState(false);
  const [editingAward, setEditingAward] = React.useState<PegaPixAward | null>(null);
  const [awardToDelete, setAwardToDelete] = React.useState<PegaPixAward | null>(null);

  const isEditing = !!editingAward;
  const salespeople = React.useMemo(() => users.filter(u => u.roleId && u.roleId.trim() !== ""), [users]);
  
  const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const fetchData = React.useCallback(async () => {
    try {
      setLoading(true);
      const [awardsSnap, usersSnap, branchesSnap, rolesSnap] = await Promise.all([
        getDocs(query(collection(db, "pegaPixAwards"), orderBy("createdAt", "desc"))),
        getDocs(query(collection(db, "users"), orderBy("name"))),
        getDocs(query(collection(db, "branches"), orderBy("name"))),
        getDocs(query(collection(db, "roles"), orderBy("name"))),
      ]);
      setAwards(awardsSnap.docs.map(d => ({ id: d.id, ...d.data() } as PegaPixAward)));
      setUsers(usersSnap.docs.map(d => ({ id: d.id, ...d.data() } as User)));
      setBranches(branchesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Branch)));
      setRoles(rolesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Role)));
    } catch (error) {
      toast({ title: "Erro ao buscar dados", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleOpenDialog = (award?: PegaPixAward) => {
    if (award) {
        setEditingAward(JSON.parse(JSON.stringify(award)));
    } else {
        setEditingAward(null);
        setFormData(initialFormData);
    }
    setOpen(true);
  };
  
  const handleCloseDialog = () => {
    setOpen(false);
    setEditingAward(null);
    setFormData(initialFormData);
  };
  
  const handleResponsibleSelection = (id: string) => {
    const stateSetter = isEditing ? setEditingAward : setFormData;
    stateSetter(prev => {
        const newResponsibleIds = [...(prev!.responsibleIds || [])];
        const index = newResponsibleIds.indexOf(id);
        if (index > -1) {
            newResponsibleIds.splice(index, 1);
        } else {
            newResponsibleIds.push(id);
        }
        return {...prev!, responsibleIds: newResponsibleIds};
    });
  };

  const handleCurrencyLikeChange = (level: keyof GoalLevelTargets) => (e: React.ChangeEvent<HTMLInputElement>) => {
      let rawValue = e.target.value.replace(/[^0-9]/g, '');
      const numericValue = rawValue ? parseInt(rawValue, 10) / 100 : 0;
      const stateSetter = isEditing ? setEditingAward : setFormData;
      stateSetter(prev => ({...prev!, levels: {...prev!.levels, [level]: numericValue }}));
  };
  
  const formatCurrencyForInput = (value: number | undefined) => {
    if (value === undefined || value === null || isNaN(value)) return '';
    return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };
  
  const handleSubmit = async () => {
    const data = isEditing ? editingAward : formData;
    if (!data?.name || data.responsibleIds.length === 0) {
      toast({ title: "Campos obrigatórios", description: "Preencha nome e selecione ao menos um responsável.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      if (isEditing) {
        const docRef = doc(db, "pegaPixAwards", editingAward!.id);
        await updateDoc(docRef, {
            name: editingAward!.name,
            levels: editingAward!.levels,
            responsibleIds: editingAward!.responsibleIds,
            responsibleType: editingAward!.responsibleType,
        });
        toast({ title: "Prêmio atualizado com sucesso!" });
      } else {
        await addDoc(collection(db, "pegaPixAwards"), {
            ...formData,
            createdAt: serverTimestamp(),
        });
        toast({ title: "Prêmio Pega Pix salvo com sucesso!"});
      }
      handleCloseDialog();
      fetchData();
    } catch (error) {
      toast({ title: "Erro ao Salvar", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if(!awardToDelete) return;
    try {
        await deleteDoc(doc(db, "pegaPixAwards", awardToDelete.id));
        toast({ title: "Prêmio excluído!", variant: "destructive" });
        fetchData();
    } catch (error) {
        toast({ title: "Erro ao excluir", variant: "destructive" });
    } finally {
        setAwardToDelete(null);
    }
  }

  const getResponsibleName = (id: string, type: 'user' | 'branch' | 'role') => {
    switch (type) {
      case 'user': return users.find(u => u.id === id)?.name;
      case 'branch': return branches.find(b => b.id === id)?.name;
      case 'role': return roles.find(r => r.id === id)?.name;
      default: return 'N/A';
    }
  }

  const responsibleOptions = React.useMemo(() => {
    const currentType = isEditing ? editingAward?.responsibleType : formData.responsibleType;
    switch (currentType) {
      case 'branch': return branches;
      case 'user': return salespeople;
      case 'role': return roles;
      default: return [];
    }
  }, [isEditing, editingAward, formData, branches, salespeople, roles]);

  const renderFormContent = () => {
    const data = isEditing ? editingAward : formData;
    const setData = isEditing ? setEditingAward : setFormData;

    if (!data) return null;

    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <Label htmlFor="name">Nome do Prêmio</Label>
                <Input id="name" value={data.name} onChange={(e) => setData(p => ({...p!, name: e.target.value}))} placeholder="Ex: Prêmio Pega Pix T1" disabled={isSubmitting}/>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>Níveis de Premiação</CardTitle>
                    <CardDescription>Defina os valores a serem pagos para cada nível atingido.</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {(Object.keys(levelIcons) as Array<keyof GoalLevelTargets>).map(level => (
                    <div key={level} className="space-y-2">
                        <Label htmlFor={level} className="flex items-center gap-2">{levelIcons[level]} {level}</Label>
                        <Input id={level} type="text" placeholder="R$ 0,00" value={formatCurrencyForInput(data.levels[level])} onChange={handleCurrencyLikeChange(level)} disabled={isSubmitting}/>
                    </div>
                ))}
                </CardContent>
            </Card>
            <div className="space-y-4">
                <Label>Atribuir Prêmio para:</Label>
                <Tabs value={data.responsibleType} onValueChange={(v) => setData(p => ({...p!, responsibleType: v as any, responsibleIds: []}))} className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="user"><UserIcon className="mr-2 h-4 w-4" />Vendedor</TabsTrigger>
                    <TabsTrigger value="branch"><GitFork className="mr-2 h-4 w-4" />Filial</TabsTrigger>
                    <TabsTrigger value="role"><BriefcaseBusiness className="mr-2 h-4 w-4" />Função</TabsTrigger>
                </TabsList>
                </Tabs>
                <Card>
                    <CardContent className="p-4">
                    <ScrollArea className="h-48">
                        <div className="space-y-3">
                        {responsibleOptions.map(opt => (
                            <div key={opt.id} className="flex items-center space-x-3">
                            <Checkbox id={`resp-${opt.id}`} checked={data.responsibleIds.includes(opt.id)} onCheckedChange={() => handleResponsibleSelection(opt.id)} disabled={isSubmitting}/>
                            <Label htmlFor={`resp-${opt.id}`} className="font-normal cursor-pointer flex-1">{opt.name}</Label>
                            </div>
                        ))}
                        </div>
                    </ScrollArea>
                    </CardContent>
                    <CardFooter className="text-sm text-muted-foreground border-t pt-3">{data.responsibleIds.length} selecionado(s).</CardFooter>
                </Card>
            </div>
        </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-headline tracking-tight">Definir Premiação Pega Pix</h1>
          <p className="text-muted-foreground">Crie e gerencie os prêmios para as metas Pega Pix.</p>
        </div>
        <Button size="sm" className="gap-1" onClick={() => handleOpenDialog()}>
          <PlusCircle className="h-3.5 w-3.5" />
          <span>Novo Prêmio</span>
        </Button>
      </div>

      <AlertDialog>
      <Card>
        <CardHeader>
          <CardTitle>Prêmios Cadastrados</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Loader2 className="mx-auto h-8 w-8 animate-spin" />
          ) : (
            <div className="space-y-4">
                {awards.map(award => (
                    <Card key={award.id}>
                        <CardHeader className="flex flex-row items-start justify-between">
                            <div>
                                <CardTitle>{award.name}</CardTitle>
                                <CardDescription>
                                    Atribuído para {award.responsibleIds.length} {award.responsibleType}(s).
                                </CardDescription>
                            </div>
                            <div>
                                <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(award)}><Pencil className="h-4 w-4" /></Button>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => setAwardToDelete(award)}><Trash2 className="h-4 w-4" /></Button>
                                </AlertDialogTrigger>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                             <div className="flex flex-wrap gap-2">
                                {(Object.keys(levelIcons) as Array<keyof GoalLevelTargets>).map(level => (
                                    award.levels[level] > 0 && (
                                    <Badge key={level} variant="secondary" className="font-mono">
                                        {levelIcons[level]}
                                        <span className="ml-1.5">{formatCurrency(award.levels[level])}</span>
                                    </Badge>
                                    )
                                ))}
                            </div>
                            <div className="flex flex-wrap gap-1">
                                {award.responsibleIds.map(id => (
                                    <Badge key={id} variant="outline">{getResponsibleName(id, award.responsibleType)}</Badge>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                ))}
                 {awards.length === 0 && <p className="text-center text-muted-foreground">Nenhum prêmio Pega Pix cadastrado.</p>}
            </div>
          )}
        </CardContent>
      </Card>
      {awardToDelete && (
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                <AlertDialogDescription>Esta ação não pode ser desfeita e irá excluir o prêmio <strong className="mx-1">{awardToDelete.name}</strong>.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setAwardToDelete(null)}>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete}>Sim, excluir</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      )}
      </AlertDialog>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl" onCloseAutoFocus={handleCloseDialog}>
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Editar Prêmio' : 'Novo Prêmio Pega Pix'}</DialogTitle>
          </DialogHeader>
          <div className="py-4 max-h-[70vh] overflow-y-auto pr-4">
            {renderFormContent()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog} disabled={isSubmitting}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="animate-spin" /> : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
