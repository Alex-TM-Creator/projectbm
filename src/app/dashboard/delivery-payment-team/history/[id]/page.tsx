
"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Loader2, Printer, ArrowLeft, Users, Percent, DollarSign } from "lucide-react";
import type { DeliveryTeamPaymentOrder } from "@/lib/definitions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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
  TableFooter as TableFoot
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";

export default function PrintDeliveryTeamPaymentPage() {
  const { id } = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const [order, setOrder] = React.useState<DeliveryTeamPaymentOrder | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (typeof id !== 'string') return;
    const fetchOrderData = async () => {
      try {
        setLoading(true);
        const orderDocRef = doc(db, "deliveryTeamPaymentOrders", id);
        const orderDocSnap = await getDoc(orderDocRef);

        if (!orderDocSnap.exists()) {
          toast({ title: "Ordem de pagamento não encontrada", variant: "destructive" });
          router.push('/dashboard/delivery-payment-team/history');
          return;
        }
        
        const orderData = orderDocSnap.data() as DeliveryTeamPaymentOrder;
        setOrder(orderData);

      } catch (error) {
        console.error("Error fetching order details:", error);
        toast({ title: "Erro ao carregar detalhes", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    fetchOrderData();
  }, [id, router, toast]);
  
  const formatCurrency = (value: number | undefined) => {
    if(value === undefined) return "R$ 0,00";
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
        return format(parseISO(dateString), "dd/MM/yyyy", { locale: ptBR });
    } catch(e) {
        return "Data inválida";
    }
  };
  
  const formatDateTime = (timestamp: any) => {
    if (!timestamp?.toDate) return "N/A";
    return format(timestamp.toDate(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  };
  
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin" />
      </div>
    );
  }

  if (!order) {
    return null;
  }

  return (
    <div className="bg-background text-foreground min-h-screen p-4 sm:p-8 print:p-2 print:text-xs">
      <div className="mx-auto max-w-2xl">
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

        <Card className="print:shadow-none print:border-none">
          <CardHeader className="text-center print:p-2">
            <CardTitle className="text-2xl font-bold print:text-base">Relatório de Pagamento da Equipe</CardTitle>
            <CardDescription className="print:text-xs">
              Gerado em: {formatDateTime(order.createdAt)}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 print:space-y-2 p-6 print:p-2">
            <div className="grid grid-cols-2 gap-4 rounded-lg border p-4 print:p-2 print:gap-2">
                 <div className="space-y-1">
                    <h3 className="font-semibold print:text-xs">Período de Referência</h3>
                    <p className="text-muted-foreground print:text-xs">{formatDate(order.periodStartDate)} a {formatDate(order.periodEndDate)}</p>
                </div>
                 <div className="space-y-1">
                    <h3 className="font-semibold print:text-xs flex items-center gap-1.5"><Percent className="h-4 w-4"/>Comissão da Empresa</h3>
                    <p className="text-muted-foreground print:text-xs">{order.companyCommission}%</p>
                </div>
            </div>
            
             <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-muted rounded-md text-sm">
                    <p className="text-muted-foreground">Total Serviços (Subida de Escada)</p>
                    <p className="font-semibold text-lg">{formatCurrency(order.totalServiceValue)}</p>
                </div>
                <div className="p-3 bg-green-100 dark:bg-green-900/50 rounded-md text-sm">
                    <p className="text-green-800 dark:text-green-300">Total Distribuído para Equipe</p>
                    <p className="font-semibold text-lg text-green-700 dark:text-green-200">{formatCurrency(order.totalDistributed)}</p>
                </div>
            </div>

             <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2 text-sm print:text-xs"><Users className="h-4 w-4 text-muted-foreground"/> Pagamentos Individuais</h3>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="print:p-1">Membro</TableHead>
                            <TableHead className="print:p-1">Função</TableHead>
                            <TableHead className="text-center print:p-1">Participações</TableHead>
                            <TableHead className="text-right print:p-1">Valor a Receber</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {order.results.map((item, index) => (
                          <TableRow key={index}>
                                <TableCell className="print:p-1">{item.name}</TableCell>
                                <TableCell className="print:p-1"><Badge variant="outline">{item.type}</Badge></TableCell>
                                <TableCell className="text-center print:p-1">{item.participations}</TableCell>
                                <TableCell className="text-right print:p-1 font-semibold">{formatCurrency(item.amountToReceive)}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
             </div>
          </CardContent>
           <CardFooter className="flex-col items-center justify-center text-xs text-muted-foreground pt-8 print:pt-4">
             <p className="mt-8 border-t border-dashed w-full max-w-xs mx-auto pt-2 text-center print:mt-4 print:text-[9px]">Assinatura do Responsável</p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
