
"use client";

import * as React from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { doc, getDoc, getDocs, collection, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Loader2, Printer, ArrowLeft, Building2, User as UserIcon } from "lucide-react";
import type { CleaningRequest, Status, CleaningProduct, Company, PriceColumnConfig } from "@/lib/definitions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter as TableFoot } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function PrintCleaningRequestPage() {
  const { id } = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [request, setRequest] = React.useState<CleaningRequest | null>(null);
  const [status, setStatus] = React.useState<Status | null>(null);
  const [products, setProducts] = React.useState<CleaningProduct[]>([]);
  const [companies, setCompanies] = React.useState<Company[]>([]);
  const [priceColumnConfig, setPriceColumnConfig] = React.useState<PriceColumnConfig>({ id: 'priceColumnConfig' });
  const [loading, setLoading] = React.useState(true);

  const showValues = searchParams.get('showValues') !== 'false';

  React.useEffect(() => {
    if (typeof id !== 'string') return;
    const fetchRequest = async () => {
      try {
        setLoading(true);
        const [docSnap, productsSnap, companiesSnap, configSnap] = await Promise.all([
          getDoc(doc(db, "cleaningRequests", id)),
          getDocs(query(collection(db, "cleaningProducts"), orderBy("name"))),
          getDocs(query(collection(db, "companies"), orderBy("name"))),
          getDoc(doc(db, "settings", "priceColumnConfig")),
        ]);

        if (docSnap.exists()) {
          const requestData = docSnap.data() as CleaningRequest;
          setRequest(requestData);

          if (requestData.statusId) {
            const statusSnap = await getDoc(doc(db, "statuses", requestData.statusId));
            if (statusSnap.exists()) {
              setStatus(statusSnap.data() as Status);
            }
          }
        } else {
          toast({ title: "Pedido não encontrado", variant: "destructive" });
          router.push('/dashboard/cleaning/history');
        }

        setProducts(productsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as CleaningProduct)));
        setCompanies(companiesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Company)));
        if (configSnap.exists()) {
          setPriceColumnConfig(configSnap.data() as PriceColumnConfig);
        }

      } catch (error) {
        toast({ title: "Erro ao buscar pedido", variant: "destructive" });
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchRequest();
  }, [id, router, toast]);
  
  const formatCurrency = (value: number | undefined) => {
    if (value === undefined) return "R$ 0,00";
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  }

  const formatDate = (timestamp: any) => {
    if (!timestamp?.toDate) return "Data inválida";
    return format(timestamp.toDate(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  };

  const getCompanyName = (companyId: string | null | undefined): string => companies.find(c => c.id === companyId)?.name || '';

  const totalValue2 = React.useMemo(() => {
    if (!request) return 0;
    return request.items.reduce((sum, item) => {
      const product = products.find(p => p.id === item.productId);
      return sum + ((product?.price2 || 0) * item.quantity);
    }, 0);
  }, [request, products]);

  const totalValue3 = React.useMemo(() => {
    if (!request) return 0;
    return request.items.reduce((sum, item) => {
      const product = products.find(p => p.id === item.productId);
      return sum + ((product?.price3 || 0) * item.quantity);
    }, 0);
  }, [request, products]);


  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin" />
      </div>
    );
  }

  if (!request) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p>Pedido não encontrado.</p>
      </div>
    );
  }

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

        <Card className="print:shadow-none print:border-none print:p-0">
          <CardHeader className="text-center print:p-2 print:pb-0">
            <CardTitle className="text-2xl font-bold print:text-lg">Pedido de Material de Limpeza</CardTitle>
            <CardDescription className="print:text-[10px]">
              Gerado em: {formatDate(request.createdAt)}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 print:space-y-2 print:p-2">
            <div className="grid grid-cols-2 gap-4 rounded-lg border p-4 print:p-2 print:gap-2">
                <div className="space-y-1 print:space-y-0.5">
                    <h3 className="font-semibold flex items-center gap-2 print:text-xs"><Building2 className="h-4 w-4 text-muted-foreground print:h-3 print:w-3"/> Filial</h3>
                    <p className="text-muted-foreground print:text-xs">{request.branchName}</p>
                </div>
                 <div className="space-y-1 print:space-y-0.5">
                    <h3 className="font-semibold flex items-center gap-2 print:text-xs"><UserIcon className="h-4 w-4 text-muted-foreground print:h-3 print:w-3"/> Solicitante</h3>
                    <p className="text-muted-foreground print:text-xs">{request.userName}</p>
                </div>
                 <div className="space-y-1 col-span-2 print:space-y-0.5">
                    <h3 className="font-semibold print:text-xs">Status</h3>
                    <p className="text-muted-foreground print:text-xs">{status?.name || "Não definido"}</p>
                </div>
            </div>
            
             <div>
                <h3 className="font-semibold mb-2 print:text-xs print:mb-1">Itens Solicitados</h3>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="print:h-8 print:py-1 print:text-[10px]">Produto</TableHead>
                            <TableHead className="text-center print:h-8 print:py-1 print:text-[10px]">Qtd.</TableHead>
                            {showValues && <TableHead className="text-right print:h-8 print:py-1 print:text-[10px]">{getCompanyName(priceColumnConfig.price1CompanyId) || "Subtotal 1"}</TableHead>}
                            {showValues && priceColumnConfig.price2CompanyId && <TableHead className="text-right print:h-8 print:py-1 print:text-[10px]">{getCompanyName(priceColumnConfig.price2CompanyId)}</TableHead>}
                            {showValues && priceColumnConfig.price3CompanyId && <TableHead className="text-right print:h-8 print:py-1 print:text-[10px]">{getCompanyName(priceColumnConfig.price3CompanyId)}</TableHead>}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {request.items.map(item => {
                           const product = products.find(p => p.id === item.productId);
                           return (
                            <TableRow key={item.productId} className="print:border-b">
                                <TableCell className="print:py-1 print:text-[10px]">{item.productName}</TableCell>
                                <TableCell className="text-center print:py-1 print:text-[10px]">{item.quantity}</TableCell>
                                {showValues && <TableCell className="text-right print:py-1 print:text-[10px]">{formatCurrency(item.price * item.quantity)}</TableCell>}
                                {showValues && priceColumnConfig.price2CompanyId && <TableCell className="text-right print:py-1 print:text-[10px]">{formatCurrency((product?.price2 || 0) * item.quantity)}</TableCell>}
                                {showValues && priceColumnConfig.price3CompanyId && <TableCell className="text-right print:py-1 print:text-[10px]">{formatCurrency((product?.price3 || 0) * item.quantity)}</TableCell>}
                            </TableRow>
                        )})}
                    </TableBody>
                    {showValues && (
                        <TableFoot>
                            <TableRow className="font-bold text-lg print:text-sm">
                                <TableCell colSpan={2} className="text-right print:py-1">Total</TableCell>
                                <TableCell className="text-right print:py-1">{formatCurrency(request.totalValue)}</TableCell>
                                {priceColumnConfig.price2CompanyId && <TableCell className="text-right print:py-1">{formatCurrency(totalValue2)}</TableCell>}
                                {priceColumnConfig.price3CompanyId && <TableCell className="text-right print:py-1">{formatCurrency(totalValue3)}</TableCell>}
                            </TableRow>
                        </TableFoot>
                    )}
                </Table>
             </div>
          </CardContent>
           <CardFooter className="flex-col items-center justify-center text-xs text-muted-foreground pt-12 print:pt-4">
             <p className="mt-8 print:mt-2">_________________________________________</p>
             <p>Assinatura do Responsável</p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
