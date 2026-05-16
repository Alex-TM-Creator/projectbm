"use client";

import * as React from "react";
import {
  Loader2,
  HardHat,
  RefreshCw,
  Frown,
  Printer,
  Trash2,
  Check,
  X,
  History,
} from "lucide-react";
import {
  collection,
  getDocs,
  query,
  orderBy,
  updateDoc,
  doc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import type { AssemblyClosing } from "@/lib/definitions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const statusConfig: { [key in AssemblyClosing['status']]: { label: string; variant: "default" | "secondary" | "outline" | "destructive"; className?: string } } = {
  paid: { label: "Pago", variant: "default", className: "bg-green-600 hover:bg-green-700" },
  pending: { label: "Pendente", variant: "secondary" },
};

export default function AssemblyHistoryPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [closings, setClosings] = React.useState<AssemblyClosing[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [closingToDelete, setClosingToDelete] = React.useState<AssemblyClosing | null>(null);

  const formatCurrency = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
        const [year, month, day] = dateString.split('T')[0].split('-');
        return `${day}/${month}/${year}`;
    } catch(e) {
        return "Data inválida";
    }
  };

  const fetchData = React.useCallback(async () => {
    try {
      setLoading(true);
      const closingsQuery = query(collection(db, "assemblyClosings"), orderBy("closingDate", "desc"));
      const closingsSnap = await getDocs(closingsQuery);
      setClosings(closingsSnap.docs.map(d => ({ id: d.id, ...d.data() } as AssemblyClosing)));
    } catch (error) {
      toast({ title: "Erro ao buscar histórico", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleStatusChange = async (closingId: string, status: AssemblyClosing['status']) => {
    try {
      const docRef = doc(db, "assemblyClosings", closingId);
      await updateDoc(docRef, { 
        status: status,
        paidAt: status === 'paid' ? serverTimestamp() : null,
      });
      toast({ title: `Pagamento marcado como ${status === 'paid' ? 'Pago' : 'Pendente'}` });
      fetchData();
    } catch (error) {
      toast({ title: "Erro ao atualizar status", variant: "destructive" });
    }
  };
  
  const handleDelete = async () => {
    if (!closingToDelete) return;
    try {
      await deleteDoc(doc(db, "assemblyClosings", closingToDelete.id));
      toast({ title: "Fechamento Excluído", variant: "destructive" });
      fetchData();
    } catch (error) {
       toast({ title: "Erro ao excluir fechamento", variant: "destructive" });
    } finally {
      setClosingToDelete(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-headline tracking-tight flex items-center gap-2">
            <History /> Histórico de Fechamentos de Montagem
          </h1>
          <p className="text-muted-foreground">
            Acompanhe e gerencie todos os fechamentos realizados.
          </p>
        </div>
        <Button variant="outline" size="icon" onClick={fetchData} disabled={loading}>
          <RefreshCw className={loading ? "animate-spin h-4 w-4" : "h-4 w-4"} />
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Fechamentos Registrados</CardTitle>
          <CardDescription>
            {loading ? "Carregando..." : `${closings.length} registros encontrados.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>
          ) : closings.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 rounded-lg border border-dashed">
              <Frown className="h-16 w-16 text-muted-foreground" />
              <h2 className="mt-4 text-xl font-semibold">Nenhum fechamento encontrado</h2>
            </div>
          ) : (
             <AlertDialog>
              <Accordion type="multiple" className="w-full space-y-3">
                {closings.map(closing => {
                  const currentStatus = statusConfig[closing.status] || { label: 'Desconhecido', variant: 'secondary' };
                  return (
                    <AccordionItem value={closing.id} key={closing.id} className="border rounded-lg">
                      <AccordionTrigger className="p-4 hover:no-underline text-left">
                         <div className="flex flex-col md:flex-row md:items-center justify-between w-full gap-2">
                            <div className="flex-1 space-y-1">
                              <p className="font-semibold text-lg">{closing.montadorName}</p>
                              <div className="text-sm text-muted-foreground">Data: {formatDate(closing.closingDate)}</div>
                            </div>
                            <div className="flex items-center gap-4">
                                <Badge variant={currentStatus.variant} className={cn("gap-1.5", currentStatus.className)}>
                                  {currentStatus.label}
                                </Badge>
                                <p className="text-lg font-bold text-primary">{formatCurrency(closing.totalPremio)}</p>
                            </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="p-4 pt-0">
                        <div className="flex justify-end mb-4 border-b pb-4 gap-2">
                           <Button variant="outline" size="sm" onClick={() => router.push(`/dashboard/assembly/history/${closing.id}`)}>
                              <Printer className="mr-2 h-4 w-4"/>Imprimir
                           </Button>
                           {closing.status === 'pending' ? (
                             <Button size="sm" onClick={() => handleStatusChange(closing.id, 'paid')}>
                                <Check className="mr-2 h-4 w-4" /> Marcar como Pago
                             </Button>
                           ) : (
                             <Button variant="secondary" size="sm" onClick={() => handleStatusChange(closing.id, 'pending')}>
                                <X className="mr-2 h-4 w-4" /> Marcar como Pendente
                             </Button>
                           )}
                           <AlertDialogTrigger asChild>
                              <Button variant="destructive" size="sm" onClick={() => setClosingToDelete(closing)}>
                                <Trash2 className="mr-2 h-4 w-4" /> Excluir
                              </Button>
                           </AlertDialogTrigger>
                        </div>
                        {/* More details can be added here if needed */}
                      </AccordionContent>
                    </AccordionItem>
                  )
                })}
              </Accordion>
                {closingToDelete && (
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                        <AlertDialogDescription>
                           Esta ação não pode ser desfeita e excluirá permanentemente o fechamento para <strong className="mx-1">{closingToDelete.montadorName}</strong> do dia <strong className="mx-1">{formatDate(closingToDelete.closingDate)}</strong>.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setClosingToDelete(null)}>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete}>Sim, excluir</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
                )}
             </AlertDialog>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
