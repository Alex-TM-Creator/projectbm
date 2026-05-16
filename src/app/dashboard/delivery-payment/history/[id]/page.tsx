
"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc, getDocs, collection, query, where, documentId } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Loader2, Printer, ArrowLeft, Car, GitFork, Building2 } from "lucide-react";
import type { DeliveryPaymentOrder, Branch, CompanyBranch, SalesOrder, AssistanceRequest } from "@/lib/definitions";
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
import Image from "next/image";

export default function PrintDeliveryPaymentPage() {
  const { id } = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const [order, setOrder] = React.useState<DeliveryPaymentOrder | null>(null);
  const [branches, setBranches] = React.useState<Branch[]>([]);
  const [companyBranches, setCompanyBranches] = React.useState<CompanyBranch[]>([]);
  const [allOrders, setAllOrders] = React.useState<(SalesOrder | AssistanceRequest)[]>([]);
  const [companyBranch, setCompanyBranch] = React.useState<CompanyBranch | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (typeof id !== 'string') return;
    const fetchOrderData = async () => {
      try {
        setLoading(true);
        const [orderDocSnap, branchesSnap, companyBranchesSnap, salesOrdersSnap, astecSnap] = await Promise.all([
          getDoc(doc(db, "deliveryPaymentOrders", id)),
          getDocs(collection(db, "branches")),
          getDocs(collection(db, "companyBranches")),
          getDocs(collection(db, "salesOrders")),
          getDocs(collection(db, "astec")),
        ]);

        if (!orderDocSnap.exists()) {
          toast({ title: "Ordem de pagamento não encontrada", variant: "destructive" });
          router.push('/dashboard/delivery-payment/history');
          return;
        }
        
        const orderData = orderDocSnap.data() as DeliveryPaymentOrder;
        setOrder(orderData);
        
        const fetchedBranches = branchesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Branch));
        const fetchedCompanyBranches = companyBranchesSnap.docs.map(d => ({ id: d.id, ...d.data() } as CompanyBranch));
        const fetchedAllOrders = [
          ...salesOrdersSnap.docs.map(d => ({...d.data(), id: d.id} as SalesOrder)),
          ...astecSnap.docs.map(d => ({...d.data(), id: d.id} as AssistanceRequest))
        ];

        setBranches(fetchedBranches);
        setCompanyBranches(fetchedCompanyBranches);
        setAllOrders(fetchedAllOrders);

        if (orderData.items.length > 0) {
          const firstItem = orderData.items[0];
          const relatedOrder = fetchedAllOrders.find(o => o.id === firstItem.itemId);
          if (relatedOrder && 'companyBranchId' in relatedOrder && relatedOrder.companyBranchId) {
             const mainCompanyBranch = fetchedCompanyBranches.find(cb => cb.id === relatedOrder.companyBranchId);
             setCompanyBranch(mainCompanyBranch || null);
          } else if (relatedOrder && 'branchName' in relatedOrder) {
            const astecBranchName = (relatedOrder as AssistanceRequest).branchName;
            const branch = fetchedBranches.find(b => b.name === astecBranchName);
            if (branch) {
              const mainCompanyBranch = fetchedCompanyBranches.find(cb => cb.branchId === branch.id);
              setCompanyBranch(mainCompanyBranch || null);
            }
          }
        }


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
        const [year, month, day] = dateString.split('T')[0].split('-');
        return `${day}/${month}/${year}`;
    } catch(e) {
        console.warn("Could not parse date:", dateString, e);
        return "Data inválida";
    }
  };
  
  const formatPhone = (value: string | undefined) => {
    if (!value) return "";
    value = value.replace(/\D/g, "");
    if (value.length > 11) return value.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
    return value.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3");
};

  const getBranchName = (orderId: string, itemType: 'Pedido' | 'ASTEC'): string => {
      const relatedItem = allOrders.find(o => o.id === orderId);
      if (!relatedItem) return 'N/A';

      const companyBranchId = (relatedItem as SalesOrder).companyBranchId || (relatedItem as AssistanceRequest).branchName;
      if (!companyBranchId) return 'N/A';
      
      if (itemType === 'ASTEC') {
          return (relatedItem as AssistanceRequest).branchName || 'N/A';
      }

      const companyBranch = companyBranches.find(cb => cb.id === companyBranchId);
      if (!companyBranch) return 'N/A';

      return branches.find(b => b.id === companyBranch.branchId)?.name || 'N/A';
  }
  
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
          <CardHeader className="flex flex-row items-start justify-between p-6 print:p-2 gap-4">
              <div className="w-32 print:w-24 flex-shrink-0 flex items-center">
                {companyBranch?.logoUrl && (
                    <Image src={companyBranch.logoUrl} alt="Logo da Empresa" width={128} height={64} className="object-contain" priority />
                )}
              </div>
              <div className="text-center flex-grow">
                  <h2 className="font-bold text-base print:text-sm">{companyBranch?.razao_social || 'Empresa'}</h2>
                  <p className="text-xs text-muted-foreground print:text-[10px]">{companyBranch?.cnpj}</p>
                  <p className="text-xs text-muted-foreground print:text-[10px]">{`${companyBranch?.logradouro || ''}, ${companyBranch?.numero || ''} - ${companyBranch?.bairro || ''}, ${companyBranch?.cidade || ''} - ${companyBranch?.uf || ''}`}</p>
                  <p className="text-xs text-muted-foreground print:text-[10px]">{formatPhone(companyBranch?.telefone)}</p>
              </div>
              <div className="w-32 print:w-24 flex-shrink-0" />
          </CardHeader>
          <CardContent className="space-y-4 print:space-y-2 p-6 print:p-2">
             <div className="text-center">
                <CardTitle className="text-2xl font-bold print:text-base">Ordem de Pagamento - Frete</CardTitle>
                <CardDescription className="print:text-xs">
                  Gerado em: {format(parseISO(order.generatedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                </CardDescription>
             </div>
            <div className="grid grid-cols-2 gap-4 rounded-lg border p-4 print:p-2 print:gap-2">
                <div className="space-y-1">
                    <h3 className="font-semibold flex items-center gap-2 text-sm print:text-xs"><Car className="h-4 w-4 text-muted-foreground"/> Motorista</h3>
                    <p className="text-muted-foreground print:text-xs">{order.driverName}</p>
                </div>
                 <div className="space-y-1">
                    <h3 className="font-semibold print:text-xs">Período de Referência</h3>
                    <p className="text-muted-foreground print:text-xs">{formatDate(order.periodStartDate)} a {formatDate(order.periodEndDate)}</p>
                </div>
            </div>
            
             <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2 text-sm print:text-xs"> Detalhes do Frete</h3>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="print:p-1">Data</TableHead>
                            <TableHead className="print:p-1">Tipo</TableHead>
                            <TableHead className="print:p-1">Filial</TableHead>
                            <TableHead className="text-right print:p-1">Valor Final</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {order.items.map((item, index) => (
                          <TableRow key={index}>
                            <TableCell className="print:p-1">{formatDate(item.date)}</TableCell>
                            <TableCell className="print:p-1">{item.type} #{item.number}</TableCell>
                            <TableCell className="print:p-1">{getBranchName(item.itemId, item.type)}</TableCell>
                            <TableCell className="text-right print:p-1">{formatCurrency(item.finalFreight)}</TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                    <TableFoot>
                      <TableRow className="font-bold text-lg">
                        <TableCell colSpan={3} className="text-right print:p-1">Total a Receber</TableCell>
                        <TableCell className="text-right print:p-1">{formatCurrency(order.totalAmount)}</TableCell>
                      </TableRow>
                    </TableFoot>
                </Table>
             </div>
          </CardContent>
           <CardFooter className="flex-col items-center justify-center text-xs text-muted-foreground pt-8 print:pt-4">
             <p className="mt-8 border-t border-dashed w-full max-w-xs mx-auto pt-2 text-center print:mt-4 print:text-[9px]">Assinatura do Motorista</p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
