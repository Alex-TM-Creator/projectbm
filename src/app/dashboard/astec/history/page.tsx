
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Wrench,
  RefreshCw,
  Frown,
  CheckCircle,
  Clock,
  XCircle,
  Hourglass,
  MoreHorizontal,
  Printer,
  FileText,
  GitFork,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  collection,
  getDocs,
  query,
  orderBy,
  updateDoc,
  doc,
  addDoc,
  serverTimestamp,
  writeBatch,
  limit,
  startAfter,
  where,
} from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { useAuthState } from "react-firebase-hooks/auth";
import { useToast } from "@/hooks/use-toast";
import type { AssistanceRequest, User } from "@/lib/definitions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type StatusConfig = {
  label: string;
  variant: "default" | "secondary" | "outline" | "destructive";
  icon: React.ReactNode;
  className?: string;
};

const statusConfig: Record<AssistanceRequest['status'], StatusConfig> = {
  pending: { label: "Pendente", variant: "destructive", icon: <Clock className="h-3 w-3" /> },
  in_progress: { label: "Em Andamento", variant: "outline", icon: <Hourglass className="h-3 w-3" />, className: "text-yellow-600 border-yellow-500" },
  finished: { label: "Finalizado", variant: "default", icon: <CheckCircle className="h-3 w-3" />, className: "bg-green-600 hover:bg-green-700" },
  cancelled: { label: "Cancelado", variant: "destructive", icon: <XCircle className="h-3 w-3" /> },
};

export default function AssistanceHistoryPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [user] = useAuthState(auth);
  const PAGE_SIZE = 15;
  const [requests, setRequests] = React.useState<AssistanceRequest[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  
  // Pagination State
  const [page, setPage] = React.useState(1);
  const [cursors, setCursors] = React.useState<any[]>([null]);
  const [hasMore, setHasMore] = React.useState(true);

  // Laudo Modal State
  const [laudoModalOpen, setLaudoModalOpen] = React.useState(false);
  const [currentRequest, setCurrentRequest] = React.useState<AssistanceRequest | null>(null);
  const [technicalAnalysis, setTechnicalAnalysis] = React.useState("");
  const [solution, setSolution] = React.useState("");
  
  // History State
  const [laudoHistory, setLaudoHistory] = React.useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = React.useState(false);


  const fetchPage = React.useCallback(async (pageIndex: number, currentCursors: any[]) => {
    try {
      setLoading(true);
      const cursor = currentCursors[pageIndex - 1];
      let reqQuery = query(collection(db, "astec"), orderBy("assistanceNumber", "desc"), limit(PAGE_SIZE));
      
      if (cursor) {
        reqQuery = query(collection(db, "astec"), orderBy("assistanceNumber", "desc"), startAfter(cursor), limit(PAGE_SIZE));
      }

      const reqsSnap = await getDocs(reqQuery);
      setRequests(reqsSnap.docs.map(d => ({ id: d.id, ...d.data() } as AssistanceRequest)));
      setHasMore(reqsSnap.docs.length === PAGE_SIZE);
      return reqsSnap.docs[reqsSnap.docs.length - 1] || null;
    } catch (error) {
      toast({ title: "Erro ao buscar histórico", variant: "destructive" });
      return null;
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const loadInitialData = React.useCallback(async () => {
    const lastDoc = await fetchPage(1, [null]);
    if (lastDoc) {
      setCursors([null, lastDoc]);
    }
    setPage(1);
  }, [fetchPage]);

  const fetchData = React.useCallback(async () => {
    await fetchPage(page, cursors);
  }, [fetchPage, page, cursors]);

  React.useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  const handleNextPage = async () => {
    if (!hasMore) return;
    const lastDoc = await fetchPage(page + 1, cursors);
    if (lastDoc) {
      setCursors(prev => {
        const newCursors = [...prev];
        newCursors[page + 1] = lastDoc;
        return newCursors;
      });
      setPage(prev => prev + 1);
    }
  };

  const handlePrevPage = async () => {
    if (page <= 1) return;
    await fetchPage(page - 1, cursors);
    setPage(prev => prev - 1);
  };


  const handleStatusChange = async (requestId: string, newStatus: AssistanceRequest['status']) => {
    if (newStatus === 'in_progress') {
        const requestToUpdate = requests.find(r => r.id === requestId);
        if (requestToUpdate) {
            setCurrentRequest(requestToUpdate);
            setTechnicalAnalysis('');
            setSolution('');
            setLaudoHistory([]);
            setLaudoModalOpen(true);
            
            // fetch history
            setLoadingHistory(true);
            try {
                const q = query(collection(db, "astecLaudos"), where("astecId", "==", requestId));
                const snap = await getDocs(q);
                let docs = snap.docs.map(d => ({id: d.id, ...d.data()}));
                
                docs.sort((a: any, b: any) => {
                   const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
                   const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
                   return timeB - timeA;
                });
                
                setLaudoHistory(docs);
            } catch (e) {
                console.error("Failed to load history", e);
            } finally {
                setLoadingHistory(false);
            }
        }
        return;
    }

    try {
      const docRef = doc(db, "astec", requestId);
      await updateDoc(docRef, { status: newStatus, updatedAt: new Date().toISOString() });
      toast({ title: "Status atualizado com sucesso!" });
      fetchData(); // Refetch data to show updated status
    } catch (error) {
      toast({ title: "Erro ao atualizar status", variant: "destructive" });
    }
  };

  const handleSaveLaudoAndStatus = async () => {
    if (!currentRequest || !user || !technicalAnalysis.trim() || !solution.trim()) {
      toast({ title: "Campos obrigatórios", description: "Laudo técnico e solução são necessários.", variant: "destructive" });
      return;
    }
    
    setIsSubmitting(true);
    const batch = writeBatch(db);

    try {
      // 1. Update ASTEC status
      const astecRef = doc(db, "astec", currentRequest.id);
      batch.update(astecRef, { status: 'in_progress', updatedAt: new Date().toISOString() });

      // 2. Create new Laudo document
      const laudoRef = doc(collection(db, "astecLaudos"));
      batch.set(laudoRef, {
        astecId: currentRequest.id,
        orderNumber: currentRequest.orderNumber,
        customerName: currentRequest.customerName,
        productName: currentRequest.items[0]?.productName || 'N/A', // Assuming one product for now
        problemReported: currentRequest.problemDescription,
        technicalAnalysis: technicalAnalysis.trim(),
        solution: solution.trim(),
        status: 'Pendente',
        createdAt: serverTimestamp(),
        createdByUserId: user.uid,
        createdByUserName: user.displayName,
      });

      await batch.commit();

      toast({ title: "Salvo com sucesso!", description: "Sua análise foi salva no histórico e o chamado atualizado." });
      setLaudoModalOpen(false);
      setCurrentRequest(null);
      fetchData();

    } catch (error) {
      console.error(error);
      toast({ title: "Erro ao salvar", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp?.toDate) return "N/A";
    return format(timestamp.toDate(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  };

  return (
    <>
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-headline tracking-tight flex items-center gap-2">
            <Wrench /> Histórico de Chamados ASTEC
          </h1>
          <p className="text-muted-foreground">
            Acompanhe e gerencie todas as solicitações de assistência técnica.
          </p>
        </div>
        <Button variant="outline" size="icon" onClick={fetchData} disabled={loading}>
          <RefreshCw className={loading ? "animate-spin h-4 w-4" : "h-4 w-4"} />
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Chamados Registrados</CardTitle>
          <CardDescription>
            {loading ? "Carregando..." : `${requests.length} chamados encontrados.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>
          ) : requests.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 rounded-lg border border-dashed">
              <Frown className="h-16 w-16 text-muted-foreground" />
              <h2 className="mt-4 text-xl font-semibold">Nenhum chamado encontrado</h2>
            </div>
          ) : (
            <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nº Chamado</TableHead>
                  <TableHead>Nº Pedido</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Solicitante</TableHead>
                  <TableHead>Filial</TableHead>
                  <TableHead>Produto(s)</TableHead>
                  <TableHead>Data Solicitação</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map(req => {
                  const currentStatus = statusConfig[req.status] || { label: 'Desconhecido', variant: 'secondary', icon: <Wrench /> };
                  return (
                    <TableRow key={req.id}>
                      <TableCell className="font-mono">#{req.assistanceNumber}</TableCell>
                      <TableCell className="font-mono">#{req.orderNumber}</TableCell>
                      <TableCell>{req.customerName}</TableCell>
                      <TableCell>{req.createdByUserName}</TableCell>
                       <TableCell>
                          <Badge variant="outline" className="gap-1.5">
                              <GitFork className="h-3 w-3" />
                              {req.branchName || 'N/A'}
                          </Badge>
                       </TableCell>
                      <TableCell>
                        <ul className="list-disc list-inside">
                          {req.items.map(item => <li key={item.productId}>{item.productName}</li>)}
                        </ul>
                      </TableCell>
                      <TableCell>{formatDate(req.createdAt)}</TableCell>
                      <TableCell>
                        <Badge variant={currentStatus.variant} className={`gap-1.5 ${currentStatus.className}`}>
                          {currentStatus.icon}
                          {currentStatus.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => router.push(`/dashboard/astec/history/${req.id}`)}>
                               <Printer className="mr-2 h-4 w-4"/> Imprimir
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleStatusChange(req.id, 'in_progress')}>Marcar como "Em Andamento"</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleStatusChange(req.id, 'finished')}>Marcar como "Finalizado"</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleStatusChange(req.id, 'cancelled')} className="text-destructive">Marcar como "Cancelado"</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
            <div className="flex items-center justify-between space-x-2 py-4 border-t mt-4">
              <div className="text-sm text-muted-foreground font-medium">
                Página {page}
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={handlePrevPage} disabled={page <= 1 || loading}>
                  <ChevronLeft className="h-4 w-4 mr-1"/> Anterior
                </Button>
                <Button variant="outline" size="sm" onClick={handleNextPage} disabled={!hasMore || loading}>
                  Próxima <ChevronRight className="h-4 w-4 ml-1"/>
                </Button>
              </div>
            </div>
          </>
          )}
        </CardContent>
      </Card>
    </div>

    <Dialog open={laudoModalOpen} onOpenChange={setLaudoModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex justify-between items-center pr-6">
                <span>Registrar Laudo Técnico</span>
            </DialogTitle>
            <DialogDescription>
              Preencha as informações do laudo para anexar ao chamado #{currentRequest?.assistanceNumber}.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto pr-2 py-4 space-y-6">
            <div className="space-y-4 bg-muted/20 p-4 rounded-lg border border-muted">
                <div className="space-y-2">
                  <Label htmlFor="technical-analysis">Análise Técnica</Label>
                  <Textarea
                    id="technical-analysis"
                    value={technicalAnalysis}
                    onChange={(e) => setTechnicalAnalysis(e.target.value)}
                    placeholder="Descreva a análise técnica, defeitos encontrados, etc."
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="solution">Solução Aplicada / Proposta</Label>
                  <Textarea
                    id="solution"
                    value={solution}
                    onChange={(e) => setSolution(e.target.value)}
                    placeholder="Descreva a solução aplicada ou a ser proposta para o cliente."
                    rows={2}
                  />
                </div>
            </div>
            
            <div className="space-y-3">
                <h4 className="font-semibold flex items-center gap-2"><FileText className="w-4 h-4" /> Histórico de Registros</h4>
                {loadingHistory ? (
                    <div className="flex py-6 justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
                ) : laudoHistory.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-2 italic text-center">Nenhum registro no histórico deste chamado.</p>
                ) : (
                    <div className="space-y-4">
                        {laudoHistory.map((item, idx) => (
                            <div key={item.id || idx} className="bg-card w-full border border-border/50 rounded-lg p-3 text-sm shadow-sm">
                                <div className="flex justify-between items-start mb-2">
                                    <div className="font-semibold text-primary">{item.createdByUserName}</div>
                                    <div className="text-xs text-muted-foreground">{formatDate({ toDate: () => (item.createdAt?.toDate ? item.createdAt.toDate() : new Date(item.createdAt)) })}</div>
                                </div>
                                <div className="space-y-2">
                                    {item.technicalAnalysis && (
                                        <div><span className="font-semibold text-xs uppercase text-muted-foreground">Análise:</span> <p className="mt-0.5 text-foreground/90">{item.technicalAnalysis}</p></div>
                                    )}
                                    {item.solution && (
                                        <div><span className="font-semibold text-xs uppercase text-muted-foreground">Solução:</span> <p className="mt-0.5 text-foreground/90">{item.solution}</p></div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
          </div>
          <DialogFooter className="pt-4 border-t">
            <Button variant="outline" onClick={() => setLaudoModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveLaudoAndStatus} disabled={isSubmitting || (!technicalAnalysis.trim() && !solution.trim())}>
              {isSubmitting ? <Loader2 className="animate-spin mr-2 w-4 h-4" /> : <CheckCircle className="mr-2 h-4 w-4" />}
              Salvar e Registrar Histórico
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
    </>
  );
}
