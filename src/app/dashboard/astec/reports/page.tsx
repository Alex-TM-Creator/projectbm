
"use client";

import * as React from "react";
import {
  FileText,
  Frown,
  PlusCircle,
  MoreHorizontal,
  Trash2,
  Pencil,
  Loader2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Search,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { db, auth } from "@/lib/firebase";
import { useAuthState } from "react-firebase-hooks/auth";
import {
  collection,
  query,
  orderBy,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  where,
  getDoc,
} from "firebase/firestore";
import type { AstecLaudo, AssistanceRequest, User } from "@/lib/definitions";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const statusConfig: Record<AstecLaudo['status'], { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    'Pendente': { label: 'Pendente', variant: 'secondary' },
    'Aprovado': { label: 'Aprovado', variant: 'default' },
    'Reprovado': { label: 'Reprovado', variant: 'destructive' },
};


export default function AstecReportsPage() {
  const { toast } = useToast();
  const [user, authLoading] = useAuthState(auth);
  const [userData, setUserData] = React.useState<User | null>(null);

  const [laudos, setLaudos] = React.useState<AstecLaudo[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Modal State
  const [open, setOpen] = React.useState(false);
  const [currentLaudo, setCurrentLaudo] = React.useState<Partial<AstecLaudo>>({});
  const [isEditing, setIsEditing] = React.useState(false);
  const [laudoToDelete, setLaudoToDelete] = React.useState<AstecLaudo | null>(null);

  // Assistance Request Search
  const [astecSearch, setAstecSearch] = React.useState("");
  const [foundAstecs, setFoundAstecs] = React.useState<AssistanceRequest[]>([]);
  const [selectedAstec, setSelectedAstec] = React.useState<AssistanceRequest | null>(null);

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [laudosSnap, userSnap] = await Promise.all([
          getDocs(query(collection(db, "astecLaudos"), orderBy("createdAt", "desc"))),
          user ? getDoc(doc(db, "users", user.uid)) : null,
        ]);
        setLaudos(laudosSnap.docs.map((d: any) => ({ id: d.id, ...d.data() } as AstecLaudo)));
        if (userSnap && userSnap.exists()) {
          setUserData(userSnap.data() as User);
        }
      } catch (error) {
        toast({ title: "Erro ao carregar dados", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    if (!authLoading) {
      fetchData();
    }
  }, [toast, authLoading, user]);

  React.useEffect(() => {
    const searchAstec = async () => {
      if (astecSearch.length < 3) {
        setFoundAstecs([]);
        return;
      }
      try {
        const numberSearch = /^\d+$/.test(astecSearch);
        let q;
        if (numberSearch) {
          q = query(collection(db, "astec"), where("orderNumber", "==", Number(astecSearch)));
        } else {
          const searchTermLower = astecSearch.toLowerCase();
          const searchTermUpper = searchTermLower + '\uf8ff';
          q = query(collection(db, "astec"), where("customerName", ">=", searchTermLower), where("customerName", "<=", searchTermUpper));
        }
        const astecSnap = await getDocs(q);
        setFoundAstecs(astecSnap.docs.map(d => ({ id: d.id, ...d.data() } as AssistanceRequest)));
      } catch (error) {
        console.error("Error searching assistance requests:", error);
      }
    };
    const debounce = setTimeout(searchAstec, 300);
    return () => clearTimeout(debounce);
  }, [astecSearch]);

  const handleSelectAstec = (astec: AssistanceRequest) => {
    setSelectedAstec(astec);
    setAstecSearch("");
    setFoundAstecs([]);
    setCurrentLaudo(prev => ({
      ...prev,
      astecId: astec.id,
      orderNumber: astec.orderNumber,
      customerName: astec.customerName,
      problemReported: astec.problemDescription,
    }));
  };

  const handleOpenDialog = (laudo?: AstecLaudo) => {
    if (laudo) {
      setIsEditing(true);
      setCurrentLaudo(JSON.parse(JSON.stringify(laudo)));
    } else {
      setIsEditing(false);
      setCurrentLaudo({ status: 'Pendente' });
      setSelectedAstec(null);
    }
    setOpen(true);
  };
  
  const handleCloseDialog = () => {
    setOpen(false);
    setCurrentLaudo({});
    setSelectedAstec(null);
  };
  
  const handleSubmit = async () => {
    if (!currentLaudo.astecId || !currentLaudo.technicalAnalysis || !currentLaudo.solution || !currentLaudo.productName) {
        toast({ title: "Campos obrigatórios", description: "Vincule um chamado, selecione um produto, e preencha a análise e solução.", variant: "destructive" });
        return;
    }
    if (!user || !userData) return;
    setIsSubmitting(true);
    try {
        if(isEditing) {
            const docRef = doc(db, "astecLaudos", currentLaudo.id!);
            await updateDoc(docRef, { ...currentLaudo });
            toast({ title: "Laudo Atualizado!"});
        } else {
            await addDoc(collection(db, "astecLaudos"), {
                ...currentLaudo,
                createdByUserId: user.uid,
                createdByUserName: userData.name,
                createdAt: serverTimestamp(),
            });
            toast({ title: "Laudo Criado com Sucesso!"});
        }
        handleCloseDialog();
        const laudosSnap = await getDocs(query(collection(db, "astecLaudos"), orderBy("createdAt", "desc")));
        setLaudos(laudosSnap.docs.map(d => ({ id: d.id, ...d.data() } as AstecLaudo)));
    } catch (error) {
        toast({ title: "Erro ao salvar", variant: "destructive" });
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!laudoToDelete) return;
    try {
        await deleteDoc(doc(db, "astecLaudos", laudoToDelete.id));
        toast({ title: "Laudo excluído", variant: "destructive" });
        setLaudos(laudos.filter(l => l.id !== laudoToDelete.id));
    } catch (error) {
        toast({ title: "Erro ao excluir", variant: "destructive"});
    } finally {
        setLaudoToDelete(null);
    }
  }

  const formatDate = (timestamp: any) => {
    if (!timestamp?.toDate) return "N/A";
    return format(timestamp.toDate(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-headline tracking-tight flex items-center gap-2">
            <FileText /> Laudos Técnicos ASTEC
          </h1>
          <p className="text-muted-foreground">
            Crie, gerencie e consulte os laudos técnicos das assistências.
          </p>
        </div>
        <Button size="sm" onClick={() => handleOpenDialog()}>
          <PlusCircle className="mr-2 h-4 w-4" /> Novo Laudo
        </Button>
      </div>

      <Card>
        <CardHeader>
            <CardTitle>Laudos Emitidos</CardTitle>
            <CardDescription>{laudos.length} laudos encontrados.</CardDescription>
        </CardHeader>
        <CardContent>
            {loading ? (
                <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>
            ) : laudos.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 rounded-lg border border-dashed">
                  <Frown className="h-16 w-16 text-muted-foreground" />
                  <h2 className="mt-4 text-xl font-semibold">Nenhum laudo encontrado</h2>
                </div>
            ) : (
             <AlertDialog>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nº Chamado</TableHead>
                            <TableHead>Cliente</TableHead>
                            <TableHead>Produto</TableHead>
                            <TableHead>Data</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {laudos.map(laudo => {
                            const statusInfo = statusConfig[laudo.status];
                            return (
                                <TableRow key={laudo.id}>
                                    <TableCell className="font-mono">#{laudo.orderNumber}</TableCell>
                                    <TableCell>{laudo.customerName}</TableCell>
                                    <TableCell>{laudo.productName}</TableCell>
                                    <TableCell>{formatDate(laudo.createdAt)}</TableCell>
                                    <TableCell><Badge variant={statusInfo.variant}>{statusInfo.label}</Badge></TableCell>
                                    <TableCell className="text-right">
                                        <DropdownMenu>
                                          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                          <DropdownMenuContent align="end">
                                            <DropdownMenuItem onClick={() => handleOpenDialog(laudo)}><Pencil className="mr-2 h-4 w-4"/>Editar</DropdownMenuItem>
                                            <AlertDialogTrigger asChild>
                                                <DropdownMenuItem className="text-destructive" onSelect={e => { e.preventDefault(); setLaudoToDelete(laudo);}}>
                                                    <Trash2 className="mr-2 h-4 w-4"/>Excluir
                                                </DropdownMenuItem>
                                            </AlertDialogTrigger>
                                          </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            )
                        })}
                    </TableBody>
                </Table>
                 {laudoToDelete && (
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
                            <AlertDialogDescription>Esta ação é irreversível e excluirá o laudo para o pedido #{laudoToDelete.orderNumber}.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel onClick={() => setLaudoToDelete(null)}>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDelete}>Sim, excluir</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                )}
             </AlertDialog>
            )}
        </CardContent>
      </Card>
      
       <Dialog open={open} onOpenChange={handleCloseDialog}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Editar Laudo Técnico' : 'Novo Laudo Técnico'}</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-6 max-h-[70vh] overflow-y-auto pr-4">
             <div className="space-y-2">
                <Label>Vincular Chamado ASTEC</Label>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Buscar por Nº do Pedido ou Nome do Cliente..." className="pl-10" value={astecSearch} onChange={e => setAstecSearch(e.target.value)} disabled={isEditing} />
                    {foundAstecs.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-card border rounded-md shadow-lg max-h-48 overflow-y-auto">
                        {foundAstecs.map(a => <div key={a.id} className="p-2 hover:bg-muted cursor-pointer text-sm" onClick={() => handleSelectAstec(a)}>Pedido #{a.orderNumber} - {a.customerName}</div>)}
                      </div>
                    )}
                </div>
                {selectedAstec && (
                    <div className="mt-2 p-3 border rounded-lg bg-muted text-sm space-y-1">
                        <p><strong>Pedido:</strong> #{selectedAstec.orderNumber}</p>
                        <p><strong>Cliente:</strong> {selectedAstec.customerName}</p>
                    </div>
                )}
             </div>
             
             {selectedAstec && (
                  <div className="space-y-2">
                    <Label htmlFor="productName">Produto</Label>
                    <Select value={currentLaudo.productName} onValueChange={v => setCurrentLaudo(p => ({...p, productName: v}))} disabled={isSubmitting}>
                       <SelectTrigger><SelectValue placeholder="Selecione o produto do chamado..." /></SelectTrigger>
                       <SelectContent>
                          {selectedAstec.items.map(item => <SelectItem key={item.productId} value={item.productName}>{item.productName}</SelectItem>)}
                       </SelectContent>
                    </Select>
                  </div>
             )}

             <div className="space-y-2">
                <Label>Problema Relatado</Label>
                <Textarea value={currentLaudo.problemReported || ''} disabled rows={3}/>
             </div>

             <div className="space-y-2">
                <Label htmlFor="technicalAnalysis">Análise Técnica</Label>
                <Textarea id="technicalAnalysis" value={currentLaudo.technicalAnalysis || ''} onChange={e => setCurrentLaudo(p => ({...p, technicalAnalysis: e.target.value}))} rows={5} placeholder="Descreva a análise técnica realizada, defeitos encontrados, etc."/>
             </div>
             
              <div className="space-y-2">
                <Label htmlFor="solution">Solução Aplicada / Proposta</Label>
                <Textarea id="solution" value={currentLaudo.solution || ''} onChange={e => setCurrentLaudo(p => ({...p, solution: e.target.value}))} rows={3} placeholder="Descreva a solução aplicada ou proposta ao cliente."/>
             </div>
             
             <div className="space-y-2">
                <Label htmlFor="status">Status do Laudo</Label>
                 <Select value={currentLaudo.status} onValueChange={(v) => setCurrentLaudo(p => ({...p, status: v as any}))}>
                    <SelectTrigger><SelectValue/></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="Pendente">Pendente</SelectItem>
                        <SelectItem value="Aprovado">Aprovado (Ex: Garantia)</SelectItem>
                        <SelectItem value="Reprovado">Reprovado (Ex: Mau uso)</SelectItem>
                    </SelectContent>
                </Select>
             </div>

          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="animate-spin mr-2"/> : null}
              Salvar Laudo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
