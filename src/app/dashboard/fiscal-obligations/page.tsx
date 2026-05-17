
"use client";

import * as React from "react";
import { PlusCircle, MoreHorizontal, Trash2, Loader2, Pencil, Calendar as CalendarIcon, CheckCircle, FileText, X } from "lucide-react";
import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
  query,
  orderBy,
  serverTimestamp,
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
import type { FiscalObligation } from "@/lib/definitions";
import { format, parseISO, isPast } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";

export default function FiscalObligationsPage() {
  const { toast } = useToast();
  const [obligations, setObligations] = React.useState<FiscalObligation[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [open, setOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const [currentObligation, setCurrentObligation] = React.useState<Partial<FiscalObligation>>({});
  const [itemToDelete, setItemToDelete] = React.useState<FiscalObligation | null>(null);

  const isEditing = !!currentObligation.id;

  const fetchData = React.useCallback(async () => {
    try {
      setLoading(true);
      const dataCollection = collection(db, "fiscalObligations");
      const q = query(dataCollection, orderBy("dueDate"));
      const dataSnapshot = await getDocs(q);
      setObligations(dataSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FiscalObligation)));
    } catch (error) {
      toast({ title: "Erro ao buscar obrigações", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleOpenDialog = (obligation?: FiscalObligation) => {
    setCurrentObligation(obligation || { status: 'pending' });
    setOpen(true);
  };
  
  const handleCloseDialog = () => {
    setCurrentObligation({});
    setOpen(false);
  };

  const handleSubmit = async () => {
    if (!currentObligation.name || !currentObligation.dueDate) {
        toast({ title: "Nome e data são obrigatórios", variant: "destructive" });
        return;
    }
    
    setIsSubmitting(true);
    try {
        const dataToSave = {
            name: currentObligation.name,
            description: currentObligation.description || "",
            dueDate: currentObligation.dueDate,
            status: currentObligation.status || 'pending',
        };

      if (isEditing) {
        await updateDoc(doc(db, "fiscalObligations", currentObligation.id!), dataToSave);
        toast({ title: "Obrigação Atualizada!" });
      } else {
        await addDoc(collection(db, "fiscalObligations"), {...dataToSave, createdAt: serverTimestamp()});
        toast({ title: "Obrigação Cadastrada!" });
      }
      handleCloseDialog();
      fetchData();
    } catch (error) {
      toast({ title: isEditing ? "Erro ao atualizar" : "Erro ao cadastrar", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleToggleStatus = async (obligation: FiscalObligation) => {
    try {
      const newStatus = obligation.status === 'completed' ? 'pending' : 'completed';
      await updateDoc(doc(db, "fiscalObligations", obligation.id), { status: newStatus });
      toast({ title: "Status alterado com sucesso!" });
      fetchData();
    } catch(error) {
      toast({ title: "Erro ao alterar status", variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;
    try {
      await deleteDoc(doc(db, "fiscalObligations", itemToDelete.id));
      toast({ title: "Obrigação Deletada", variant: "destructive" });
      fetchData();
    } catch (error) {
      toast({ title: "Erro ao deletar", variant: "destructive" });
    } finally {
      setItemToDelete(null);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return format(parseISO(dateString), "dd 'de' MMMM, yyyy", { locale: ptBR });
    } catch {
      return "Data inválida";
    }
  }

  const { pending, completed } = React.useMemo(() => {
    const pending: FiscalObligation[] = [];
    const completed: FiscalObligation[] = [];
    obligations.forEach(ob => {
        if (ob.status === 'completed') {
            completed.push(ob);
        } else {
            pending.push(ob);
        }
    });
    return { pending, completed };
  }, [obligations]);

  return (
    <>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold font-headline tracking-tight flex items-center gap-2">
              <FileText /> Obrigações Fiscais
            </h1>
            <p className="text-muted-foreground">Gerencie seus prazos e obrigações fiscais e administrativas.</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1" onClick={() => handleOpenDialog()}>
                <PlusCircle className="h-3.5 w-3.5" />
                <span>Nova Obrigação</span>
              </Button>
            </DialogTrigger>
            <DialogContent onCloseAutoFocus={handleCloseDialog}>
              <DialogHeader>
                <DialogTitle>{isEditing ? 'Editar Obrigação' : 'Cadastrar Nova Obrigação'}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-6 py-4">
                 <div className="space-y-2">
                  <Label htmlFor="name">Nome da Obrigação</Label>
                  <Input id="name" value={currentObligation.name || ""} onChange={(e) => setCurrentObligation(p => ({...p, name: e.target.value}))} placeholder="Ex: Entrega do SPED Fiscal" disabled={isSubmitting}/>
                </div>
                 <div className="space-y-2">
                  <Label htmlFor="dueDate">Data de Vencimento</Label>
                  <Input id="dueDate" type="date" value={currentObligation.dueDate || ""} onChange={(e) => setCurrentObligation(p => ({...p, dueDate: e.target.value}))} disabled={isSubmitting}/>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Descrição (Opcional)</Label>
                  <Textarea id="description" value={currentObligation.description || ""} onChange={(e) => setCurrentObligation(p => ({...p, description: e.target.value}))} placeholder="Detalhes sobre a obrigação..." disabled={isSubmitting}/>
                </div>
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

        <Card>
          <CardHeader>
            <CardTitle>Obrigações Pendentes</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center items-center h-40"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : (
            <AlertDialog>
              <Table>
                <TableHeader><TableRow><TableHead>Obrigação</TableHead><TableHead>Vencimento</TableHead><TableHead className="w-20 text-right">Ações</TableHead></TableRow></TableHeader>
                <TableBody>
                  {pending.map((item) => {
                    const isOverdue = isPast(parseISO(item.dueDate));
                    return (
                    <TableRow key={item.id} className={isOverdue ? "bg-destructive/10" : ""}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell>
                        <Badge variant={isOverdue ? "destructive" : "outline"} className="gap-1.5"><CalendarIcon className="h-3 w-3"/>{formatDate(item.dueDate)}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                         <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600 hover:text-green-700" onClick={() => handleToggleStatus(item)}><CheckCircle className="h-4 w-4" /></Button>
                         <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenDialog(item)}><Pencil className="h-4 w-4" /></Button>
                         <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setItemToDelete(item)}><Trash2 className="h-4 w-4" /></Button>
                         </AlertDialogTrigger>
                      </TableCell>
                    </TableRow>
                  )})}
                </TableBody>
              </Table>
              {pending.length === 0 && <p className="text-center text-muted-foreground py-8">Nenhuma obrigação pendente.</p>}

              {itemToDelete && (
                <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                      <AlertDialogDescription>Esta ação irá excluir a obrigação <strong className="mx-1">{itemToDelete.name}</strong>.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setItemToDelete(null)}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete}>Sim, excluir</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
                )}
            </AlertDialog>
            )}
          </CardContent>
        </Card>
         <Card>
          <CardHeader>
            <CardTitle>Obrigações Concluídas</CardTitle>
          </CardHeader>
          <CardContent>
             {loading ? (
              <div className="flex justify-center items-center h-40"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
            ) : (
             <AlertDialog>
              <Table>
                <TableHeader><TableRow><TableHead>Obrigação</TableHead><TableHead>Vencimento</TableHead><TableHead className="w-20 text-right">Ações</TableHead></TableRow></TableHeader>
                <TableBody>
                  {completed.map((item) => (
                    <TableRow key={item.id} className="text-muted-foreground">
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell>{formatDate(item.dueDate)}</TableCell>
                      <TableCell className="text-right">
                         <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleToggleStatus(item)}><X className="h-4 w-4" /></Button>
                         <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setItemToDelete(item)}><Trash2 className="h-4 w-4" /></Button>
                         </AlertDialogTrigger>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
                {completed.length === 0 && <p className="text-center text-muted-foreground py-8">Nenhuma obrigação concluída.</p>}
              </AlertDialog>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
