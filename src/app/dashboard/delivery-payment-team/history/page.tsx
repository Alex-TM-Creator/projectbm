
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  RefreshCw,
  Frown,
  Printer,
  Check,
  XCircle,
  Clock,
  MoreHorizontal,
  Trash2,
  CheckCircle,
} from "lucide-react";
import {
  collection,
  getDocs,
  query,
  orderBy,
  updateDoc,
  doc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import type { DeliveryTeamPaymentOrder } from "@/lib/definitions";
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
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
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


const statusConfig: { [key in DeliveryTeamPaymentOrder['status']]: { label: string; icon: React.ReactNode; className: string } } = {
  paid: { label: "Pago", icon: <CheckCircle className="h-3 w-3" />, className: "bg-green-100 text-green-800" },
  pending: { label: "Pendente", icon: <Clock className="h-3 w-3" />, className: "bg-yellow-100 text-yellow-800" },
};


export default function DeliveryTeamPaymentHistoryPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [orders, setOrders] = React.useState<DeliveryTeamPaymentOrder[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [orderToDelete, setOrderToDelete] = React.useState<DeliveryTeamPaymentOrder | null>(null);

  const fetchData = React.useCallback(async () => {
    try {
      setLoading(true);
      const ordersQuery = query(collection(db, "deliveryTeamPaymentOrders"), orderBy("createdAt", "desc"));
      const ordersSnap = await getDocs(ordersQuery);
      setOrders(ordersSnap.docs.map(d => ({ id: d.id, ...d.data() } as DeliveryTeamPaymentOrder)));
    } catch (error) {
      toast({ title: "Erro ao buscar histórico", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleMarkAsPaid = async (orderId: string) => {
    try {
      const docRef = doc(db, "deliveryTeamPaymentOrders", orderId);
      await updateDoc(docRef, { 
        status: 'paid',
        paidAt: serverTimestamp(),
      });
      toast({ title: "Status atualizado para Pago!" });
      fetchData();
    } catch (error) {
      toast({ title: "Erro ao atualizar status", variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!orderToDelete) return;
    try {
        await deleteDoc(doc(db, "deliveryTeamPaymentOrders", orderToDelete.id));
        toast({ title: "Ordem de Pagamento Excluída", variant: "destructive"});
        fetchData();
    } catch (error) {
        toast({ title: "Erro ao excluir", variant: "destructive" });
    } finally {
        setOrderToDelete(null);
    }
  };

  const formatCurrency = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return format(parseISO(dateString), "dd/MM/yyyy", { locale: ptBR });
  };
  
  const formatDateTime = (timestamp: any) => {
    if (!timestamp?.toDate) return "N/A";
    return format(timestamp.toDate(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  };


  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-headline tracking-tight">Histórico de Pagamentos da Equipe</h1>
          <p className="text-muted-foreground">Consulte e imprima as ordens de pagamento da equipe geradas.</p>
        </div>
        <Button variant="outline" size="icon" onClick={fetchData} disabled={loading}>
          <RefreshCw className={loading ? "animate-spin h-4 w-4" : "h-4 w-4"} />
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ordens Geradas</CardTitle>
          <CardDescription>{orders.length} ordens encontradas.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>
          ) : orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 rounded-lg border border-dashed">
                <Frown className="h-16 w-16 text-muted-foreground" />
                <h2 className="mt-4 text-xl font-semibold">Nenhuma ordem encontrada</h2>
            </div>
          ) : (
                <AlertDialog>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Período</TableHead>
                            <TableHead>Valor Total Serviços</TableHead>
                            <TableHead>Total Distribuído</TableHead>
                            <TableHead>Data de Geração</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {orders.map(order => {
                            const statusInfo = statusConfig[order.status] || { label: 'Desconhecido', icon: <></>, className: '' };
                            return (
                                <TableRow key={order.id}>
                                    <TableCell>{formatDate(order.periodStartDate)} - {formatDate(order.periodEndDate)}</TableCell>
                                    <TableCell>{formatCurrency(order.totalServiceValue)}</TableCell>
                                    <TableCell className="font-semibold text-green-600">{formatCurrency(order.totalDistributed)}</TableCell>
                                    <TableCell>{formatDateTime(order.createdAt)}</TableCell>
                                    <TableCell>
                                        <Badge className={cn("gap-1.5", statusInfo.className)} variant={statusInfo.label === 'Pendente' ? 'outline' : 'default'}>
                                            {statusInfo.icon} <span className="ml-1">{statusInfo.label}</span>
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                      <DropdownMenu>
                                          <DropdownMenuTrigger asChild>
                                              <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4"/></Button>
                                          </DropdownMenuTrigger>
                                          <DropdownMenuContent align="end">
                                              <DropdownMenuLabel>Ações</DropdownMenuLabel>
                                              <DropdownMenuItem onClick={() => router.push(`/dashboard/delivery-payment-team/history/${order.id}`)}>
                                                  <Printer className="mr-2 h-4 w-4"/>Imprimir
                                              </DropdownMenuItem>
                                              <DropdownMenuSeparator />
                                              <DropdownMenuItem onClick={() => handleMarkAsPaid(order.id)} disabled={order.status === 'paid'}>
                                                <Check className="mr-2 h-4 w-4" /> Marcar como Pago
                                              </DropdownMenuItem>
                                              <AlertDialogTrigger asChild>
                                                  <DropdownMenuItem className="text-destructive" onSelect={e => { e.preventDefault(); setOrderToDelete(order);}}>
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
                 {orderToDelete && (
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Esta ação não pode ser desfeita e irá excluir permanentemente esta ordem de pagamento.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel onClick={() => setOrderToDelete(null)}>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDelete}>Sim, excluir</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                )}
                </AlertDialog>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
