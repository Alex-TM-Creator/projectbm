
"use client";

import * as React from "react";
import { PlusCircle, MoreHorizontal, Trash2, Loader2, Pencil, HardHat, Car, User, Percent, DollarSign, X, Link, Copy } from "lucide-react";
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
import type { Montador, User as UserType, ProductType, AssemblerSalesRange, AssemblerProductTypeCommission, AssemblerCommissionThreshold, AssemblerAutomaticDiscount } from "@/lib/definitions";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

const initialFormData: Partial<Montador> = {
    name: "",
    userId: null,
    isActive: true,
    salesRanges: [],
    productTypeCommissions: [],
    commissionThresholds: [],
    automaticDiscounts: [],
};

export default function MontadoresPage() {
  const { toast } = useToast();
  const [montadores, setMontadores] = React.useState<Montador[]>([]);
  const [users, setUsers] = React.useState<UserType[]>([]);
  const [productTypes, setProductTypes] = React.useState<ProductType[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [open, setOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const [currentMontador, setCurrentMontador] = React.useState<Partial<Montador>>(initialFormData);
  const [itemToDelete, setItemToDelete] = React.useState<Montador | null>(null);

  const isEditing = !!currentMontador.id;

  const fetchData = React.useCallback(async () => {
    try {
      setLoading(true);
      const [montadoresSnap, usersSnap, productTypesSnap] = await Promise.all([
        getDocs(query(collection(db, "montadores"), orderBy("name"))),
        getDocs(query(collection(db, "users"))),
        getDocs(query(collection(db, "productTypes"), orderBy("name"))),
      ]);
      setMontadores(montadoresSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Montador)));
      setUsers(usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserType)));
      setProductTypes(productTypesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProductType)));
    } catch (error) {
      toast({ title: "Erro ao buscar dados", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleOpenDialog = (montador?: Montador) => {
    const filteredProductTypes = productTypes.filter(pt => pt.name.toLowerCase().includes('novo') || pt.name.toLowerCase().includes('salvado'));

    if (montador) {
        const commissions = filteredProductTypes.map(pt => {
            const existing = montador.productTypeCommissions?.find(c => c.productTypeId === pt.id);
            return existing || { productTypeId: pt.id, productTypeName: pt.name, commissionPercentage: 0 };
        });
         const discounts = filteredProductTypes.map(pt => {
            const existing = montador.automaticDiscounts?.find(d => d.productTypeId === pt.id);
            return existing || { productTypeId: pt.id, productTypeName: pt.name, discountType: 'percentage' as const, discountValue: 0 };
        });
        setCurrentMontador({...JSON.parse(JSON.stringify(montador)), productTypeCommissions: commissions, automaticDiscounts: discounts });
    } else {
         const commissions = filteredProductTypes.map(pt => ({ productTypeId: pt.id, productTypeName: pt.name, commissionPercentage: 0 }));
         const discounts = filteredProductTypes.map(pt => ({ productTypeId: pt.id, productTypeName: pt.name, discountType: 'percentage' as const, discountValue: 0 }));
         setCurrentMontador({...initialFormData, productTypeCommissions: commissions, automaticDiscounts: discounts });
    }
    setOpen(true);
  };
  
  const handleDuplicate = (montador: Montador) => {
    const newMontador = JSON.parse(JSON.stringify(montador));
    delete newMontador.id; // Remove ID to create a new document
    newMontador.name = `${newMontador.name} (Cópia)`;
    handleOpenDialog(newMontador);
  };

  const handleCloseDialog = () => {
    setCurrentMontador(initialFormData);
    setOpen(false);
  };

  const handleUserSelection = (userId: string) => {
    const selectedUser = users.find(u => u.id === userId);
    setCurrentMontador(prev => ({
        ...prev,
        userId: userId === "none" ? null : userId,
        name: selectedUser ? selectedUser.name : (isEditing ? prev?.name : ""),
    }));
  };

  const handleRangeChange = (rangeId: string, field: keyof AssemblerSalesRange, value: any) => {
    setCurrentMontador(prev => ({
        ...prev,
        salesRanges: (prev?.salesRanges || []).map(range => 
            range.id === rangeId ? {...range, [field]: value } : range
        )
    }));
  };

  const handleAddRange = () => {
    const newRange: AssemblerSalesRange = { id: `range-${Date.now()}`, from: 0, to: 0, bonusType: 'fixed', bonusValue: 0 };
    setCurrentMontador(prev => ({...prev, salesRanges: [...(prev?.salesRanges || []), newRange]}));
  };
  
  const handleRemoveRange = (rangeId: string) => {
    setCurrentMontador(prev => ({...prev, salesRanges: (prev?.salesRanges || []).filter(r => r.id !== rangeId)}));
  };
  
  const handleCommissionThresholdChange = (thresholdId: string, field: keyof AssemblerCommissionThreshold, value: any) => {
    setCurrentMontador(prev => ({
        ...prev,
        commissionThresholds: (prev?.commissionThresholds || []).map(thresh => 
            thresh.id === thresholdId ? {...thresh, [field]: value } : thresh
        )
    }));
  };

  const handleAddCommissionThreshold = () => {
    const newThreshold: AssemblerCommissionThreshold = { id: `threshold-${Date.now()}`, from: 0, to: 0 };
    setCurrentMontador(prev => ({...prev, commissionThresholds: [...(prev?.commissionThresholds || []), newThreshold]}));
  };
  
  const handleRemoveCommissionThreshold = (thresholdId: string) => {
    setCurrentMontador(prev => ({...prev, commissionThresholds: (prev?.commissionThresholds || []).filter(t => t.id !== thresholdId)}));
  };

  const handleCommissionChange = (productTypeId: string, value: number) => {
    setCurrentMontador(prev => {
        const newCommissions = [...(prev?.productTypeCommissions || [])];
        const index = newCommissions.findIndex(c => c.productTypeId === productTypeId);
        if (index > -1) {
            newCommissions[index].commissionPercentage = value;
        } else {
            const pt = productTypes.find(p => p.id === productTypeId);
            if (pt) {
                newCommissions.push({ productTypeId: pt.id, productTypeName: pt.name, commissionPercentage: value });
            }
        }
        return {...prev, productTypeCommissions: newCommissions};
    });
  };

  const handleAutomaticDiscountChange = (productTypeId: string, field: 'discountType' | 'discountValue', value: any) => {
    setCurrentMontador(prev => {
        if (!prev) return prev;
        const newDiscounts = (prev.automaticDiscounts || []).map(ad => {
            if (ad.productTypeId === productTypeId) {
                return { ...ad, [field]: value };
            }
            return ad;
        });
        return { ...prev, automaticDiscounts: newDiscounts };
    });
  };
  
  const formatCurrencyForInput = (value?: number) => {
    if (value === undefined || value === null) return '';
    return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(value);
  };

  const handleCurrencyInputChange = (setter: (value: number) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
      const rawValue = e.target.value.replace(/\D/g, '');
      setter(rawValue ? parseInt(rawValue, 10) / 100 : 0);
  };
  
  const formatPercentageForInput = (value: number | undefined) => {
    if (value === undefined || value === null || isNaN(value)) return '';
    return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };
  
  const handlePercentageInputChange = (setter: (value: number) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
      let rawValue = e.target.value.replace(/[^0-9]/g, '');
      setter(rawValue ? parseFloat(rawValue) / 100 : 0);
  };


  const handleSubmit = async () => {
    if (!currentMontador?.name || currentMontador.name.trim() === "") {
        toast({ title: "Nome é obrigatório", variant: "destructive" });
        return;
    }
    setIsSubmitting(true);
    try {
      const dataToSave = {
        name: currentMontador.name,
        userId: currentMontador.userId || null,
        isActive: currentMontador.isActive === undefined ? true : currentMontador.isActive,
        salesRanges: currentMontador.salesRanges || [],
        productTypeCommissions: currentMontador.productTypeCommissions || [],
        commissionThresholds: currentMontador.commissionThresholds || [],
        automaticDiscounts: currentMontador.automaticDiscounts || [],
      };

      if (isEditing) {
        const docRef = doc(db, "montadores", currentMontador.id!);
        await updateDoc(docRef, dataToSave);
        toast({ title: "Montador Atualizado!" });
      } else {
        await addDoc(collection(db, "montadores"), { ...dataToSave, createdAt: serverTimestamp() });
        toast({ title: "Montador Cadastrado!" });
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
      await deleteDoc(doc(db, "montadores", itemToDelete.id));
      toast({ title: "Montador Deletado", variant: "destructive" });
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
              <HardHat /> Montadores
            </h1>
            <p className="text-muted-foreground">Gerencie os montadores e suas regras de premiação.</p>
          </div>
          <Button size="sm" className="gap-1" onClick={() => handleOpenDialog()}>
            <PlusCircle className="h-3.5 w-3.5" />
            <span>Novo Montador</span>
          </Button>
        </div>

        <AlertDialog>
        <Card>
          <CardHeader>
            <CardTitle>Montadores Cadastrados</CardTitle>
            <CardDescription>Total de {montadores.length} montadores cadastrados.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center p-8"><Loader2 className="mx-auto h-8 w-8 animate-spin" /></div>
            ) : (
              <Table>
                <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Usuário Vinculado</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
                <TableBody>
                  {montadores.map((montador) => (
                    <TableRow key={montador.id} className={!montador.isActive ? "text-muted-foreground" : ""}>
                      <TableCell className="font-medium">{montador.name}</TableCell>
                      <TableCell>
                        {montador.userId ? <Badge variant="outline" className="gap-1.5"><Link className="h-3 w-3" />{users.find(u => u.id === montador.userId)?.name}</Badge> : 'Nenhum'}
                      </TableCell>
                      <TableCell><Badge variant={montador.isActive ? 'default' : 'outline'}>{montador.isActive ? 'Ativo' : 'Inativo'}</Badge></TableCell>
                      <TableCell className="text-right">
                         <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button aria-haspopup="true" size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Ações</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => handleOpenDialog(montador)}><Pencil className="mr-2 h-4 w-4" />Editar</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDuplicate(montador)}><Copy className="mr-2 h-4 w-4" />Duplicar</DropdownMenuItem>
                            <AlertDialogTrigger asChild>
                              <DropdownMenuItem className="text-destructive" onSelect={(e) => { e.preventDefault(); setItemToDelete(montador);}}><Trash2 className="mr-2 h-4 w-4" />Deletar</DropdownMenuItem>
                            </AlertDialogTrigger>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
        {itemToDelete && (
          <AlertDialogContent>
              <AlertDialogHeader><AlertDialogTitle>Você tem certeza?</AlertDialogTitle><AlertDialogDescription>Esta ação é irreversível e excluirá o montador <strong className="mx-1">{itemToDelete.name}</strong>.</AlertDialogDescription></AlertDialogHeader>
              <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => setItemToDelete(null)}>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete}>Sim, excluir</AlertDialogAction>
              </AlertDialogFooter>
          </AlertDialogContent>
        )}
        </AlertDialog>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl" onCloseAutoFocus={handleCloseDialog}>
          <DialogHeader><DialogTitle>{isEditing ? 'Editar Montador' : 'Novo Montador'}</DialogTitle></DialogHeader>
          <div className="py-4 grid gap-6 max-h-[70vh] overflow-y-auto pr-4">
            <div className="space-y-2">
                <Label htmlFor="name">Nome do Montador</Label>
                <Input id="name" value={currentMontador?.name || ''} onChange={e => setCurrentMontador(p => ({ ...p!, name: e.target.value }))} disabled={isSubmitting}/>
            </div>
            <div className="space-y-2">
              <Label>Vincular ao Usuário (Opcional)</Label>
              <Select value={currentMontador?.userId || 'none'} onValueChange={handleUserSelection}>
                  <SelectTrigger><SelectValue placeholder="Selecione..."/></SelectTrigger>
                  <SelectContent><SelectItem value="none">Nenhum</SelectItem>{users.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-2 pt-2"><Switch id="isActive" checked={currentMontador?.isActive} onCheckedChange={(c) => setCurrentMontador(p => ({...p!, isActive: c}))} /><Label htmlFor="isActive">Ativo</Label></div>

            <Card>
              <CardHeader><CardTitle className="text-lg">Premiação por Faixa de Venda</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {(currentMontador?.commissionThresholds || []).map((thresh, index) => (
                   <div key={thresh.id} className="grid grid-cols-12 items-end gap-2 p-3 rounded-md bg-muted/50">
                      <div className="col-span-5 space-y-1">
                          <Label htmlFor={`thresh-from-${index}`}>De (R$)</Label>
                          <Input id={`thresh-from-${index}`} type="text" value={formatCurrencyForInput(thresh.from)} onChange={handleCurrencyInputChange(value => handleCommissionThresholdChange(thresh.id, 'from', value))}/>
                      </div>
                      <div className="col-span-5 space-y-1">
                          <Label htmlFor={`thresh-to-${index}`}>Até (R$)</Label>
                          <Input id={`thresh-to-${index}`} type="text" value={formatCurrencyForInput(thresh.to)} onChange={handleCurrencyInputChange(value => handleCommissionThresholdChange(thresh.id, 'to', value))}/>
                      </div>
                      <div className="col-span-2 flex justify-end"><Button variant="ghost" size="icon" onClick={() => handleRemoveCommissionThreshold(thresh.id)}><X className="h-4 w-4"/></Button></div>
                   </div>
                ))}
                <Button variant="outline" size="sm" onClick={handleAddCommissionThreshold}><PlusCircle className="h-4 w-4 mr-2"/>Adicionar Faixa de Premiação</Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-lg">Premiação por Tipo de Produto</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                  {(currentMontador?.productTypeCommissions || []).map(ptc => (
                      <div key={ptc.productTypeId} className="grid grid-cols-3 items-center gap-4">
                          <Label htmlFor={`comm-${ptc.productTypeId}`} className="text-right">{ptc.productTypeName}</Label>
                          <div className="relative col-span-2">
                            <Input 
                                id={`comm-${ptc.productTypeId}`} 
                                type="text"
                                value={formatPercentageForInput(ptc.commissionPercentage)}
                                onChange={handlePercentageInputChange(value => handleCommissionChange(ptc.productTypeId, value))}
                                placeholder="0,00"
                                className="pl-2 pr-8 text-right"
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
                          </div>
                      </div>
                  ))}
              </CardContent>
            </Card>

             <Card>
              <CardHeader><CardTitle className="text-lg">Descontos Automáticos por Tipo</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {(currentMontador?.automaticDiscounts || []).map(ad => (
                  <div key={ad.productTypeId} className="grid grid-cols-3 items-center gap-4">
                    <Label htmlFor={`ad-type-${ad.productTypeId}`} className="text-right">{ad.productTypeName}</Label>
                    <div className="col-span-2 flex items-center gap-2">
                      <Input
                        id={`ad-value-${ad.productTypeId}`}
                        type="text"
                        value={ad.discountType === 'percentage' ? formatPercentageForInput(ad.discountValue) : formatCurrencyForInput(ad.discountValue)}
                        onChange={handleCurrencyInputChange(value => handleAutomaticDiscountChange(ad.productTypeId, 'discountValue', value))}
                        className="flex-1"
                      />
                      <Select value={ad.discountType} onValueChange={(v) => handleAutomaticDiscountChange(ad.productTypeId, 'discountType', v as any)}>
                        <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="percentage">%</SelectItem>
                          <SelectItem value="fixed">R$</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

             <Card>
              <CardHeader><CardTitle className="text-lg">Metas por Faixa de Valor (Bônus)</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {(currentMontador?.salesRanges || []).map((range, index) => (
                   <div key={range.id} className="grid grid-cols-12 items-end gap-2 p-3 rounded-md bg-muted/50">
                      <div className="col-span-3 space-y-1">
                          <Label htmlFor={`range-from-${index}`}>De (R$)</Label>
                          <Input id={`range-from-${index}`} type="text" value={formatCurrencyForInput(range.from)} onChange={handleCurrencyInputChange(value => handleRangeChange(range.id, 'from', value))}/>
                      </div>
                      <div className="col-span-3 space-y-1">
                          <Label htmlFor={`range-to-${index}`}>Até (R$)</Label>
                          <Input id={`range-to-${index}`} type="text" value={formatCurrencyForInput(range.to)} onChange={handleCurrencyInputChange(value => handleRangeChange(range.id, 'to', value))}/>
                      </div>
                      <div className="col-span-2 space-y-1">
                          <Label>Tipo</Label>
                          <Select value={range.bonusType} onValueChange={(v) => handleRangeChange(range.id, 'bonusType', v)}>
                            <SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="fixed">R$</SelectItem><SelectItem value="percentage">%</SelectItem></SelectContent>
                          </Select>
                      </div>
                      <div className="col-span-3 space-y-1">
                          <Label>Bônus</Label>
                           <Input type="text" value={formatCurrencyForInput(range.bonusValue)} onChange={handleCurrencyInputChange(value => handleRangeChange(range.id, 'bonusValue', value))}/>
                      </div>
                      <div className="col-span-1"><Button variant="ghost" size="icon" onClick={() => handleRemoveRange(range.id)}><X className="h-4 w-4"/></Button></div>
                   </div>
                ))}
                <Button variant="outline" size="sm" onClick={handleAddRange}><PlusCircle className="h-4 w-4 mr-2"/>Adicionar Faixa de Bônus</Button>
              </CardContent>
            </Card>
          </div>
          <DialogFooter><Button variant="outline" onClick={handleCloseDialog}>Cancelar</Button><Button onClick={handleSubmit}>{isSubmitting ? <Loader2 className="animate-spin" /> : "Salvar"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
