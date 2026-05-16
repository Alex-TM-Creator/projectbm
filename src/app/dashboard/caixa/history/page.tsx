

"use client";

import * as React from "react";
import {
  Loader2,
  RefreshCw,
  GitFork,
  User as UserIcon,
  DollarSign,
  History,
  Printer,
  ShieldAlert,
  ArrowUpRight,
  TrendingUp,
} from "lucide-react";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import type { Caixa, Branch, User as UserType } from "@/lib/definitions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

export default function CaixaHistoryPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [allCaixas, setAllCaixas] = React.useState<Caixa[]>([]);
  const [branches, setBranches] = React.useState<Branch[]>([]);
  const [users, setUsers] = React.useState<UserType[]>([]);
  const [loading, setLoading] = React.useState(true);

  const formatCurrency = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  const formatDate = (timestamp: any) => {
    if (!timestamp?.toDate) return "N/A";
    return format(timestamp.toDate(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  };
  
  const getBranchName = (branchId: string) => branches.find(b => b.id === branchId)?.name || "Desconhecida";

  const fetchData = React.useCallback(async () => {
    try {
      setLoading(true);
      const [caixasSnap, branchesSnap, usersSnap] = await Promise.all([
        getDocs(query(collection(db, "caixas"))),
        getDocs(collection(db, "branches")),
        getDocs(collection(db, "users")),
      ]);
      const caixasList = caixasSnap.docs.map(d => ({ id: d.id, ...d.data() } as Caixa))
        .sort((a,b) => (b.closedAt?.seconds || b.openedAt?.seconds || 0) - (a.closedAt?.seconds || a.openedAt?.seconds || 0));
      
      setAllCaixas(caixasList);
      setBranches(branchesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Branch)));
      setUsers(usersSnap.docs.map(d => ({ id: d.id, ...d.data() } as UserType)));
    } catch (error) {
      toast({ title: "Erro ao buscar histórico de caixas", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);
  
  const closedCaixas = React.useMemo(() => allCaixas.filter(c => c.status === 'closed'), [allCaixas]);

  const summaryMetrics = React.useMemo(() => {
     let totalClosingBalance = 0;
     let totalReceived = 0;
     let totalDifference = 0;

     closedCaixas.forEach(c => {
       const hasDifference = c.difference !== undefined && c.difference !== 0;
       const finalBalance = hasDifference ? (c.confirmedBalance ?? 0) : (c.closingBalance ?? 0);
       const adjustments = (c.transactions || []).reduce((sum, t) => sum + t.value, 0);
       
       totalClosingBalance += finalBalance;
       totalReceived += (c.closingBalance ?? 0) - c.openingBalance - adjustments;
       totalDifference += (c.difference || 0);
     });

     return { totalClosingBalance, totalReceived, totalDifference };
  }, [closedCaixas]);

  return (
    <div className="flex flex-col gap-6">
       <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold font-headline tracking-tight flex items-center gap-2">
            <History className="text-primary h-8 w-8" /> Histórico de Caixas
          </h1>
          <p className="text-muted-foreground text-sm">
            Audite todos os fechamentos de caixa realizados no sistema.
          </p>
        </div>
        <Button variant="outline" size="icon" onClick={fetchData} disabled={loading} className="rounded-xl shadow-soft">
          <RefreshCw className={loading ? "animate-spin" : ""} />
        </Button>
      </div>

      {/* Summary Metro */}
      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-none shadow-soft bg-card/40 backdrop-blur-md rounded-3xl overflow-hidden hover:bg-card/60 transition-all border border-border/10">
            <CardContent className="p-5 flex flex-col justify-between h-full">
              <div className="flex items-center justify-between mb-2">
                <div className="p-2 bg-primary/10 rounded-xl text-primary"><TrendingUp className="h-5 w-5" /></div>
                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Saldo em Caixa</span>
              </div>
              <p className="text-xl font-bold font-mono tracking-tighter truncate">{formatCurrency(summaryMetrics.totalClosingBalance)}</p>
            </CardContent>
          </Card>
          
          <Card className="border-none shadow-soft bg-card/40 backdrop-blur-md rounded-3xl overflow-hidden hover:bg-card/60 transition-all border border-border/10">
            <CardContent className="p-5 flex flex-col justify-between h-full">
              <div className="flex items-center justify-between mb-2">
                <div className="p-2 bg-green-500/10 rounded-xl text-green-600"><ArrowUpRight className="h-5 w-5" /></div>
                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Total Recebido</span>
              </div>
              <p className="text-xl font-bold font-mono tracking-tighter truncate">{formatCurrency(summaryMetrics.totalReceived)}</p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-soft bg-card/40 backdrop-blur-md rounded-3xl overflow-hidden hover:bg-card/60 transition-all border border-border/10">
            <CardContent className="p-5 flex flex-col justify-between h-full">
              <div className="flex items-center justify-between mb-2">
                <div className="p-2 bg-destructive/10 rounded-xl text-destructive"><ShieldAlert className="h-5 w-5" /></div>
                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Dif. Acumulada</span>
              </div>
              <p className={cn("text-xl font-bold font-mono tracking-tighter truncate", summaryMetrics.totalDifference >= 0 ? "text-green-600" : "text-destructive")}>
                {formatCurrency(summaryMetrics.totalDifference)}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card className="border-none shadow-glass bg-card/60 backdrop-blur-xl rounded-3xl overflow-hidden">
        <CardHeader className="bg-muted/10 border-b border-border/10">
          <CardTitle className="text-xl font-headline">Caixas Fechados</CardTitle>
          <CardDescription>
            {loading ? "Carregando..." : `${closedCaixas.length} fechamentos de caixa auditados.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>
          ) : closedCaixas.length === 0 ? (
            <div className="text-center text-muted-foreground py-16">Nenhum caixa fechado encontrado.</div>
          ) : (
             <Accordion type="multiple" className="w-full space-y-3">
              {closedCaixas.map((caixa) => {
                const hasDifference = caixa.difference !== undefined && caixa.difference !== 0;
                const finalBalance = hasDifference ? (caixa.confirmedBalance ?? 0) : (caixa.closingBalance ?? 0);
                const totalAdjustments = (caixa.transactions || []).reduce((sum, t) => sum + t.value, 0);
                const totalReceived = (caixa.closingBalance ?? 0) - caixa.openingBalance - totalAdjustments;
                
                return (
                  <AccordionItem value={caixa.id} key={caixa.id} className="border border-border/50 rounded-2xl overflow-hidden transition-all hover:border-primary/20 hover:shadow-sm bg-background/40">
                    <AccordionTrigger className="p-5 hover:no-underline hover:bg-muted/5 group">
                       <div className="flex flex-col md:flex-row md:items-center justify-between w-full gap-4 pr-4">
                          <div className="flex-1 space-y-1 text-left">
                            <div className="font-bold text-lg flex items-center gap-2 text-foreground/80 group-hover:text-primary transition-colors">
                                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                    <UserIcon className="h-4 w-4"/>
                                </div>
                                <span>{caixa.userName}</span>
                            </div>
                            <div className="text-[10px] text-muted-foreground/60 flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
                              <span className="flex items-center gap-1.5 bg-muted/50 px-2 py-0.5 rounded-md uppercase font-bold tracking-wider"><GitFork className="h-3 w-3"/> {getBranchName(caixa.branchId)}</span>
                              <span className="flex items-center gap-1.5 bg-muted/50 px-2 py-0.5 rounded-md uppercase font-bold tracking-wider">Fechado em: {formatDate(caixa.closedAt)}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-6">
                            {hasDifference && (
                               <Badge className={cn("text-[10px] font-bold uppercase tracking-widest px-2 py-1 h-6 shadow-sm", caixa.difference! > 0 ? 'bg-green-500/10 text-green-600 border-green-200' : 'bg-destructive/10 text-destructive border-destructive/20')}>
                                    <ShieldAlert className="mr-1 h-3 w-3" /> Dif: {formatCurrency(caixa.difference!)}
                               </Badge>
                            )}
                            <div className="flex flex-col items-end gap-1">
                                <p className="text-xl font-bold font-mono tracking-tight text-foreground/90">{formatCurrency(finalBalance)}</p>
                                <span className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-widest">Saldo Final</span>
                            </div>
                          </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="p-4 pt-0">
                      <div className="flex justify-end mb-4">
                        <Button variant="outline" size="sm" onClick={() => router.push(`/dashboard/caixa/print/${caixa.id}`)}>
                            <Printer className="mr-2 h-4 w-4"/>
                            Imprimir Extrato
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                        <div className="space-y-1 p-4 bg-background/40 border border-border/10 rounded-2xl shadow-sm">
                            <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Abertura</p>
                            <p className="font-medium text-foreground/80">{formatDate(caixa.openedAt)}</p>
                        </div>
                         <div className="space-y-1 p-4 bg-background/40 border border-border/10 rounded-2xl shadow-sm">
                            <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Saldo Inicial</p>
                            <p className="font-bold font-mono text-lg">{formatCurrency(caixa.openingBalance)}</p>
                        </div>
                         <div className="space-y-1 p-4 bg-background/40 border border-border/10 rounded-2xl shadow-sm">
                            <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Total Recebido</p>
                            <p className="font-bold font-mono text-lg text-green-600">+{formatCurrency(totalReceived)}</p>
                        </div>
                         {totalAdjustments !== 0 && (
                            <div className="space-y-1 p-4 bg-background/40 border border-border/10 rounded-2xl shadow-sm">
                                <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Ajustes / Sangrias</p>
                                <p className={cn("font-bold font-mono text-lg", totalAdjustments > 0 ? "text-blue-600" : "text-destructive")}>{formatCurrency(totalAdjustments)}</p>
                            </div>
                         )}
                        <div className="space-y-1 p-4 bg-background/40 border border-border/10 rounded-2xl shadow-sm">
                            <p className="text-[10px] uppercase font-bold text-primary tracking-widest">Saldo Final (Relat.)</p>
                            <p className="font-bold font-mono text-lg text-primary">{formatCurrency(finalBalance)}</p>
                        </div>
                         {hasDifference && (
                              <>
                                <div className="space-y-1 p-4 bg-background/40 border border-border/10 rounded-2xl shadow-sm">
                                    <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Valor Esperado</p>
                                    <p className="font-bold font-mono text-lg">{formatCurrency(caixa.closingBalance ?? 0)}</p>
                                </div>
                                <div className="space-y-1 p-4 bg-background/40 border border-border/10 rounded-2xl shadow-sm col-span-1 md:col-span-2">
                                    <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Diferença de Caixa</p>
                                    <p className={cn("font-bold font-mono text-lg", caixa.difference! > 0 ? "text-green-600" : "text-destructive")}>
                                    {formatCurrency(caixa.difference!)} {caixa.difference! > 0 ? "(Sobra)" : "(Quebra)"}
                                    </p>
                                </div>
                                {caixa.closingNotes && (
                                     <div className="space-y-2 p-4 bg-destructive/5 border border-destructive/10 rounded-2xl shadow-sm col-span-full">
                                        <div className="flex items-center gap-2 text-[10px] uppercase font-bold text-destructive tracking-widest">
                                            <ShieldAlert className="h-4 w-4" /> Justificativa de Diferença
                                        </div>
                                        <p className="font-medium whitespace-pre-wrap text-sm italic">"{caixa.closingNotes}"</p>
                                     </div>
                                )}
                              </>
                         )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )
              })}
             </Accordion>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

