
"use client";

import * as React from "react";
import { PlusCircle, MoreHorizontal, Trash2, Loader2, Pencil, Calendar, X, Plus, Lock, Unlock } from "lucide-react";
import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
  query,
  orderBy,
  writeBatch,
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
import type { PeriodGroup, Period } from "@/lib/definitions";
import { format, parseISO, isBefore, isAfter, isEqual } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { getGroupStatus } from "@/lib/period-helpers";

type StatusVariant = "default" | "secondary" | "outline" | "destructive";


export default function PeriodGroupsPage() {
  const { toast } = useToast();
  const [periodGroups, setPeriodGroups] = React.useState<PeriodGroup[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [open, setOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const [currentGroup, setCurrentGroup] = React.useState<Partial<PeriodGroup>>({ periods: [] });
  const [groupToDelete, setGroupToDelete] = React.useState<PeriodGroup | null>(null);

  const isEditing = !!currentGroup.id;

  const fetchGroups = React.useCallback(async () => {
    try {
      setLoading(true);
      const groupsCollection = collection(db, "periodgroups");
      const q = query(groupsCollection, orderBy("name"));
      const groupSnapshot = await getDocs(q);
      const groupsList = groupSnapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as PeriodGroup)
      );

      const statusOrder = { "Ativo": 1, "Agendado": 2, "Encerrado": 3, "Vazio": 4 };
      groupsList.sort((a, b) => {
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

      setPeriodGroups(groupsList);
    } catch (error) {
      toast({
        title: "Erro ao buscar grupos",
        description: "Não foi possível carregar a lista de grupos de períodos.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  const handleOpenDialog = (group?: PeriodGroup) => {
    if (group) {
        // Deep copy to avoid direct state mutation
        setCurrentGroup(JSON.parse(JSON.stringify(group)));
    } else {
        setCurrentGroup({ name: "", periods: [] });
    }
    setOpen(true);
  };

  const handleCloseDialog = () => {
    setCurrentGroup({ periods: [] });
    setOpen(false);
  };
  
  const handleAddPeriod = () => {
    const newPeriod: Period = {
        id: `period-${Date.now()}`,
        name: "",
        startDate: "",
        endDate: "",
        isLocked: false,
    };
    setCurrentGroup(prev => ({ ...prev, periods: [...(prev.periods || []), newPeriod]}));
  }
  
  const handleRemovePeriod = (periodId: string) => {
    setCurrentGroup(prev => ({
        ...prev,
        periods: (prev.periods || []).filter(p => p.id !== periodId)
    }));
  }
  
  const handlePeriodChange = (periodId: string, field: keyof Period, value: string | boolean) => {
     setCurrentGroup(prev => ({
        ...prev,
        periods: (prev.periods || []).map(p => p.id === periodId ? {...p, [field]: value} : p)
     }))
  }

  const handleSubmit = async () => {
    if (!currentGroup.name || currentGroup.name.trim() === "" || isSubmitting) return;

    // Validate periods
    if(currentGroup.periods?.some(p => !p.name || !p.startDate || !p.endDate)){
        toast({ title: "Períodos incompletos", description: "Por favor, preencha todos os campos de todos os períodos.", variant: "destructive"});
        return;
    }

    setIsSubmitting(true);
    try {
      const groupData = {
          name: currentGroup.name.trim(),
          periods: (currentGroup.periods || []).map(p => ({
            ...p,
            isLocked: p.isLocked || false, // Ensure isLocked is always a boolean
          }))
      };

      if (isEditing) {
        const groupDoc = doc(db, "periodgroups", currentGroup.id!);
        await updateDoc(groupDoc, groupData);
        toast({
          title: "Grupo Atualizado!",
          description: "O grupo de períodos foi atualizado com sucesso.",
        });
      } else {
        const docRef = doc(collection(db, "periodgroups"));
        await setDoc(docRef, { ...groupData, id: docRef.id });
        toast({
          title: "Grupo Cadastrado!",
          description: "O novo grupo de períodos foi adicionado com sucesso.",
        });
      }
      handleCloseDialog();
      fetchGroups(); // Refresh the list
    } catch (error) {
      console.error(error);
      toast({
        title: isEditing ? "Erro ao atualizar" : "Erro ao cadastrar",
        description: `Não foi possível salvar o grupo de períodos.`,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (!groupToDelete) return;
    try {
      const groupDoc = doc(db, "periodgroups", groupToDelete.id);
      await deleteDoc(groupDoc);
      toast({
        title: "Grupo Deletado",
        description: "O grupo de períodos foi removido com sucesso.",
        variant: "destructive",
      });
      fetchGroups(); // Refresh the list
    } catch (error) {
      toast({
        title: "Erro ao deletar",
        description: "Não foi possível remover o grupo de períodos.",
        variant: "destructive",
      });
    } finally {
      setGroupToDelete(null);
    }
  };
  
  const formatDate = (dateString: string) => {
      if(!dateString) return "N/A";
      try {
        return format(parseISO(dateString), "dd/MM/yyyy");
      } catch {
        return dateString; // Return original if parsing fails
      }
  }

  const getPeriodStatus = (period: Period): { text: string; variant: StatusVariant } => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize today to the start of the day
    try {
      const startDate = parseISO(period.startDate);
      const endDate = parseISO(period.endDate);

      if (isBefore(endDate, today)) {
        return { text: "Encerrado", variant: "secondary" };
      }
      if (isAfter(startDate, today)) {
        return { text: "Agendado", variant: "outline" };
      }
      return { text: "Ativo", variant: "default" };
    } catch {
      return { text: "Inválido", variant: "destructive" };
    }
  };

  return (
    <>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold font-headline tracking-tight">
              Grupos de Períodos
            </h1>
            <p className="text-muted-foreground">
              Crie e gerencie grupos de períodos para vincular às metas.
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1" onClick={() => handleOpenDialog()}>
                <PlusCircle className="h-3.5 w-3.5" />
                <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                  Cadastrar Grupo
                </span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl" onCloseAutoFocus={() => handleCloseDialog()}>
              <DialogHeader>
                <DialogTitle>{isEditing ? 'Editar Grupo' : 'Cadastrar Novo Grupo'}</DialogTitle>
                <DialogDescription>
                  {isEditing ? 'Altere o nome e os períodos do grupo.' : 'Defina um nome e adicione os períodos que farão parte deste grupo.'}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="name" className="text-right">
                    Nome do Grupo
                  </Label>
                  <Input
                    id="name"
                    value={currentGroup.name || ""}
                    onChange={(e) => setCurrentGroup({...currentGroup, name: e.target.value})}
                    className="col-span-3"
                    placeholder="Ex: Trimestre 1 - 2024"
                    disabled={isSubmitting}
                  />
                </div>
                <Card className="col-span-4">
                    <CardHeader className="flex flex-row items-center justify-between pb-4">
                        <div>
                            <CardTitle className="text-lg">Períodos</CardTitle>
                            <CardDescription>Adicione os períodos que compõem este grupo.</CardDescription>
                        </div>
                        <Button variant="outline" size="sm" onClick={handleAddPeriod} disabled={isSubmitting}>
                            <Plus className="h-4 w-4 mr-2"/>
                            Adicionar Período
                        </Button>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {(currentGroup.periods || []).map((period) => (
                           <div key={period.id} className="grid grid-cols-12 items-end gap-3 p-3 rounded-md bg-muted/50">
                               <div className="col-span-4 space-y-1">
                                   <Label htmlFor={`p-name-${period.id}`}>Nome</Label>
                                   <Input id={`p-name-${period.id}`} placeholder="Ex: Janeiro" value={period.name} onChange={(e) => handlePeriodChange(period.id, 'name', e.target.value)} disabled={isSubmitting}/>
                               </div>
                                <div className="col-span-3 space-y-1">
                                   <Label htmlFor={`p-start-${period.id}`}>Início</Label>
                                   <Input id={`p-start-${period.id}`} type="date" value={period.startDate} onChange={(e) => handlePeriodChange(period.id, 'startDate', e.target.value)} disabled={isSubmitting}/>
                               </div>
                                <div className="col-span-3 space-y-1">
                                   <Label htmlFor={`p-end-${period.id}`}>Fim</Label>
                                   <Input id={`p-end-${period.id}`} type="date" value={period.endDate} onChange={(e) => handlePeriodChange(period.id, 'endDate', e.target.value)} disabled={isSubmitting}/>
                               </div>
                               <div className="col-span-1 flex flex-col items-center justify-end space-y-1">
                                  <Label htmlFor={`p-lock-${period.id}`} className="text-xs">Bloq?</Label>
                                  <Switch id={`p-lock-${period.id}`} checked={period.isLocked} onCheckedChange={(c) => handlePeriodChange(period.id, 'isLocked', c)} disabled={isSubmitting}/>
                               </div>
                                <div className="col-span-1 flex items-end justify-end">
                                    <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => handleRemovePeriod(period.id)} disabled={isSubmitting}>
                                        <X className="h-5 w-5"/>
                                    </Button>
                                </div>
                           </div>
                        ))}
                         {(!currentGroup.periods || currentGroup.periods.length === 0) && (
                            <p className="text-center text-sm text-muted-foreground py-4">Nenhum período adicionado.</p>
                        )}
                    </CardContent>
                </Card>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={handleCloseDialog} disabled={isSubmitting}>
                  Cancelar
                </Button>
                <Button onClick={handleSubmit} disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="animate-spin" /> : "Salvar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Lista de Grupos de Períodos</CardTitle>
            <CardDescription>
              Total de {periodGroups.length} grupos cadastrados.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center items-center h-40">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
            <AlertDialog>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome do Grupo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Períodos</TableHead>
                    <TableHead>
                      <span className="sr-only">Ações</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {periodGroups.map((group) => {
                    const groupStatus = getGroupStatus(group);
                    return (
                    <TableRow key={group.id}>
                      <TableCell className="font-medium">{group.name}</TableCell>
                      <TableCell>
                        <Badge 
                          variant={groupStatus.variant}
                          className={groupStatus.variant === 'default' ? 'bg-green-600 text-white' : groupStatus.variant === 'outline' ? 'border-yellow-500 text-yellow-600' : ''}
                        >
                            {groupStatus.text}
                        </Badge>
                      </TableCell>
                       <TableCell>
                          <div className="flex flex-col gap-2">
                          {(group.periods || []).map(p => {
                            const periodStatus = getPeriodStatus(p);
                            return (
                              <div key={p.id} className="flex items-center gap-3 text-xs">
                                <span className="text-muted-foreground">
                                  <strong className="text-foreground font-medium">{p.name}:</strong> {formatDate(p.startDate)} - {formatDate(p.endDate)}
                                </span>
                                <div className="flex items-center gap-2">
                                  <Badge variant={periodStatus.variant} className={periodStatus.variant === 'default' ? 'bg-green-600 text-white' : periodStatus.variant === 'outline' ? 'border-yellow-500 text-yellow-600' : ''}>{periodStatus.text}</Badge>
                                  {p.isLocked && <Badge variant="destructive" className="h-5"><Lock className="h-3 w-3 mr-1"/> Bloqueado</Badge>}
                                </div>
                              </div>
                            )
                          })}
                          </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              aria-haspopup="true"
                              size="icon"
                              variant="ghost"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Toggle menu</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Ações</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => handleOpenDialog(group)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Editar
                            </DropdownMenuItem>
                            <AlertDialogTrigger asChild>
                              <DropdownMenuItem
                                className="text-red-600"
                                onSelect={(e) => {
                                  e.preventDefault();
                                  setGroupToDelete(group);
                                }}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Deletar
                              </DropdownMenuItem>
                            </AlertDialogTrigger>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )})}
                </TableBody>
              </Table>
              {groupToDelete && (
                <AlertDialogContent>
                    <AlertDialogHeader>
                    <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Essa ação não pode ser desfeita. Isso irá deletar permanentemente o grupo
                        <strong className="mx-1">{groupToDelete.name}</strong>
                        do sistema.
                    </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setGroupToDelete(null)}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteGroup}>
                            Sim, deletar
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
                )}
            </AlertDialog>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
