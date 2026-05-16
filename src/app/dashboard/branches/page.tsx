"use client";

import * as React from "react";
import { PlusCircle, MoreHorizontal, Trash2, Loader2, Pencil } from "lucide-react";
import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
  query,
  orderBy,
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
import type { Branch } from "@/lib/definitions";

export default function BranchesPage() {
  const { toast } = useToast();
  const [branches, setBranches] = React.useState<Branch[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [open, setOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const [currentBranch, setCurrentBranch] = React.useState<Partial<Branch>>({});
  const [branchToDelete, setBranchToDelete] = React.useState<Branch | null>(null);

  const isEditing = !!currentBranch.id;

  const fetchBranches = React.useCallback(async () => {
    try {
      setLoading(true);
      const branchesCollection = collection(db, "branches");
      const q = query(branchesCollection, orderBy("name"));
      const branchSnapshot = await getDocs(q);
      const branchesList = branchSnapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as Branch)
      );
      setBranches(branchesList);
    } catch (error) {
      toast({
        title: "Erro ao buscar filiais",
        description: "Não foi possível carregar a lista de filiais.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    fetchBranches();
  }, [fetchBranches]);

  const handleOpenDialog = (branch?: Branch) => {
    setCurrentBranch(branch || {});
    setOpen(true);
  };
  
  const handleCloseDialog = () => {
    setCurrentBranch({});
    setOpen(false);
  };

  const handleSubmit = async () => {
    if (!currentBranch.name || currentBranch.name.trim() === "" || isSubmitting) return;

    setIsSubmitting(true);
    try {
      if (isEditing) {
        const branchDoc = doc(db, "branches", currentBranch.id!);
        await updateDoc(branchDoc, { name: currentBranch.name.trim() });
        toast({
          title: "Filial Atualizada!",
          description: "A filial foi atualizada com sucesso.",
        });
      } else {
        const branchesCollection = collection(db, "branches");
        await addDoc(branchesCollection, { name: currentBranch.name.trim() });
        toast({
          title: "Filial Cadastrada!",
          description: "A nova filial foi adicionada com sucesso.",
        });
      }
      handleCloseDialog();
      fetchBranches(); // Refresh the list
    } catch (error) {
      toast({
        title: isEditing ? "Erro ao atualizar" : "Erro ao cadastrar",
        description: `Não foi possível salvar a filial.`,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteBranch = async () => {
    if (!branchToDelete) return;
    try {
      const branchDoc = doc(db, "branches", branchToDelete.id);
      await deleteDoc(branchDoc);
      toast({
        title: "Filial Deletada",
        description: "A filial foi removida com sucesso.",
        variant: "destructive",
      });
      fetchBranches(); // Refresh the list
    } catch (error) {
      toast({
        title: "Erro ao deletar",
        description: "Não foi possível remover a filial.",
        variant: "destructive",
      });
    } finally {
      setBranchToDelete(null);
    }
  };
  

  return (
    <>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold font-headline tracking-tight">
              Filiais
            </h1>
            <p className="text-muted-foreground">
              Gerencie as filiais cadastradas no sistema.
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1" onClick={() => handleOpenDialog()}>
                <PlusCircle className="h-3.5 w-3.5" />
                <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                  Cadastrar Filial
                </span>
              </Button>
            </DialogTrigger>
            <DialogContent onCloseAutoFocus={() => handleCloseDialog()}>
              <DialogHeader>
                <DialogTitle>{isEditing ? 'Editar Filial' : 'Cadastrar Nova Filial'}</DialogTitle>
                <DialogDescription>
                  {isEditing ? 'Altere o nome da filial.' : 'Insira o nome da nova filial para adicioná-la ao sistema.'}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="name" className="text-right">
                    Nome
                  </Label>
                  <Input
                    id="name"
                    value={currentBranch.name || ""}
                    onChange={(e) => setCurrentBranch({...currentBranch, name: e.target.value})}
                    className="col-span-3"
                    placeholder="Ex: Matriz - São Paulo"
                    disabled={isSubmitting}
                  />
                </div>
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
            <CardTitle>Lista de Filiais</CardTitle>
            <CardDescription>
              Total de {branches.length} filiais cadastradas.
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
                    <TableHead>Nome da Filial</TableHead>
                    <TableHead>
                      <span className="sr-only">Ações</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {branches.map((branch) => (
                    <TableRow key={branch.id}>
                      <TableCell className="font-medium">{branch.name}</TableCell>
                      <TableCell>
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
                            <DropdownMenuItem onClick={() => handleOpenDialog(branch)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Editar
                            </DropdownMenuItem>
                            <AlertDialogTrigger asChild>
                              <DropdownMenuItem
                                className="text-red-600"
                                onSelect={(e) => {
                                  e.preventDefault();
                                  setBranchToDelete(branch);
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
                  ))}
                </TableBody>
              </Table>
              {branchToDelete && (
                <AlertDialogContent>
                    <AlertDialogHeader>
                    <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Essa ação não pode ser desfeita. Isso irá deletar permanentemente a filial
                        <strong className="mx-1">{branchToDelete.name}</strong>
                        do sistema.
                    </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setBranchToDelete(null)}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteBranch}>
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
