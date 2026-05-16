
"use client";

import * as React from "react";
import { PlusCircle, MoreHorizontal, Trash2, Loader2, Pencil, ArrowUp, ArrowDown } from "lucide-react";
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
import type { Brand } from "@/lib/definitions";

export default function BrandsPage() {
  const { toast } = useToast();
  const [brands, setBrands] = React.useState<Brand[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [open, setOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);

  const [currentBrand, setCurrentBrand] = React.useState<Partial<Brand>>({});
  const [brandToDelete, setBrandToDelete] = React.useState<Brand | null>(null);

  const isEditing = !!currentBrand.id;

  const fetchData = React.useCallback(async () => {
    try {
      setLoading(true);
      const dataCollection = collection(db, "brands");
      const q = query(dataCollection, orderBy("order"));
      const dataSnapshot = await getDocs(q);
      const itemsList = dataSnapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as Brand)
      );

      if (itemsList.some(item => typeof item.order !== 'number')) {
        const batch = writeBatch(db);
        itemsList.forEach((item, index) => {
          if (typeof item.order !== 'number') {
            const docRef = doc(db, "brands", item.id);
            batch.update(docRef, { order: index });
            item.order = index;
          }
        });
        await batch.commit();
      }

      itemsList.sort((a, b) => a.order - b.order);
      setBrands(itemsList);
    } catch (error) {
      toast({
        title: "Erro ao buscar marcas",
        description: "Não foi possível carregar a lista.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleOpenDialog = (brand?: Brand) => {
    setCurrentBrand(brand || {});
    setOpen(true);
  };
  
  const handleCloseDialog = () => {
    setCurrentBrand({});
    setOpen(false);
  };

  const handleSubmit = async () => {
    if (!currentBrand.name || currentBrand.name.trim() === "" || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const dataToSave = { name: currentBrand.name.trim() };

      if (isEditing) {
        const docRef = doc(db, "brands", currentBrand.id!);
        await updateDoc(docRef, dataToSave);
        toast({ title: "Marca Atualizada!" });
      } else {
        await addDoc(collection(db, "brands"), { ...dataToSave, order: brands.length });
        toast({ title: "Marca Cadastrada!" });
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
    if (!brandToDelete) return;
    try {
      await deleteDoc(doc(db, "brands", brandToDelete.id));
      toast({ title: "Marca Deletada", variant: "destructive" });
      fetchData();
    } catch (error) {
      toast({ title: "Erro ao deletar", variant: "destructive" });
    } finally {
      setBrandToDelete(null);
    }
  };
  
  const saveOrder = async (itemsToSave: Brand[]) => {
      setIsSaving(true);
      try {
          const batch = writeBatch(db);
          itemsToSave.forEach((item, index) => {
              const docRef = doc(db, "brands", item.id);
              batch.update(docRef, { order: index });
          });
          await batch.commit();
          toast({ title: "Ordem Salva!" });
          setBrands(itemsToSave);
      } catch (error) {
          toast({ title: "Erro ao salvar ordem", variant: "destructive" });
          fetchData(); 
      } finally {
          setIsSaving(false);
      }
  }

  const handleMove = (itemId: string, direction: "up" | "down") => {
    const items = [...brands];
    const index = items.findIndex(i => i.id === itemId);
    if (index === -1) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= items.length) return;

    [items[index], items[newIndex]] = [items[newIndex], items[index]];

    const updatedItems = items.map((item, idx) => ({ ...item, order: idx }));

    setBrands(updatedItems);
    saveOrder(updatedItems);
  };

  return (
    <>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold font-headline tracking-tight">Marcas</h1>
            <p className="text-muted-foreground">Gerencie as marcas dos produtos.</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1" onClick={() => handleOpenDialog()}>
                <PlusCircle className="h-3.5 w-3.5" />
                <span>Nova Marca</span>
              </Button>
            </DialogTrigger>
            <DialogContent onCloseAutoFocus={handleCloseDialog}>
              <DialogHeader>
                <DialogTitle>{isEditing ? 'Editar Marca' : 'Cadastrar Nova Marca'}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="name" className="text-right">Nome</Label>
                  <Input
                    id="name"
                    value={currentBrand.name || ""}
                    onChange={(e) => setCurrentBrand({ ...currentBrand, name: e.target.value })}
                    className="col-span-3"
                    placeholder="Ex: Nike"
                    disabled={isSubmitting}
                  />
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
            <CardTitle>Lista de Marcas</CardTitle>
            <CardDescription>
              Total de {brands.length} marcas cadastradas.
              {(isSaving) && <span className="ml-2 animate-pulse">Salvando...</span>}
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
                    <TableHead className="w-24">Ordem</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead className="w-20 text-right"><span className="sr-only">Ações</span></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {brands.map((brand, index) => (
                    <TableRow key={brand.id}>
                      <TableCell>
                         <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleMove(brand.id, 'up')} disabled={index === 0 || isSaving}>
                                <ArrowUp className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleMove(brand.id, 'down')} disabled={index === brands.length - 1 || isSaving}>
                                <ArrowDown className="h-4 w-4" />
                            </Button>
                         </div>
                      </TableCell>
                      <TableCell className="font-medium">{brand.name}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button aria-haspopup="true" size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Ações</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => handleOpenDialog(brand)}><Pencil className="mr-2 h-4 w-4" />Editar</DropdownMenuItem>
                            <AlertDialogTrigger asChild>
                              <DropdownMenuItem className="text-red-600" onSelect={(e) => { e.preventDefault(); setBrandToDelete(brand);}}><Trash2 className="mr-2 h-4 w-4" />Deletar</DropdownMenuItem>
                            </AlertDialogTrigger>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {brandToDelete && (
                <AlertDialogContent>
                    <AlertDialogHeader>
                    <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                    <AlertDialogDescription>Esta ação não pode ser desfeita e irá excluir a marca <strong className="mx-1">{brandToDelete.name}</strong>.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setBrandToDelete(null)}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete}>Sim, deletar</AlertDialogAction>
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
