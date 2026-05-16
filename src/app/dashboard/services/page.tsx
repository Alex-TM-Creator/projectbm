
"use client";

import * as React from "react";
import { PlusCircle, MoreHorizontal, Trash2, Loader2, Pencil, Wrench, ArrowUp, ArrowDown, Check, X } from "lucide-react";
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
import type { Service } from "@/lib/definitions";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export default function ServicesPage() {
  const { toast } = useToast();
  const [services, setServices] = React.useState<Service[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [open, setOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);

  const [currentService, setCurrentService] = React.useState<Partial<Service>>({ priceType: 'fixed', allowDiscount: true });
  const [serviceToDelete, setServiceToDelete] = React.useState<Service | null>(null);

  const isEditing = !!currentService.id;

  const fetchData = React.useCallback(async () => {
    try {
      setLoading(true);
      const dataCollection = collection(db, "services");
      const q = query(dataCollection, orderBy("order"));
      const dataSnapshot = await getDocs(q);
      const itemsList = dataSnapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as Service)
      );

      // Migration for existing items
      const needsMigration = itemsList.some(item => typeof item.order !== 'number' || !item.priceType);
      if (needsMigration) {
        const batch = writeBatch(db);
        itemsList.forEach((item, index) => {
          const updateData: Partial<Service> = {};
          if(typeof item.order !== 'number') {
            updateData.order = index;
            item.order = index;
          }
          if(!item.priceType) {
             updateData.priceType = 'fixed';
             item.priceType = 'fixed';
          }
           if (Object.keys(updateData).length > 0) {
            const docRef = doc(db, "services", item.id);
            batch.update(docRef, updateData as any);
          }
        });
        await batch.commit();
      }

      itemsList.sort((a, b) => a.order - b.order);
      setServices(itemsList);
    } catch (error) {
      toast({
        title: "Erro ao buscar serviços",
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
  
  const handleOpenDialog = (service?: Service) => {
    setCurrentService(service || { price: 0, minPrice: 0, maxPrice: 0, priceType: 'fixed', allowDiscount: true });
    setOpen(true);
  };
  
  const handleCloseDialog = () => {
    setCurrentService({ price: 0, minPrice: 0, maxPrice: 0, priceType: 'fixed', allowDiscount: true });
    setOpen(false);
  };
  
  const handleCurrencyChange = (field: 'price' | 'minPrice' | 'maxPrice') => (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    setCurrentService(prev => ({...prev, [field]: Number(value) / 100 }));
  }

  const formatCurrencyForInput = (value?: number) => {
    if (value === undefined || value === null) return '';
    return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(value);
  }

  const formatCurrency = (value: number) => {
     return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  }
  
  const getPriceDisplay = (service: Service) => {
    if (service.priceType === 'range') {
        return `${formatCurrency(service.minPrice || 0)} - ${formatCurrency(service.maxPrice || 0)}`;
    }
    return formatCurrency(service.price || 0);
  };

  const handleSubmit = async () => {
    if (!currentService.name || currentService.name.trim() === "" || isSubmitting) return;

    if (currentService.priceType === 'range' && (currentService.minPrice || 0) > (currentService.maxPrice || 0)) {
        toast({ title: "Valores inválidos", description: "O preço mínimo não pode ser maior que o preço máximo.", variant: "destructive"});
        return;
    }

    setIsSubmitting(true);
    try {
      const dataToSave: Partial<Omit<Service, 'id' | 'order'>> = {
        name: currentService.name.trim(),
        priceType: currentService.priceType,
        allowDiscount: currentService.allowDiscount === undefined ? true : currentService.allowDiscount,
      };

      if (currentService.priceType === 'range') {
        dataToSave.minPrice = currentService.minPrice || 0;
        dataToSave.maxPrice = currentService.maxPrice || 0;
        dataToSave.price = 0; // Clear fixed price
      } else {
        dataToSave.price = currentService.price || 0;
        dataToSave.minPrice = 0; // Clear range prices
        dataToSave.maxPrice = 0;
      }

      if (isEditing) {
        const docRef = doc(db, "services", currentService.id!);
        await updateDoc(docRef, dataToSave as any);
        toast({ title: "Serviço Atualizado!" });
      } else {
        await addDoc(collection(db, "services"), { 
          ...dataToSave,
          order: services.length,
        });
        toast({ title: "Serviço Cadastrado!" });
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
    if (!serviceToDelete) return;
    try {
      await deleteDoc(doc(db, "services", serviceToDelete.id));
      toast({ title: "Serviço Deletado", variant: "destructive" });
      fetchData();
    } catch (error) {
      toast({ title: "Erro ao deletar", variant: "destructive" });
    } finally {
      setServiceToDelete(null);
    }
  };
  
  const saveOrder = async (itemsToSave: Service[]) => {
      setIsSaving(true);
      try {
          const batch = writeBatch(db);
          itemsToSave.forEach((item, index) => {
              const docRef = doc(db, "services", item.id);
              batch.update(docRef, { order: index });
          });
          await batch.commit();
          toast({ title: "Ordem Salva!" });
          setServices(itemsToSave);
      } catch (error) {
          toast({ title: "Erro ao salvar ordem", variant: "destructive" });
          fetchData(); 
      } finally {
          setIsSaving(false);
      }
  }

  const handleMove = (itemId: string, direction: "up" | "down") => {
    const items = [...services];
    const index = items.findIndex(i => i.id === itemId);
    if (index === -1) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= items.length) return;

    [items[index], items[newIndex]] = [items[newIndex], items[index]];

    const updatedItems = items.map((item, idx) => ({ ...item, order: idx }));

    setServices(updatedItems);
    saveOrder(updatedItems);
  };

  return (
    <>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold font-headline tracking-tight flex items-center gap-2">
              <Wrench /> Serviços
            </h1>
            <p className="text-muted-foreground">
              Gerencie os serviços e seus respectivos valores e condições.
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1" onClick={() => handleOpenDialog()}>
                <PlusCircle className="h-3.5 w-3.5" />
                <span>Novo Serviço</span>
              </Button>
            </DialogTrigger>
            <DialogContent onCloseAutoFocus={handleCloseDialog}>
              <DialogHeader>
                <DialogTitle>{isEditing ? 'Editar Serviço' : 'Cadastrar Novo Serviço'}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-6 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome do Serviço</Label>
                  <Input
                    id="name"
                    value={currentService.name || ""}
                    onChange={(e) => setCurrentService({...currentService, name: e.target.value})}
                    placeholder="Ex: Instalação de Ar Condicionado"
                    disabled={isSubmitting}
                  />
                </div>
                 <div className="space-y-2">
                    <Label>Tipo de Preço</Label>
                    <RadioGroup value={currentService.priceType} onValueChange={(v) => setCurrentService(p => ({...p, priceType: v as 'fixed' | 'range'}))} className="flex gap-4">
                      <div className="flex items-center space-x-2"><RadioGroupItem value="fixed" id="fixed" /><Label htmlFor="fixed">Valor Fixo</Label></div>
                      <div className="flex items-center space-x-2"><RadioGroupItem value="range" id="range" /><Label htmlFor="range">Faixa de Valor</Label></div>
                    </RadioGroup>
                 </div>

                 {currentService.priceType === 'range' ? (
                   <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="minPrice">Preço Mínimo (R$)</Label>
                        <Input id="minPrice" value={formatCurrencyForInput(currentService.minPrice)} onChange={handleCurrencyChange('minPrice')} placeholder="0,00" disabled={isSubmitting}/>
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="maxPrice">Preço Máximo (R$)</Label>
                        <Input id="maxPrice" value={formatCurrencyForInput(currentService.maxPrice)} onChange={handleCurrencyChange('maxPrice')} placeholder="0,00" disabled={isSubmitting}/>
                    </div>
                   </div>
                 ) : (
                    <div className="space-y-2">
                        <Label htmlFor="price">Preço (R$)</Label>
                        <Input id="price" value={formatCurrencyForInput(currentService.price)} onChange={handleCurrencyChange('price')} placeholder="0,00" disabled={isSubmitting}/>
                    </div>
                 )}

                 <div className="flex items-center space-x-2">
                  <Switch id="allowDiscount" checked={currentService.allowDiscount} onCheckedChange={(checked) => setCurrentService({...currentService, allowDiscount: checked})} disabled={isSubmitting}/>
                  <Label htmlFor="allowDiscount">Permitir Desconto</Label>
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
            <CardTitle>Lista de Serviços</CardTitle>
            <CardDescription>
              Total de {services.length} serviços cadastrados.
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
                    <TableHead>Preço</TableHead>
                    <TableHead>Desconto Permitido</TableHead>
                    <TableHead className="w-20 text-right">
                      <span className="sr-only">Ações</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {services.map((service, index) => (
                    <TableRow key={service.id}>
                       <TableCell>
                         <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleMove(service.id, 'up')} disabled={index === 0 || isSaving}>
                                <ArrowUp className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleMove(service.id, 'down')} disabled={index === services.length - 1 || isSaving}>
                                <ArrowDown className="h-4 w-4" />
                            </Button>
                         </div>
                      </TableCell>
                      <TableCell className="font-medium">{service.name}</TableCell>
                      <TableCell>{getPriceDisplay(service)}</TableCell>
                       <TableCell>
                        <Badge variant={service.allowDiscount ? "default" : "outline"} className="gap-1.5">
                            {service.allowDiscount ? <Check className="h-3 w-3"/> : <X className="h-3 w-3"/>}
                            {service.allowDiscount ? "Sim" : "Não"}
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
                            <DropdownMenuItem onClick={() => handleOpenDialog(service)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Editar
                            </DropdownMenuItem>
                            <AlertDialogTrigger asChild>
                              <DropdownMenuItem
                                className="text-red-600"
                                onSelect={(e) => {
                                  e.preventDefault();
                                  setServiceToDelete(service);
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
              {serviceToDelete && (
                <AlertDialogContent>
                    <AlertDialogHeader>
                    <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Essa ação não pode ser desfeita. Isso irá deletar permanentemente o serviço
                        <strong className="mx-1">{serviceToDelete.name}</strong>.
                    </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setServiceToDelete(null)}>Cancelar</AlertDialogCancel>
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
