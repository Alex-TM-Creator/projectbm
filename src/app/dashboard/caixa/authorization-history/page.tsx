
"use client";

import * as React from "react";
import {
  collection,
  getDocs,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import type { ClosingAuthorizationRequest } from "@/lib/definitions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Loader2, RefreshCw, CheckCircle, XCircle, Clock, FileClock, User as UserIcon, GitFork, ShieldAlert, Timer, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

const statusConfig: { [key in ClosingAuthorizationRequest['status']]: { label: string; icon: React.ReactNode; className: string } } = {
  approved: { 
    label: "Apresentado", 
    icon: <CheckCircle className="h-3 w-3" />, 
    className: "bg-green-500/10 text-green-600 border-green-200/50" 
  },
  denied: { 
    label: "Negado", 
    icon: <XCircle className="h-3 w-3" />, 
    className: "bg-destructive/10 text-destructive border-destructive/20" 
  },
  pending: { 
    label: "Pendente", 
    icon: <Timer className="h-3 w-3 animate-pulse" />, 
    className: "bg-amber-500/10 text-amber-600 border-amber-500/20" 
  },
};

export default function CaixaAuthorizationHistoryPage() {
  const { toast } = useToast();
  const [requests, setRequests] = React.useState<ClosingAuthorizationRequest[]>([]);
  const [loading, setLoading] = React.useState(true);

  const fetchData = React.useCallback(async () => {
    try {
      setLoading(true);
      const reqsQuery = query(collection(db, "caixaClosingAuthorizations"), orderBy("requestedAt", "desc"));
      const reqsSnap = await getDocs(reqsQuery);
      setRequests(reqsSnap.docs.map(d => ({ id: d.id, ...d.data() } as ClosingAuthorizationRequest)));
    } catch (error) {
      toast({ title: "Erro ao buscar histórico", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const summaryMetrics = React.useMemo(() => {
    let total = requests.length;
    let approved = requests.filter(r => r.status === 'approved').length;
    let denied = requests.filter(r => r.status === 'denied').length;
    let pending = requests.filter(r => r.status === 'pending').length;
    return { total, approved, denied, pending };
  }, [requests]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const formatCurrency = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  const formatDate = (timestamp: any) => {
    if (!timestamp?.toDate) return "N/A";
    return format(timestamp.toDate(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  };

  return (
    <div className="flex flex-col gap-6">
       <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold font-headline tracking-tight flex items-center gap-2">
            <FileClock className="text-primary h-8 w-8" /> Histórico de Autorizações
          </h1>
          <p className="text-muted-foreground text-sm">
            Audite todas as solicitações de fechamento de caixa e seu processamento.
          </p>
        </div>
        <Button variant="outline" size="icon" onClick={fetchData} disabled={loading} className="rounded-xl shadow-soft">
          <RefreshCw className={loading ? "animate-spin h-4 w-4" : "h-4 w-4"} />
        </Button>
      </div>

      {/* Summary Metro */}
      {!loading && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-none shadow-soft bg-card/40 backdrop-blur-md rounded-3xl overflow-hidden hover:bg-card/60 transition-all border border-border/10">
            <CardContent className="p-5 flex flex-col justify-between h-full">
              <div className="flex items-center justify-between mb-2">
                <div className="p-2 bg-primary/10 rounded-xl text-primary"><TrendingUp className="h-5 w-5" /></div>
                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Total</span>
              </div>
              <p className="text-xl font-bold font-mono tracking-tighter truncate">{summaryMetrics.total}</p>
            </CardContent>
          </Card>
          
          <Card className="border-none shadow-soft bg-card/40 backdrop-blur-md rounded-3xl overflow-hidden hover:bg-card/60 transition-all border border-border/10">
            <CardContent className="p-5 flex flex-col justify-between h-full">
              <div className="flex items-center justify-between mb-2">
                <div className="p-2 bg-green-500/10 rounded-xl text-green-600"><CheckCircle className="h-5 w-5" /></div>
                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Aprovados</span>
              </div>
              <p className="text-xl font-bold font-mono tracking-tighter truncate text-green-600">{summaryMetrics.approved}</p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-soft bg-card/40 backdrop-blur-md rounded-3xl overflow-hidden hover:bg-card/60 transition-all border border-border/10">
            <CardContent className="p-5 flex flex-col justify-between h-full">
              <div className="flex items-center justify-between mb-2">
                <div className="p-2 bg-amber-500/10 rounded-xl text-amber-500"><Timer className="h-5 w-5" /></div>
                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Pendentes</span>
              </div>
              <p className="text-xl font-bold font-mono tracking-tighter truncate text-amber-600">{summaryMetrics.pending}</p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-soft bg-card/40 backdrop-blur-md rounded-3xl overflow-hidden hover:bg-card/60 transition-all border border-border/10">
            <CardContent className="p-5 flex flex-col justify-between h-full">
              <div className="flex items-center justify-between mb-2">
                <div className="p-2 bg-destructive/10 rounded-xl text-destructive"><XCircle className="h-5 w-5" /></div>
                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Negados</span>
              </div>
              <p className="text-xl font-bold font-mono tracking-tighter truncate text-destructive font-bold">{summaryMetrics.denied}</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card className="border-none shadow-glass bg-card/60 backdrop-blur-xl rounded-3xl overflow-hidden">
        <CardHeader className="bg-muted/10 border-b border-border/10">
          <CardTitle className="text-xl font-headline">Monitor de Autorizações</CardTitle>
          <CardDescription>
            {requests.length} solicitações de auditoria encontradas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>
          ) : (
             <Table>
               <TableHeader>
                 <TableRow className="bg-muted/20 border-border/50">
                   <TableHead className="text-[10px] uppercase font-bold tracking-widest py-4">Solicitante / Filial</TableHead>
                   <TableHead className="text-[10px] uppercase font-bold tracking-widest py-4">Data Solicitação</TableHead>
                   <TableHead className="text-right text-[10px] uppercase font-bold tracking-widest py-4">Diferença</TableHead>
                   <TableHead className="text-[10px] uppercase font-bold tracking-widest py-4 text-center">Status</TableHead>
                   <TableHead className="text-[10px] uppercase font-bold tracking-widest py-4">Processamento</TableHead>
                 </TableRow>
               </TableHeader>
              <TableBody>
                {requests.map(req => {
                  const statusInfo = statusConfig[req.status] || { label: 'Desconhecido', icon: <></>, className: '' };
                  return (
                     <TableRow key={req.id} className="hover:bg-primary/5 transition-colors border-border/5">
                       <TableCell className="py-4">
                         <div className="flex items-center gap-2 font-bold text-foreground/80"><UserIcon className="h-4 w-4 text-primary/60" />{req.userName}</div>
                         <div className="flex items-center gap-2 text-[10px] uppercase font-bold text-muted-foreground/60 mt-1"><GitFork className="h-3 w-3" />{req.branchName}</div>
                       </TableCell>
                       <TableCell className="font-mono text-[11px] font-medium text-muted-foreground/80">{formatDate(req.requestedAt)}</TableCell>
                       <TableCell className={cn("text-right font-bold font-mono text-base tracking-tighter", req.difference > 0 ? 'text-green-600' : 'text-destructive')}>
                         {formatCurrency(req.difference)}
                       </TableCell>
                       <TableCell className="text-center">
                         <Badge className={cn("gap-1.5 px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider shadow-sm", statusInfo.className)}>
                             {statusInfo.icon}
                             {statusInfo.label}
                         </Badge>
                       </TableCell>
                       <TableCell>
                         {req.processedByUserName ? (
                             <div className="space-y-1">
                                 <div className="flex items-center gap-2 text-xs font-bold text-foreground/70"><CheckCircle className="h-3 w-3 text-green-500" />{req.processedByUserName}</div>
                                 <div className="text-[10px] text-muted-foreground/60 font-mono tracking-tighter">{formatDate(req.processedAt)}</div>
                             </div>
                         ) : (
                             <div className="flex items-center gap-2 text-xs text-muted-foreground/40 italic font-medium"><Clock className="h-3 w-3" /> Aguardando Auditoria</div>
                         )}
                       </TableCell>
                     </TableRow>
                   )
                 })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
