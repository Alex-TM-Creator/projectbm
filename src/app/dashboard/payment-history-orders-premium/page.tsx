
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  writeBatch,
  getDoc,
  addDoc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { useAuthState } from "react-firebase-hooks/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import type { PaymentOrder, PeriodGroup } from "@/lib/definitions";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, GitFork, User, BriefcaseBusiness,  Undo2,
  Check,
  Printer,
  History,
  TrendingUp,
  Coins,
  Scale,
  Calendar,
  AlertCircle
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getGroupStatus } from "@/lib/period-helpers";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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


const statusConfig: { [key in PaymentOrder['status']]: { label: string; variant: "default" | "secondary" | "destructive" } } = {
  pending: { label: "Pendente", variant: "secondary" },
  paid: { label: "Pago", variant: "default" },
  cancelled: { label: "Cancelado", variant: "destructive" },
};

export default function PaymentHistoryOrdersPremiumPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [paymentOrders, setPaymentOrders] = React.useState<PaymentOrder[]>([]);
  const [periodGroups, setPeriodGroups] = React.useState<PeriodGroup[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [orderToCancel, setOrderToCancel] = React.useState<PaymentOrder | null>(null);

  const fetchData = React.useCallback(async () => {
    try {
      setLoading(true);
      const [ordersSnap, periodsSnap] = await Promise.all([
        getDocs(query(collection(db, "paymentHistory"))),
        getDocs(query(collection(db, "periodgroups"))),
      ]);
      const orders = ordersSnap.docs.map(d => ({ id: d.id, ...d.data() } as PaymentOrder));
      setPaymentOrders(orders.sort((a,b) => parseISO(b.generatedAt).getTime() - parseISO(a.generatedAt).getTime()));
      setPeriodGroups(periodsSnap.docs.map(d => ({ id: d.id, ...d.data() } as PeriodGroup)));

    } catch (error) {
      toast({ title: "Erro ao buscar histórico", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);
  
  const handleCancelOrder = async () => {
    if (!orderToCancel) return;
    
    try {
      const docRef = doc(db, "paymentHistory", orderToCancel.id);
      await updateDoc(docRef, { status: 'cancelled' });

      setPaymentOrders(prev => prev.map(order => 
        order.id === orderToCancel.id ? { ...order, status: 'cancelled' as const } : order
      ));

      toast({ title: "Ordem Cancelada", description: "A ordem de pagamento foi marcada como cancelada.", variant: "destructive" });
    } catch (error) {
      toast({ title: "Erro ao cancelar ordem", variant: "destructive" });
    } finally {
        setOrderToCancel(null);
    }
  }
  
  const handleMarkAsPaid = async (orderId: string) => {
     try {
      const docRef = doc(db, "paymentHistory", orderId);
      const paidAt = new Date().toISOString();
      await updateDoc(docRef, { 
        status: 'paid',
        paidAt: paidAt,
      });

      setPaymentOrders(prev => prev.map(order => 
        order.id === orderId ? { ...order, status: 'paid' as const, paidAt } : order
      ));

      toast({ title: "Status atualizado para Pago!" });
    } catch (error) {
      toast({ title: "Erro ao atualizar status", variant: "destructive" });
    }
  }
  
  const globalMetrics = React.useMemo(() => {
    const validOrders = paymentOrders.filter(o => o.status !== 'cancelled');
    const totalAmount = validOrders.reduce((acc, o) => acc + o.amount, 0);
    const paidAmount = validOrders.filter(o => o.status === 'paid').reduce((acc, o) => acc + o.amount, 0);
    const pendingAmount = validOrders.filter(o => o.status === 'pending').reduce((acc, o) => acc + o.amount, 0);
    const paidCount = validOrders.filter(o => o.status === 'paid').length;
    const efficiency = validOrders.length > 0 ? (paidCount / validOrders.length) * 100 : 0;

    return {
      totalAmount,
      paidAmount,
      pendingAmount,
      efficiency,
      count: validOrders.length
    };
  }, [paymentOrders]);

  const groupedOrders = React.useMemo(() => {
    return paymentOrders.reduce((acc, order) => {
        const group = periodGroups.find(g => g.id === order.periodGroupId);
        const groupName = group?.name || 'Grupo Desconhecido';
        if (!acc[groupName]) {
            acc[groupName] = [];
        }
        acc[groupName].push(order);
        return acc;
    }, {} as Record<string, PaymentOrder[]>);
  }, [paymentOrders, periodGroups]);

  const formatCurrency = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  const formatDate = (dateString: string) => format(parseISO(dateString), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  
  const getResponsibleIcon = (type: 'user' | 'branch' | 'role') => {
    switch(type) {
        case 'user': return <User className="h-4 w-4"/>;
        case 'branch': return <GitFork className="h-4 w-4"/>;
        case 'role': return <BriefcaseBusiness className="h-4 w-4"/>;
    }
  }

  return (
    <TooltipProvider>
      <div className="flex flex-col gap-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold font-headline tracking-tight">Histórico de Ordens de Pagamento</h1>
            <p className="text-muted-foreground">Consulte e gerencie todas as ordens de pagamento geradas.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={fetchData} disabled={loading} className="h-10 w-10">
              <RefreshCw className={cn("h-4 w-4", loading ? "animate-spin" : "")} />
            </Button>
          </div>
        </div>

        {/* Global Summary Cards */}
        {!loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-primary/5 border-primary/10 relative overflow-hidden group hover:shadow-md transition-all duration-300">
               <div className="absolute -right-2 -bottom-2 opacity-5 scale-150 rotate-12 group-hover:scale-110 transition-transform duration-500">
                  <Coins className="h-24 w-24 text-primary" />
               </div>
               <CardContent className="p-5 flex items-center gap-4 relative">
                  <div className="h-12 w-12 rounded-2xl bg-primary text-white flex items-center justify-center shadow-lg shadow-primary/20">
                    <History className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-primary/60 uppercase tracking-widest leading-none mb-1">Total Gerado</p>
                    <p className="text-xl font-bold font-mono tracking-tight">{formatCurrency(globalMetrics.totalAmount)}</p>
                  </div>
               </CardContent>
            </Card>

            <Card className="bg-green-50/50 border-green-200/50 dark:bg-green-500/10 dark:border-green-500/20 relative overflow-hidden group hover:shadow-md transition-all duration-300">
               <div className="absolute -right-2 -bottom-2 opacity-5 scale-150 rotate-12 group-hover:scale-110 transition-transform duration-500">
                  <Check className="h-24 w-24 text-green-600" />
               </div>
               <CardContent className="p-5 flex items-center gap-4 relative">
                  <div className="h-12 w-12 rounded-2xl bg-green-600 text-white flex items-center justify-center shadow-lg shadow-green-600/20">
                    <Check className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-green-600/60 uppercase tracking-widest leading-none mb-1">Total Pago</p>
                    <p className="text-xl font-bold font-mono tracking-tight text-green-700 dark:text-green-400">{formatCurrency(globalMetrics.paidAmount)}</p>
                  </div>
               </CardContent>
            </Card>

            <Card className="bg-amber-50/50 border-amber-200/50 dark:bg-amber-500/10 dark:border-amber-500/20 relative overflow-hidden group hover:shadow-md transition-all duration-300">
               <div className="absolute -right-2 -bottom-2 opacity-5 scale-150 rotate-12 group-hover:scale-110 transition-transform duration-500">
                  <AlertCircle className="h-24 w-24 text-amber-600" />
               </div>
               <CardContent className="p-5 flex items-center gap-4 relative">
                  <div className="h-12 w-12 rounded-2xl bg-amber-600 text-white flex items-center justify-center shadow-lg shadow-amber-600/20">
                    <Loader2 className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-amber-600/60 uppercase tracking-widest leading-none mb-1">Aguardando</p>
                    <p className="text-xl font-bold font-mono tracking-tight text-amber-700 dark:text-amber-400">{formatCurrency(globalMetrics.pendingAmount)}</p>
                  </div>
               </CardContent>
            </Card>

            <Card className="bg-sky-50/50 border-sky-200/50 dark:bg-sky-500/10 dark:border-sky-500/20 relative overflow-hidden group hover:shadow-md transition-all duration-300">
               <div className="absolute -right-2 -bottom-2 opacity-5 scale-150 rotate-12 group-hover:scale-110 transition-transform duration-500">
                  <TrendingUp className="h-24 w-24 text-sky-600" />
               </div>
               <CardContent className="p-5 flex items-center gap-4 relative">
                  <div className="h-12 w-12 rounded-2xl bg-sky-600 text-white flex items-center justify-center shadow-lg shadow-sky-600/20">
                    <Scale className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-sky-600/60 uppercase tracking-widest leading-none mb-1">Eficiência</p>
                    <p className="text-xl font-bold font-mono tracking-tight text-sky-700 dark:text-sky-400">{globalMetrics.efficiency.toFixed(1)}%</p>
                  </div>
               </CardContent>
            </Card>
          </div>
        )}

        <Card className="border-muted/60 shadow-sm overflow-hidden">
          <CardHeader className="bg-muted/30 border-b border-muted/60 pb-6">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl font-bold font-headline tracking-tight">Ordens Geradas</CardTitle>
                <CardDescription>
                  Gerenciamento granular das ordens de pagamento por período.
                </CardDescription>
              </div>
              <Badge variant="secondary" className="font-mono">{paymentOrders.length} Ordens Totais</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex flex-col h-96 items-center justify-center gap-4">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-muted-foreground animate-pulse font-medium">Buscando histórico financeiro...</p>
              </div>
            ) : paymentOrders.length === 0 ? (
              <div className="flex flex-col h-96 items-center justify-center text-center p-8">
                 <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                   <History className="h-8 w-8 text-muted-foreground" />
                 </div>
                 <h3 className="text-lg font-bold">Nenhuma ordem encontrada</h3>
                 <p className="text-muted-foreground max-w-xs mx-auto">Não há ordens de pagamento registradas no sistema até o momento.</p>
              </div>
            ) : (
              <AlertDialog>
              <div className="divide-y divide-muted/60">
                <Accordion type="multiple" className="w-full">
                  {Object.entries(groupedOrders).map(([groupName, orders]) => {
                    const group = periodGroups.find(g => g.name === groupName);
                    const status = group ? getGroupStatus(group) : null;
                    const groupTotal = orders.reduce((acc, o) => acc + (o.status !== 'cancelled' ? o.amount : 0), 0);
                    
                    return (
                      <AccordionItem value={groupName} key={groupName} className="border-none">
                        <AccordionTrigger className="p-6 hover:bg-muted/20 transition-colors hover:no-underline group">
                          <div className="flex items-center justify-between w-full pr-6">
                             <div className="flex items-center gap-4">
                                <div className="h-10 w-10 rounded-xl bg-background border shadow-sm flex items-center justify-center group-hover:border-primary/40 transition-colors">
                                  <Calendar className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                                </div>
                                <div className="flex flex-col items-start translate-y-0.5">
                                  <span className="text-lg font-bold font-headline tracking-tight">{groupName}</span>
                                  <div className="flex items-center gap-2">
                                     <Badge variant="outline" className="text-[10px] h-4 py-0 font-bold uppercase tracking-tight">{orders.length} ordens</Badge>
                                     {status && (
                                       <Badge variant="outline" className={cn(
                                         "text-[10px] h-4 py-0 font-bold uppercase tracking-tight",
                                         status.variant === 'default' ? "text-green-600 border-green-200" :
                                         status.variant === 'outline' ? "text-blue-600 border-blue-200" :
                                         "text-muted-foreground border-muted"
                                       )}>
                                         {status.text}
                                       </Badge>
                                     )}
                                  </div>
                                </div>
                             </div>
                             <div className="flex items-center gap-8">
                                <div className="text-right flex flex-col items-end">
                                   <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest leading-none mb-1">Total do Período</span>
                                   <span className="text-lg font-bold font-mono tracking-tight text-primary">{formatCurrency(groupTotal)}</span>
                                </div>
                             </div>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="pb-6 px-6">
                          <div className="rounded-xl border border-muted/60 bg-background/50 overflow-hidden shadow-sm">
                            <Table>
                              <TableHeader>
                                <TableRow className="bg-muted/30 hover:bg-muted/30 border-muted/60">
                                  <TableHead className="text-[10px] uppercase font-bold tracking-widest">Responsável</TableHead>
                                  <TableHead className="text-[10px] uppercase font-bold tracking-widest">Data Geração</TableHead>
                                  <TableHead className="text-[10px] uppercase font-bold tracking-widest text-right">Base</TableHead>
                                  <TableHead className="text-[10px] uppercase font-bold tracking-widest text-center">Ajustes</TableHead>
                                  <TableHead className="text-[10px] uppercase font-bold tracking-widest text-right">Total</TableHead>
                                  <TableHead className="text-[10px] uppercase font-bold tracking-widest text-center">Status</TableHead>
                                  <TableHead className="text-[10px] uppercase font-bold tracking-widest text-right pr-6">Ações</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {orders.map(order => {
                                   const currentStatus = statusConfig[order.status] || { label: 'Desconhecido', variant: 'secondary' };
                                   return (
                                   <TableRow key={order.id} className="hover:bg-muted/20 border-muted/40 group/row transition-colors">
                                    <TableCell className="py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center shadow-sm">
                                              {getResponsibleIcon(order.responsibleType)}
                                            </div>
                                            <div className="flex flex-col">
                                              <span className="font-bold text-sm tracking-tight">{order.responsibleName}</span>
                                              <span className="text-[10px] text-muted-foreground uppercase font-semibold">
                                                {order.responsibleType === 'user' ? 'Vendedor' : order.responsibleType === 'branch' ? 'Filial' : 'Função'}
                                              </span>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-xs font-medium text-muted-foreground">
                                      {format(parseISO(order.generatedAt), "dd/MM/yy 'às' HH:mm")}
                                    </TableCell>
                                    <TableCell className="text-right font-mono text-xs text-muted-foreground">
                                      {formatCurrency(order.baseAward)}
                                    </TableCell>
                                    <TableCell>
                                      <div className="flex items-center justify-center gap-3">
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <div className={cn("flex flex-col items-center", order.extraBonus > 0 ? "opacity-100" : "opacity-20")}>
                                              <span className="text-[9px] font-bold text-sky-600">+{formatCurrency(order.extraBonus)}</span>
                                            </div>
                                          </TooltipTrigger>
                                          <TooltipContent>Bônus Extra</TooltipContent>
                                        </Tooltip>

                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <div className={cn("flex flex-col items-center", order.discount > 0 ? "opacity-100" : "opacity-20")}>
                                              <span className="text-[9px] font-bold text-red-600">-{formatCurrency(order.discount)}</span>
                                            </div>
                                          </TooltipTrigger>
                                          <TooltipContent>Deduções/Descontos</TooltipContent>
                                        </Tooltip>
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                      <span className="font-bold font-mono text-sm tracking-tight">{formatCurrency(order.amount)}</span>
                                    </TableCell>
                                    <TableCell className="text-center">
                                      <Badge variant={currentStatus.variant} className={cn(
                                        "text-[9px] h-5 px-2 font-bold uppercase tracking-tighter",
                                        order.status === 'paid' ? "bg-green-600 hover:bg-green-700" : ""
                                      )}>
                                        {order.status === 'paid' && <Check className="h-2 w-2 mr-1" />}
                                        {currentStatus.label}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="text-right pr-6 space-x-1.5 opacity-40 group-hover/row:opacity-100 transition-opacity">
                                       <Tooltip>
                                         <TooltipTrigger asChild>
                                            <Button variant="outline" size="icon" className="h-8 w-8 hover:bg-primary hover:text-white transition-all border-muted-foreground/20" 
                                                    onClick={() => router.push(`/dashboard/payment-history-orders-premium/${order.id}`)}>
                                              <Printer className="h-3.5 w-3.5"/>
                                            </Button>
                                         </TooltipTrigger>
                                         <TooltipContent>Imprimir Ordem</TooltipContent>
                                       </Tooltip>

                                       {order.status === 'pending' && (
                                        <>
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <Button variant="outline" size="icon" className="h-8 w-8 hover:bg-green-600 hover:text-white transition-all border-green-600/20 text-green-600" 
                                                      onClick={() => handleMarkAsPaid(order.id)}>
                                                <Check className="h-3.5 w-3.5"/>
                                              </Button>
                                            </TooltipTrigger>
                                            <TooltipContent>Marcar como Pago</TooltipContent>
                                          </Tooltip>

                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <AlertDialogTrigger asChild>
                                                <Button variant="outline" size="icon" className="h-8 w-8 hover:bg-destructive hover:text-white transition-all border-destructive/20 text-destructive" 
                                                        onClick={() => setOrderToCancel(order)}>
                                                  <Undo2 className="h-3.5 w-3.5"/>
                                                </Button>
                                              </AlertDialogTrigger>
                                            </TooltipTrigger>
                                            <TooltipContent>Estornar Ordem</TooltipContent>
                                          </Tooltip>
                                        </>
                                       )}
                                    </TableCell>
                                  </TableRow>
                                )})}
                              </TableBody>
                            </Table>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              </div>
              {orderToCancel && (
                  <AlertDialogContent className="max-w-md border-primary/10 shadow-2xl">
                      <AlertDialogHeader>
                          <div className="h-12 w-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mb-4">
                            <Undo2 className="h-6 w-6" />
                          </div>
                          <AlertDialogTitle className="text-xl font-bold font-headline">Estornar Ordem de Pagamento?</AlertDialogTitle>
                          <AlertDialogDescription className="text-base">
                              Esta ação marcará a ordem de pagamento para <strong className="text-foreground">{orderToCancel.responsibleName}</strong> como <span className="text-destructive font-bold">cancelada</span>. 
                              <br/><br/>
                              Esta operação é irreversível e o valor deixará de constar nos totais pagos.
                          </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter className="mt-6">
                          <AlertDialogCancel onClick={() => setOrderToCancel(null)} className="font-bold">Voltar</AlertDialogCancel>
                          <AlertDialogAction onClick={handleCancelOrder} className="bg-destructive hover:bg-destructive/90 font-bold">Sim, estornar</AlertDialogAction>
                      </AlertDialogFooter>
                  </AlertDialogContent>
              )}
              </AlertDialog>
            )}
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}
