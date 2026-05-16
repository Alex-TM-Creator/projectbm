
"use client";

import * as React from "react";
import { PlusCircle, MoreHorizontal, Trash2, Loader2, Pencil, Percent } from "lucide-react";
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
import type { Markup } from "@/lib/definitions";

export default function MarkupsPage() {
  const { toast } = useToast();
  const [markups, setMarkups] = React.useState<Markup[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [open, setOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const [currentMarkup, setCurrentMarkup] = React.useState<Partial<Markup>>({ name: "", percentage: 0 });
  const [itemToDelete, setItemToDelete] = React.useState<Markup | null>(null);

  const isEditing = !!currentMarkup.id;

  const fetchData = React.useCallback(async () => {
    try {
      setLoading(true);
      const dataCollection = collection(db, "markups");
      const q = query(dataCollection, orderBy("name"));
      const dataSnapshot = await getDocs(q);
      setMarkups(dataSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Markup)));
    } catch (error) {
      toast({
        title: "Erro ao buscar markups",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleOpenDialog = (markup?: Markup) => {
    setCurrentMarkup(markup || { name: "", percentage: 0 });
    setOpen(true);
  };
  
  const handleCloseDialog = () => {
    setCurrentMarkup({ name: "", percentage: 0 });
    setOpen(false);
  };

  const handlePercentageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9]/g, '');
    const numericValue = value ? parseFloat(value) / 100 : 0;
    setCurrentMarkup(prev => ({ ...prev, percentage: numericValue }));
  };

  const formatPercentageForInput = (value?: number) => {
    if (value === undefined || value === null || isNaN(value)) return '';
    return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const handleSubmit = async () => {
    if (!currentMarkup.name || currentMarkup.name.trim() === "") {
      toast({ title: "Nome é obrigatório", variant: "destructive" });
      return;
    }
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      const dataToSave = {
        name: currentMarkup.name.trim(),
        percentage: currentMarkup.percentage || 0,
      };

      if (isEditing) {
        const docRef = doc(db, "markups", currentMarkup.id!);
        await updateDoc(docRef, dataToSave);
        toast({ title: "Markup Atualizado!" });
      } else {
        await addDoc(collection(db, "markups"), dataToSave);
        toast({ title: "Markup Cadastrado!" });
      }
      handleCloseDialog();
      fetchData();
    } catch (error) {
      toast({ title: isEditing ? "Erro ao atualizar" : "Erro ao cadastrar", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;
    try {
      await deleteDoc(doc(db, "markups", itemToDelete.id));
      toast({ title: "Markup Deletado", variant: "destructive" });
      fetchData();
    } catch (error) {
      toast({ title: "Erro ao deletar", variant: "destructive" });
    } finally {
      setItemToDelete(null);
    }
  };

  return (
    <>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold font-headline tracking-tight flex items-center gap-2">
              <Percent /> Markup
            </h1>
            <p className="text-muted-foreground">
              Gerencie os markups para precificação de produtos.
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1" onClick={() => handleOpenDialog()}>
                <PlusCircle className="h-3.5 w-3.5" />
                <span>Novo Markup</span>
              </Button>
            </DialogTrigger>
            <DialogContent onCloseAutoFocus={handleCloseDialog}>
              <DialogHeader>
                <DialogTitle>{isEditing ? 'Editar Markup' : 'Cadastrar Novo Markup'}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome</Label>
                  <Input
                    id="name"
                    value={currentMarkup.name || ""}
                    onChange={(e) => setCurrentMarkup({...currentMarkup, name: e.target.value})}
                    placeholder="Ex: Markup Padrão"
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="percentage">Percentual (%)</Label>
                  <Input
                    id="percentage"
                    value={formatPercentageForInput(currentMarkup.percentage)}
                    onChange={handlePercentageChange}
                    placeholder="0,00"
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
            <CardTitle>Lista de Markups</CardTitle>
            <CardDescription>
              Total de {markups.length} markups cadastrados.
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
                    <TableHead>Nome</TableHead>
                    <TableHead>Percentual</TableHead>
                    <TableHead className="text-right">
                      <span className="sr-only">Ações</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {markups.map((markup) => (
                    <TableRow key={markup.id}>
                      <TableCell className="font-medium">{markup.name}</TableCell>
                      <TableCell>{formatPercentageForInput(markup.percentage)}%</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button aria-haspopup="true" size="icon" variant="ghost">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Ações</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => handleOpenDialog(markup)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Editar
                            </DropdownMenuItem>
                            <AlertDialogTrigger asChild>
                              <DropdownMenuItem
                                className="text-red-600"
                                onSelect={(e) => {
                                  e.preventDefault();
                                  setItemToDelete(markup);
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
              {itemToDelete && (
                <AlertDialogContent>
                    <AlertDialogHeader>
                    <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Essa ação não pode ser desfeita. Isso irá deletar permanentemente o markup
                        <strong className="mx-1">{itemToDelete.name}</strong>.
                    </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setItemToDelete(null)}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete}>
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
