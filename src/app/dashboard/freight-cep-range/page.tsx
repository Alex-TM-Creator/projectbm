
"use client";

import * as React from "react";
import { PlusCircle, MoreHorizontal, Trash2, Loader2, Pencil, Map } from "lucide-react";
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
import type { FreightCepRange } from "@/lib/definitions";

export default function FreightCepRangePage() {
  const { toast } = useToast();
  const [ranges, setRanges] = React.useState<FreightCepRange[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [open, setOpen] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const [currentRange, setCurrentRange] = React.useState<Partial<FreightCepRange>>({ name: "", cepStart: "", cepEnd: "", value: 0 });
  const [itemToDelete, setItemToDelete] = React.useState<FreightCepRange | null>(null);

  const isEditing = !!currentRange.id;

  const fetchData = React.useCallback(async () => {
    try {
      setLoading(true);
      const dataCollection = collection(db, "freightCepRanges");
      const q = query(dataCollection, orderBy("name"));
      const dataSnapshot = await getDocs(q);
      setRanges(dataSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FreightCepRange)));
    } catch (error) {
      toast({
        title: "Erro ao buscar faixas de CEP",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const formatCurrencyForInput = (value?: number) => {
    if (value === undefined || value === null) return '';
    return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(value);
  }

  const handleCurrencyChange = (setter: (value: number) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, '');
    const numericValue = rawValue ? parseInt(rawValue, 10) / 100 : 0;
    setter(numericValue);
  };
  
  const formatCep = (cep: string = "") => {
    return cep.replace(/\D/g, '')
               .replace(/(\d{5})(\d)/, '$1-$2')
               .slice(0, 9);
  }

  const handleOpenDialog = (range?: FreightCepRange) => {
    setCurrentRange(range || { name: "", cepStart: "", cepEnd: "", value: 0 });
    setOpen(true);
  };
  
  const handleCloseDialog = () => {
    setCurrentRange({});
    setOpen(false);
  };

  const handleSubmit = async () => {
    if (!currentRange.name || !currentRange.cepStart || !currentRange.cepEnd) {
      toast({ title: "Campos obrigatórios", variant: "destructive" });
      return;
    }
    
    setIsSubmitting(true);
    try {
      const dataToSave = {
        name: currentRange.name.trim(),
        cepStart: currentRange.cepStart.replace(/\D/g, ''),
        cepEnd: currentRange.cepEnd.replace(/\D/g, ''),
        value: currentRange.value || 0,
      };

      if (isEditing) {
        const docRef = doc(db, "freightCepRanges", currentRange.id!);
        await updateDoc(docRef, dataToSave);
        toast({ title: "Faixa de CEP atualizada!" });
      } else {
        await addDoc(collection(db, "freightCepRanges"), dataToSave);
        toast({ title: "Faixa de CEP cadastrada!" });
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
      await deleteDoc(doc(db, "freightCepRanges", itemToDelete.id));
      toast({ title: "Faixa de CEP deletada", variant: "destructive" });
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
              <Map /> Frete por Faixa de CEP
            </h1>
            <p className="text-muted-foreground">
              Gerencie os valores de frete para diferentes regiões.
            </p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1" onClick={() => handleOpenDialog()}>
                <PlusCircle className="h-3.5 w-3.5" />
                <span>Nova Faixa</span>
              </Button>
            </DialogTrigger>
            <DialogContent onCloseAutoFocus={handleCloseDialog}>
              <DialogHeader>
                <DialogTitle>{isEditing ? 'Editar Faixa de CEP' : 'Nova Faixa de CEP'}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome da Regra/Região</Label>
                  <Input
                    id="name"
                    value={currentRange.name || ""}
                    onChange={(e) => setCurrentRange({...currentRange, name: e.target.value})}
                    placeholder="Ex: São Paulo - Capital"
                    disabled={isSubmitting}
                  />
                </div>
                 <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-2">
                      <Label htmlFor="cepStart">CEP Inicial</Label>
                      <Input
                        id="cepStart"
                        value={formatCep(currentRange.cepStart)}
                        onChange={(e) => setCurrentRange({...currentRange, cepStart: e.target.value})}
                        placeholder="00000-000"
                        maxLength={9}
                        disabled={isSubmitting}
                      />
                    </div>
                     <div className="space-y-2">
                      <Label htmlFor="cepEnd">CEP Final</Label>
                      <Input
                        id="cepEnd"
                        value={formatCep(currentRange.cepEnd)}
                        onChange={(e) => setCurrentRange({...currentRange, cepEnd: e.target.value})}
                        placeholder="00000-000"
                        maxLength={9}
                        disabled={isSubmitting}
                      />
                    </div>
                 </div>
                <div className="space-y-2">
                  <Label htmlFor="value">Valor do Frete (R$)</Label>
                  <Input
                    id="value"
                    value={formatCurrencyForInput(currentRange.value)}
                    onChange={handleCurrencyChange(value => setCurrentRange(p => ({...p, value })))}
                    placeholder="0,00"
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
            <CardTitle>Faixas de CEP Cadastradas</CardTitle>
            <CardDescription>
              Total de {ranges.length} faixas cadastradas.
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
                    <TableHead>CEP Inicial</TableHead>
                    <TableHead>CEP Final</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ranges.map((range) => (
                    <TableRow key={range.id}>
                      <TableCell className="font-medium">{range.name}</TableCell>
                      <TableCell>{formatCep(range.cepStart)}</TableCell>
                      <TableCell>{formatCep(range.cepEnd)}</TableCell>
                      <TableCell className="text-right font-semibold">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(range.value)}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button aria-haspopup="true" size="icon" variant="ghost">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Ações</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => handleOpenDialog(range)}>
                              <Pencil className="mr-2 h-4 w-4" />Editar
                            </DropdownMenuItem>
                            <AlertDialogTrigger asChild>
                              <DropdownMenuItem className="text-red-600" onSelect={(e) => { e.preventDefault(); setItemToDelete(range);}}>
                                <Trash2 className="mr-2 h-4 w-4" />Deletar
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
                        Esta ação não pode ser desfeita e irá excluir a regra <strong className="mx-1">{itemToDelete.name}</strong>.
                    </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setItemToDelete(null)}>Cancelar</AlertDialogCancel>
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
