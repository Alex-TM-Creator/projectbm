

"use client";

import * as React from "react";
import {
  collection,
  getDocs,
  query,
  where,
  addDoc,
  serverTimestamp,
  updateDoc,
  doc,
  getDoc,
  limit,
  orderBy,
  writeBatch,
} from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { useAuthState } from "react-firebase-hooks/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import type { Caixa, CaixaConta, User as UserType, Branch, SalesOrder, PaymentMethod, ClosingAuthorizationRequest, CaixaTransaction } from "@/lib/definitions";
import { Loader2, Store, Lock, Unlock, DollarSign, Frown, ShieldAlert, GitFork, User as UserIcon, Send, CheckCircle, XCircle, ArrowDownToLine, ArrowRightLeft, Wallet, AlertCircle, Calendar } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
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
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { errorEmitter, FirestorePermissionError } from "@/lib/firebase-error-handler";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export default function CaixaPage() {
  const { toast } = useToast();
  const [user, authLoading] = useAuthState(auth);
  const [userData, setUserData] = React.useState<UserType | null>(null);
  const [caixaConta, setCaixaConta] = React.useState<CaixaConta | null>(null);
  const [branches, setBranches] = React.useState<Branch[]>([]);
  const [paymentMethods, setPaymentMethods] = React.useState<PaymentMethod[]>([]);
  const [activeCaixa, setActiveCaixa] = React.useState<Caixa | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isRequestingAuth, setIsRequestingAuth] = React.useState(false);
  const [hasPendingAuthorization, setHasPendingAuthorization] = React.useState(false);

  const [openingBalance, setOpeningBalance] = React.useState<number | "">("");
  const [receivedByMethod, setReceivedByMethod] = React.useState<Record<string, number>>({});
  const [confirmedAmounts, setConfirmedAmounts] = React.useState<Record<string, number | "">>({});
  const [justification, setJustification] = React.useState("");
  
  const totalReceived = React.useMemo(() => Object.values(receivedByMethod).reduce((sum, value) => sum + value, 0), [receivedByMethod]);
  const totalConfirmed = React.useMemo(() => Object.values(confirmedAmounts).reduce((sum, value) => sum + (Number(value) || 0), 0), [confirmedAmounts]);
  const totalAdjustments = React.useMemo(() => (activeCaixa?.transactions || []).reduce((sum, t) => sum + t.value, 0), [activeCaixa]);
  const currentBalance = (activeCaixa?.openingBalance || 0) + totalReceived + totalAdjustments;
  const difference = totalConfirmed - currentBalance;
  
  const formatCurrency = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const handleCurrencyInputChange = (setter: React.Dispatch<React.SetStateAction<number | "">>) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, '');
    if (rawValue === '') {
      setter('');
      return;
    }
    const numericValue = parseInt(rawValue, 10) / 100;
    setter(numericValue);
  };
  
  const handleConfirmedAmountChange = (method: string, value: string) => {
    const rawValue = value.replace(/\D/g, '');
    if (rawValue === '') {
      setConfirmedAmounts(prev => ({...prev, [method]: ''}));
      return;
    }
    const numericValue = parseInt(rawValue, 10) / 100;
    setConfirmedAmounts(prev => ({...prev, [method]: numericValue}));
  }

  const formatCurrencyForInput = (value: number | "") => {
    if (value === "") return "";
    return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(value);
  };
  
  const getBranchName = (branchId: string) => branches.find(b => b.id === branchId)?.name || "Desconhecida";


  const fetchData = React.useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      
      const [userDocSnap, contaQuerySnap, branchesSnap, paymentMethodsSnap] = await Promise.all([
        getDoc(doc(db, "users", user.uid)),
        getDocs(query(collection(db, "caixaContas"), where("userId", "==", user.uid), limit(1))),
        getDocs(collection(db, "branches")),
        getDocs(collection(db, "paymentMethods")),
      ]);
      
      const currentUserData = userDocSnap.exists() ? (userDocSnap.data() as UserType) : null;
      setUserData(currentUserData);
      setBranches(branchesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Branch)));
      const fetchedPaymentMethods = paymentMethodsSnap.docs.map(d => ({ id: d.id, ...d.data() } as PaymentMethod));
      setPaymentMethods(fetchedPaymentMethods);
      
      if (contaQuerySnap.empty) {
        setCaixaConta(null);
        setActiveCaixa(null);
        setLoading(false);
        return;
      }
      
      const userCaixaConta = contaQuerySnap.docs[0].data() as CaixaConta;
      setCaixaConta(userCaixaConta);
      
      const caixaQuery = query(collection(db, "caixas"), where("userId", "==", user.uid));
      const caixaSnap = await getDocs(caixaQuery);

      const allUserCaixas = caixaSnap.docs.map(d => ({ id: d.id, ...d.data() } as Caixa));
      // Filter for open caixas and then sort locally by date to get the most recent one.
      const currentlyActiveCaixa = allUserCaixas
        .filter(c => c.status === 'open')
        .sort((a, b) => (b.openedAt?.seconds || 0) - (a.openedAt?.seconds || 0))[0] || null;

      setActiveCaixa(currentlyActiveCaixa);
      setConfirmedAmounts({}); // Reset on data fetch
      setHasPendingAuthorization(false);

      if (currentlyActiveCaixa) {
        const salesOrdersSnap = await getDocs(collection(db, "salesOrders"));
        const allOrders = salesOrdersSnap.docs.map(d => d.data() as SalesOrder);
        const receivedAmountsByMethod: Record<string, number> = {};

        allOrders.forEach(order => {
          if (Array.isArray(order.payments)) {
            order.payments.forEach(payment => {
              if (Array.isArray(payment.installments)) {
                payment.installments.forEach(installment => {
                  if (installment.paid && installment.paidInCaixaId === currentlyActiveCaixa.id) {
                    const methodName = fetchedPaymentMethods.find(pm => pm.id === payment.paymentMethodId)?.name || 'Outros';
                    receivedAmountsByMethod[methodName] = (receivedAmountsByMethod[methodName] || 0) + installment.value;
                  }
                });
              }
            });
          }
        });
        setReceivedByMethod(receivedAmountsByMethod);

        // Check for pending authorization
        const authReqQuery = query(
            collection(db, "caixaClosingAuthorizations"), 
            where("caixaId", "==", currentlyActiveCaixa.id), 
            where("status", "==", "pending")
        );
        const authReqSnap = await getDocs(authReqQuery);
        setHasPendingAuthorization(!authReqSnap.empty);
      }


    } catch (error) {
      console.error("Erro ao buscar dados do caixa:", error);
      toast({ title: "Erro ao buscar dados do caixa", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  React.useEffect(() => {
    if (user && !authLoading) {
      fetchData();
    } else if (!user && !authLoading) {
      setLoading(false);
    }
  }, [user, authLoading, fetchData]);

  const handleOpenCaixa = async () => {
    if (typeof openingBalance !== 'number' || openingBalance < 0 || !caixaConta || !userData) return;
    setIsSubmitting(true);
    const dataToSave: Omit<Caixa, 'id' | 'closedAt' | 'closingBalance'> = {
        userId: userData.id,
        userName: userData.name,
        branchId: caixaConta.branchId,
        openingBalance: openingBalance,
        openedAt: serverTimestamp(),
        status: 'open',
        transactions: [],
      };
    
    addDoc(collection(db, "caixas"), dataToSave)
        .then((newCaixaRef) => {
            const newActiveCaixa = {
                id: newCaixaRef.id,
                ...dataToSave,
                openedAt: new Date(),
            }
            setActiveCaixa(newActiveCaixa as Caixa);
            setReceivedByMethod({});
            toast({ title: "Caixa Aberto!", description: "Você já pode iniciar as operações." });
        })
        .catch(error => {
            errorEmitter.emit('permission-error', new FirestorePermissionError(error, {
                operation: 'write',
                path: 'caixas',
                resource: dataToSave,
            }));
        })
        .finally(() => {
            setIsSubmitting(false);
            setOpeningBalance("");
        });
  };

  const handleCloseCaixa = async () => {
    if (!activeCaixa) return;
    setIsSubmitting(true);
    const closingBalance = currentBalance;
    const docRef = doc(db, "caixas", activeCaixa.id);
    const dataToSave = {
        status: 'closed',
        closedAt: serverTimestamp(),
        closingBalance: closingBalance,
        confirmedBalance: totalConfirmed,
        difference: difference
    };

    updateDoc(docRef, dataToSave)
        .then(() => {
            toast({ title: "Caixa Fechado!", description: "Suas operações foram encerradas por hoje." });
            setActiveCaixa(null);
            setConfirmedAmounts({});
        })
        .catch(error => {
             errorEmitter.emit('permission-error', new FirestorePermissionError(error, {
                operation: 'write',
                path: `caixas/${activeCaixa.id}`,
                resource: dataToSave,
            }));
        })
        .finally(() => {
            setIsSubmitting(false);
        });
  };
  
  const handleRequestAuthorization = async () => {
    if (hasPendingAuthorization) {
      toast({
        title: "Aguardando Autorização",
        description: "Já existe uma solicitação de fechamento pendente para este caixa.",
        variant: "default",
      });
      return;
    }
    if (!activeCaixa || !userData || !justification.trim()) {
        toast({ title: "Justificativa obrigatória", variant: "destructive" });
        return;
    }
    setIsRequestingAuth(true);

    const requestData: Omit<ClosingAuthorizationRequest, 'id'> = {
        caixaId: activeCaixa.id,
        userId: userData.id,
        userName: userData.name,
        branchId: activeCaixa.branchId,
        branchName: getBranchName(activeCaixa.branchId),
        expectedAmount: currentBalance,
        confirmedAmount: totalConfirmed,
        difference: difference,
        details: Object.entries(confirmedAmounts).map(([method, amount]) => ({
            paymentMethod: method,
            expected: receivedByMethod[method] || 0,
            confirmed: Number(amount) || 0,
        })),
        justification,
        status: 'pending',
        requestedAt: serverTimestamp(),
    };

    addDoc(collection(db, "caixaClosingAuthorizations"), requestData)
        .then(() => {
            toast({ title: "Solicitação Enviada!", description: "Seu pedido de fechamento foi enviado para aprovação."});
            setHasPendingAuthorization(true); // Optimistically update UI
            document.getElementById('close-alert-dialog')?.click();
        })
        .catch(error => {
             errorEmitter.emit('permission-error', new FirestorePermissionError(error, {
                operation: 'write',
                path: 'caixaClosingAuthorizations',
                resource: requestData,
            }));
        })
        .finally(() => {
            setIsRequestingAuth(false);
        });
  }

  
  if (loading || authLoading) {
    return <div className="flex justify-center items-center h-96"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }
  
  if (!caixaConta) {
    return (
        <Card className="max-w-2xl mx-auto">
            <CardHeader className="text-center">
                <ShieldAlert className="mx-auto h-12 w-12 text-destructive mb-4" />
                <CardTitle>Acesso não configurado</CardTitle>
                <CardDescription>
                    Seu usuário não está vinculado a nenhum caixa. Peça a um administrador para vincular seu usuário a uma filial na tela de "Caixa/Conta".
                </CardDescription>
            </CardHeader>
        </Card>
    );
  }

  const hasDifference = Math.abs(difference) > 0.001;

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Header da Página */}
      <div className="flex items-center justify-between bg-card/40 backdrop-blur-md p-6 rounded-3xl border border-border/50 shadow-sm">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-3 text-foreground">
            <div className="p-3 bg-primary/10 rounded-2xl">
              <Store className="h-7 w-7 text-primary" />
            </div>
            Gestão do Caixa
          </h1>
          <p className="text-muted-foreground mt-2 ml-1">
            Controle de fluxo de valores e fechamento diário da filial.
          </p>
        </div>
        {activeCaixa && (
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 px-4 py-1.5 text-sm font-semibold rounded-full flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            Caixa Operante
          </Badge>
        )}
      </div>
      
      {activeCaixa ? (
        <AlertDialog>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Coluna Principal: Resumo e Saldo */}
            <div className="lg:col-span-2 flex flex-col gap-6">
              
              {/* O Grande Card Hero de Saldo */}
              <Card className="bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-background border-emerald-500/20 shadow-none overflow-hidden relative">
                <div className="absolute top-0 right-0 -mr-8 -mt-8 opacity-10">
                  <Wallet className="w-48 h-48 text-emerald-500" />
                </div>
                <CardContent className="p-8 relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                  <div>
                    <h2 className="text-emerald-700/80 dark:text-emerald-400 font-semibold mb-2 uppercase tracking-wide text-sm flex items-center gap-2">
                      <DollarSign className="w-4 h-4" /> Saldo Atual em Caixa
                    </h2>
                    <div className="text-5xl font-black text-emerald-700 dark:text-emerald-400 tracking-tight">
                      {formatCurrency(currentBalance)}
                    </div>
                  </div>
                  <div className="text-right flex flex-col gap-1 items-start sm:items-end bg-background/40 backdrop-blur-sm p-4 rounded-2xl border border-border/30">
                    <span className="text-xs text-muted-foreground uppercase font-semibold">Valor Inicial</span>
                    <span className="text-lg font-bold">{formatCurrency(activeCaixa.openingBalance)}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Card de Detalhamento das Movimentações */}
              <Card className="border-border/50 shadow-sm bg-card/50 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-lg">Movimentaçoes do Dia</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  
                  {/* Seção Recebimentos */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                      <ArrowDownToLine className="w-4 h-4 text-primary" /> Valores Recebidos
                    </h3>
                    <div className="bg-background/50 rounded-xl p-1 border border-border/50">
                      {Object.keys(receivedByMethod).length > 0 ? (
                        <div className="divide-y divide-border/30">
                          {Object.entries(receivedByMethod).map(([method, amount]) => (
                            <div key={method} className="flex justify-between items-center p-3 hover:bg-muted/50 rounded-lg transition-colors">
                                <span className="font-medium text-foreground">{method}</span>
                                <span className="font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full text-sm">+{formatCurrency(amount)}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-6 text-center text-muted-foreground text-sm flex flex-col items-center gap-2">
                          <DollarSign className="w-8 h-8 opacity-20" />
                          Nenhum recebimento processado hoje.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Seção Ajustes (se existirem) */}
                  {activeCaixa.transactions && activeCaixa.transactions.length > 0 && (
                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                        <ArrowRightLeft className="w-4 h-4 text-amber-500" /> Ajustes e Sangrias
                      </h3>
                      <div className="bg-background/50 rounded-xl p-1 border border-border/50">
                        <div className="divide-y divide-border/30">
                          {activeCaixa.transactions.map(t => (
                              <div key={t.id} className="flex flex-col sm:flex-row sm:justify-between sm:items-center p-3 hover:bg-muted/50 rounded-lg transition-colors gap-2">
                                  <div className="flex flex-col">
                                    <span className="font-medium text-foreground text-sm">{t.notes}</span>
                                    {t.paymentMethodName && <span className="text-xs text-muted-foreground">{t.paymentMethodName}</span>}
                                  </div>
                                  <span className={cn(
                                    "font-bold px-3 py-1 rounded-full text-sm w-fit", 
                                    t.value < 0 ? "text-rose-600 dark:text-rose-400 bg-rose-500/10" : "text-blue-600 dark:text-blue-400 bg-blue-500/10"
                                  )}>
                                    {formatCurrency(t.value)}
                                  </span>
                              </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                </CardContent>
              </Card>

            </div>

            {/* Coluna Lateral: Status e Fechamento */}
            <div className="flex flex-col gap-6">
              
              <Card className="border-border/50 shadow-sm bg-card/50 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-md font-semibold">Informações da Operação</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div className="flex items-center gap-3 p-3 bg-background/50 rounded-xl border border-border/50">
                    <div className="p-2 bg-blue-500/10 rounded-lg text-blue-600"><Calendar className="w-4 h-4" /></div>
                    <div className="flex flex-col">
                      <span className="text-xs text-muted-foreground font-medium">Data de Abertura</span>
                      <span className="font-semibold">{activeCaixa.openedAt?.toDate ? format(activeCaixa.openedAt.toDate(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : '...'}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3 p-3 bg-background/50 rounded-xl border border-border/50">
                    <div className="p-2 bg-purple-500/10 rounded-lg text-purple-600"><UserIcon className="w-4 h-4" /></div>
                    <div className="flex flex-col">
                      <span className="text-xs text-muted-foreground font-medium">Operador de Caixa</span>
                      <span className="font-semibold">{activeCaixa.userName}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-3 bg-background/50 rounded-xl border border-border/50">
                    <div className="p-2 bg-amber-500/10 rounded-lg text-amber-600"><GitFork className="w-4 h-4" /></div>
                    <div className="flex flex-col">
                      <span className="text-xs text-muted-foreground font-medium">Filial Vinculada</span>
                      <span className="font-semibold">{getBranchName(activeCaixa.branchId)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-destructive/5 text-destructive border-none shadow-sm text-center">
                <CardContent className="pt-6">
                  <p className="text-sm font-medium mb-4 opacity-80">Finalizou o expediente?</p>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="lg" className="w-full font-bold h-12 text-md shadow-lg" disabled={isSubmitting}>
                      {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin"/> : <Lock className="mr-2 h-5 w-5"/>}
                      Encerrar Caixa
                    </Button>
                  </AlertDialogTrigger>
                </CardContent>
              </Card>

            </div>
          </div>

          {/* Modal Magnífico de Conferência de Fechamento */}
          <AlertDialogContent className="sm:max-w-xl p-0 overflow-hidden border-border/50 shadow-2xl">
              <div className="bg-muted/30 p-6 border-b border-border/50">
                <AlertDialogTitle className="text-2xl font-bold flex items-center gap-2">
                  <Lock className="w-6 h-6 text-primary" /> Conferência Final
                </AlertDialogTitle>
                <AlertDialogDescription className="text-base mt-2">
                  Valide os montantes físicos e bancários (maquininha/PIX) antes de fechar.
                </AlertDialogDescription>
              </div>
              
              <div className="px-6 py-4 space-y-6 max-h-[55vh] overflow-y-auto scrollbar-thin">
                 
                 {/* Resumo do Sistema */}
                 <div className="rounded-2xl border bg-background overflow-hidden">
                    <div className="bg-muted/50 px-4 py-2 border-b">
                      <span className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Sistema Aponta:</span>
                    </div>
                    <div className="p-4 space-y-3">
                      <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Suprimento Inicial</span>
                          <span className="font-medium">{formatCurrency(activeCaixa.openingBalance)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Entradas</span>
                          <span className="font-medium text-emerald-600">+{formatCurrency(totalReceived)}</span>
                      </div>
                      
                      {/* Breakdown of received amounts in the Modal */}
                      {Object.keys(receivedByMethod).length > 0 && (
                        <div className="pl-4 border-l-2 border-border/50 space-y-1 my-2">
                           {Object.entries(receivedByMethod).map(([method, amount]) => (
                               <div key={method} className="flex justify-between items-center text-xs">
                                   <span className="text-muted-foreground">{method}</span>
                                   <span className="font-medium text-emerald-600/80">+{formatCurrency(amount)}</span>
                               </div>
                           ))}
                        </div>
                      )}
                      
                       {totalAdjustments !== 0 && (
                          <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Ajustes/Sangria</span>
                              <span className={cn("font-medium", totalAdjustments < 0 ? "text-rose-600" : "text-blue-600")}>{formatCurrency(totalAdjustments)}</span>
                          </div>
                       )}
                      <Separator className="my-2" />
                      <div className="flex justify-between items-center bg-primary/5 p-3 rounded-xl border border-primary/10">
                          <span className="font-bold text-foreground">Total Líquido Esperado</span>
                          <span className="font-black text-xl text-primary">{formatCurrency(currentBalance)}</span>
                      </div>
                    </div>
                 </div>

                {/* Área de Input do Operador */}
                <div className="space-y-4">
                    <Label className="text-base font-bold flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-muted-foreground" />
                      Informe os valores reais conferidos:
                    </Label>
                    
                    <div className="grid gap-3 bg-secondary/10 p-4 rounded-2xl border border-secondary/20">
                      {Object.keys(receivedByMethod).length > 0 ? Object.entries(receivedByMethod).map(([method]) => {
                        const expectedAmount = receivedByMethod[method] || 0;
                        const confirmedAmount = confirmedAmounts[method] ?? "";
                        const isMatch = confirmedAmount !== "" && Math.abs(Number(confirmedAmount) - expectedAmount) < 0.01;
                        const isWrong = confirmedAmount !== "" && !isMatch;

                        return (
                        <div key={method} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-background rounded-xl border shadow-sm">
                          <Label htmlFor={`confirmed-${method}`} className="font-semibold">{method}</Label>
                          <div className="relative w-full sm:w-1/2">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">R$</span>
                            <Input
                              id={`confirmed-${method}`}
                              type="text"
                              placeholder="0,00"
                              value={formatCurrencyForInput(confirmedAmounts[method] ?? '')}
                              onChange={(e) => handleConfirmedAmountChange(method, e.target.value)}
                              className={cn(
                                "text-right font-bold pr-10 pl-8 h-10 transition-all",
                                isMatch && "border-emerald-500 bg-emerald-500/5 focus-visible:ring-emerald-500",
                                isWrong && "border-rose-500 bg-rose-500/5 focus-visible:ring-rose-500"
                              )}
                            />
                            {isMatch && <CheckCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-600" />}
                            {isWrong && <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-rose-600" />}
                          </div>
                        </div>
                      )}) : (
                        <p className="text-sm text-muted-foreground text-center py-4 bg-background rounded-xl border">Nada a conferir financeiramente hoje.</p>
                      )}
                    </div>
                </div>

                {/* Resumo da Diferença */}
                <div className={cn(
                  "p-5 rounded-2xl border shadow-sm transition-colors duration-300",
                  !hasDifference ? 'bg-gradient-to-r from-emerald-500/10 to-emerald-500/5 border-emerald-500/30' : 'bg-gradient-to-r from-rose-500/10 to-rose-500/5 border-rose-500/30'
                )}>
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-bold text-foreground">Soma Conferida:</span>
                    <span className="font-black text-lg">{formatCurrency(totalConfirmed)}</span>
                  </div>
                  <div className="flex justify-between items-center border-t border-black/10 dark:border-white/10 pt-2">
                    <span className={cn("font-bold", !hasDifference ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400')}>
                      Status da Divergência:
                    </span>
                    <span className={cn("font-black text-xl", !hasDifference ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400')}>
                      {difference === 0 ? 'Bateu Exato!' : formatCurrency(difference)}
                    </span>
                  </div>
                </div>
                
                {hasDifference && (
                  <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                      <Label htmlFor="justification" className="font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" /> Justifique a sobra/falta abaixo:
                      </Label>
                      <Textarea 
                        id="justification" 
                        value={justification} 
                        onChange={e => setJustification(e.target.value)} 
                        className="bg-rose-500/5 border-rose-500/20 focus-visible:ring-rose-500/50"
                        placeholder="Ex: Troco errado, dinheiro rasgado, esqueci de lançar uma sangria..." 
                      />
                  </div>
                )}
              </div>
            
            <AlertDialogFooter className="bg-muted/30 p-4 border-t border-border/50 sm:justify-between items-center">
              <AlertDialogCancel id="close-alert-dialog" className="m-0 bg-background">Voltar e Revisar</AlertDialogCancel>
              <div className="flex gap-2">
                {!hasDifference ? (
                    <AlertDialogAction onClick={handleCloseCaixa} disabled={isSubmitting} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-10 px-8">
                        {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin"/> : <CheckCircle className="mr-2 h-5 w-5"/>}
                        Confirmar e Fechar
                    </AlertDialogAction>
                ) : (
                    <Button onClick={handleRequestAuthorization} disabled={isRequestingAuth || !justification.trim() || hasPendingAuthorization} variant="destructive" className="font-bold h-10 px-8">
                        {isRequestingAuth ? <Loader2 className="mr-2 h-5 w-5 animate-spin"/> : <Send className="mr-2 h-5 w-5" />}
                        {hasPendingAuthorization ? "Autorização Pendente..." : "Pedir Autorização para Fechar"}
                    </Button>
                )}
              </div>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : (
        <div className="min-h-[60vh] flex items-center justify-center">
          <Card className="w-full max-w-lg shadow-xl shadow-primary/5 border-primary/10 bg-card/80 backdrop-blur-md rounded-3xl overflow-hidden relative">
            <div className="absolute top-0 right-0 -mr-12 -mt-12 opacity-5 pointer-events-none">
              <Store className="w-64 h-64 text-primary" />
            </div>
            
            <CardHeader className="text-center pt-10 pb-6 relative z-10">
              <div className="mx-auto w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-6">
                <Store className="w-10 h-10 text-primary" />
              </div>
              <CardTitle className="text-3xl font-black text-foreground">Abrir Caixa</CardTitle>
              <CardDescription className="text-base mt-2 max-w-sm mx-auto">
                Para iniciar as vendas do dia, informe com quanto de troco (suprimento) a gaveta está começando.
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-8 px-10 relative z-10">
              <div className="space-y-3">
                <Label htmlFor="opening-balance" className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Wallet className="w-4 h-4" /> Dinheiro Físico (Troco Inicial)
                </Label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-muted-foreground/50">R$</span>
                  <Input
                    id="opening-balance"
                    type="text"
                    value={formatCurrencyForInput(openingBalance)}
                    onChange={handleCurrencyInputChange(setOpeningBalance)}
                    placeholder="0,00"
                    disabled={isSubmitting}
                    className="h-20 text-center text-4xl font-black font-headline transition-all border-2 border-border/50 focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/20 rounded-2xl bg-background/50 shadow-inner"
                  />
                </div>
              </div>
            </CardContent>
            
            <CardFooter className="px-10 pb-10 pt-4 bg-muted/20 border-t border-border/50 relative z-10">
              <Button 
                onClick={handleOpenCaixa} 
                disabled={isSubmitting || openingBalance === ""}
                className="w-full h-14 text-lg font-bold rounded-2xl shadow-lg shadow-primary/25 transition-all hover:shadow-primary/40 hover:-translate-y-1"
                size="lg"
              >
                {isSubmitting ? <Loader2 className="mr-2 h-6 w-6 animate-spin"/> : <Unlock className="mr-2 h-6 w-6"/>}
                Confirmar e Abrir Caixa
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}
    </div>
  );
}

