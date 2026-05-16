
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
import type { DeliveryType } from "@/lib/definitions";

export default function DeliveryTypesPage() {
  const { toast } = useToast();
  const [deliveryTypes, setDeliveryTypes] = React.useState<DeliveryType[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [open, setOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);

  const [currentType, setCurrentType] = React.useState<Partial<DeliveryType>>({});
  const [typeToDelete, setTypeToDelete] = React.useState<DeliveryType | null>(null);

  const isEditing = !!currentType.id;

  const fetchData = React.useCallback(async () => {
    try {
      setLoading(true);
      const dataCollection = collection(db, "deliveryTypes");
      const q = query(dataCollection, orderBy("order"));
      const dataSnapshot = await getDocs(q);
      const itemsList = dataSnapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as DeliveryType)
      );

       // Migration for existing items without 'order'
      if (itemsList.some(item => typeof item.order !== 'number')) {
        const batch = writeBatch(db);
        itemsList.forEach((item, index) => {
          if (typeof item.order !== 'number') {
            const docRef = doc(db, "deliveryTypes", item.id);
            batch.update(docRef, { order: index });
            item.order = index; // Update local item
          }
        });
        await batch.commit();
      }

      itemsList.sort((a, b) => a.order - b.order);
      setDeliveryTypes(itemsList);
    } catch (error) {
      toast({
        title: "Erro ao buscar tipos de entrega",
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

  const handleOpenDialog = (type?: DeliveryType) => {
    setCurrentType(type || {});
    setOpen(true);
  };
  
  const handleCloseDialog = () => {
    setCurrentType({});
    setOpen(false);
  };

  const handleSubmit = async () => {
    if (!currentType.name || currentType.name.trim() === "" || isSubmitting) return;

    setIsSubmitting(true);
    try {
      if (isEditing) {
        const docRef = doc(db, "deliveryTypes", currentType.id!);
        await updateDoc(docRef, { name: currentType.name.trim() });
        toast({
          title: "Tipo de Entrega Atualizado!",
          description: "O tipo de entrega foi atualizado com sucesso.",
        });
      } else {
        await addDoc(collection(db, "deliveryTypes"), { 
          name: currentType.name.trim(),
          order: deliveryTypes.length,
        });
        toast({
          title: "Tipo de Entrega Cadastrado!",
          description: "O novo tipo de entrega foi adicionado com sucesso.",
        });
      }
      handleCloseDialog();
      fetchData();
    } catch (error) {
      toast({
        title: isEditing ? "Erro ao atualizar" : "Erro ao cadastrar",
        description: `Não foi possível salvar o tipo de entrega.`,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!typeToDelete) return;
    try {
      await deleteDoc(doc(db, "deliveryTypes", typeToDelete.id));
      toast({
        title: "Tipo de Entrega Deletado",
        description: "O registro foi removido com sucesso.",
        variant: "destructive",
      });
      fetchData();
    } catch (error) {
      toast({
        title: "Erro ao deletar",
        description: "Não foi possível remover o registro.",
        variant: "destructive",
      });
    } finally {
      setTypeToDelete(null);
    }
  };
  
  const saveOrder = async (itemsToSave: DeliveryType[]) => {
      setIsSaving(true);
      try {
          const batch = writeBatch(db);
          itemsToSave.forEach((item, index) => {
              const docRef = doc(db, "deliveryTypes", item.id);
              batch.update(docRef, { order: index });
          });
          await batch.commit();
          toast({
              title: "Ordem Salva!",
              description: "A nova ordem foi salva com sucesso.",
          });
          setDeliveryTypes(itemsToSave);
      } catch (error) {
          toast({
              title: "Erro ao salvar",
              description: "Não foi possível salvar a nova ordem.",
              variant: "destructive",
          });
          fetchData(); 
      } finally {
          setIsSaving(false);
      }
  }

  const handleMove = (itemId: string, direction: "up" | "down") => {
    const items = [...deliveryTypes];
    const index = items.findIndex(i => i.id === itemId);
    if (index === -1) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= items.length) return;

    [items[index], items[newIndex]] = [items[newIndex], items[index]];

    const updatedItems = items.map((item, idx) => ({ ...item, order: idx }));

    setDeliveryTypes(updatedItems);
    saveOrder(updatedItems);
  };

  return (
    <>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold font-headline tracking-tight">
              Tipos de Entrega
            </h1>
            <p className="text-muted-foreground">
              Gerencie as opções de entrega disponíveis no sistema.
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1" onClick={() => handleOpenDialog()}>
                <PlusCircle className="h-3.5 w-3.5" />
                <span>Novo Tipo</span>
              </Button>
            </DialogTrigger>
            <DialogContent onCloseAutoFocus={handleCloseDialog}>
              <DialogHeader>
                <DialogTitle>{isEditing ? 'Editar Tipo de Entrega' : 'Cadastrar Novo Tipo de Entrega'}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="name" className="text-right">
                    Nome
                  </Label>
                  <Input
                    id="name"
                    value={currentType.name || ""}
                    onChange={(e) => setCurrentType({...currentType, name: e.target.value})}
                    className="col-span-3"
                    placeholder="Ex: Retirada na Loja"
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
            <CardTitle>Lista de Tipos de Entrega</CardTitle>
            <CardDescription>
              Total de {deliveryTypes.length} tipos cadastrados.
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
                    <TableHead className="text-right w-20">
                      <span className="sr-only">Ações</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deliveryTypes.map((type, index) => (
                    <TableRow key={type.id}>
                      <TableCell>
                         <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleMove(type.id, 'up')} disabled={index === 0 || isSaving}>
                                <ArrowUp className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleMove(type.id, 'down')} disabled={index === deliveryTypes.length - 1 || isSaving}>
                                <ArrowDown className="h-4 w-4" />
                            </Button>
                         </div>
                      </TableCell>
                      <TableCell className="font-medium">{type.name}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              aria-haspopup="true"
                              size="icon"
                              variant="ghost"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Ações</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => handleOpenDialog(type)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Editar
                            </DropdownMenuItem>
                            <AlertDialogTrigger asChild>
                              <DropdownMenuItem
                                className="text-red-600"
                                onSelect={(e) => {
                                  e.preventDefault();
                                  setTypeToDelete(type);
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
              {typeToDelete && (
                <AlertDialogContent>
                    <AlertDialogHeader>
                    <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Essa ação não pode ser desfeita. Isso irá deletar permanentemente o tipo de entrega
                        <strong className="mx-1">{typeToDelete.name}</strong>.
                    </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setTypeToDelete(null)}>Cancelar</AlertDialogCancel>
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
