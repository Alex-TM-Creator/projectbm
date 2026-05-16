
"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Loader2, Printer, ArrowLeft, User, GitFork, DollarSign, FileText } from "lucide-react";
import type { Caixa, Branch, SalesOrder, PaymentMethod, SalesOrderPayment } from "@/lib/definitions";
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
import { Separator } from "@/components/ui/separator";

type GroupedPaymentDetail = {
  orderNumber: number;
  customerName: string;
  paymentMethod: string;
  totalValue: number;
};

export default function PrintCaixaPage() {
  const { id } = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const [caixa, setCaixa] = React.useState<Caixa | null>(null);
  const [branch, setBranch] = React.useState<Branch | null>(null);
  const [groupedPayments, setGroupedPayments] = React.useState<GroupedPaymentDetail[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (typeof id !== 'string') return;
    const fetchCaixaData = async () => {
      try {
        setLoading(true);
        const caixaDocRef = doc(db, "caixas", id);
        const caixaDocSnap = await getDoc(caixaDocRef);

        if (!caixaDocSnap.exists()) {
          toast({ title: "Registro de caixa não encontrado", variant: "destructive" });
          router.push('/dashboard/caixa/history');
          return;
        }
        
        const caixaData = { id: caixaDocSnap.id, ...caixaDocSnap.data() } as Caixa;
        setCaixa(caixaData);

        if (caixaData.branchId) {
            const branchDocSnap = await getDoc(doc(db, "branches", caixaData.branchId));
            if (branchDocSnap.exists()) {
              setBranch(branchDocSnap.data() as Branch);
            }
        }
        
        const salesOrdersSnap = await getDocs(query(collection(db, "salesOrders")));
        const paymentMethodsSnap = await getDocs(collection(db, "paymentMethods"));
        const paymentMethods = paymentMethodsSnap.docs.map(d => ({id: d.id, ...d.data() as PaymentMethod}));
        const getPaymentMethodName = (pmId: string) => paymentMethods.find(pm => pm.id === pmId)?.name || "N/A";

        const paymentsMap = new Map<string, GroupedPaymentDetail>();

        salesOrdersSnap.forEach(orderDoc => {
            const order = orderDoc.data() as SalesOrder;
            (order.payments || []).forEach((p: SalesOrderPayment) => {
                (p.installments || []).forEach(i => {
                    if (i.paidInCaixaId === id) {
                        const paymentMethodName = getPaymentMethodName(p.paymentMethodId);
                        const key = `${order.orderNumber}-${order.customerName}-${paymentMethodName}`;
                        
                        if (paymentsMap.has(key)) {
                          paymentsMap.get(key)!.totalValue += i.value;
                        } else {
                          paymentsMap.set(key, {
                            orderNumber: order.orderNumber,
                            customerName: order.customerName,
                            paymentMethod: paymentMethodName,
                            totalValue: i.value
                          });
                        }
                    }
                })
            })
        });

        setGroupedPayments(Array.from(paymentsMap.values()));

      } catch (error) {
        console.error("Error fetching caixa details:", error);
        toast({ title: "Erro ao carregar detalhes", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    fetchCaixaData();
  }, [id, router, toast]);
  
  const formatCurrency = (value: number | undefined) => {
    if(value === undefined) return "R$ 0,00";
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  }

  const formatDate = (timestamp: any) => {
    if (!timestamp?.toDate && typeof timestamp !== 'string') {
        return "Data inválida";
    }
    
    let date;
    if (timestamp.toDate) {
        date = timestamp.toDate();
    } else {
        try {
            date = parseISO(timestamp);
        } catch (e) {
            return "Data inválida";
        }
    }
    return format(date, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  };
  
  const hasDifference = caixa?.difference !== undefined && caixa.difference !== 0;

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin" />
      </div>
    );
  }

  if (!caixa) {
    return null;
  }

  const totalReceived = groupedPayments.reduce((sum, item) => sum + item.totalValue, 0);
  const totalAdjustments = (caixa.transactions || []).reduce((sum, t) => sum + t.value, 0);
  const totalExpected = caixa.openingBalance + totalReceived + totalAdjustments;

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
            <CardTitle className="text-2xl font-bold print:text-base">Extrato de Fechamento de Caixa</CardTitle>
            <CardDescription className="print:text-xs">
              Fechado em: {formatDate(caixa.closedAt)}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 print:space-y-2 p-6 print:p-2">
            <div className="grid grid-cols-2 gap-4 rounded-lg border p-4 print:p-2 print:gap-2">
                <div className="space-y-1">
                    <h3 className="font-semibold flex items-center gap-2 text-sm print:text-xs"><User className="h-4 w-4 text-muted-foreground"/> Operador</h3>
                    <p className="text-muted-foreground print:text-xs">{caixa.userName}</p>
                </div>
                 <div className="space-y-1">
                    <h3 className="font-semibold flex items-center gap-2 text-sm print:text-xs"><GitFork className="h-4 w-4 text-muted-foreground"/> Filial</h3>
                    <p className="text-muted-foreground print:text-xs">{branch?.name || 'N/A'}</p>
                </div>
                 <div className="space-y-1">
                    <h3 className="font-semibold print:text-xs">Abertura</h3>
                    <p className="text-muted-foreground print:text-xs">{formatDate(caixa.openedAt)}</p>
                </div>
                 <div className="space-y-1">
                    <h3 className="font-semibold print:text-xs">Fechamento</h3>
                    <p className="text-muted-foreground print:text-xs">{formatDate(caixa.closedAt)}</p>
                </div>
            </div>
            
             <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2 text-sm print:text-xs"><DollarSign className="h-4 w-4 text-muted-foreground"/> Recebimentos do Período</h3>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="print:p-1">Pedido Nº</TableHead>
                            <TableHead className="print:p-1">Cliente</TableHead>
                            <TableHead className="print:p-1">Forma de Pgto.</TableHead>
                            <TableHead className="text-right print:p-1">Valor Total</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {groupedPayments.length > 0 ? (
                            groupedPayments.map((item, index) => (
                            <TableRow key={index}>
                                    <TableCell className="print:p-1">#{item.orderNumber}</TableCell>
                                    <TableCell className="print:p-1">{item.customerName}</TableCell>
                                    <TableCell className="print:p-1">{item.paymentMethod}</TableCell>
                                    <TableCell className="text-right print:p-1">{formatCurrency(item.totalValue)}</TableCell>
                                </TableRow>
                            ))
                        ) : (
                             <TableRow>
                                <TableCell colSpan={4} className="text-center text-muted-foreground print:p-1">Nenhum recebimento no período.</TableCell>
                             </TableRow>
                        )}
                    </TableBody>
                    <TableFoot>
                      <TableRow className="font-bold">
                        <TableCell colSpan={3} className="text-right print:p-1">Total Recebido</TableCell>
                        <TableCell className="text-right print:p-1">{formatCurrency(totalReceived)}</TableCell>
                      </TableRow>
                    </TableFoot>
                </Table>
             </div>
             
             {caixa.transactions && caixa.transactions.length > 0 && (
                 <div>
                    <h3 className="font-semibold mb-2 flex items-center gap-2 text-sm print:text-xs"><DollarSign className="h-4 w-4 text-muted-foreground"/> Ajustes no Caixa</h3>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="print:p-1">Data</TableHead>
                                <TableHead className="print:p-1">Descrição</TableHead>
                                <TableHead className="text-right print:p-1">Valor</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {caixa.transactions.map((t, index) => (
                                <TableRow key={`${t.id}-${index}`}>
                                    <TableCell className="print:p-1 text-xs">{formatDate(t.timestamp)}</TableCell>
                                    <TableCell className="print:p-1">{t.notes}{t.paymentMethodName && ` (${t.paymentMethodName})`}</TableCell>
                                    <TableCell className="text-right print:p-1 font-medium text-red-600">{formatCurrency(t.value)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                         <TableFoot>
                            <TableRow className="font-bold">
                                <TableCell colSpan={2} className="text-right print:p-1">Total Ajustes</TableCell>
                                <TableCell className="text-right print:p-1">{formatCurrency(totalAdjustments)}</TableCell>
                            </TableRow>
                         </TableFoot>
                    </Table>
                </div>
            )}
             
            <div className="space-y-2 rounded-lg border p-4 print:p-2">
                <h3 className="font-semibold mb-2 text-center text-sm print:text-xs">Conferência de Caixa</h3>
                <div className="space-y-1">
                   <div className="flex justify-between items-center text-xs print:text-[10px]"><span className="text-muted-foreground">Saldo Inicial:</span><span className="font-medium">{formatCurrency(caixa.openingBalance)}</span></div>
                   <div className="flex justify-between items-center text-xs print:text-[10px]"><span className="text-muted-foreground">Total Recebido:</span><span className="font-medium text-green-600">+ {formatCurrency(totalReceived)}</span></div>
                   {totalAdjustments !== 0 && (
                      <div className="flex justify-between items-center text-xs print:text-[10px]">
                        <span className="text-muted-foreground">Ajustes:</span>
                        <span className="font-medium text-red-600">{formatCurrency(totalAdjustments)}</span>
                      </div>
                   )}
                </div>
                <Separator />
                <div className="flex justify-between items-center text-sm print:text-xs"><span className="font-bold">Total Esperado:</span><span className="font-bold">{formatCurrency(totalExpected)}</span></div>
                <div className="flex justify-between items-center text-sm print:text-xs"><span className="font-bold">Total Conferido:</span><span className="font-bold">{formatCurrency(caixa.confirmedBalance)}</span></div>
                <Separator />
                <div className="flex justify-between items-center text-base font-bold print:text-sm">
                    <span>Diferença:</span>
                    <span className={hasDifference ? (caixa.difference! > 0 ? "text-blue-600" : "text-red-600") : ""}>
                        {formatCurrency(caixa.difference)}
                    </span>
                </div>
                 {caixa.closingNotes && (
                    <div className="pt-2 border-t">
                        <h4 className="font-semibold text-xs print:text-[10px]">Justificativa da Divergência:</h4>
                        <p className="text-xs text-muted-foreground whitespace-pre-wrap print:text-[9px]">{caixa.closingNotes}</p>
                    </div>
                )}
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
