
"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc, getDocs, collection } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Loader2, Printer, ArrowLeft, GitFork, User, Package, Check } from "lucide-react";
import type { TransferOrder, Branch } from "@/lib/definitions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const statusConfig: { [key in TransferOrder['status']]: { label: string; variant: "default" | "secondary" | "outline" | "destructive"; className?: string } } = {
  pending: { label: "Pendente", variant: "secondary" },
  separating: { label: "Em Separação", variant: "outline" },
  in_transit: { label: "Em Trânsito", variant: "default" },
  received: { label: "Recebido", variant: "default", className: "bg-green-600 hover:bg-green-700" },
  received_partially: { label: "Recebido Parcialmente", variant: "default", className: "bg-yellow-500 hover:bg-yellow-600" },
  returned: { label: "Devolvido", variant: "destructive" },
  cancelled: { label: "Cancelado", variant: "destructive" },
};


export default function PrintTransferOrderPage() {
  const { id } = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const [order, setOrder] = React.useState<TransferOrder | null>(null);
  const [branches, setBranches] = React.useState<Branch[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (typeof id !== 'string') return;
    const fetchOrder = async () => {
      try {
        setLoading(true);
        const [docSnap, branchesSnap] = await Promise.all([
          getDoc(doc(db, "transferOrders", id)),
          getDocs(collection(db, "branches")),
        ]);

        if (docSnap.exists()) {
          setOrder(docSnap.data() as TransferOrder);
        } else {
          toast({ title: "Ordem não encontrada", variant: "destructive" });
          router.push('/dashboard/transfers/history');
        }

        setBranches(branchesSnap.docs.map(d => ({id: d.id, ...d.data()}) as Branch));

      } catch (error) {
        toast({ title: "Erro ao buscar ordem", variant: "destructive" });
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchOrder();
  }, [id, router, toast]);

  const getBranchName = (branchId: string) => branches.find(b => b.id === branchId)?.name || 'N/A';
  const formatDate = (timestamp: any) => {
    if (!timestamp?.toDate) return "Data inválida";
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
    return (
      <div className="flex h-screen items-center justify-center">
        <p>Ordem de transferência não encontrada.</p>
      </div>
    );
  }
  
  const currentStatus = statusConfig[order.status] || { label: "Desconhecido", variant: "secondary" };


  return (
    <div className="bg-background text-foreground min-h-screen p-4 sm:p-8">
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

        <Card className="print:shadow-none print:border-none">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">Solicitação de Transferência de Estoque</CardTitle>
            <CardDescription>
              Gerado em: {formatDate(order.createdAt)}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 rounded-lg border p-4">
                <div className="space-y-1">
                    <h3 className="font-semibold flex items-center gap-2"><GitFork className="h-4 w-4 text-muted-foreground"/> Origem</h3>
                    <p className="text-muted-foreground">{getBranchName(order.originBranchId)}</p>
                </div>
                 <div className="space-y-1">
                    <h3 className="font-semibold flex items-center gap-2"><GitFork className="h-4 w-4 text-muted-foreground"/> Destino</h3>
                    <p className="text-muted-foreground">{getBranchName(order.destinationBranchId)}</p>
                </div>
                 <div className="space-y-1">
                    <h3 className="font-semibold flex items-center gap-2"><User className="h-4 w-4 text-muted-foreground"/> Solicitante</h3>
                    <p className="text-muted-foreground">{order.requesterName}</p>
                </div>
                 <div className="space-y-1 col-span-1 md:col-span-3">
                    <h3 className="font-semibold">Status</h3>
                    <Badge variant={currentStatus.variant} className={currentStatus.className}>{currentStatus.label}</Badge>
                </div>
            </div>
            
             <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2"><Package className="h-4 w-4 text-muted-foreground"/> Itens Solicitados</h3>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Produto</TableHead>
                            <TableHead className="text-right">Qtd. Enviada</TableHead>
                             <TableHead className="text-right">Qtd. Recebida</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {order.items.map(item => (
                            <TableRow key={item.productId}>
                                <TableCell>{item.productName}</TableCell>
                                <TableCell className="text-right">{item.quantity}</TableCell>
                                <TableCell className="text-right">{item.receivedQuantity ?? "-"}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
             </div>
          </CardContent>
           <CardFooter className="flex-col items-center justify-between text-xs text-muted-foreground pt-12">
            <div className="grid grid-cols-2 gap-8 w-full">
                <div className="text-center">
                    <p className="mt-8 border-t border-dashed w-full max-w-xs mx-auto pt-2">Assinatura do Responsável (Origem)</p>
                </div>
                <div className="text-center">
                     <p className="mt-8 border-t border-dashed w-full max-w-xs mx-auto pt-2">Assinatura do Responsável (Destino)</p>
                </div>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
