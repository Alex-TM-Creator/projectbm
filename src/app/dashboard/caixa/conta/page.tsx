
"use client";

import * as React from "react";
import { PlusCircle, MoreHorizontal, Trash2, Loader2, User, GitFork, ShieldAlert } from "lucide-react";
import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  query,
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
import { useToast } from "@/hooks/use-toast";
import type { CaixaConta, User as UserType, Branch } from "@/lib/definitions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

export default function CaixaContaPage() {
  const { toast } = useToast();
  const [contas, setContas] = React.useState<CaixaConta[]>([]);
  const [users, setUsers] = React.useState<UserType[]>([]);
  const [branches, setBranches] = React.useState<Branch[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [open, setOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const [selectedUserId, setSelectedUserId] = React.useState("");
  const [selectedBranchId, setSelectedBranchId] = React.useState("");
  const [itemToDelete, setItemToDelete] = React.useState<CaixaConta | null>(null);

  const fetchData = React.useCallback(async () => {
    try {
      setLoading(true);
      const [contasSnap, usersSnap, branchesSnap] = await Promise.all([
        getDocs(query(collection(db, "caixaContas"))),
        getDocs(query(collection(db, "users"))),
        getDocs(query(collection(db, "branches"))),
      ]);
      setContas(contasSnap.docs.map(d => ({ id: d.id, ...d.data() } as CaixaConta)));
      setUsers(usersSnap.docs.map(d => ({ id: d.id, ...d.data() } as UserType)));
      setBranches(branchesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Branch)));
    } catch (error) {
      toast({ title: "Erro ao buscar dados", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);
  
  const handleOpenDialog = () => {
    setSelectedUserId("");
    setSelectedBranchId("");
    setOpen(true);
  };
  
  const handleCloseDialog = () => {
    setOpen(false);
  };

  const handleSubmit = async () => {
    if (!selectedUserId || !selectedBranchId) {
      toast({ title: "Campos obrigatórios", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      const user = users.find(u => u.id === selectedUserId);
      await addDoc(collection(db, "caixaContas"), {
        userId: selectedUserId,
        userName: user?.name || "Desconhecido",
        branchId: selectedBranchId,
      });
      toast({ title: "Vínculo criado com sucesso!" });
      handleCloseDialog();
      fetchData();
    } catch (error) {
      toast({ title: "Erro ao criar vínculo", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;
    try {
      await deleteDoc(doc(db, "caixaContas", itemToDelete.id));
      toast({ title: "Vínculo removido", variant: "destructive" });
      fetchData();
    } catch (error) {
      toast({ title: "Erro ao remover", variant: "destructive" });
    } finally {
      setItemToDelete(null);
    }
  };
  
  const getBranchName = (branchId: string) => branches.find(b => b.id === branchId)?.name || 'N/A';

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-headline tracking-tight">Vincular Conta ao Caixa</h1>
          <p className="text-muted-foreground">Associe usuários a filiais para permitir a operação do caixa.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1" onClick={handleOpenDialog}>
              <PlusCircle className="h-3.5 w-3.5" />
              <span>Novo Vínculo</span>
            </Button>
          </DialogTrigger>
          <DialogContent onCloseAutoFocus={handleCloseDialog}>
            <DialogHeader>
              <DialogTitle>Vincular Usuário a uma Filial</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Usuário</Label>
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger><SelectValue placeholder="Selecione um usuário"/></SelectTrigger>
                  <SelectContent>{users.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
               <div className="space-y-2">
                <Label>Filial</Label>
                <Select value={selectedBranchId} onValueChange={setSelectedBranchId}>
                  <SelectTrigger><SelectValue placeholder="Selecione uma filial"/></SelectTrigger>
                  <SelectContent>{branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleCloseDialog} disabled={isSubmitting}>Cancelar</Button>
              <Button onClick={handleSubmit} disabled={isSubmitting || !selectedUserId || !selectedBranchId}>
                {isSubmitting ? <Loader2 className="animate-spin" /> : "Salvar Vínculo"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Contas Vinculadas</CardTitle>
          <CardDescription>Usuários que podem operar o caixa em suas respectivas filiais.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center h-40"><Loader2 className="h-8 w-8 animate-spin"/></div>
          ) : (
            <AlertDialog>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Filial</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contas.map(conta => (
                    <TableRow key={conta.id}>
                      <TableCell className="font-medium flex items-center gap-2"><User className="h-4 w-4"/> {conta.userName}</TableCell>
                      <TableCell><GitFork className="h-4 w-4 inline mr-2"/>{getBranchName(conta.branchId)}</TableCell>
                      <TableCell className="text-right">
                        <AlertDialogTrigger asChild>
                           <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => setItemToDelete(conta)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                      </TableCell>
                    </TableRow>
                  ))}
                  {contas.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center h-24">Nenhum vínculo encontrado.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              {itemToDelete && (
                <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta ação irá remover a permissão do usuário <strong>{itemToDelete.userName}</strong> de operar o caixa da filial <strong>{getBranchName(itemToDelete.branchId)}</strong>.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setItemToDelete(null)}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete}>Sim, remover</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
              )}
            </AlertDialog>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
