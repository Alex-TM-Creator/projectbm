
"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Loader2, Printer, ArrowLeft, Building2 } from "lucide-react";
import type { PaymentOrder } from "@/lib/definitions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function PrintPaymentOrderPremiumPage() {
  const { id } = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const [order, setOrder] = React.useState<PaymentOrder | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (typeof id !== 'string') return;
    const fetchOrder = async () => {
      try {
        setLoading(true);
        const docRef = doc(db, "paymentHistory", id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setOrder(docSnap.data() as PaymentOrder);
        } else {
          toast({ title: "Ordem não encontrada", variant: "destructive" });
          router.push('/dashboard/payment-history-orders-premium');
        }
      } catch (error) {
        toast({ title: "Erro ao buscar ordem", variant: "destructive" });
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchOrder();
  }, [id, router, toast]);
  
  const formatCurrency = (value: number | undefined) => {
    if(value === undefined) return "R$ 0,00";
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p>Ordem de pagamento não encontrada.</p>
      </div>
    );
  }
  
  const hasAdjustments = order.extraBonus > 0 || order.discount > 0;

  return (
    <div className="bg-background text-foreground min-h-screen p-4 sm:p-8">
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
          <CardHeader className="text-center">
             <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <Building2 className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl font-bold">Ordem de Pagamento</CardTitle>
            <CardDescription>
              Gerada em: {format(parseISO(order.generatedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2 rounded-lg border p-4">
                <h3 className="font-semibold">Responsável</h3>
                <p className="text-muted-foreground">{order.responsibleName}</p>
                 <h3 className="font-semibold pt-2">Grupo de Períodos</h3>
                <p className="text-muted-foreground">{order.periodGroupName}</p>
            </div>
            
            <div className="space-y-4 rounded-lg border p-4">
                <h3 className="font-semibold mb-4 text-center">Resumo Financeiro</h3>
                 <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Prêmio Base Calculado</span>
                    <span className="font-medium">{formatCurrency(order.baseAward)}</span>
                </div>
                {hasAdjustments && (
                    <>
                         {order.extraBonus > 0 && (
                            <div className="flex justify-between items-center text-sm text-blue-600">
                                <span className="">(+) Bônus Extra</span>
                                <span className="font-medium">{formatCurrency(order.extraBonus)}</span>
                            </div>
                         )}
                         {order.discount > 0 && (
                             <div className="flex justify-between items-center text-sm text-red-600">
                                <span className="">(-) Desconto</span>
                                <span className="font-medium">{formatCurrency(order.discount)}</span>
                            </div>
                         )}
                    </>
                )}
                 <div className="border-t border-dashed my-2"></div>
                 <div className="flex justify-between items-center text-lg">
                    <span className="font-bold">VALOR TOTAL</span>
                    <span className="font-bold text-green-600">{formatCurrency(order.amount)}</span>
                </div>
            </div>

            {order.notes && (
                <div className="space-y-2 rounded-lg border p-4">
                    <h3 className="font-semibold">Observações</h3>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{order.notes}</p>
                </div>
            )}
          </CardContent>
           <CardFooter className="flex-col items-center justify-center text-xs text-muted-foreground pt-6">
             <p className="text-center">Este é um documento gerado pelo sistema Conect para fins de controle de pagamento de premiações.</p>
             <p className="mt-4">_________________________________________</p>
             <p>Assinatura do Responsável</p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}

    