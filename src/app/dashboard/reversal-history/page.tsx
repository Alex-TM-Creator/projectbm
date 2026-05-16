
"use client";

import * as React from "react";
import {
  Loader2,
  RefreshCw,
  Frown,
  CheckCircle,
  XCircle,
  DollarSign,
  History,
  ShieldCheck,
  AlertOctagon,
  Timer,
} from "lucide-react";
import {
  collection,
  getDocs,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import type { ReversalRequest, SalesOrder } from "@/lib/definitions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";

export default function ReversalHistoryPage() {
  const { toast } = useToast();
  const [requests, setRequests] = React.useState<ReversalRequest[]>([]);
  const [orders, setOrders] = React.useState<Map<string, SalesOrder>>(new Map());
  const [loading, setLoading] = React.useState(true);

  const fetchData = React.useCallback(async () => {
    try {
      setLoading(true);
      const reqQuery = query(collection(db, "reversalRequests"), orderBy("requestedAt", "desc"));
      
      const [reqsSnap, ordersSnap] = await Promise.all([
        getDocs(reqQuery),
        getDocs(collection(db, "salesOrders")),
      ]);
      
      const allRequests = reqsSnap.docs.map(d => ({ id: d.id, ...d.data() } as ReversalRequest));
      setRequests(allRequests);
      
      const ordersMap = new Map<string, SalesOrder>();
      ordersSnap.docs.forEach(doc => ordersMap.set(doc.id, { id: doc.id, ...doc.data()} as SalesOrder));
      setOrders(ordersMap);

    } catch (error) {
      toast({ title: "Erro ao carregar histórico", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const summaryMetrics = React.useMemo(() => {
     let totalApproved = 0;
     let totalPending = 0;
     let approvedCount = 0;

     requests.forEach(req => {
       if (req.status === 'approved') {
         totalApproved += req.totalValue;
         approvedCount++;
       } else if (req.status === 'pending') {
         totalPending += req.totalValue;
       }
     });

     return { totalApproved, totalPending, approvedCount };
  }, [requests]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const formatCurrency = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  const formatDate = (timestamp: any) => {
    if (!timestamp) return "N/A";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return format(date, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  };
  
  return (
    <div className="flex flex-col gap-6">
       <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold font-headline tracking-tight flex items-center gap-2">
            <History className="text-primary h-8 w-8" /> Histórico de Estornos
          </h1>
          <p className="text-muted-foreground text-sm">
            Audite todas as solicitações de estorno, aprovadas ou negadas.
          </p>
        </div>
        <Button variant="outline" size="icon" onClick={fetchData} disabled={loading} className="rounded-xl shadow-soft">
          <RefreshCw className={loading ? "animate-spin" : ""} />
        </Button>
      </div>

      {/* Summary Metro */}
      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-none shadow-soft bg-card/40 backdrop-blur-md rounded-3xl overflow-hidden hover:bg-card/60 transition-all border border-border/10">
            <CardContent className="p-5 flex flex-col justify-between h-full">
              <div className="flex items-center justify-between mb-2">
                <div className="p-2 bg-green-500/10 rounded-xl text-green-600"><ShieldCheck className="h-5 w-5" /></div>
                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Aprovados</span>
              </div>
              <div className="flex items-baseline gap-2">
                  <p className="text-xl font-bold font-mono tracking-tighter truncate">{formatCurrency(summaryMetrics.totalApproved)}</p>
                  <span className="text-[10px] text-muted-foreground font-bold">{summaryMetrics.approvedCount} req.</span>
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-none shadow-soft bg-card/40 backdrop-blur-md rounded-3xl overflow-hidden hover:bg-card/60 transition-all border border-border/10">
            <CardContent className="p-5 flex flex-col justify-between h-full">
              <div className="flex items-center justify-between mb-2">
                <div className="p-2 bg-amber-500/10 rounded-xl text-amber-500"><Timer className="h-5 w-5" /></div>
                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Pendentes</span>
              </div>
              <p className="text-xl font-bold font-mono tracking-tighter truncate text-amber-600">{formatCurrency(summaryMetrics.totalPending)}</p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-soft bg-card/40 backdrop-blur-md rounded-3xl overflow-hidden hover:bg-card/60 transition-all border border-border/10">
            <CardContent className="p-5 flex flex-col justify-between h-full">
              <div className="flex items-center justify-between mb-2">
                <div className="p-2 bg-primary/10 rounded-xl text-primary"><History className="h-5 w-5" /></div>
                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Total Registros</span>
              </div>
              <p className="text-xl font-bold font-mono tracking-tighter truncate">{requests.length}</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card className="border-none shadow-glass bg-card/60 backdrop-blur-xl rounded-3xl overflow-hidden">
        <CardHeader className="bg-muted/10 border-b border-border/10">
          <CardTitle className="text-xl font-headline">Registros de Estorno</CardTitle>
          <CardDescription>
            {requests.length} solicitações de estorno auditadas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>
          ) : requests.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 rounded-lg border border-dashed">
                <Frown className="h-16 w-16 text-muted-foreground" />
                <h2 className="mt-4 text-xl font-semibold">Nenhum registro encontrado</h2>
                <p className="mt-2 text-sm text-muted-foreground">Nenhuma solicitação de estorno foi feita ainda.</p>
            </div>
          ) : (
             <Table>
               <TableHeader>
                 <TableRow className="bg-muted/20 border-border/50">
                   <TableHead className="text-[10px] uppercase font-bold tracking-widest">Pedido Nº</TableHead>
                   <TableHead className="text-[10px] uppercase font-bold tracking-widest">Cliente</TableHead>
                   <TableHead className="text-[10px] uppercase font-bold tracking-widest">Valor Estornado</TableHead>
                   <TableHead className="text-[10px] uppercase font-bold tracking-widest">Data Solicitação</TableHead>
                   <TableHead className="text-[10px] uppercase font-bold tracking-widest">Status</TableHead>
                   <TableHead className="text-[10px] uppercase font-bold tracking-widest">Aprovador</TableHead>
                   <TableHead className="text-[10px] uppercase font-bold tracking-widest">Notas</TableHead>
                 </TableRow>
               </TableHeader>
              <TableBody>
                {requests.map(req => {
                    const order = orders.get(req.items[0]?.orderId || '');
                    return (
                     <TableRow key={req.id} className="hover:bg-primary/5 transition-colors border-border/5">
                         <TableCell className="font-mono text-xs font-bold text-primary/80">#{order?.orderNumber || 'N/A'}</TableCell>
                         <TableCell className="text-sm font-medium text-foreground/80">{order?.customerName || 'N/A'}</TableCell>
                         <TableCell className="font-bold font-mono text-foreground/80">{formatCurrency(req.totalValue)}</TableCell>
                         <TableCell className="text-[11px] text-muted-foreground font-medium">{formatDate(req.requestedAt)}</TableCell>
                         <TableCell>
                            {req.status === 'approved' && (
                                <Badge className="bg-green-500/10 text-green-600 border-green-200/50 gap-1.5 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider">
                                    <CheckCircle className="h-3 w-3"/> Aprovado
                                </Badge>
                            )}
                            {req.status === 'denied' && (
                                <Badge className="bg-destructive/10 text-destructive border-destructive/20 gap-1.5 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider">
                                    <XCircle className="h-3 w-3"/> Negado
                                </Badge>
                            )}
                            {req.status === 'pending' && (
                                <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 gap-1.5 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider">
                                    <Timer className="h-3 w-3 animate-pulse"/> Pendente
                                </Badge>
                            )}
                         </TableCell>
                         <TableCell>
                             <div className="flex flex-col">
                                 <span className="text-xs font-medium text-foreground/70">{req.processedByUserName || "-"}</span>
                                 <span className="text-[9px] text-muted-foreground/60">{req.processedAt ? formatDate(req.processedAt) : ""}</span>
                             </div>
                         </TableCell>
                         <TableCell className="max-w-[200px]">
                             <div className="text-[10px] text-muted-foreground/80 leading-tight italic bg-muted/30 p-2 rounded-lg border border-border/10">
                                 "{req.reason}"
                             </div>
                         </TableCell>
                     </TableRow>
                 )})}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
