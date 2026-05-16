
"use client";

import * as React from "react";
import {
  Loader2,
  GitFork,
  User as UserIcon,
  BriefcaseBusiness,
  Trash2,
  Pencil,
  PlusCircle,
  Medal,
  Trophy,
  Award,
  Gem,
  RefreshCw,
} from "lucide-react";
import {
  collection,
  getDocs,
  doc,
  writeBatch,
  query,
  orderBy as firestoreOrderBy,
  updateDoc,
  deleteDoc,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import type { PegaPixGoal, User, Branch, Role, PeriodGroup, GoalLevelTargets } from "@/lib/definitions";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { useRouter } from "next/navigation";
import { getGroupStatus } from "@/lib/period-helpers";

const levelIcons: Record<keyof GoalLevelTargets, React.ReactNode> = {
    Bronze: <Medal className="h-4 w-4 text-orange-600" />,
    Prata: <Trophy className="h-4 w-4 text-slate-500" />,
    Ouro: <Award className="h-4 w-4 text-yellow-500" />,
    Diamante: <Gem className="h-4 w-4 text-sky-400" />,
};

export default function PegaPixGoalsPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [goals, setGoals] = React.useState<PegaPixGoal[]>([]);
  const [periodGroups, setPeriodGroups] = React.useState<PeriodGroup[]>([]);
  const [users, setUsers] = React.useState<User[]>([]);
  const [branches, setBranches] = React.useState<Branch[]>([]);
  const [roles, setRoles] = React.useState<Role[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const [editingGoal, setEditingGoal] = React.useState<PegaPixGoal | null>(null);
  const [goalToDelete, setGoalToDelete] = React.useState<PegaPixGoal | null>(null);
  const [goalsToDelete, setGoalsToDelete] = React.useState<PegaPixGoal[] | null>(null);


  const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  const formatCurrencyForInput = (value: number | undefined) => {
    if (value === undefined || value === null || isNaN(value)) return '';
    return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
  };
  const handleCurrencyLikeChange = (setter: (value: number) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
      let rawValue = e.target.value.replace(/\D/g, '');
      if (rawValue === '') {
        setter(0);
        return;
      }
      setter(parseInt(rawValue, 10) / 100);
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
      
      setGoals(goalsSnap.docs.map(d => ({id: d.id, ...d.data()}) as PegaPixGoal));
      
      const fetchedPeriodGroups = periodsSnap.docs.map(d => ({id: d.id, ...d.data()}) as PeriodGroup);
      const sortedGroups = fetchedPeriodGroups.sort((a, b) => {
        const aLatest = a.periods?.length > 0 ? Math.max(...a.periods.map(p => new Date(p.startDate || 0).getTime())) : 0;
        const bLatest = b.periods?.length > 0 ? Math.max(...b.periods.map(p => new Date(p.startDate || 0).getTime())) : 0;
        return bLatest - aLatest;
      });
      setPeriodGroups(sortedGroups);

      setUsers(usersSnap.docs.map(d => ({id: d.id, ...d.data()}) as User));
      setBranches(branchesSnap.docs.map(b => ({id: b.id, ...b.data()}) as Branch));
      setRoles(rolesSnap.docs.map(r => ({id: r.id, ...r.data()}) as Role));
      
    } catch (error) {
      toast({ title: "Erro ao buscar dados", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleOpenEditDialog = (goal: PegaPixGoal) => {
    setEditingGoal(JSON.parse(JSON.stringify(goal)));
  };

  const handleCloseEditDialog = () => {
    setEditingGoal(null);
  };

  const handleUpdateGoal = async () => {
    if (!editingGoal || !editingGoal.name) {
        toast({ title: "Nome é obrigatório", variant: "destructive" });
        return;
    }
    setIsSubmitting(true);
    try {
        const { id, name, levels } = editingGoal;
        const docRef = doc(db, "pegaPixGoals", id);
        await updateDoc(docRef, { name, levels });
        toast({ title: "Meta atualizada com sucesso!" });
        handleCloseEditDialog();
        fetchData();
    } catch (error) {
        toast({ title: "Erro ao atualizar meta", variant: "destructive"});
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleDeleteGoal = async () => {
    if (!goalToDelete) return;
    try {
        await deleteDoc(doc(db, "pegaPixGoals", goalToDelete.id));
        toast({ title: "Meta excluída com sucesso!", variant: "destructive" });
        fetchData();
    } catch (error) {
        toast({ title: "Erro ao excluir meta", variant: "destructive" });
    } finally {
        setGoalToDelete(null);
    }
  };
  
  const handleDeleteAllGoalsInGroup = async () => {
    if (!goalsToDelete || goalsToDelete.length === 0) return;
    const batch = writeBatch(db);
    try {
        goalsToDelete.forEach(goal => {
            const docRef = doc(db, "pegaPixGoals", goal.id);
            batch.delete(docRef);
        });
        await batch.commit();
        toast({ title: "Metas excluídas!", description: `${goalsToDelete.length} metas foram removidas com sucesso do grupo.`, variant: "destructive" });
        fetchData();
    } catch (error) {
        toast({ title: "Erro ao excluir metas", variant: "destructive" });
    } finally {
        setGoalsToDelete(null);
    }
  }


  const getResponsibleName = (responsibleId: string, responsibleType: 'user' | 'branch' | 'role'): string => {
    switch (responsibleType) {
      case 'user': return users.find(u => u.id === responsibleId)?.name || 'N/A';
      case 'branch': return branches.find(b => b.id === responsibleId)?.name || 'N/A';
      case 'role': return roles.find(r => r.id === responsibleId)?.name || 'N/A';
      default: return 'N/A';
    }
  }
  
  const getResponsibleIcon = (type: 'user' | 'branch' | 'role') => {
    switch(type) {
      case 'user': return <UserIcon className="h-5 w-5" />;
      case 'branch': return <GitFork className="h-5 w-5" />;
      case 'role': return <BriefcaseBusiness className="h-5 w-5" />;
    }
  }

  const renderGoalsTable = (filteredGoals: PegaPixGoal[], responsibleName: string) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nome da Meta</TableHead>
          <TableHead>Níveis</TableHead>
          <TableHead className="text-right">Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {filteredGoals.map(goal => {
          return (
            <TableRow key={goal.id}>
              <TableCell className="font-medium">{goal.name}</TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(levelIcons) as Array<keyof GoalLevelTargets>).map(level => (
                    goal.levels[level] > 0 && (
                      <Badge key={level} variant="secondary" className="font-mono">
                        {levelIcons[level]}
                        <span className="ml-1.5">{formatCurrency(goal.levels[level])}</span>
                      </Badge>
                    )
                  ))}
                </div>
              </TableCell>
              <TableCell className="text-right">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenEditDialog(goal)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive h-8 w-8" onClick={() => setGoalToDelete(goal)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );

  return (
    <>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold font-headline tracking-tight">Metas Pega Pix</h1>
            <p className="text-muted-foreground">Gerencie as metas "Pega Pix" cadastradas no sistema.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" className="gap-1" onClick={() => router.push('/dashboard/pega-pix/create')}>
              <PlusCircle className="h-3.5 w-3.5" />
              <span>Nova Meta Pega Pix</span>
            </Button>
            <Button variant="outline" size="icon" onClick={fetchData} disabled={loading}>
              <RefreshCw className={loading ? "animate-spin h-4 w-4" : "h-4 w-4"} />
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Lista de Metas por Grupo de Período</CardTitle>
            <CardDescription>Visualize, edite ou exclua as metas "Pega Pix" existentes.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center items-center h-40">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
             <AlertDialog>
               <Accordion type="multiple" className="w-full">
                {periodGroups.map(group => {
                    const goalsInGroup = goals.filter(g => g.periodGroupId === group.id);
                    if (goalsInGroup.length === 0) return null;
                    
                    const status = getGroupStatus(group);

                    const responsiblesInGroup = goalsInGroup.reduce((acc, goal) => {
                        const key = `${goal.responsibleType}-${goal.responsibleId}`;
                        if (!acc[key]) {
                            acc[key] = {
                                id: goal.responsibleId,
                                type: goal.responsibleType,
                                name: getResponsibleName(goal.responsibleId, goal.responsibleType),
                                goals: []
                            }
                        }
                        acc[key].goals.push(goal);
                        return acc;
                    }, {} as Record<string, { id: string, type: 'user'|'branch'|'role', name: string, goals: PegaPixGoal[] }>);
                    
                    return (
                        <AccordionItem value={group.id} key={group.id}>
                            <AccordionTrigger className="text-xl font-medium hover:no-underline">
                               <div className="flex w-full items-center justify-between pr-4">
                                  <div className="flex items-center gap-3">
                                      <span>{group.name}</span>
                                      <Badge variant={status.variant}>{status.text}</Badge>
                                  </div>
                               </div>
                            </AccordionTrigger>
                            <AccordionContent className="p-2 space-y-4">
                                <div className="flex justify-end pr-2">
                                     <AlertDialogTrigger asChild>
                                        <Button variant="destructive" size="sm" onClick={(e) => { e.stopPropagation(); setGoalsToDelete(goalsInGroup); }}>
                                            <Trash2 className="h-4 w-4 mr-2" /> Excluir Todas as {goalsInGroup.length} Metas do Grupo
                                        </Button>
                                     </AlertDialogTrigger>
                                </div>
                                <Accordion type="multiple" className="w-full">
                                    {Object.values(responsiblesInGroup).map(resp => (
                                        <AccordionItem value={resp.id} key={resp.id} className="border-b-0">
                                            <AccordionTrigger className="text-base font-medium bg-muted/50 rounded-md px-4 py-3 hover:no-underline">
                                                 <div className="flex items-center justify-between w-full">
                                                    <div className="flex items-center gap-2">
                                                        {getResponsibleIcon(resp.type)}
                                                        {resp.name}
                                                    </div>
                                                 </div>
                                            </AccordionTrigger>
                                            <AccordionContent className="pt-2">
                                                {renderGoalsTable(resp.goals, resp.name)}
                                            </AccordionContent>
                                        </AccordionItem>
                                    ))}
                                </Accordion>
                            </AccordionContent>
                        </AccordionItem>
                    )
                })}
               </Accordion>
                {goalToDelete && (
                  <AlertDialogContent>
                      <AlertDialogHeader>
                          <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                          <AlertDialogDescription>
                              Esta ação não pode ser desfeita. Isso irá excluir permanentemente a meta
                              <strong className="mx-1">{goalToDelete.name}</strong>.
                          </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                          <AlertDialogCancel onClick={() => setGoalToDelete(null)}>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={handleDeleteGoal}>Sim, excluir</AlertDialogAction>
                      </AlertDialogFooter>
                  </AlertDialogContent>
                )}
                 {goalsToDelete && (
                  <AlertDialogContent>
                      <AlertDialogHeader>
                          <AlertDialogTitle>Excluir todas as metas do grupo?</AlertDialogTitle>
                          <AlertDialogDescription>
                              Esta ação não pode ser desfeita. Isso irá excluir permanentemente todas as
                              <strong className="mx-1">{goalsToDelete.length}</strong> metas deste grupo de período.
                          </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                          <AlertDialogCancel onClick={() => setGoalsToDelete(null)}>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={handleDeleteAllGoalsInGroup}>Sim, excluir todas</AlertDialogAction>
                      </AlertDialogFooter>
                  </AlertDialogContent>
                )}
             </AlertDialog>
            )}
          </CardContent>
        </Card>
      </div>

      {editingGoal && (
        <Dialog open={!!editingGoal} onOpenChange={(open) => !open && handleCloseEditDialog()}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Editar Meta Pega Pix</DialogTitle>
                </DialogHeader>
                <div className="grid gap-6 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="edit-name">Nome da Meta</Label>
                        <Input id="edit-name" value={editingGoal.name} onChange={(e) => setEditingGoal({...editingGoal, name: e.target.value})} disabled={isSubmitting} />
                    </div>
                    <Card>
                        <CardHeader><CardTitle>Níveis</CardTitle></CardHeader>
                        <CardContent className="grid grid-cols-2 gap-4">
                            {(Object.keys(levelIcons) as Array<keyof GoalLevelTargets>).map(level => (
                                <div key={level} className="space-y-2">
                                    <Label htmlFor={`edit-${level}`} className="flex items-center gap-2">{levelIcons[level]} {level}</Label>
                                    <Input
                                        id={`edit-${level}`}
                                        type="text"
                                        placeholder="R$ 0,00"
                                        value={formatCurrencyForInput(editingGoal.levels[level])}
                                        onChange={handleCurrencyLikeChange(value => setEditingGoal(prev => prev ? {...prev, levels: {...prev.levels, [level]: value}} : null))}
                                        disabled={isSubmitting}
                                    />
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={handleCloseEditDialog} disabled={isSubmitting}>Cancelar</Button>
                    <Button onClick={handleUpdateGoal} disabled={isSubmitting}>
                        {isSubmitting ? <Loader2 className="animate-spin" /> : "Salvar Alterações"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
      )}
    </>
  );
}
