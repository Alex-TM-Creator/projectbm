

"use client";

import * as React from "react";
import { PlusCircle, MoreHorizontal, Trash2, Loader2, Pencil, ArrowUp, ArrowDown, CreditCard, Check, X, Percent } from "lucide-react";
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
import type { PaymentMethod } from "@/lib/definitions";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

export default function PaymentMethodsPage() {
  const { toast } = useToast();
  const [paymentMethods, setPaymentMethods] = React.useState<PaymentMethod[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [open, setOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);

  const [currentMethod, setCurrentMethod] = React.useState<Partial<PaymentMethod>>({ receivingTerm: 0, installments: 1, installmentIntervalDays: 30, keepSameDay: true, isGrouped: false, interestRates: [], isCustomerCredit: false });
  const [methodToDelete, setMethodToDelete] = React.useState<PaymentMethod | null>(null);

  const isEditing = !!currentMethod.id;

  const fetchData = React.useCallback(async () => {
    try {
      setLoading(true);
      const dataCollection = collection(db, "paymentMethods");
      const q = query(dataCollection, orderBy("order"));
      const dataSnapshot = await getDocs(q);
      const itemsList = dataSnapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as PaymentMethod)
      );

      if (itemsList.some(item => typeof item.order !== 'number' || typeof item.isGrouped !== 'boolean')) {
        const batch = writeBatch(db);
        itemsList.forEach((item, index) => {
          const updateData: Partial<PaymentMethod> = {};
          if (typeof item.order !== 'number') {
            updateData.order = index;
            item.order = index;
          }
           if (typeof item.isGrouped !== 'boolean') {
            updateData.isGrouped = false; // Default to false
            item.isGrouped = false;
          }
          if (Object.keys(updateData).length > 0) {
            const docRef = doc(db, "paymentMethods", item.id);
            batch.update(docRef, updateData);
          }
        });
        await batch.commit();
      }

      itemsList.sort((a, b) => a.order - b.order);
      setPaymentMethods(itemsList);
    } catch (error) {
      toast({
        title: "Erro ao buscar formas de pagamento",
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

  const handleOpenDialog = (method?: PaymentMethod) => {
    const initialData = { receivingTerm: 0, installments: 1, installmentIntervalDays: 30, keepSameDay: true, isGrouped: false, interestRates: [], isCustomerCredit: false };
    if (method) {
        // Ensure interestRates array has the correct length
        const installments = method.installments || 1;
        const interestRates = Array.isArray(method.interestRates) ? method.interestRates : [];
        const newRates = Array.from({ length: installments }, (_, i) => interestRates[i] || 0);
        setCurrentMethod({...method, interestRates: newRates});
    } else {
        setCurrentMethod(initialData);
    }
    setOpen(true);
  };
  
  const handleCloseDialog = () => {
    setCurrentMethod({ receivingTerm: 0, installments: 1, installmentIntervalDays: 30, keepSameDay: true, isGrouped: false, interestRates: [], isCustomerCredit: false });
    setOpen(false);
  };
  
  const handlePercentageInputChange = (index: number) => (e: React.ChangeEvent<HTMLInputElement>) => {
    let rawValue = e.target.value.replace(/[^0-9]/g, '');
    const numericValue = rawValue ? parseFloat(rawValue) / 100 : 0;
    
    setCurrentMethod(prev => {
        if (!prev) return prev;
        const newRates = [...(prev.interestRates || [])];
        newRates[index] = numericValue;
        return { ...prev, interestRates: newRates };
    });
  };

  const handleInstallmentsChange = (value: number) => {
    const newInstallments = Math.max(1, value);
    setCurrentMethod(prev => {
        const oldRates = prev?.interestRates || [];
        const newRates = Array.from({ length: newInstallments }, (_, i) => oldRates[i] || 0);
        return { ...prev, installments: newInstallments, interestRates: newRates };
    });
  }

  const formatPercentageForInput = (value: number | undefined) => {
    if (value === undefined || value === null || isNaN(value)) return '';
    return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };


  const handleSubmit = async () => {
    if (!currentMethod.name || currentMethod.name.trim() === "" || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const dataToSave = {
        name: currentMethod.name.trim(),
        receivingTerm: Number(currentMethod.receivingTerm) || 0,
        installments: Number(currentMethod.installments) || 1,
        installmentIntervalDays: Number(currentMethod.installmentIntervalDays) || 30,
        keepSameDay: currentMethod.keepSameDay === undefined ? true : currentMethod.keepSameDay,
        isGrouped: currentMethod.isGrouped || false,
        interestRates: (currentMethod.installments || 1) > 1 ? (currentMethod.interestRates || []) : [],
        isCustomerCredit: currentMethod.isCustomerCredit || false,
      };

      if (isEditing) {
        const docRef = doc(db, "paymentMethods", currentMethod.id!);
        await updateDoc(docRef, dataToSave as any);
        toast({ title: "Forma de Pagamento Atualizada!" });
      } else {
        await addDoc(collection(db, "paymentMethods"), { 
          ...dataToSave,
          order: paymentMethods.length,
        });
        toast({ title: "Forma de Pagamento Cadastrada!" });
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
    if (!methodToDelete) return;
    try {
      await deleteDoc(doc(db, "paymentMethods", methodToDelete.id));
      toast({ title: "Registro Deletado", variant: "destructive" });
      fetchData();
    } catch (error) {
      toast({ title: "Erro ao deletar", variant: "destructive" });
    } finally {
      setMethodToDelete(null);
    }
  };
  
  const saveOrder = async (itemsToSave: PaymentMethod[]) => {
      setIsSaving(true);
      try {
          const batch = writeBatch(db);
          itemsToSave.forEach((item, index) => {
              const docRef = doc(db, "paymentMethods", item.id);
              batch.update(docRef, { order: index });
          });
          await batch.commit();
          toast({ title: "Ordem Salva!" });
          setPaymentMethods(itemsToSave);
      } catch (error) {
          toast({ title: "Erro ao salvar ordem", variant: "destructive" });
          fetchData(); 
      } finally {
          setIsSaving(false);
      }
  }

  const handleMove = (itemId: string, direction: "up" | "down") => {
    const items = [...paymentMethods];
    const index = items.findIndex(i => i.id === itemId);
    if (index === -1) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= items.length) return;

    [items[index], items[newIndex]] = [items[newIndex], items[index]];

    const updatedItems = items.map((item, idx) => ({ ...item, order: idx }));

    setPaymentMethods(updatedItems);
    saveOrder(updatedItems);
  };
  
  return (
    <>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold font-headline tracking-tight flex items-center gap-2">
              <CreditCard /> Formas de Pagamento
            </h1>
            <p className="text-muted-foreground">
              Gerencie as formas de pagamento aceitas.
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1" onClick={() => handleOpenDialog()}>
                <PlusCircle className="h-3.5 w-3.5" />
                <span>Nova Forma</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl" onCloseAutoFocus={handleCloseDialog}>
              <DialogHeader>
                <DialogTitle>{isEditing ? 'Editar Forma de Pagamento' : 'Cadastrar Nova Forma de Pagamento'}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome</Label>
                  <Input
                    id="name"
                    value={currentMethod.name || ""}
                    onChange={(e) => setCurrentMethod({...currentMethod, name: e.target.value})}
                    placeholder="Ex: Cartão de Crédito"
                    disabled={isSubmitting}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="receivingTerm">Prazo de Recebimento (dias)</Label>
                    <Input
                      id="receivingTerm"
                      type="number"
                      value={currentMethod.receivingTerm ?? 0}
                      onChange={(e) => setCurrentMethod({...currentMethod, receivingTerm: Number(e.target.value)})}
                      disabled={isSubmitting}
                      min="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="installments">Máximo de Parcelas</Label>
                    <Input
                      id="installments"
                      type="number"
                      value={currentMethod.installments ?? 1}
                      onChange={(e) => handleInstallmentsChange(Number(e.target.value))}
                      disabled={isSubmitting}
                      min="1"
                    />
                  </div>
                </div>
                 <div className="flex items-center space-x-2 pt-2">
                    <Switch id="isGrouped" checked={currentMethod.isGrouped} onCheckedChange={(checked) => setCurrentMethod({...currentMethod, isGrouped: checked })} />
                    <Label htmlFor="isGrouped">Parcelas Agrupadas (Ex: 10x de R$100)</Label>
                </div>
                 <div className="flex items-center space-x-2 pt-2">
                    <Switch id="isCustomerCredit" checked={currentMethod.isCustomerCredit} onCheckedChange={(checked) => setCurrentMethod({...currentMethod, isCustomerCredit: checked })} />
                    <Label htmlFor="isCustomerCredit">Utiliza Crédito do Cliente?</Label>
                </div>
                {(currentMethod.installments ?? 1) > 1 && (
                  <Card>
                    <CardHeader>
                        <CardTitle>Taxas de Juros por Parcela</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                         <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                              <Label htmlFor="installmentIntervalDays">Intervalo entre Parcelas (dias)</Label>
                              <Input
                                id="installmentIntervalDays"
                                type="number"
                                value={currentMethod.installmentIntervalDays ?? 30}
                                onChange={(e) => setCurrentMethod({...currentMethod, installmentIntervalDays: Number(e.target.value)})}
                                disabled={isSubmitting || currentMethod.isGrouped}
                                min="1"
                              />
                          </div>
                          <div className="flex items-end space-x-2 pb-1">
                              <Switch id="keepSameDay" checked={currentMethod.keepSameDay} onCheckedChange={(checked) => setCurrentMethod({...currentMethod, keepSameDay: checked })} disabled={isSubmitting || currentMethod.isGrouped} />
                              <Label htmlFor="keepSameDay">Manter mesmo dia do mês</Label>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {Array.from({ length: currentMethod.installments || 1 }).map((_, index) => (
                                <div key={index} className="space-y-1">
                                    <Label htmlFor={`rate-${index}`} className="text-xs">Parcela {index + 1} (%)</Label>
                                    <Input
                                        id={`rate-${index}`}
                                        type="text"
                                        value={formatPercentageForInput(currentMethod.interestRates?.[index])}
                                        onChange={handlePercentageInputChange(index)}
                                        placeholder="0,00"
                                        disabled={isSubmitting}
                                    />
                                </div>
                            ))}
                        </div>
                    </CardContent>
                  </Card>
                )}
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
            <CardTitle>Lista de Formas de Pagamento</CardTitle>
            <CardDescription>
              Total de {paymentMethods.length} formas cadastradas.
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
                    <TableHead>Prazo Recebimento</TableHead>
                    <TableHead>Parcelamento</TableHead>
                    <TableHead>Tipo de Parcela</TableHead>
                    <TableHead>Crédito Cliente</TableHead>
                    <TableHead className="w-20 text-right">
                      <span className="sr-only">Ações</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paymentMethods.map((method, index) => {
                    let interestText = '';
                    if (method.interestRates && method.interestRates.some(r => r > 0)) {
                        const rates = method.interestRates.map(r => `${formatPercentageForInput(r)}%`).join(' / ');
                        interestText = `+ juros variáveis`;
                    }
                    return (
                    <TableRow key={method.id}>
                       <TableCell>
                         <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleMove(method.id, 'up')} disabled={index === 0 || isSaving}>
                                <ArrowUp className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleMove(method.id, 'down')} disabled={index === paymentMethods.length - 1 || isSaving}>
                                <ArrowDown className="h-4 w-4" />
                            </Button>
                         </div>
                      </TableCell>
                      <TableCell className="font-medium">{method.name}</TableCell>
                      <TableCell>{method.receivingTerm} dias</TableCell>
                      <TableCell>
                        {method.installments > 1 ? (
                          `${method.installments}x ${method.isGrouped ? '' : `(${method.installmentIntervalDays} dias${method.keepSameDay ? ', mesmo dia' : ''})`} ${interestText}`
                        ) : (
                          'À vista'
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={method.isGrouped ? "default" : "outline"} className="gap-1.5">
                            {method.isGrouped ? "Agrupado" : "Individual"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={method.isCustomerCredit ? "default" : "outline"} className={method.isCustomerCredit ? "bg-blue-600" : ""}>
                            {method.isCustomerCredit ? "Sim" : "Não"}
                        </Badge>
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
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Ações</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => handleOpenDialog(method)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Editar
                            </DropdownMenuItem>
                            <AlertDialogTrigger asChild>
                              <DropdownMenuItem
                                className="text-red-600"
                                onSelect={(e) => {
                                  e.preventDefault();
                                  setMethodToDelete(method);
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
              {methodToDelete && (
                <AlertDialogContent>
                    <AlertDialogHeader>
                    <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Essa ação não pode ser desfeita. Isso irá deletar permanentemente a forma de pagamento
                        <strong className="mx-1">{methodToDelete.name}</strong>.
                    </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setMethodToDelete(null)}>Cancelar</AlertDialogCancel>
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
