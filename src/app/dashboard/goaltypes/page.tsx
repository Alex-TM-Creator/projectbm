
"use client";

import * as React from "react";
import { PlusCircle, MoreHorizontal, Trash2, Loader2, Pencil, ArrowUp, ArrowDown, X } from "lucide-react";
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
  DropdownMenuCheckboxItem,
  DropdownMenuSubTrigger,
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
import type { GoalType, AwardType, ValueType } from "@/lib/definitions";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export default function GoalTypesPage() {
  const { toast } = useToast();
  const [goalTypes, setGoalTypes] = React.useState<GoalType[]>([]);
  const [awardTypes, setAwardTypes] = React.useState<AwardType[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [open, setOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);

  const [currentGoalType, setCurrentGoalType] = React.useState<Partial<GoalType>>({ awardTypeIds: [], valueType: 'currency' });
  const [goalTypeToDelete, setGoalTypeToDelete] = React.useState<GoalType | null>(null);

  const isEditing = !!currentGoalType.id;

  const fetchGoalTypes = React.useCallback(async () => {
    try {
      setLoading(true);
      
      const [goalTypesSnap, awardTypesSnap] = await Promise.all([
        getDocs(collection(db, "goaltypes")),
        getDocs(query(collection(db, "awardtypes"), orderBy("name")))
      ]);
      
      let itemsList = goalTypesSnap.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as GoalType)
      );
      setAwardTypes(awardTypesSnap.docs.map(d => ({id: d.id, ...d.data()}) as AwardType));

      // Check if any item is missing 'order' or 'valueType'
      const needsMigration = itemsList.some(item => typeof item.order !== 'number' || !item.valueType);

      if (needsMigration && itemsList.length > 0) {
        toast({
          title: "Atualizando estrutura...",
          description: "Adicionando novas capacidades aos tipos de metas existentes.",
        });
        const batch = writeBatch(db);
        itemsList.forEach((item, index) => {
          const updateData: Partial<GoalType> = {};
          if(typeof item.order !== 'number') {
            updateData.order = index;
            item.order = index; // Update local item
          }
          if(!item.valueType) {
            updateData.valueType = 'currency'; // Default to currency
            item.valueType = 'currency';
          }
          if (Object.keys(updateData).length > 0) {
            const docRef = doc(db, "goaltypes", item.id);
            batch.update(docRef, updateData);
          }
        });
        await batch.commit();
        toast({
          title: "Estrutura atualizada!",
          description: "Agora você pode reordenar e definir o tipo de valor.",
        });
      }
      
      // Sort items by order locally after potential migration
      itemsList.sort((a, b) => a.order - b.order);
      setGoalTypes(itemsList);

    } catch (error) {
      console.error("Error fetching or migrating goal types:", error);
      toast({
        title: "Erro ao buscar tipos de metas",
        description: "Não foi possível carregar a lista de tipos de metas.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);


  React.useEffect(() => {
    fetchGoalTypes();
  }, [fetchGoalTypes]);

  const handleOpenDialog = (goalType?: GoalType) => {
    setCurrentGoalType(goalType ? JSON.parse(JSON.stringify(goalType)) : { awardTypeIds: [], valueType: 'currency' });
    setOpen(true);
  };
  
  const handleCloseDialog = () => {
    setCurrentGoalType({ awardTypeIds: [], valueType: 'currency' });
    setOpen(false);
  };
  
  const handleAwardTypeSelection = (awardTypeId: string) => {
    setCurrentGoalType(prev => {
      const newAwardTypeIds = [...(prev.awardTypeIds || [])];
      const index = newAwardTypeIds.indexOf(awardTypeId);
      if (index > -1) {
        newAwardTypeIds.splice(index, 1);
      } else {
        newAwardTypeIds.push(awardTypeId);
      }
      return { ...prev, awardTypeIds: newAwardTypeIds };
    });
  }

  const handleClearAwardTypes = () => {
    setCurrentGoalType(prev => ({ ...prev, awardTypeIds: [] }));
  }

  const availableAwardTypesForGoalType = React.useMemo(() => {
    if (!isEditing || !currentGoalType) {
        return awardTypes;
    }
    return awardTypes.filter(at => {
        // Include if it's a global award type (no specific goal types linked)
        if (!at.goalTypeIds || at.goalTypeIds.length === 0) {
            return true;
        }
        // Include if it's specifically linked to the current goal type
        return at.goalTypeIds.includes(currentGoalType.id!);
    });
}, [awardTypes, currentGoalType, isEditing]);


  const handleSubmit = async () => {
    if (!currentGoalType.name || currentGoalType.name.trim() === "" || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const dataToSave: Omit<GoalType, 'id' | 'order'> = {
        name: currentGoalType.name.trim(),
        valueType: currentGoalType.valueType || 'currency',
        awardTypeIds: currentGoalType.awardTypeIds || [],
      };

      if (isEditing) {
        const goalTypeDoc = doc(db, "goaltypes", currentGoalType.id!);
        await updateDoc(goalTypeDoc, dataToSave as any);
        toast({
          title: "Tipo de Meta Atualizado!",
          description: "O tipo de meta foi atualizado com sucesso.",
        });
      } else {
        const goalTypesCollection = collection(db, "goaltypes");
        await addDoc(goalTypesCollection, { 
            ...dataToSave,
            order: goalTypes.length, // Add new items to the end
        });
        toast({
          title: "Tipo de Meta Cadastrado!",
          description: "O novo tipo de meta foi adicionado com sucesso.",
        });
      }
      handleCloseDialog();
      fetchGoalTypes(); // Refresh the list
    } catch (error) {
      toast({
        title: isEditing ? "Erro ao atualizar" : "Erro ao cadastrar",
        description: `Não foi possível salvar o tipo de meta.`,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteGoalType = async () => {
    if (!goalTypeToDelete) return;
    try {
      const goalTypeDoc = doc(db, "goaltypes", goalTypeToDelete.id);
      await deleteDoc(goalTypeDoc);
      toast({
        title: "Tipo de Meta Deletado",
        description: "O tipo de meta foi removido com sucesso.",
        variant: "destructive",
      });
      fetchGoalTypes(); // Refresh the list after deletion
    } catch (error) {
      toast({
        title: "Erro ao deletar",
        description: "Não foi possível remover o tipo de meta.",
        variant: "destructive",
      });
    } finally {
      setGoalTypeToDelete(null);
    }
  };
  
  const saveOrder = async (itemsToSave: GoalType[]) => {
      setIsSaving(true);
      try {
          const batch = writeBatch(db);
          itemsToSave.forEach((item, index) => {
              const docRef = doc(db, "goaltypes", item.id);
              batch.update(docRef, { order: index });
          });
          await batch.commit();
          toast({
              title: "Ordem Salva!",
              description: "A nova ordem dos tipos de meta foi salva com sucesso.",
          });
          setGoalTypes(itemsToSave);
      } catch (error) {
          toast({
              title: "Erro ao salvar",
              description: "Não foi possível salvar a nova ordem.",
              variant: "destructive",
          });
          fetchGoalTypes(); 
      } finally {
          setIsSaving(false);
      }
  }

  const handleMove = (itemId: string, direction: "up" | "down") => {
    const items = [...goalTypes];
    const index = items.findIndex(i => i.id === itemId);
    if (index === -1) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= items.length) return;

    [items[index], items[newIndex]] = [items[newIndex], items[index]];

    const updatedItems = items.map((item, idx) => ({ ...item, order: idx }));

    setGoalTypes(updatedItems); // Optimistic update
    saveOrder(updatedItems); // Persist changes
  };

  const getAwardTypesByIds = (ids?: string[]) => {
      if (!ids || ids.length === 0) return [];
      return ids.map(id => awardTypes.find(at => at.id === id)).filter(Boolean) as AwardType[];
  }


  return (
    <>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold font-headline tracking-tight">
              Tipos de Metas
            </h1>
            <p className="text-muted-foreground">
              Gerencie os tipos de metas cadastrados no sistema.
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1" onClick={() => handleOpenDialog()}>
                <PlusCircle className="h-3.5 w-3.5" />
                <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                  Cadastrar Tipo de Meta
                </span>
              </Button>
            </DialogTrigger>
            <DialogContent onCloseAutoFocus={() => handleCloseDialog()}>
              <DialogHeader>
                <DialogTitle>{isEditing ? 'Editar Tipo de Meta' : 'Cadastrar Novo Tipo de Meta'}</DialogTitle>
                <DialogDescription>
                  {isEditing ? 'Altere os detalhes do tipo de meta.' : 'Insira os detalhes do novo tipo de meta para adicioná-la ao sistema.'}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome</Label>
                  <Input
                    id="name"
                    value={currentGoalType.name || ""}
                    onChange={(e) => setCurrentGoalType({...currentGoalType, name: e.target.value})}
                    placeholder="Ex: Vendas Mensais"
                    disabled={isSubmitting}
                  />
                </div>
                 <div className="space-y-2">
                    <Label>Tipo de Valor da Meta</Label>
                     <RadioGroup 
                        value={currentGoalType.valueType} 
                        onValueChange={(v) => setCurrentGoalType(p => ({...p, valueType: v as ValueType}))}
                        className="flex items-center gap-4"
                        disabled={isSubmitting}
                    >
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="currency" id="type-currency"/>
                            <Label htmlFor="type-currency">Moeda (R$)</Label>
                        </div>
                         <div className="flex items-center space-x-2">
                            <RadioGroupItem value="percentage" id="type-percentage"/>
                            <Label htmlFor="type-percentage">Percentual (%)</Label>
                        </div>
                    </RadioGroup>
                 </div>
                 <div className="space-y-2">
                    <Label htmlFor="awardTypeId">Premiação Vinculada</Label>
                    <div className="flex items-center gap-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" className="w-full justify-start font-normal">
                                {currentGoalType.awardTypeIds && currentGoalType.awardTypeIds.length > 0 
                                ? `${currentGoalType.awardTypeIds.length} selecionada(s)`
                                : "Selecione as premiações"
                                }
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-64">
                          <DropdownMenuLabel>Tipos de Premiação</DropdownMenuLabel>
                          {availableAwardTypesForGoalType.map(at => (
                              <DropdownMenuCheckboxItem
                                  key={at.id}
                                  checked={currentGoalType.awardTypeIds?.includes(at.id)}
                                  onSelect={(e) => e.preventDefault()}
                                  onCheckedChange={() => handleAwardTypeSelection(at.id)}
                              >
                                  {at.name}
                              </DropdownMenuCheckboxItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                      {currentGoalType.awardTypeIds && currentGoalType.awardTypeIds.length > 0 && (
                        <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={handleClearAwardTypes} disabled={isSubmitting}>
                          <X className="h-4 w-4" />
                          <span className="sr-only">Limpar seleção</span>
                        </Button>
                      )}
                    </div>
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
            <CardTitle>Lista de Tipos de Metas</CardTitle>
            <CardDescription>
              Total de {goalTypes.length} tipos de metas cadastrados.
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
                    <TableHead>Tipo de Valor</TableHead>
                    <TableHead>Premiação</TableHead>
                    <TableHead className="w-20 text-right">
                      <span className="sr-only">Ações</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {goalTypes.map((goalType, index) => (
                    <TableRow key={goalType.id}>
                      <TableCell>
                         <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleMove(goalType.id, 'up')} disabled={index === 0 || isSaving}>
                                <ArrowUp className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleMove(goalType.id, 'down')} disabled={index === goalTypes.length - 1 || isSaving}>
                                <ArrowDown className="h-4 w-4" />
                            </Button>
                         </div>
                      </TableCell>
                      <TableCell className="font-medium">{goalType.name}</TableCell>
                       <TableCell>
                          <Badge variant="outline">
                            {goalType.valueType === 'currency' ? 'Moeda (R$)' : 'Percentual (%)'}
                          </Badge>
                       </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {getAwardTypesByIds(goalType.awardTypeIds).map(awardType => (
                            <Badge key={awardType.id} variant="secondary">{awardType.name}</Badge>
                          ))}
                          {(!goalType.awardTypeIds || goalType.awardTypeIds.length === 0) && (
                            <span className="text-xs text-muted-foreground">Nenhuma</span>
                          )}
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
                            <DropdownMenuItem onClick={() => handleOpenDialog(goalType)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Editar
                            </DropdownMenuItem>
                            <AlertDialogTrigger asChild>
                              <DropdownMenuItem
                                className="text-red-600"
                                onSelect={(e) => {
                                  e.preventDefault();
                                  setGoalTypeToDelete(goalType);
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
              {goalTypeToDelete && (
                <AlertDialogContent>
                    <AlertDialogHeader>
                    <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Essa ação não pode ser desfeita. Isso irá deletar permanentemente o tipo de meta
                        <strong className="mx-1">{goalTypeToDelete.name}</strong>
                        do sistema.
                    </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setGoalTypeToDelete(null)}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteGoalType}>
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

    