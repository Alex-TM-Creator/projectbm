"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Loader2, Printer, ArrowLeft } from "lucide-react";
import type { AssemblyClosing } from "@/lib/definitions";
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

export default function PrintAssemblyClosingPage() {
  const { id } = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const [closing, setClosing] = React.useState<AssemblyClosing | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (typeof id !== 'string') return;
    const fetchClosingData = async () => {
      try {
        setLoading(true);
        const closingDocRef = doc(db, "assemblyClosings", id);
        const closingDocSnap = await getDoc(closingDocRef);

        if (!closingDocSnap.exists()) {
          toast({ title: "Fechamento não encontrado", variant: "destructive" });
          router.push('/dashboard/assembly/history');
          return;
        }
        
        setClosing(closingDocSnap.data() as AssemblyClosing);

      } catch (error) {
        console.error("Error fetching closing details:", error);
        toast({ title: "Erro ao carregar detalhes", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    fetchClosingData();
  }, [id, router, toast]);
  
  const formatCurrency = (value: number | undefined) => {
    if(value === undefined) return "R$ 0,00";
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
        const [year, month, day] = dateString.split('T')[0].split('-');
        return `${day}/${month}/${year}`;
    } catch(e) {
        return "Data inválida";
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin" />
      </div>
    );
  }

  if (!closing) {
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
            <CardTitle className="text-2xl font-bold print:text-base">Relatório de Fechamento de Montagem</CardTitle>
            <CardDescription className="print:text-xs">
              Montador: {closing.montadorName} | Data: {formatDate(closing.closingDate)}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 print:space-y-2 p-6 print:p-2">
             <div>
                <h3 className="font-semibold mb-2 text-sm print:text-xs">Itens Montados</h3>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="print:p-1">Cód.</TableHead>
                            <TableHead className="print:p-1">Produto</TableHead>
                            <TableHead className="text-center print:p-1">Qtd.</TableHead>
                            <TableHead className="text-right print:p-1">Total</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {closing.items.map((item, index) => (
                           <TableRow key={`item-${index}`}>
                                <TableCell className="print:p-1 font-mono">{item.internalCode}</TableCell>
                                <TableCell className="print:p-1">{item.productName}</TableCell>
                                <TableCell className="text-center print:p-1">{item.quantity}</TableCell>
                                <TableCell className="text-right print:p-1">{formatCurrency(item.total)}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
             </div>
             
             {closing.assistanceItems && closing.assistanceItems.length > 0 && (
                 <div>
                    <h3 className="font-semibold mb-2 text-sm print:text-xs">Assistências Realizadas</h3>
                    <Table>
                       <TableHeader>
                           <TableRow>
                                <TableHead className="print:p-1">OS Nº</TableHead>
                                <TableHead className="text-right print:p-1">Valor</TableHead>
                           </TableRow>
                       </TableHeader>
                       <TableBody>
                            {closing.assistanceItems.map((item, index) => (
                                <TableRow key={`astec-${index}`}>
                                    <TableCell className="print:p-1">#{item.assistanceNumber}</TableCell>
                                    <TableCell className="text-right print:p-1">{formatCurrency(item.value)}</TableCell>
                                </TableRow>
                            ))}
                       </TableBody>
                    </Table>
                </div>
            )}
             
            <div className="space-y-2 rounded-lg border p-4 print:p-2">
                <h3 className="font-semibold mb-2 text-center text-sm print:text-xs">Resumo e Premiação</h3>
                 <div className="flex justify-between items-center text-xs print:text-[10px]"><span className="text-muted-foreground">Total Produtos (Novo):</span><span className="font-medium">{formatCurrency(closing.totalNovo)}</span></div>
                 <div className="flex justify-between items-center text-xs print:text-[10px]"><span className="text-muted-foreground">Total Produtos (Salvado):</span><span className="font-medium">{formatCurrency(closing.totalSalvado)}</span></div>
                 <div className="flex justify-between items-center text-xs print:text-[10px]"><span className="text-muted-foreground">Total Assistências:</span><span className="font-medium">{formatCurrency(closing.subtotalAssistance)}</span></div>
                <div className="border-t border-dashed my-2"></div>
                <div className="flex justify-between items-center text-sm print:text-xs"><span className="font-semibold">Subtotal Geral:</span><span className="font-semibold">{formatCurrency(closing.totalGeral)}</span></div>
                <div className="border-t border-dashed my-2"></div>
                <h4 className="font-semibold text-xs pt-2">Cálculo do Prêmio</h4>
                {closing.comissaoAplicada ? (
                    <>
                    <div className="flex justify-between items-center text-xs print:text-[10px]"><span className="text-muted-foreground">Comissão (Novo):</span><span className="font-medium">{formatCurrency(closing.comissaoNovo)}</span></div>
                    <div className="flex justify-between items-center text-xs print:text-[10px]"><span className="text-muted-foreground">Comissão (Salvado):</span><span className="font-medium">{formatCurrency(closing.comissaoSalvado)}</span></div>
                    </>
                ) : (
                    <p className="text-xs text-muted-foreground text-center">Comissão por tipo não aplicável (meta de faixa não atingida).</p>
                )}
                <div className="flex justify-between items-center text-xs print:text-[10px]"><span className="text-muted-foreground">Bônus por Faixa:</span><span className="font-medium">{formatCurrency(closing.bonus)}</span></div>
                <div className="border-t border-dashed my-2"></div>
                <div className="flex justify-between items-center text-base font-bold print:text-sm">
                    <span>Total do Prêmio:</span>
                    <span className="text-green-600">{formatCurrency(closing.totalPremio)}</span>
                </div>
            </div>

          </CardContent>
           <CardFooter className="flex-col items-center justify-center text-xs text-muted-foreground pt-8 print:pt-4">
             <p className="mt-8 border-t border-dashed w-full max-w-xs mx-auto pt-2 text-center print:mt-4 print:text-[9px]">Assinatura do Montador</p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
