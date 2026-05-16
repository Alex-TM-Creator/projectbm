"use client";

import * as React from "react";
import {
  Loader2,
  Calendar,
  Save,
  BadgeCheck,
  History,
  PlusCircle,
  QrCode,
  Pencil,
  Trash2,
  MoreHorizontal
} from "lucide-react";
import {
  collection,
  getDocs,
  query,
  orderBy,
  addDoc,
  serverTimestamp,
  doc,
  getDoc,
  limit,
  setDoc,
  updateDoc,
  deleteDoc
} from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { useAuthState } from "react-firebase-hooks/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { User, Lot } from "@/lib/definitions";
import { format } from "date-fns";

export default function LotsPage() {
  const { toast } = useToast();
  const [user, authLoading] = useAuthState(auth);
  const [userData, setUserData] = React.useState<User | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const [lots, setLots] = React.useState<Lot[]>([]);
  
  const [lotNumber, setLotNumber] = React.useState("");
  const [lotType, setLotType] = React.useState<'compra' | 'ajuste'>('compra');
  const [registrationDate, setRegistrationDate] = React.useState(format(new Date(), 'yyyy-MM-dd'));
  const [lotValue, setLotValue] = React.useState<string>("");
  const [lotValueRaw, setLotValueRaw] = React.useState<number | null>(null);

  const [editingLot, setEditingLot] = React.useState<Lot | null>(null);
  const [editLotNumber, setEditLotNumber] = React.useState("");
  const [editLotType, setEditLotType] = React.useState<'compra' | 'ajuste'>('compra');
  const [editRegistrationDate, setEditRegistrationDate] = React.useState("");
  const [editLotValue, setEditLotValue] = React.useState<string>("");
  const [editLotValueRaw, setEditLotValueRaw] = React.useState<number | null>(null);

  const [lotToDelete, setLotToDelete] = React.useState<Lot | null>(null);

  const formatCurrencyInput = (raw: string): string => {
    const digits = raw.replace(/\D/g, '');
    if (!digits) return '';
    const number = parseInt(digits, 10) / 100;
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(number);
  };

  const handleLotValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '');
    setLotValue(formatCurrencyInput(e.target.value));
    setLotValueRaw(digits ? parseInt(digits, 10) / 100 : null);
  };

  const fetchData = React.useCallback(async (uid?: string) => {
    try {
      setLoading(true);
      const lotsSnap = await getDocs(query(collection(db, "lots"), orderBy("createdAt", "desc"), limit(100)));
      setLots(lotsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Lot)));

      if (uid) {
        const userSnap = await getDoc(doc(db, "users", uid));
        if (userSnap.exists()) setUserData(userSnap.data() as User);
      }
    } catch (error) {
      console.error(error);
      toast({ title: "Erro ao carregar dados", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    if (user?.uid) fetchData(user.uid);
    else if (!authLoading) setLoading(false);
  }, [fetchData, user, authLoading]);

  const handleCreateLot = async () => {
    if (!lotNumber || !registrationDate) {
      toast({ title: "Dados incompletos", description: "O número do lote e a data são obrigatórios.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const newLotRef = doc(collection(db, "lots"));
      const lotData: Omit<Lot, "id"> = {
        lotNumber: lotNumber.toUpperCase(),
        registrationDate: registrationDate,
        type: lotType,
        lotValue: lotValueRaw !== null ? lotValueRaw : undefined,
        createdAt: serverTimestamp(),
        createdById: user?.uid || "",
        createdByName: userData?.name || "N/A"
      };

      await setDoc(newLotRef, lotData);
      toast({ title: "Lote registrado!", description: `Lote ${lotNumber.toUpperCase()} salvo com sucesso.` });
      
      setLotNumber("");
      setLotValue("");
      setLotValueRaw("");
      fetchData(user?.uid);
    } catch (e) {
      console.error(e);
      toast({ title: "Erro ao salvar", variant: "destructive" });
    } finally { setIsSubmitting(false); }
  };

  const handleStartEdit = (lot: Lot) => {
    setEditingLot(lot);
    setEditLotNumber(lot.lotNumber);
    setEditLotType(lot.type);
    setEditRegistrationDate(lot.registrationDate);
    if (lot.lotValue !== undefined) {
      const formatted = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(lot.lotValue);
      setEditLotValue(formatted);
      setEditLotValueRaw(lot.lotValue);
    } else {
      setEditLotValue("");
      setEditLotValueRaw(null);
    }
  };

  const handleEditLotValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '');
    setEditLotValue(formatCurrencyInput(e.target.value));
    setEditLotValueRaw(digits ? parseInt(digits, 10) / 100 : null);
  };

  const handleUpdateLot = async () => {
    if (!editingLot || !editLotNumber || !editRegistrationDate) return;

    setIsSubmitting(true);
    try {
      const lotRef = doc(db, "lots", editingLot.id);
      await updateDoc(lotRef, {
        lotNumber: editLotNumber.toUpperCase(),
        registrationDate: editRegistrationDate,
        type: editLotType,
        lotValue: editLotValueRaw !== null ? editLotValueRaw : undefined,
      });
      toast({ title: "Lote atualizado!", description: "As informações foram salvas com sucesso." });
      setEditingLot(null);
      fetchData(user?.uid);
    } catch (e) {
      console.error(e);
      toast({ title: "Erro ao atualizar lote", variant: "destructive" });
    } finally { setIsSubmitting(false); }
  };

  const handleDeleteLot = async () => {
    if (!lotToDelete) return;

    setIsSubmitting(true);
    try {
      await deleteDoc(doc(db, "lots", lotToDelete.id));
      toast({ title: "Lote excluído!", description: "O registro foi removido permanentemente." });
      setLotToDelete(null);
      fetchData(user?.uid);
    } catch (e) {
      console.error(e);
      toast({ title: "Erro ao excluir lote", variant: "destructive" });
    } finally { setIsSubmitting(false); }
  };

  if (loading || authLoading) return <div className="flex justify-center items-center h-96"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <CardTitle className="text-3xl font-bold font-headline flex items-center gap-3">
            <BadgeCheck className="text-primary" />
            Lotes
          </CardTitle>
          <CardDescription className="text-lg">Cadastro de IDS de Lotes para Compras e Ajustes.</CardDescription>
        </div>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2 mb-6">
          <TabsTrigger value="overview" className="gap-2"> <History className="h-4 w-4"/> Histórico </TabsTrigger>
          <TabsTrigger value="new" className="gap-2"> <PlusCircle className="h-4 w-4"/> Novo Lote </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card className="border-none shadow-md bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm">
             <CardHeader className="border-b border-zinc-100 dark:border-zinc-800">
                <CardTitle className="text-xl flex items-center gap-2"> <History className="h-5 w-5 text-primary" /> Histórico de Lotes </CardTitle>
             </CardHeader>
             <CardContent className="p-0">
                <ScrollArea className="h-[600px]">
                    <div className="p-4 space-y-3">
                        {lots.length === 0 ? <div className="text-center py-20 text-muted-foreground italic">Nenhum lote registrado.</div> : (
                            <div className="grid grid-cols-1 gap-2">
                                {lots.map(l => (
                                    <div key={l.id} className="p-4 rounded-xl border bg-card flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:shadow-sm transition-all">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <Badge className="text-[10px] uppercase font-bold">{l.type}</Badge>
                                                <span className="text-xs text-muted-foreground italic">Registrado em {l.registrationDate ? format(new Date(l.registrationDate + 'T12:00:00'), 'dd/MM/yyyy') : 'N/A'}</span>
                                            </div>
                                            <h3 className="text-xl font-black text-primary tracking-tight">#{l.lotNumber}</h3>
                                        </div>
                                        <div className="flex flex-col items-end text-right">
                                            {l.lotValue !== undefined && (
                                              <span className="text-sm font-bold text-primary">
                                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(l.lotValue)}
                                              </span>
                                            )}
                                            <span className="text-[10px] opacity-40">Responsável: {l.createdByName}</span>
                                            <span className="text-[10px] opacity-30 italic">Lançado em: {l.createdAt?.seconds ? format(new Date(l.createdAt.seconds * 1000), 'dd/MM/yyyy HH:mm') : '...'}</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={() => handleStartEdit(l)} className="gap-2">
                                                        <Pencil className="h-4 w-4" /> Editar
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem onClick={() => setLotToDelete(l)} className="gap-2 text-destructive">
                                                        <Trash2 className="h-4 w-4" /> Excluir
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </ScrollArea>
             </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="new" className="flex justify-center">
            <Card className="shadow-premium border-none bg-white/50 dark:bg-zinc-900/50 backdrop-blur-md w-full max-w-xl">
                <CardHeader className="bg-primary/5 border-b border-primary/10 text-center">
                    <CardTitle className="text-xl flex items-center justify-center gap-2"> <QrCode className="h-5 w-5 text-primary" /> Dados do Lote </CardTitle>
                    <CardDescription>Cadastre apenas as informações essenciais do lote.</CardDescription>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                    <div className="space-y-2">
                        <Label className="text-sm font-semibold">Tipo do Lote</Label>
                        <Select value={lotType} onValueChange={(v:any) => setLotType(v)}>
                            <SelectTrigger className="h-12"><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="compra">Lote de Compra</SelectItem><SelectItem value="ajuste">Lote de Ajuste</SelectItem></SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label className="text-sm font-semibold">Número do Lote (Batch ID)</Label>
                        <Input placeholder="Digite o ID do lote..." className="h-12 text-lg font-bold" value={lotNumber} onChange={e => setLotNumber(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-sm font-semibold flex items-center gap-2"><Calendar className="h-4 w-4 text-primary"/> Data de Cadastro do Lote</Label>
                        <Input type="date" className="h-12" value={registrationDate} onChange={e => setRegistrationDate(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-sm font-semibold">Valor do Lote <span className="text-muted-foreground font-normal">(opcional)</span></Label>
                        <Input
                          placeholder="R$ 0,00"
                          className="h-12 text-lg font-semibold"
                          value={lotValue}
                          onChange={handleLotValueChange}
                          inputMode="numeric"
                        />
                    </div>
                </CardContent>
                <CardFooter>
                    <Button className="w-full h-14 font-bold text-lg rounded-xl gap-2 shadow-lg shadow-primary/20" onClick={handleCreateLot} disabled={isSubmitting || !lotNumber}>
                        {isSubmitting ? <Loader2 className="animate-spin" /> : <Save className="h-5 w-5" />}
                        REGISTRAR LOTE
                    </Button>
                </CardFooter>
            </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={!!editingLot} onOpenChange={(open) => !open && setEditingLot(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Lote</DialogTitle>
            <DialogDescription>Atualize as informações do lote #{editingLot?.lotNumber}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
              <div className="space-y-2">
                  <Label className="text-sm font-semibold">Tipo do Lote</Label>
                  <Select value={editLotType} onValueChange={(v:any) => setEditLotType(v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="compra">Lote de Compra</SelectItem><SelectItem value="ajuste">Lote de Ajuste</SelectItem></SelectContent>
                  </Select>
              </div>
              <div className="space-y-2">
                  <Label className="text-sm font-semibold">Número do Lote</Label>
                  <Input value={editLotNumber} onChange={e => setEditLotNumber(e.target.value)} />
              </div>
              <div className="space-y-2">
                  <Label className="text-sm font-semibold">Data de Cadastro</Label>
                  <Input type="date" value={editRegistrationDate} onChange={e => setEditRegistrationDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                  <Label className="text-sm font-semibold">Valor do Lote</Label>
                  <Input
                    placeholder="R$ 0,00"
                    value={editLotValue}
                    onChange={handleEditLotValueChange}
                    inputMode="numeric"
                  />
              </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingLot(null)}>Cancelar</Button>
            <Button onClick={handleUpdateLot} disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Salvar Alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!lotToDelete} onOpenChange={(open) => !open && setLotToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Lote?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o lote <strong>#{lotToDelete?.lotNumber}</strong>? 
              Esta ação não pode ser desfeita e pode afetar relatórios que dependem deste ID de lote.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteLot} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
                Sim, Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
