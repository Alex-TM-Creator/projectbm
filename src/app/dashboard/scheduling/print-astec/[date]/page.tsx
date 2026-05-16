
"use client";

import * as React from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { doc, getDoc, getDocs, collection, query, where, documentId } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Loader2, Printer, ArrowLeft, Building2, User, Home, Phone, MapPin, AlertCircle, CreditCard, Package, GitFork, ShoppingCart, Undo2 } from "lucide-react";
import type { AssistanceRequest, Customer, AstecLaudo } from "@/lib/definitions";
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
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function PrintAstecSchedulePage() {
  const { date: dateParam } = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { toast } = useToast();
  const [astecRequests, setAstecRequests] = React.useState<AssistanceRequest[]>([]);
  const [customers, setCustomers] = React.useState<Customer[]>([]);
  const [laudos, setLaudos] = React.useState<AstecLaudo[]>([]);
  const [loading, setLoading] = React.useState(true);

  const date = typeof dateParam === 'string' ? dateParam : '';
  const astecIds = searchParams.get('ids')?.split(',') || [];

  React.useEffect(() => {
    if (astecIds.length === 0) {
      setLoading(false);
      return;
    }
    
    const fetchAstecs = async () => {
      try {
        setLoading(true);
        const [astecsSnap, customersSnap, laudosSnap] = await Promise.all([
          getDocs(query(
            collection(db, "astec"),
            where(documentId(), "in", astecIds)
          )),
          getDocs(collection(db, "customers")),
          getDocs(query(
            collection(db, "astecLaudos"),
            where("astecId", "in", astecIds)
          ))
        ]);
       
        const fetchedAstecs = astecsSnap.docs.map(d => ({ id: d.id, ...d.data() } as AssistanceRequest));
        setAstecRequests(fetchedAstecs);
        setCustomers(customersSnap.docs.map(d => ({ id: d.id, ...d.data() } as Customer)));
        
        const fetchedLaudos = laudosSnap.docs.map(d => ({ id: d.id, ...d.data() } as AstecLaudo));
        fetchedLaudos.sort((a, b) => {
            const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
            const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
            return timeB - timeA;
        });
        setLaudos(fetchedLaudos);

      } catch (error) {
        toast({ title: "Erro ao buscar chamados ASTEC", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };

    fetchAstecs();
  }, [astecIds.join(','), toast]); 

  const formatDate = (timestamp: any) => {
    if (!timestamp?.toDate) return "Data inválida";
    return format(timestamp.toDate(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  };
  
  const formatPhone = (phone?: { number: string; type: string; }) => {
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
  
  if (astecRequests.length === 0 && !loading) {
     return (
       <div className="flex h-screen items-center justify-center text-center">
         <div>
            <h1 className="text-xl font-semibold">Nenhum chamado ASTEC para imprimir</h1>
            <p className="text-muted-foreground">Volte e selecione os chamados na tela da Rota do Dia.</p>
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
          {astecRequests.map((request) => {
            const customer = customers.find(c => c.id === request.customerId);
            const laudo = laudos.find(l => l.astecId === request.id);
            return (
              <Card key={request.id} className="print:shadow-none print:border-none print:break-before-page p-4">
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
            )
          })}
        </div>
      </div>
    </div>
  );
}
