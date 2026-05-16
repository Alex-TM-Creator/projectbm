
"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc, collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Loader2, Printer, ArrowLeft, Building2, User, Home, Phone } from "lucide-react";
import type { AssistanceRequest, Customer, Phone as PhoneType, AstecLaudo, Address } from "@/lib/definitions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function PrintAstecPage() {
  const { id } = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const [request, setRequest] = React.useState<AssistanceRequest | null>(null);
  const [customer, setCustomer] = React.useState<Customer | null>(null);
  const [laudo, setLaudo] = React.useState<AstecLaudo | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (typeof id !== 'string') return;
    const fetchRequestData = async () => {
      try {
        setLoading(true);
        const requestDocRef = doc(db, "astec", id);
        const requestDocSnap = await getDoc(requestDocRef);

        if (!requestDocSnap.exists()) {
          toast({ title: "Chamado não encontrado", variant: "destructive" });
          router.push('/dashboard/astec/history');
          return;
        }
        
        const requestData = { id: requestDocSnap.id, ...requestDocSnap.data() } as AssistanceRequest;
        setRequest(requestData);

        if (requestData.customerId) {
            const customerDocSnap = await getDoc(doc(db, "customers", requestData.customerId));
            if (customerDocSnap.exists()) {
              setCustomer(customerDocSnap.data() as Customer);
            }
        }
        
        const laudoQuery = query(collection(db, "astecLaudos"), where("astecId", "==", id));
        const laudoSnap = await getDocs(laudoQuery);
        if (!laudoSnap.empty) {
          setLaudo(laudoSnap.docs[0].data() as AstecLaudo);
        }

      } catch (error) {
        console.error("Error fetching ASTEC details:", error);
        toast({ title: "Erro ao carregar detalhes", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    fetchRequestData();
  }, [id, router, toast]);
  
  const formatCurrency = (value: number | undefined) => {
    if(value === undefined) return "R$ 0,00";
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  }

  const formatDate = (timestamp: any) => {
    if (!timestamp?.toDate) return "Data inválida";
    return format(timestamp.toDate(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  };
  
  const formatPhone = (phone: PhoneType) => {
    if (!phone?.number) return "N/A";
    const cleaned = phone.number.replace(/\D/g, '');
    if (cleaned.length === 11) {
      return `(${cleaned.substring(0, 2)}) ${cleaned.substring(2, 7)}-${cleaned.substring(7)}`;
    }
    if (cleaned.length === 10) {
      return `(${cleaned.substring(0, 2)}) ${cleaned.substring(2, 6)}-${cleaned.substring(6)}`;
    }
    return phone.number;
  };
  
  const formatAddress = (address?: Address) => {
    if (!address) return "Endereço não informado.";
    return `${address.address}, ${address.number}, ${address.neighborhood} - ${address.city}/${address.state}`;
  };


  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin" />
      </div>
    );
  }

  if (!request) {
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
            <CardTitle className="text-2xl font-bold print:text-lg">Ordem de Serviço - ASTEC #{request.assistanceNumber}</CardTitle>
            <CardDescription className="print:text-xs">
              Pedido de Venda Original: #{request.orderNumber} | Chamado aberto em: {formatDate(request.createdAt)}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 print:space-y-1">
            <div className="grid grid-cols-1 gap-4 rounded-lg border p-4 print:p-2 print:gap-2">
                <div className="space-y-1">
                    <h3 className="font-semibold flex items-center gap-2 text-sm print:text-xs"><User className="h-4 w-4 text-muted-foreground"/> Cliente</h3>
                    <p className="text-sm print:text-xs">{customer?.name || request.customerName}</p>
                    <p className="text-xs text-muted-foreground print:text-[10px]">{customer?.cpf || customer?.cnpj}</p>
                </div>
                {customer?.phones && (
                    <div className="space-y-1">
                        <h3 className="font-semibold flex items-center gap-2 text-sm print:text-xs"><Phone className="h-4 w-4 text-muted-foreground"/> Telefones</h3>
                        <div className="flex gap-4">
                            {customer.phones.map((p, i) => <p key={i} className="text-xs text-muted-foreground print:text-[10px]">{formatPhone(p)} ({p.type})</p>)}
                        </div>
                    </div>
                )}
                 {request.deliveryAddress && (
                    <div className="space-y-1">
                        <h3 className="font-semibold flex items-center gap-2 text-sm print:text-xs"><Home className="h-4 w-4 text-muted-foreground"/> Endereço do Atendimento</h3>
                        <p className="text-xs text-muted-foreground print:text-[10px]">{formatAddress(request.deliveryAddress)}</p>
                    </div>
                )}
            </div>
            
            <div className="space-y-2 rounded-lg border p-4 print:p-2">
                <h3 className="font-semibold mb-2 text-sm print:text-xs">Produtos para Assistência</h3>
                <ul className="list-disc list-inside text-sm print:text-xs">
                    {request.items.map(item => <li key={item.productId}>{item.productName}</li>)}
                </ul>
            </div>

            <div className="space-y-2 rounded-lg border p-4 print:p-2">
                <h3 className="font-semibold text-sm print:text-xs">Problema / Defeito Relatado</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap print:text-xs">{request.problemDescription}</p>
            </div>
            
             <div className="space-y-2 rounded-lg border p-4 print:p-2 min-h-24">
                <h3 className="font-semibold text-sm print:text-xs">Laudo Técnico e Solução</h3>
                {laudo ? (
                  <div className="space-y-3">
                    <div>
                      <h4 className="font-medium text-xs print:text-[10px]">Análise Técnica:</h4>
                      <p className="text-xs text-muted-foreground whitespace-pre-wrap print:text-[10px]">{laudo.technicalAnalysis}</p>
                    </div>
                     <div>
                      <h4 className="font-medium text-xs print:text-[10px]">Solução Aplicada:</h4>
                      <p className="text-xs text-muted-foreground whitespace-pre-wrap print:text-[10px]">{laudo.solution}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground text-center pt-8 print:pt-4">Nenhum laudo técnico para este chamado.</p>
                )}
             </div>

          </CardContent>
           <CardFooter className="flex-col items-center justify-center text-xs text-muted-foreground print:pt-4">
             <p className="mt-4 border-t border-dashed w-full max-w-xs mx-auto pt-2 text-center print:mt-2 print:text-[9px]">Assinatura do Cliente</p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
