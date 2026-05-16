
"use client";

import * as React from "react";
import {
  Loader2,
  ShieldCheck,
  Frown,
  RefreshCw,
  Check,
  X,
  FileText,
  ShieldX,
  Clock,
} from "lucide-react";
import {
  collection,
  getDocs,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import type { DiscountApproval } from "@/lib/definitions";
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

export default function DiscountApprovalHistoryPage() {
  const { toast } = useToast();
  const [approvals, setApprovals] = React.useState<DiscountApproval[]>([]);
  const [loading, setLoading] = React.useState(true);

  const fetchData = React.useCallback(async () => {
    try {
      setLoading(true);
      const approvalsSnap = await getDocs(query(collection(db, "discountApprovals"), orderBy("requestedAt", "desc")));
      setApprovals(approvalsSnap.docs.map(d => ({ id: d.id, ...d.data() } as DiscountApproval)));
    } catch (error) {
      toast({ title: "Erro ao carregar histórico", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const formatPercentage = (value: number) => {
    return `${value.toFixed(2)}%`.replace('.', ',');
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp?.toDate) return "N/A";
    return format(timestamp.toDate(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-headline tracking-tight flex items-center gap-2">
            <ShieldCheck /> Histórico de Liberações de Desconto
          </h1>
          <p className="text-muted-foreground">
            Audite todos os pedidos que solicitaram aprovação de desconto.
          </p>
        </div>
        <Button variant="outline" size="icon" onClick={fetchData} disabled={loading}>
          <RefreshCw className={loading ? "animate-spin h-4 w-4" : "h-4 w-4"} />
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Registros de Aprovação</CardTitle>
          <CardDescription>
            {approvals.length} registros encontrados.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {approvals.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 rounded-lg border border-dashed">
                <Frown className="h-16 w-16 text-muted-foreground" />
                <h2 className="mt-4 text-xl font-semibold">Nenhum registro encontrado</h2>
                <p className="mt-2 text-sm text-muted-foreground text-center">
                    Nenhum pedido solicitou aprovação de desconto ainda.
                </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pedido Nº</TableHead>
                  <TableHead>Vendedor</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Desconto (%)</TableHead>
                  <TableHead>Data Solicitação</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Aprovador</TableHead>
                  <TableHead>Data Aprovação</TableHead>
                  <TableHead>Notas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {approvals.map(approval => (
                  <TableRow key={approval.id}>
                    <TableCell className="font-mono">#{approval.orderNumber}</TableCell>
                    <TableCell>{approval.sellerName}</TableCell>
                    <TableCell>{approval.customerName}</TableCell>
                    <TableCell>
                      <Badge variant="destructive">{formatPercentage(approval.totalDiscountPercentage)}</Badge>
                    </TableCell>
                    <TableCell>{formatDate(approval.requestedAt)}</TableCell>
                    <TableCell>
                      {approval.status === 'approved' && <Badge className="bg-green-600 hover:bg-green-700 gap-1.5"><Check className="h-3 w-3"/> Aprovado</Badge>}
                      {approval.status === 'denied' && <Badge variant="destructive" className="gap-1.5"><X className="h-3 w-3"/> Negado</Badge>}
                      {approval.status === 'pending' && <Badge variant="secondary" className="gap-1.5"><Clock className="h-3 w-3"/> Pendente</Badge>}
                    </TableCell>
                    <TableCell>{approval.releasedBy || "-"}</TableCell>
                    <TableCell>{formatDate(approval.releasedAt)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{approval.releaseNotes || "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
