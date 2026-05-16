
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  updateDoc,
  getDoc,
  writeBatch,
  serverTimestamp,
  orderBy,
  limit,
} from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { useAuthState } from "react-firebase-hooks/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import type { SalesOrder, Customer, PaymentMethod, Installment, SaleType, Branch, CompanyBranch, User as UserType, SalesPermissions, Caixa, CaixaTransaction, ProductModality, CustomerCredit, SalesOrderPayment } from "@/lib/definitions";
import { format, parseISO, isPast, addDays, setDate, lastDayOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, GitFork, User as UserIcon, ShoppingCart, CreditCard, History, Undo2, ChevronDown, ChevronRight, ShieldAlert, Pencil, PlusCircle, Trash2, Check, X, DollarSign } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import {
  Dialog,
  DialogHeader,
  DialogContent,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";


const statusConfig: { [key: string]: { label: string; variant: "default" | "secondary" | "outline" | "destructive" } } = {
  paid: { label: "Pago", variant: "default" },
  pending: { label: "Pendente", variant: "secondary" },
  overdue: { label: "Atrasado", variant: "destructive" },
};

type SelectedInstallments = {
  [key: string]: {
    orderId: string;
    paymentId: string;
    installmentNumber: number;
    value: number;
  }
};


export default function RecebimentoPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [user, authLoading] = useAuthState(auth);
  const [userData, setUserData] = React.useState<UserType | null>(null);
  const [hasPermission, setHasPermission] = React.useState(false);
  const [orders, setOrders] = React.useState<SalesOrder[]>([]);
  const [customers, setCustomers] = React.useState<Customer[]>([]);
  const [paymentMethods, setPaymentMethods] = React.useState<PaymentMethod[]>([]);
  const [saleTypes, setSaleTypes] = React.useState<SaleType[]>([]);
  const [branches, setBranches] = React.useState<Branch[]>([]);
  const [companyBranches, setCompanyBranches] = React.useState<CompanyBranch[]>([]);
  const [activeCaixa, setActiveCaixa] = React.useState<Caixa | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  
  const [editingOrder, setEditingOrder] = React.useState<SalesOrder | null>(null);
  const [tempPayments, setTempPayments] = React.useState<SalesOrderPayment[]>([]);
  const [tempExtraBonus, setTempExtraBonus] = React.useState<number>(0);
  const [tempExtraDiscount, setTempExtraDiscount] = React.useState<number>(0);


  const [selectedInstallments, setSelectedInstallments] = React.useState<SelectedInstallments>({});

  const fetchData = React.useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);

      // Parallelize base data fetching
      const [userDocSnap, caixaSnap, permsDocSnap, paymentMethodsSnap, saleTypesSnap, branchesSnap, companyBranchesSnap] = await Promise.all([
        getDoc(doc(db, "users", user.uid)),
        getDocs(query(collection(db, "caixas"), where("userId", "==", user.uid), where("status", "==", "open"), limit(1))),
        getDoc(doc(db, "settings", "salesPermissions")),
        getDocs(query(collection(db, "paymentMethods"), orderBy("order"))),
        getDocs(collection(db, "saleTypes")),
        getDocs(collection(db, "branches")),
        getDocs(collection(db, "companyBranches")),
      ]);

      if (!userDocSnap.exists()) {
        toast({ title: "Usuário não encontrado.", variant: "destructive" });
        setLoading(false);
        return;
      }

      const currentUserData = { id: user.uid, ...userDocSnap.data() } as UserType;
      setUserData(currentUserData);
      
      if (!caixaSnap.empty) {
        setActiveCaixa({ id: caixaSnap.docs[0].id, ...caixaSnap.docs[0].data() } as Caixa);
      } else {
        setActiveCaixa(null);
      }

      const permissions = permsDocSnap.exists() ? permsDocSnap.data() as SalesPermissions : {};
      const canViewAll = currentUserData.isAdmin || permissions.viewAllPayments?.userIds?.includes(user.uid) || permissions.viewAllPayments?.roleIds?.includes(currentUserData.roleId || '');
      const canViewBranch = permissions.viewBranchPayments?.userIds?.includes(user.uid) || permissions.viewBranchPayments?.roleIds?.includes(currentUserData.roleId || '');
      const canView = !!(canViewAll || canViewBranch);
      setHasPermission(canView);

      setPaymentMethods(paymentMethodsSnap.docs.map(d => ({ id: d.id, ...d.data() } as PaymentMethod)));
      setSaleTypes(saleTypesSnap.docs.map(d => ({ id: d.id, ...d.data() } as SaleType)));
      setBranches(branchesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Branch)));
      setCompanyBranches(companyBranchesSnap.docs.map(d => ({ id: d.id, ...d.data() } as CompanyBranch)));

      if (canView) {
        let ordersQuery;
        if (canViewAll) {
            ordersQuery = query(collection(db, "salesOrders"), where("status", "==", "billed"), limit(200));
        } else if (canViewBranch) {
            ordersQuery = query(collection(db, "salesOrders"), where("status", "==", "billed"), where("companyBranchId", "==", currentUserData.companyBranchId), limit(200));
        } else {
            ordersQuery = query(collection(db, "salesOrders"), where("status", "==", "billed"), where("createdByUserId", "==", user.uid), limit(200));
        }

        const ordersSnap = await getDocs(ordersQuery);
        const fetchedOrders = ordersSnap.docs.map(d => ({ id: d.id, ...d.data() } as SalesOrder));

        const finalOrders = fetchedOrders
            .filter(order => 
                (order.payments || []).some(p => 
                    (p.installments || []).some(i => !i.paid)
                )
            )
            .sort((a, b) => (b.orderNumber || 0) - (a.orderNumber || 0));
            
        setOrders(finalOrders);
      }

    } catch (error) {
      console.error("Erro no fetchData:", error);
      toast({ title: "Erro ao buscar dados", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast, user]);

  const summaryMetrics = React.useMemo(() => {
    let totalPending = 0;
    let totalOverdue = 0;
    let ordersWithOverdue = 0;

    orders.forEach(order => {
      const allInstallments = order.payments.flatMap(p => p.installments);
      let hasOverdueOrder = false;
      
      allInstallments.forEach(i => {
        if (!i.paid) {
          totalPending += i.value;
          if (isPast(parseISO(i.dueDate))) {
            totalOverdue += i.value;
            hasOverdueOrder = true;
          }
        }
      });
      
      if (hasOverdueOrder) ordersWithOverdue++;
    });

    return { totalPending, totalOverdue, ordersWithOverdue, totalOrders: orders.length };
  }, [orders]);

  React.useEffect(() => {
    if (user && !authLoading) {
      fetchData();
    }
  }, [fetchData, user, authLoading]);

  const getSaleTypeName = (id: string) => saleTypes.find(st => st.id === id)?.name || 'N/A';
  const getBranchName = (companyBranchId?: string) => {
    if (!companyBranchId) return 'N/A';
    const companyBranch = companyBranches.find(cb => cb.id === companyBranchId);
    if (!companyBranch) return 'N/A';
    return branches.find(b => b.id === companyBranch.branchId)?.name || 'N/A';
  };
  const formatCurrency = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  const formatDate = (dateString?: string) => dateString ? format(parseISO(dateString), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : 'N/A';
  const formatCurrencyForInput = (value?: number) => {
    if (value === undefined || value === null) return '';
    return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(value);
  }
  
  const handleCurrencyInputChange = (setter: React.Dispatch<React.SetStateAction<number>>) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value.replace(/\D/g, '');
    const numericValue = rawValue ? parseInt(rawValue, 10) / 100 : 0;
    setter(numericValue);
  };
  
  
  const handleToggleInstallment = (orderId: string, paymentId: string, installment: Installment) => {
    const key = `${orderId}-${paymentId}-${installment.number}`;
    setSelectedInstallments(prev => {
      const newSelection = { ...prev };
      if (newSelection[key]) {
        delete newSelection[key];
      } else {
        newSelection[key] = {
          orderId,
          paymentId,
          installmentNumber: installment.number,
          value: installment.value
        };
      }
      return newSelection;
    });
  };

  const handleToggleAllInstallments = (orderId: string, paymentId: string, installments: Installment[], isChecked: boolean) => {
    setSelectedInstallments(prev => {
        const newSelection = { ...prev };
        installments.filter(inst => !inst.paid).forEach(inst => {
            const key = `${orderId}-${paymentId}-${inst.number}`;
            if (isChecked) {
                newSelection[key] = {
                    orderId,
                    paymentId,
                    installmentNumber: inst.number,
                    value: inst.value
                };
            } else {
                delete newSelection[key];
            }
        });
        return newSelection;
    });
  };

  const totalSelectedValue = React.useMemo(() => {
    return Object.values(selectedInstallments).reduce((sum, item) => sum + item.value, 0);
  }, [selectedInstallments]);
  

  const handleConfirmPayments = async () => {
    if (Object.keys(selectedInstallments).length === 0 || !user || !activeCaixa) {
        return;
    }
    setIsSubmitting(true);
    const batch = writeBatch(db);
    const updatesByOrder: { [orderId: string]: SalesOrder } = {};

    for (const key in selectedInstallments) {
        const { orderId, paymentId, installmentNumber } = selectedInstallments[key];
        
        if (!updatesByOrder[orderId]) {
            const originalOrder = orders.find(o => o.id === orderId);
            if(originalOrder) updatesByOrder[orderId] = JSON.parse(JSON.stringify(originalOrder));
        }

        const orderToUpdate = updatesByOrder[orderId];
        if (orderToUpdate) {
            const payment = orderToUpdate.payments.find(p => p.id === paymentId);
            if (payment) {
                const installment = payment.installments.find(i => i.number === installmentNumber);
                if (installment && !installment.paid) {
                    installment.paid = true;
                    installment.paidAt = new Date().toISOString();
                    installment.paidByUserId = user.uid;
                    installment.paidInCaixaId = activeCaixa.id;
                }
            }
        }
    }
    
    try {
        for (const orderId in updatesByOrder) {
            const orderDocRef = doc(db, "salesOrders", orderId);
            batch.update(orderDocRef, { payments: updatesByOrder[orderId].payments });
        }
        await batch.commit();
        
        toast({ title: "Recebimento Confirmado!", description: `${Object.keys(selectedInstallments).length} parcela(s) foram baixadas.` });
        setSelectedInstallments({});
        fetchData();
    } catch (error) {
         toast({ title: "Erro ao confirmar pagamento", variant: "destructive" });
    } finally {
        setIsSubmitting(false);
    }
  }

  const handleEditPayments = (order: SalesOrder) => {
    setEditingOrder(order);
    setTempPayments(JSON.parse(JSON.stringify(order.payments || [])));
    setTempExtraBonus(order.extraBonus || 0);
    setTempExtraDiscount(order.extraDiscount || 0);
  };

  const handleSavePaymentChanges = async () => {
    if (!editingOrder) return;
    
    const baseTotal = editingOrder.subtotal - (editingOrder.generalDiscountValue || 0) + (editingOrder.freightValue || 0);
    const adjustedTotal = baseTotal + tempExtraBonus - tempExtraDiscount;
    const totalPayments = tempPayments.reduce((acc, p) => acc + p.value, 0);

    if (Math.abs(totalPayments - adjustedTotal) > 0.01) {
      toast({ title: "Valor dos pagamentos inválido", description: `A soma dos pagamentos (${formatCurrency(totalPayments)}) deve ser igual ao total ajustado do pedido (${formatCurrency(adjustedTotal)}).`, variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
        const orderRef = doc(db, "salesOrders", editingOrder.id);
        await updateDoc(orderRef, { 
          payments: tempPayments,
          extraBonus: tempExtraBonus,
          extraDiscount: tempExtraDiscount,
          total: adjustedTotal,
        });
        toast({ title: "Pagamentos Atualizados!", description: "As condições de pagamento do pedido foram salvas."});
        setEditingOrder(null);
        fetchData();
    } catch (error) {
        console.error(error);
        toast({ title: "Erro ao salvar", variant: "destructive" });
    } finally {
        setIsSubmitting(false);
    }
  };


  const calculateInstallments = (value: number, paymentMethodId: string, numInstallments?: number): Installment[] => {
    const method = paymentMethods.find(m => m.id === paymentMethodId);
    if (!method) return [];
    const installmentsCount = numInstallments || method.installments || 1;
    if (installmentsCount <= 0) return [];
    
    const interestRates = method.interestRates || [];
    
    const interestRate = interestRates[installmentsCount - 1] || 0;
    const totalWithInterest = value * (1 + interestRate / 100);

    const installmentBaseValue = totalWithInterest / installmentsCount;

    const newInstallments: Installment[] = [];
    const { receivingTerm, installmentIntervalDays, keepSameDay } = method;
    const firstDueDate = addDays(new Date(), receivingTerm || 0);
    const dayOfFirstDueDate = firstDueDate.getDate();

    for (let i = 1; i <= installmentsCount; i++) {
        let dueDate: Date;
        if (i === 1) {
            dueDate = firstDueDate;
        } else {
            const previousDueDate = parseISO(newInstallments[i - 2].dueDate);
            let nextDate = addDays(previousDueDate, installmentIntervalDays || 30);
            if (keepSameDay) {
                const lastDayOfNextMonth = lastDayOfMonth(nextDate).getDate();
                const targetDay = Math.min(dayOfFirstDueDate, lastDayOfNextMonth);
                nextDate = setDate(nextDate, targetDay);
            }
            dueDate = nextDate;
        }

        const finalInstallmentValue = parseFloat(installmentBaseValue.toFixed(2));
        
        newInstallments.push({
            number: i,
            dueDate: dueDate.toISOString(),
            value: finalInstallmentValue,
            paid: false,
        });
    }
    
    const finalSum = newInstallments.reduce((sum, inst) => sum + inst.value, 0);
    const diff = parseFloat((totalWithInterest - finalSum).toFixed(2));

    if (newInstallments.length > 0) {
        newInstallments[newInstallments.length - 1].value = parseFloat((newInstallments[newInstallments.length - 1].value + diff).toFixed(2));
    }
    
    return newInstallments;
  };
  
  const handleTempPaymentUpdate = (id: string, field: keyof SalesOrderPayment, value: any) => {
    setTempPayments(prev => prev.map(p => {
      if (p.id === id) {
        const updatedPayment = { ...p, [field]: value };
        // Check if the method uses customer credit
        const method = paymentMethods.find(m => m.id === updatedPayment.paymentMethodId);
        if (method?.isCustomerCredit) {
            // No recebimento, não temos o saldo de crédito carregado em tempo real da mesma forma que na venda.
            // Para simplificar e evitar lentidão, removemos a trava de limite de crédito aqui, 
            // já que a edição de pagamentos no recebimento é uma função administrativa.
            updatedPayment.value = updatedPayment.value;
        }

        if (field === 'paymentMethodId' || field === 'value' || field === 'numInstallments') {
          updatedPayment.installments = calculateInstallments(updatedPayment.value, updatedPayment.paymentMethodId, updatedPayment.numInstallments);
        }
        return updatedPayment;
      }
      return p;
    }));
  };

  const handleAddTempPayment = () => {
    const baseTotal = (editingOrder?.subtotal || 0) - (editingOrder?.generalDiscountValue || 0) + (editingOrder?.freightValue || 0);
    const adjustedTotal = baseTotal + tempExtraBonus - tempExtraDiscount;
    const remaining = adjustedTotal - tempPayments.reduce((acc, p) => acc + p.value, 0);
    setTempPayments(prev => [...prev, {
      id: `payment-${Date.now()}`,
      paymentMethodId: "",
      value: remaining > 0 ? remaining : 0,
      installments: [],
      numInstallments: 1,
    }]);
  };
  
  const handleRemoveTempPayment = (id: string) => {
    setTempPayments(prev => prev.filter(p => p.id !== id));
  };
  
  const totalTempPayments = React.useMemo(() => tempPayments.reduce((acc, p) => acc + p.value, 0), [tempPayments]);
  const adjustedTotal = React.useMemo(() => {
    if (!editingOrder) return 0;
    const baseTotal = editingOrder.subtotal - (editingOrder.generalDiscountValue || 0) + (editingOrder.freightValue || 0);
    return baseTotal + tempExtraBonus - tempExtraDiscount;
  }, [editingOrder, tempExtraBonus, tempExtraDiscount]);

  const tempRemainingBalance = adjustedTotal - totalTempPayments;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-headline tracking-tight flex items-center gap-2">
            <History /> Recebimentos
          </h1>
          <p className="text-muted-foreground">
            Gerencie o recebimento das parcelas dos pedidos de venda.
          </p>
        </div>
         <Button variant="outline" size="icon" onClick={fetchData} disabled={loading}>
          <RefreshCw className={loading ? "animate-spin" : ""} />
        </Button>
      </div>
      
       {!activeCaixa && hasPermission && (
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Caixa Fechado</AlertTitle>
          <AlertDescription>
            Você precisa abrir o seu caixa na tela "Caixa" para poder registrar recebimentos.
          </AlertDescription>
        </Alert>
      )}
      
       {Object.keys(selectedInstallments).length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-2xl animate-in slide-in-from-bottom-8 duration-300">
            <div className="bg-background/80 backdrop-blur-xl border border-primary/20 shadow-glow rounded-3xl p-4 flex items-center justify-between gap-6">
                <div className="flex flex-col">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Total Selecionado</span>
                    <p className="font-mono text-xl font-bold text-primary">{formatCurrency(totalSelectedValue)}</p>
                    <span className="text-[10px] text-muted-foreground">{Object.keys(selectedInstallments).length} parcela(s)</span>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="lg" disabled={!activeCaixa} className="rounded-2xl shadow-glow px-8 h-12">
                      <DollarSign className="mr-2 h-4 w-4"/> Confirmar Recebimento
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="rounded-3xl border-border/50 backdrop-blur-xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-2xl font-headline">Confirmar Recebimento?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Você está prestes a dar baixa em {Object.keys(selectedInstallments).length} parcela(s), totalizando <strong className="text-foreground">{formatCurrency(totalSelectedValue)}</strong>. Esta ação não pode ser desfeita.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirmPayments} className="rounded-xl shadow-glow">Sim, Confirmar Recebimento</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
            </div>
        </div>
      )}

      {/* Summary Metro */}
      {!loading && hasPermission && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-none shadow-soft bg-card/40 backdrop-blur-md rounded-3xl overflow-hidden hover:bg-card/60 transition-all border border-border/10">
            <CardContent className="p-5 flex flex-col justify-between h-full">
              <div className="flex items-center justify-between mb-2">
                <div className="p-2 bg-primary/10 rounded-xl text-primary"><DollarSign className="h-5 w-5" /></div>
                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Total Pendente</span>
              </div>
              <p className="text-xl font-bold font-mono tracking-tighter truncate">{formatCurrency(summaryMetrics.totalPending)}</p>
            </CardContent>
          </Card>
          
          <Card className="border-none shadow-soft bg-card/40 backdrop-blur-md rounded-3xl overflow-hidden hover:bg-card/60 transition-all border border-border/10">
            <CardContent className="p-5 flex flex-col justify-between h-full">
              <div className="flex items-center justify-between mb-2">
                <div className="p-2 bg-destructive/10 rounded-xl text-destructive"><History className="h-5 w-5" /></div>
                <span className="text-[10px] uppercase font-bold text-destructive/80 tracking-widest">Atrasados</span>
              </div>
              <p className="text-xl font-bold font-mono tracking-tighter truncate text-destructive">{formatCurrency(summaryMetrics.totalOverdue)}</p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-soft bg-card/40 backdrop-blur-md rounded-3xl overflow-hidden hover:bg-card/60 transition-all border border-border/10">
            <CardContent className="p-5 flex flex-col justify-between h-full">
              <div className="flex items-center justify-between mb-2">
                <div className="p-2 bg-blue-500/10 rounded-xl text-blue-500"><ShoppingCart className="h-5 w-5" /></div>
                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Pedidos</span>
              </div>
              <p className="text-xl font-bold font-mono tracking-tighter truncate">{summaryMetrics.totalOrders}</p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-soft bg-card/40 backdrop-blur-md rounded-3xl overflow-hidden hover:bg-card/60 transition-all border border-border/10">
            <CardContent className="p-5 flex flex-col justify-between h-full">
              <div className="flex items-center justify-between mb-2">
                <div className="p-2 bg-amber-500/10 rounded-xl text-amber-500"><ShieldAlert className="h-5 w-5" /></div>
                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Com Atraso</span>
              </div>
              <p className="text-xl font-bold font-mono tracking-tighter truncate">{summaryMetrics.ordersWithOverdue}</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card className="border-none shadow-glass bg-card/60 backdrop-blur-xl rounded-3xl overflow-hidden">
        <CardHeader className="bg-muted/10 border-b border-border/10">
          <CardTitle className="text-xl font-headline">Parcelas a Receber</CardTitle>
          <CardDescription>
            {loading ? "Carregando..." : `${orders.length} pedidos com pendências encontrados.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>
          ) : !hasPermission ? (
            <div className="flex flex-col items-center justify-center h-64 rounded-lg border border-dashed">
                <ShieldAlert className="h-16 w-16 text-destructive" />
                <h2 className="mt-4 text-xl font-semibold">Acesso Negado</h2>
                <p className="mt-2 text-sm text-muted-foreground text-center">
                    Seu perfil não tem permissão para visualizar a tela de recebimentos.
                </p>
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center text-muted-foreground py-16">Nenhum pedido com pendências encontrado.</div>
          ) : (
            <Accordion type="multiple" className="w-full space-y-3">
              {orders.map(order => {
                  const allInstallments = order.payments.flatMap(p => p.installments);
                  const hasPending = allInstallments.some(i => !i.paid);
                  if(!hasPending) return null;
                  
                  const hasOverdue = allInstallments.some(i => !i.paid && isPast(parseISO(i.dueDate)));
                  const amountToReceive = allInstallments
                    .filter(i => !i.paid)
                    .reduce((sum, i) => sum + i.value, 0);

                  return (
                  <AccordionItem value={order.id} key={order.id} className="border border-border/50 rounded-2xl overflow-hidden transition-all hover:border-primary/20 hover:shadow-sm bg-background/40">
                    <AccordionTrigger className="p-5 hover:no-underline hover:bg-muted/5 group">
                        <div className="flex flex-col md:flex-row md:items-center justify-between w-full gap-4 pr-4">
                            <div className="flex-1 space-y-1 text-left">
                                <div className="flex items-center gap-2">
                                    <span className="font-bold text-lg">Pedido #{order.orderNumber}</span>
                                    {hasOverdue && <Badge variant="destructive" className="h-5 px-1.5 text-[9px] font-bold uppercase tracking-wider shadow-sm animate-pulse">Atrasado</Badge>}
                                    {!hasOverdue && hasPending && <Badge variant="outline" className="h-5 px-1.5 text-[9px] font-bold uppercase tracking-wider text-amber-600 border-amber-500/50 bg-amber-500/5 shadow-sm">Pendente</Badge>}
                                </div>
                                <div className="text-sm font-medium text-muted-foreground/80">{order.customerName}</div>
                                <div className="text-[10px] text-muted-foreground/60 flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
                                    <span className="flex items-center gap-1.5 bg-muted/50 px-2 py-0.5 rounded-md uppercase font-bold"><ShoppingCart className="h-3 w-3"/> {getSaleTypeName(order.saleTypeId)}</span>
                                    <span className="flex items-center gap-1.5 bg-muted/50 px-2 py-0.5 rounded-md uppercase font-bold"><GitFork className="h-3 w-3"/> {getBranchName(order.companyBranchId)}</span>
                                </div>
                            </div>
                             <div className="flex flex-col items-end gap-1 self-start md:self-center">
                               <p className="text-xl font-bold font-mono tracking-tight text-foreground/80 group-hover:text-primary transition-colors">{formatCurrency(order.total)}</p>
                               <div className="text-[10px] flex items-center gap-1 font-bold text-muted-foreground/60 uppercase">
                                   Valor em aberto: <span className="text-primary/80 font-mono text-sm">{formatCurrency(amountToReceive)}</span>
                               </div>
                            </div>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="p-4 pt-0">
                      <div className="flex justify-end mb-4 border-b pb-4">
                        <Button variant="outline" size="sm" onClick={() => handleEditPayments(order)}>
                          <Pencil className="mr-2 h-4 w-4" /> Editar Pagamentos
                        </Button>
                      </div>
                      {(order.payments || []).map((payment, pIndex) => {
                        const allInstallments = payment.installments || [];
                        const unpaidInstallments = allInstallments.filter(i => !i.paid);
                        
                        if (allInstallments.length === 0) return null;

                        const areAllSelected = unpaidInstallments.length > 0 && unpaidInstallments.every(inst => selectedInstallments[`${order.id}-${payment.id}-${inst.number}`]);

                        return (
                          <div key={payment.id || pIndex} className="mt-4 first:mt-0 border border-border/30 rounded-2xl overflow-hidden bg-background/50 shadow-sm transition-all hover:bg-background/80">
                             <Table>
                                <TableHeader>
                                  <TableRow className="bg-muted/30 hover:bg-muted/30 border-none">
                                    <TableHead className="w-12 py-4">
                                        <Checkbox
                                          checked={areAllSelected && unpaidInstallments.length > 0}
                                          onCheckedChange={(checked) => handleToggleAllInstallments(order.id, payment.id, unpaidInstallments, !!checked)}
                                          disabled={!activeCaixa || unpaidInstallments.length === 0}
                                          className="rounded-md"
                                        />
                                    </TableHead>
                                    <TableHead colSpan={4} className="font-bold text-foreground/80 py-4 uppercase text-[10px] tracking-widest">
                                       <div className="flex items-center gap-2"><CreditCard className="h-4 w-4 text-primary/60"/> {paymentMethods.find(pm => pm.id === payment.paymentMethodId)?.name || 'N/A'}</div>
                                    </TableHead>
                                  </TableRow>
                                  <TableRow className="border-border/10">
                                    <TableHead></TableHead>
                                    <TableHead className="text-[10px] uppercase font-bold tracking-wider">Nº Parcela</TableHead>
                                    <TableHead className="text-[10px] uppercase font-bold tracking-wider">Vencimento</TableHead>
                                    <TableHead className="text-[10px] uppercase font-bold tracking-wider">Status</TableHead>
                                    <TableHead className="text-right text-[10px] uppercase font-bold tracking-wider">Valor</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {allInstallments.map(installment => {
                                        const dueDate = parseISO(installment.dueDate);
                                        const isOverdue = !installment.paid && isPast(dueDate);
                                        const status = installment.paid ? statusConfig.paid : (isOverdue ? statusConfig.overdue : statusConfig.pending);
                                        const key = `${order.id}-${payment.id}-${installment.number}`;
                                                       return (
                                        <TableRow key={installment.number} className={cn("hover:bg-primary/5 transition-colors border-border/5", !!selectedInstallments[key] && "bg-primary/5")}>
                                            <TableCell className="py-3">
                                                <Checkbox
                                                    checked={!!selectedInstallments[key]}
                                                    onCheckedChange={() => handleToggleInstallment(order.id, payment.id, installment)}
                                                    disabled={!activeCaixa || installment.paid}
                                                    className="rounded-md"
                                                />
                                            </TableCell>
                                            <TableCell className="font-mono text-xs">{installment.number}</TableCell>
                                            <TableCell className="font-medium text-xs text-muted-foreground/80">{format(dueDate, "dd/MM/yyyy")}</TableCell>
                                            <TableCell>
                                                <Badge 
                                                    variant={status.variant} 
                                                    className={cn(
                                                        "text-[9px] uppercase font-bold px-1.5 h-5 shadow-sm",
                                                        installment.paid ? "bg-green-500/10 text-green-600 border-green-200" : (isOverdue ? "bg-destructive/10 text-destructive border-destructive/20" : "bg-muted/50 text-muted-foreground border-border/50")
                                                    )}
                                                >
                                                    {status.label}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className={cn("text-right font-bold font-mono", installment.paid ? "text-green-600/80" : (isOverdue ? "text-destructive/80" : "text-foreground/80"))}>
                                                {formatCurrency(installment.value)}
                                            </TableCell>
                                        </TableRow>
                                    )})}
                                </TableBody>
                              </Table>
                          </div>
                        )
                      })}
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          )}
        </CardContent>
      </Card>
      {editingOrder && (
        <Dialog open={!!editingOrder} onOpenChange={() => setEditingOrder(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Editar Pagamentos do Pedido #{editingOrder.orderNumber}</DialogTitle>
              <DialogDescription>Ajuste as formas de pagamento, valores e parcelas. O valor total dos pagamentos deve ser igual ao total do pedido.</DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4 max-h-[60vh] overflow-y-auto pr-4">
              <div className="space-y-4 pt-4 border-t">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Outras Despesas</Label>
                      <Input type="text" value={formatCurrencyForInput(tempExtraBonus)} onChange={handleCurrencyInputChange(setTempExtraBonus)} />
                    </div>
                     <div className="space-y-2">
                      <Label>Desconto Adicional</Label>
                      <Input type="text" value={formatCurrencyForInput(tempExtraDiscount)} onChange={handleCurrencyInputChange(setTempExtraDiscount)} />
                    </div>
                  </div>
                  <div className="pt-4 text-right border-t">
                    <p className="text-sm">Subtotal: <span className="font-semibold">{formatCurrency(editingOrder.subtotal - (editingOrder.generalDiscountValue || 0) + (editingOrder.freightValue || 0))}</span></p>
                     <p className="text-sm text-blue-600">Outras Despesas: <span className="font-semibold">+ {formatCurrency(tempExtraBonus)}</span></p>
                    <p className="text-sm text-red-600">Desconto Adicional: <span className="font-semibold">- {formatCurrency(tempExtraDiscount)}</span></p>
                    <p className="text-lg mt-2">Total a Pagar: <span className="font-bold">{formatCurrency(adjustedTotal)}</span></p>
                    <p className="text-sm">Total dos Pagamentos: <span className="font-semibold">{formatCurrency(totalTempPayments)}</span></p>
                    <p className={`text-sm font-bold ${Math.abs(tempRemainingBalance) > 0.01 ? 'text-red-500' : 'text-green-600'}`}>
                      Saldo Restante: {formatCurrency(tempRemainingBalance)}
                    </p>
                  </div>
              </div>
              {tempPayments.map((p, index) => {
                const method = paymentMethods.find(m => m.id === p.paymentMethodId);
                const maxInstallments = method?.installments || 1;
                const isPartiallyPaid = (editingOrder.payments.find(op => op.id === p.id)?.installments || []).some(i => i.paid);

                return (
                <div key={p.id} className="p-4 border rounded-lg space-y-3">
                   <div className="flex justify-between items-center">
                    <Label className="text-base font-semibold">Pagamento {index + 1}</Label>
                    <Button variant="ghost" size="icon" className="text-destructive h-7 w-7" onClick={() => handleRemoveTempPayment(p.id)} disabled={isPartiallyPaid}><Trash2 className="h-4 w-4"/></Button>
                   </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Forma de Pagamento</Label>
                        <Select value={p.paymentMethodId} onValueChange={v => handleTempPaymentUpdate(p.id, 'paymentMethodId', v)} disabled={isPartiallyPaid}>
                          <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                          <SelectContent>{paymentMethods.map(pm => <SelectItem key={pm.id} value={pm.id}>{pm.name}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Valor</Label>
                      <Input type="text" value={formatCurrencyForInput(p.value)} onChange={(e) => handleTempPaymentUpdate(p.id, 'value', parseFloat(e.target.value.replace(/\D/g,'')) / 100 || 0)} disabled={isPartiallyPaid}/>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Número de Parcelas</Label>
                    <Select value={(p.numInstallments || 1).toString()} onValueChange={v => handleTempPaymentUpdate(p.id, 'numInstallments', parseInt(v))} disabled={!p.paymentMethodId || maxInstallments <= 1 || isPartiallyPaid}>
                      <SelectTrigger><SelectValue/></SelectTrigger>
                      <SelectContent>
                        {[...Array(maxInstallments)].map((_, i) => {
                            const num = i + 1;
                            const tempInstallments = calculateInstallments(p.value, p.paymentMethodId, num);
                            const installmentValue = tempInstallments.length > 0 ? tempInstallments[0].value : 0;
                            return (
                                <SelectItem key={num} value={num.toString()}>
                                    {num}x de {formatCurrency(installmentValue)}
                                </SelectItem>
                            );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                   {isPartiallyPaid && <p className="text-xs text-amber-600">Esta forma de pagamento não pode ser totalmente editada pois já possui parcelas pagas.</p>}
                </div>
              )})}
              <Button variant="outline" onClick={handleAddTempPayment}>Adicionar Forma de Pagamento</Button>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingOrder(null)}>Cancelar</Button>
              <Button onClick={handleSavePaymentChanges} disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>} Salvar Alterações
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
    

    