
"use client";

import * as React from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { doc, getDoc, getDocs, collection, query, where, documentId } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Loader2, Printer, ArrowLeft, Building2, User, Home, Phone, MapPin, AlertCircle, CreditCard, Package, GitFork, ShoppingCart, Undo2 } from "lucide-react";
import type { SalesOrder, CompanyBranch, SaleType, DeliveryType, Branch, PaymentMethod, ProductModality } from "@/lib/definitions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO, isPast, startOfToday, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import Image from "next/image";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter as TableFoot } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const statusParcelaConfig: { [key: string]: { label: string; variant: "default" | "secondary" | "outline" | "destructive"; className?: string } } = {
  paid: { label: "Pago", variant: "default", className: "bg-green-600 hover:bg-green-700" },
  pending: { label: "Em Aberto", variant: "outline", className: "text-yellow-600 border-yellow-500" },
  overdue: { label: "Atrasado", variant: "destructive" },
};

export default function PrintSchedulePage() {
  const { date: dateParam } = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
  const [orders, setOrders] = React.useState<SalesOrder[]>([]);
  const [productModalities, setProductModalities] = React.useState<ProductModality[]>([]);
  const [paymentMethods, setPaymentMethods] = React.useState<PaymentMethod[]>([]);
  const [companyBranches, setCompanyBranches] = React.useState<CompanyBranch[]>([]);
  const [stockingLocations, setStockingLocations] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  const date = typeof dateParam === 'string' ? dateParam : '';
  const orderIds = searchParams.get('ids')?.split(',') || [];

  React.useEffect(() => {
    if (orderIds.length === 0) {
      setLoading(false);
      return;
    }
    
    const fetchOrders = async () => {
      try {
        setLoading(true);
        const [ordersSnap, modalitiesSnap, paymentMethodsSnap, companyBranchesSnap, stockingSnap] = await Promise.all([
           getDocs(query(
            collection(db, "salesOrders"),
            where(documentId(), "in", orderIds)
          )),
           getDocs(collection(db, "productModalities")),
           getDocs(collection(db, "paymentMethods")),
           getDocs(collection(db, "companyBranches")),
           getDocs(collection(db, "stockingLocations")),
        ]);
       
        const fetchedOrders = ordersSnap.docs.map(d => ({ id: d.id, ...d.data() } as SalesOrder));
        setOrders(fetchedOrders.sort((a,b) => a.orderNumber - b.orderNumber));
        setProductModalities(modalitiesSnap.docs.map(d => ({ id: d.id, ...d.data() } as ProductModality)));
        setPaymentMethods(paymentMethodsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as PaymentMethod)));
        setCompanyBranches(companyBranchesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as CompanyBranch)));
        setStockingLocations(stockingSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      } catch (error) {
        toast({ title: "Erro ao buscar pedidos", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [orderIds.join(','), toast]); 
  
  const getModalityName = (modalityId?: string) => {
    if (!modalityId) return "N/A";
    return productModalities.find(m => m.id === modalityId)?.name || 'N/A';
  }
  
  const getPaymentMethod = (id: string) => paymentMethods.find(pm => pm.id === id);
  const getPaymentMethodName = (paymentMethodId: string) => getPaymentMethod(paymentMethodId)?.name || "N/A";
  
  const getPaymentStatus = (order: SalesOrder) => {
    if (!order.payments || order.payments.length === 0) {
      return null;
    }
    
    const allInstallments = order.payments.flatMap(p => p.installments || []);
    if (allInstallments.every(i => i.paid)) return null;

    const today = startOfToday();
    const hasOverdue = allInstallments.some(i => {
      try {
        return !i.paid && isPast(parseISO(i.dueDate));
      } catch {
        return false;
      }
    });

    if (hasOverdue) {
      return { text: "Pagamento Atrasado", variant: "destructive" as const };
    }
    
    return { text: "Pagamento em Aberto", variant: "outline" as const };
  }

  const getOverallPaymentStatus = (installments: { paid: boolean; dueDate: string }[]): { label: string; variant: "default" | "secondary" | "outline" | "destructive"; className?: string } => {
    if (installments.every(i => i.paid)) {
        return statusParcelaConfig.paid;
    }
    const today = startOfToday();
    const hasOverdue = installments.some(i => {
        try {
            return !i.paid && isPast(parseISO(i.dueDate));
        } catch {
            return false;
        }
    });
    if (hasOverdue) {
        return statusParcelaConfig.overdue;
    }
    return statusParcelaConfig.pending;
  };

  const formatCurrency = (value: number | undefined) => {
    if(value === undefined) return "R$ 0,00";
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return "Data inválida";
    return format(parseISO(dateString), "dd/MM/yyyy", { locale: ptBR });
  };
  
  const formatPhone = (value: string | undefined) => {
    if (!value) return "";
    value = value.replace(/\D/g, "");
    if (value.length > 11) return value.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
    return value.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3");
};

  const formatAddress = (address?: { address: string, number: string, complement?: string, neighborhood: string, city: string, state: string }) => {
    if (!address) return "Endereço não informado";
    return `${address.address}, ${address.number} ${address.complement ? `(${address.complement})` : ''} - ${address.neighborhood}, ${address.city}/${address.state}`;
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin" />
      </div>
    );
  }
  
  if (orders.length === 0 && !loading) {
     return (
       <div className="flex h-screen items-center justify-center text-center">
         <div>
            <h1 className="text-xl font-semibold">Nenhum pedido para imprimir</h1>
            <p className="text-muted-foreground">Volte e selecione os pedidos na tela da Rota do Dia.</p>
            <Button variant="outline" onClick={() => router.back()} className="mt-4">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar
            </Button>
         </div>
       </div>
    );
  }

  return (
    <div className="bg-background text-foreground min-h-screen print:p-0">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 flex justify-between items-center print:hidden">
            <Button variant="outline" onClick={() => router.back()}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar
            </Button>
            <Button onClick={() => window.print()}>
                <Printer className="mr-2 h-4 w-4" />
                Imprimir
            </Button>
        </div>

        <div className="space-y-4 print:space-y-2">
            {orders.map((order, index) => {
                const paymentStatus = getPaymentStatus(order);
                const companyBranch = companyBranches.find(cb => cb.id === order.companyBranchId);
                return (
                <div key={order.id} className="rounded-lg border p-4 print:p-2 space-y-3 break-inside-avoid">
                    <div className="flex justify-between items-start">
                        <div className="space-y-1">
                            <h2 className="font-bold text-lg print:text-base">Pedido #{order.orderNumber}</h2>
                            <p className="flex items-center gap-2 text-sm"><User className="h-4 w-4 text-muted-foreground"/> {order.customerName}</p>
                             {companyBranch && <p className="flex items-center gap-2 text-xs text-muted-foreground"><GitFork className="h-3 w-3"/> Filial: {companyBranch.nome_fantasia}</p>}
                        </div>
                        <div className="text-right">
                           <p className="font-mono text-lg font-semibold">{`#${index + 1}`}</p>
                            {paymentStatus && (
                                <Badge variant={paymentStatus.variant} className="mt-1 gap-1.5">
                                    <AlertCircle className="h-3 w-3" />
                                    {paymentStatus.text}
                                </Badge>
                            )}
                        </div>
                    </div>
                    
                    <Separator />
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                        {order.deliveryAddress && (
                            <div className="space-y-1">
                                <h3 className="font-semibold flex items-center gap-2"><MapPin className="h-4 w-4"/> Endereço de Entrega</h3>
                                <p className="text-muted-foreground text-xs">{formatAddress(order.deliveryAddress)}</p>
                                <p className="text-muted-foreground text-xs">CEP: {order.deliveryAddress.cep}</p>
                            </div>
                        )}
                         {order.deliveryPhone && (
                             <div className="space-y-1">
                                <h3 className="font-semibold flex items-center gap-2"><Phone className="h-4 w-4"/> Telefone</h3>
                                <p className="text-muted-foreground text-xs">{formatPhone(order.deliveryPhone.number)}</p>
                            </div>
                         )}
                    </div>

                    <div className="pt-2">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="h-6 print:p-1">Produto</TableHead>
                                    <TableHead className="h-6 print:p-1">Local Estoque</TableHead>
                                    <TableHead className="h-6 print:p-1 text-center">Qtd.</TableHead>
                                    <TableHead className="h-6 print:p-1">Modalidade</TableHead>
                                    <TableHead className="h-6 print:p-1">Entrega</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {order.items.map((item, idx) => {
                                    const locName = stockingLocations.find(l => l.id === item.originStockingLocationId)?.name || "N/A";
                                    return (
                                        <TableRow key={idx}>
                                            <TableCell className="py-1 print:p-1">{item.productName}</TableCell>
                                            <TableCell className="py-1 print:p-1 text-[10px] text-muted-foreground">{locName}</TableCell>
                                            <TableCell className="py-1 print:p-1 text-center">{item.quantity}</TableCell>
                                            <TableCell className="py-1 print:p-1">{getModalityName(item.productModalityId)}</TableCell>
                                            <TableCell className="py-1 print:p-1">{item.deliveryOption}</TableCell>
                                        </TableRow>
                                    );
                                })}
                                {order.services && order.services.map((service, idx) => (
                                    <TableRow key={`service-${idx}`}>
                                        <TableCell className="py-1 print:p-1">
                                            {service.serviceName} <Badge variant="outline">Serviço</Badge>
                                        </TableCell>
                                        <TableCell colSpan={4}></TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>

                    {order.payments && order.payments.length > 0 && (
                        <div className="pt-2 border-t">
                            <h3 className="font-semibold mb-1 text-xs print:text-[10px] flex items-center gap-2"><CreditCard className="h-4 w-4 text-muted-foreground"/> Pagamento</h3>
                           <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="h-6 print:p-1">Forma</TableHead>
                                  <TableHead className="h-6 print:p-1">Parcelas</TableHead>
                                  <TableHead className="h-6 print:p-1">1º Venc.</TableHead>
                                  <TableHead className="h-6 print:p-1">Status</TableHead>
                                  <TableHead className="h-6 print:p-1 text-right">Valor Total</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {order.payments.map((payment, index) => {
                                  const paymentMethod = getPaymentMethod(payment.paymentMethodId);
                                  const status = getOverallPaymentStatus(payment.installments || []);

                                  return (
                                    <TableRow key={index}>
                                      <TableCell className="py-1 print:p-1">{paymentMethod?.name || 'N/A'}</TableCell>
                                      <TableCell className="py-1 print:p-1">{payment.installments?.length || 1}x</TableCell>
                                      <TableCell className="py-1 print:p-1">{formatDate(payment.installments?.[0]?.dueDate)}</TableCell>
                                      <TableCell className="py-1 print:p-1">
                                        <Badge variant={status.variant} className={`${status.className} text-[10px]`}>{status.label}</Badge>
                                      </TableCell>
                                      <TableCell className="text-right py-1 print:p-1 font-semibold">{formatCurrency(payment.value)}</TableCell>
                                    </TableRow>
                                  )
                                })}
                              </TableBody>
                            </Table>
                        </div>
                    )}


                     {order.observations && (
                         <div className="pt-2">
                             <h4 className="font-semibold text-xs print:text-[10px]">Observações do Pedido:</h4>
                             <p className="text-xs text-muted-foreground whitespace-pre-wrap">{order.observations}</p>
                         </div>
                     )}
                     <div className="pt-4 mt-4 border-t h-20 print:h-12">
                        <p className="text-sm font-semibold">Observações da Entrega:</p>
                     </div>
                     <div className="flex-col items-center justify-center text-xs text-muted-foreground pt-12 print:pt-4">
                        <p className="mt-8 border-t border-dashed w-full max-w-xs mx-auto pt-2 text-center print:mt-4 print:text-[9px]">Assinatura do Cliente</p>
                    </div>
                </div>
            )})}
        </div>
      </div>
    </div>
  );
}
