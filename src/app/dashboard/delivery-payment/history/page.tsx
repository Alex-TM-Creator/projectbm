
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  RefreshCw,
  Frown,
  Printer,
  ChevronRight,
  Car,
  MoreHorizontal,
  Trash2,
  CheckCircle,
  Clock,
  Check,
} from "lucide-react";
import {
  collection,
  getDocs,
  query,
  orderBy,
  deleteDoc,
  doc,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import type { DeliveryPaymentOrder } from "@/lib/definitions";
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
import { cn } from "@/lib/utils";

const statusConfig: { [key in DeliveryPaymentOrder['status']]: { label: string; icon: React.ReactNode; className: string } } = {
  paid: { label: "Pago", icon: <CheckCircle className="h-3 w-3" />, className: "bg-green-100 text-green-800" },
  pending: { label: "Pendente", icon: <Clock className="h-3 w-3" />, className: "bg-yellow-100 text-yellow-800" },
};


export default function DeliveryPaymentHistoryPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [orders, setOrders] = React.useState<DeliveryPaymentOrder[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [orderToDelete, setOrderToDelete] = React.useState<DeliveryPaymentOrder | null>(null);

  const fetchData = React.useCallback(async () => {
    try {
      setLoading(true);
      const ordersQuery = query(collection(db, "deliveryPaymentOrders"), orderBy("generatedAt", "desc"));
      const ordersSnap = await getDocs(ordersQuery);
      setOrders(ordersSnap.docs.map(d => ({ id: d.id, ...d.data() } as DeliveryPaymentOrder)));
    } catch (error) {
      toast({ title: "Erro ao buscar histórico", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDelete = async () => {
    if (!orderToDelete) return;
    try {
        await deleteDoc(doc(db, "deliveryPaymentOrders", orderToDelete.id));
        toast({ title: "Ordem de Pagamento Excluída", variant: "destructive"});
        fetchData();
    } catch (error) {
        toast({ title: "Erro ao excluir", variant: "destructive" });
    } finally {
        setOrderToDelete(null);
    }
  };
  
  const handleMarkAsPaid = async (orderId: string) => {
    try {
      const docRef = doc(db, "deliveryPaymentOrders", orderId);
      await updateDoc(docRef, { 
        status: 'paid',
        paidAt: new Date().toISOString(),
      });
      toast({ title: "Status atualizado para Pago!" });
      fetchData(); // Refetch data to show updated status
    } catch (error) {
      toast({ title: "Erro ao atualizar status", variant: "destructive" });
    }
  };


  const formatCurrency = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  const formatDate = (dateString: string) => format(parseISO(dateString), "dd/MM/yyyy", { locale: ptBR });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-headline tracking-tight">Histórico de Ordens de Pagamento</h1>
          <p className="text-muted-foreground">Consulte e imprima as ordens de pagamento de frete geradas.</p>
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
                            <TableHead>Motorista</TableHead>
                            <TableHead>Período</TableHead>
                            <TableHead>Total</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {orders.map(order => {
                            const statusInfo = statusConfig[order.status] || { label: 'Desconhecido', icon: <></>, className: '' };
                            return (
                                <TableRow key={order.id}>
                                    <TableCell>
                                        <div className="font-medium">{order.driverName}</div>
                                        <div className="text-xs text-muted-foreground">Gerado em: {format(parseISO(order.generatedAt), "dd/MM/yyyy 'às' HH:mm")}</div>
                                    </TableCell>
                                    <TableCell>{formatDate(order.periodStartDate)} - {formatDate(order.periodEndDate)}</TableCell>
                                    <TableCell className="font-semibold text-green-600">{formatCurrency(order.totalAmount)}</TableCell>
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
                                                <DropdownMenuItem onClick={() => router.push(`/dashboard/delivery-payment/history/${order.id}`)}>
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
                            <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Esta ação não pode ser desfeita e excluirá permanentemente a ordem de pagamento para <strong className="mx-1">{orderToDelete.driverName}</strong> no período de <strong className="mx-1">{formatDate(orderToDelete.periodStartDate)} a {formatDate(orderToDelete.periodEndDate)}</strong>.
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
