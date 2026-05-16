
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  writeBatch,
  getDoc,
  addDoc,
  serverTimestamp,
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
import type { SalesOrder, PaymentMethod, SaleType, ReversalRequestItem, User, Branch, CompanyBranch, SalesOrderPayment, Installment } from "@/lib/definitions";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, GitFork, User as UserIcon, ShoppingCart, CreditCard, History, Undo2, ChevronDown, ChevronRight, Search, DollarSign, ShieldAlert } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";


type PaidInstallmentInfo = {
  order: SalesOrder;
  installment: {
    number: number;
    dueDate: string;
    value: number;
    paid: boolean;
    paidAt?: string;
    paidByUserId?: string;
    paidInCaixaId?: string;
    reversalStatus?: 'reversal_pending' | 'reversal_approved' | 'reversal_denied';
  };
  paymentId: string;
};

type GroupedPaidInstallments = {
  orderId: string;
  orderNumber: number;
  customerName: string;
  saleTypeName: string;
  branchName: string;
  sellerName: string;
  payments: {
    paymentId: string;
    paymentMethodName: string;
    installments: Installment[];
  }[];
}[]

export default function PaymentHistoryPage() {
  const { toast } = useToast();
  const [user] = useAuthState(auth);
  const [userData, setUserData] = React.useState<User | null>(null);
  const [allUsers, setAllUsers] = React.useState<User[]>([]);
  const [orders, setOrders] = React.useState<SalesOrder[]>([]);
  const [saleTypes, setSaleTypes] = React.useState<SaleType[]>([]);
  const [paymentMethods, setPaymentMethods] = React.useState<PaymentMethod[]>([]);
  const [branches, setBranches] = React.useState<Branch[]>([]);
  const [companyBranches, setCompanyBranches] = React.useState<CompanyBranch[]>([]);
  const [loading, setLoading] = React.useState(true);
  
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [selectedForReversal, setSelectedForReversal] = React.useState<ReversalRequestItem[]>([]);
  const [reversalReason, setReversalReason] = React.useState("");
  const [isReversalModalOpen, setIsReversalModalOpen] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState("");
  
  const getSaleTypeName = (saleTypeId: string) => saleTypes.find(st => st.id === saleTypeId)?.name || 'N/A';
  const getPaymentMethodName = (paymentMethodId: string) => paymentMethods.find(pm => pm.id === paymentMethodId)?.name || 'N/A';
  const getBranchName = (companyBranchId?: string) => {
    if (!companyBranchId) return 'N/A';
    const companyBranch = companyBranches.find(cb => cb.id === companyBranchId);
    if (!companyBranch) return 'N/A';
    return branches.find(b => b.id === companyBranch.branchId)?.name || 'N/A';
  };
  const getUserName = (userId?: string) => {
    if (!userId) return 'N/A';
    return allUsers.find(u => u.id === userId)?.name || 'Usuário desconhecido';
  };


  const fetchData = React.useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const [ordersSnap, saleTypesSnap, paymentMethodsSnap, userSnap, branchesSnap, companyBranchesSnap, allUsersSnap] = await Promise.all([
        getDocs(query(collection(db, "salesOrders"), where("status", "==", "billed"))),
        getDocs(collection(db, "saleTypes")),
        getDocs(collection(db, "paymentMethods")),
        getDoc(doc(db, "users", user.uid)),
        getDocs(collection(db, "branches")),
        getDocs(collection(db, "companyBranches")),
        getDocs(collection(db, "users")),
      ]);
      
      const fetchedOrders = ordersSnap.docs.map(d => ({ id: d.id, ...d.data() } as SalesOrder));
      setOrders(fetchedOrders);
      
      const saleTypesData = saleTypesSnap.docs.map(d => ({ id: d.id, ...d.data() } as SaleType));
      const paymentMethodsData = paymentMethodsSnap.docs.map(d => ({ id: d.id, ...d.data() } as PaymentMethod));
      const branchesData = branchesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Branch));
      const companyBranchesData = companyBranchesSnap.docs.map(d => ({ id: d.id, ...d.data() } as CompanyBranch));
      
      setSaleTypes(saleTypesData);
      setPaymentMethods(paymentMethodsData);
      setBranches(branchesData);
      setCompanyBranches(companyBranchesData);
      setUserData(userSnap.exists() ? userSnap.data() as User : null);
      setAllUsers(allUsersSnap.docs.map(d => ({ id: d.id, ...d.data() } as User)));

    } catch (error) {
      toast({ title: "Erro ao buscar histórico", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast, user]);

  const summaryMetrics = React.useMemo(() => {
     let totalReceived = 0;
     let totalInstallments = 0;
     let pendingReversalValue = 0;

     orders.forEach(order => {
       (order.payments || []).forEach(p => {
         (p.installments || []).forEach(i => {
           if (i.paid) {
             totalReceived += i.value;
             totalInstallments++;
             if (i.reversalStatus === 'reversal_pending') {
               pendingReversalValue += i.value;
             }
           }
         });
       });
     });

     return { totalReceived, totalInstallments, pendingReversalValue };
  }, [orders]);

  const groupedInstallments: GroupedPaidInstallments = React.useMemo(() => {
     return orders.reduce((acc, order) => {
          const paymentsWithPaidInstallments = (order.payments || [])
            .map(payment => ({
              ...payment,
              installments: (payment.installments || []).filter(inst => inst.paid)
            }))
            .filter(payment => payment.installments.length > 0);

          if (paymentsWithPaidInstallments.length > 0) {
            acc.push({
              orderId: order.id,
              orderNumber: order.orderNumber,
              customerName: order.customerName,
              saleTypeName: getSaleTypeName(order.saleTypeId),
              branchName: getBranchName(order.companyBranchId),
              sellerName: order.createdByUserName,
              payments: paymentsWithPaidInstallments.map(p => ({
                paymentId: p.id,
                paymentMethodName: getPaymentMethodName(p.paymentMethodId),
                installments: p.installments,
              }))
            });
          }
          return acc;
      }, [] as GroupedPaidInstallments).sort((a,b) => b.orderNumber - a.orderNumber);
  }, [orders, branches, companyBranches, paymentMethods, saleTypes]);
  
  const filteredGroupedInstallments = React.useMemo(() => {
    if (!searchTerm) {
      return groupedInstallments;
    }
    const lowercasedTerm = searchTerm.toLowerCase();
    return groupedInstallments.filter(group => 
        group.customerName.toLowerCase().includes(lowercasedTerm) || 
        group.orderNumber.toString().includes(lowercasedTerm)
    );
  }, [groupedInstallments, searchTerm]);


  React.useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [fetchData, user]);

  const handleToggleReversal = (orderId: string, paymentId: string, installment: Installment) => {
    const key = `${orderId}-${paymentId}-${installment.number}`;
    setSelectedForReversal(prev => {
        const newSelection = [...prev];
        const existingIndex = newSelection.findIndex(item => `${item.orderId}-${item.paymentId}-${item.installmentNumber}` === key);
        if (existingIndex > -1) {
            newSelection.splice(existingIndex, 1);
            return newSelection;
        } else {
            return [...newSelection, {
                orderId: orderId,
                paymentId: paymentId,
                installmentNumber: installment.number,
                value: installment.value,
            }];
        }
    });
  };
  
  const handleToggleAllInPaymentGroup = (orderId: string, payment: GroupedPaidInstallments[0]['payments'][0]) => {
      setSelectedForReversal(prev => {
          const newSelection = [...prev];
          const allSelected = payment.installments.every(inst => 
              inst.reversalStatus === 'reversal_pending' ||
              newSelection.some(sel => sel.orderId === orderId && sel.paymentId === payment.paymentId && sel.installmentNumber === inst.number)
          );

          payment.installments.forEach(inst => {
              if (inst.reversalStatus === 'reversal_pending') return;
              const key = `${orderId}-${payment.paymentId}-${inst.number}`;
              const index = newSelection.findIndex(sel => `${sel.orderId}-${sel.paymentId}-${sel.installmentNumber}` === key);

              if (allSelected) { // Deselect all
                  if (index > -1) newSelection.splice(index, 1);
              } else { // Select all
                  if (index === -1) {
                      newSelection.push({
                          orderId,
                          paymentId: payment.paymentId,
                          installmentNumber: inst.number,
                          value: inst.value,
                      });
                  }
              }
          });
          return newSelection;
      });
  }

  const handleOpenReversalModal = () => {
    if (selectedForReversal.length === 0) return;
    setReversalReason("");
    setIsReversalModalOpen(true);
  };
  
  const handleRequestReversal = async () => {
    if (selectedForReversal.length === 0 || !reversalReason.trim() || !user || !userData) return;
    
    setIsSubmitting(true);
    const batch = writeBatch(db);
    try {
      // Create reversal request
      const totalValue = selectedForReversal.reduce((sum, item) => sum + item.value, 0);
      batch.set(doc(collection(db, "reversalRequests")), {
        items: selectedForReversal,
        totalValue,
        reason: reversalReason,
        status: 'pending',
        requestedByUserId: user.uid,
        requestedByUserName: userData.name,
        requestedAt: serverTimestamp(),
      });
      
      const updatesByOrder: { [orderId: string]: SalesOrder } = {};

      for (const reversalItem of selectedForReversal) {
        const { orderId, paymentId, installmentNumber } = reversalItem;
        
        if (!updatesByOrder[orderId]) {
          const originalOrder = orders.find(o => o.id === orderId);
          if (originalOrder) {
            updatesByOrder[orderId] = JSON.parse(JSON.stringify(originalOrder));
          } else {
            console.error(`Order ${orderId} not found in state.`);
            continue;
          }
        }
        
        const orderToUpdate = updatesByOrder[orderId];
        const payment = orderToUpdate.payments.find(p => p.id === paymentId);
        if (payment) {
          const installment = payment.installments.find(i => i.number === installmentNumber);
          if (installment) {
            installment.reversalStatus = 'reversal_pending';
          }
        }
      }
      
      for (const orderId in updatesByOrder) {
        batch.update(doc(db, "salesOrders", orderId), { payments: updatesByOrder[orderId].payments });
      }

      await batch.commit();
      
      toast({ title: "Solicitação de Estorno Enviada!", description: "Sua solicitação foi enviada para aprovação." });
      setSelectedForReversal([]);
      setIsReversalModalOpen(false);
      fetchData();

    } catch (error) {
      console.error(error);
      toast({ title: "Erro ao solicitar estorno", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const totalReversalValue = selectedForReversal.reduce((sum, item) => sum + item.value, 0);

  const formatCurrency = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  const formatDate = (dateString?: string) => dateString ? format(parseISO(dateString), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : 'N/A';

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-headline tracking-tight flex items-center gap-2">
            <History /> Histórico de Recebimentos
          </h1>
          <p className="text-muted-foreground">
            Visualize todas as parcelas que já foram recebidas.
          </p>
        </div>
        <Button variant="outline" size="icon" onClick={fetchData} disabled={loading}>
          <RefreshCw className={loading ? "animate-spin" : ""} />
        </Button>
      </div>
      
       {selectedForReversal.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-2xl animate-in slide-in-from-bottom-8 duration-300">
            <div className="bg-background/80 backdrop-blur-xl border border-primary/20 shadow-glow rounded-3xl p-4 flex items-center justify-between gap-6">
                <div className="flex flex-col">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Total Selecionado (Estorno)</span>
                    <p className="font-mono text-xl font-bold text-destructive">{formatCurrency(totalReversalValue)}</p>
                    <span className="text-[10px] text-muted-foreground">{selectedForReversal.length} parcela(s)</span>
                </div>
                <Button size="lg" onClick={handleOpenReversalModal} className="rounded-2xl shadow-glow px-8 h-12 bg-destructive hover:bg-destructive/90 text-white font-bold transition-all hover:scale-105 active:scale-95">
                  <Undo2 className="mr-2 h-4 w-4"/> Solicitar Estorno
                </Button>
            </div>
        </div>
      )}

      {/* Summary Metro */}
      {!loading && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Card className="border-none shadow-soft bg-card/40 backdrop-blur-md rounded-3xl overflow-hidden hover:bg-card/60 transition-all border border-border/10">
            <CardContent className="p-5 flex flex-col justify-between h-full">
              <div className="flex items-center justify-between mb-2">
                <div className="p-2 bg-primary/10 rounded-xl text-primary"><DollarSign className="h-5 w-5" /></div>
                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Total Recebido</span>
              </div>
              <p className="text-xl font-bold font-mono tracking-tighter truncate">{formatCurrency(summaryMetrics.totalReceived)}</p>
            </CardContent>
          </Card>
          
          <Card className="border-none shadow-soft bg-card/40 backdrop-blur-md rounded-3xl overflow-hidden hover:bg-card/60 transition-all border border-border/10">
            <CardContent className="p-5 flex flex-col justify-between h-full">
              <div className="flex items-center justify-between mb-2">
                <div className="p-2 bg-blue-500/10 rounded-xl text-blue-500"><History className="h-5 w-5" /></div>
                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Transações</span>
              </div>
              <p className="text-xl font-bold font-mono tracking-tighter truncate">{summaryMetrics.totalInstallments}</p>
            </CardContent>
          </Card>

          <Card className="border-none shadow-soft bg-card/40 backdrop-blur-md rounded-3xl overflow-hidden hover:bg-card/60 transition-all border border-border/10">
            <CardContent className="p-5 flex flex-col justify-between h-full">
              <div className="flex items-center justify-between mb-2">
                <div className="p-2 bg-amber-500/10 rounded-xl text-amber-500"><ShieldAlert className="h-5 w-5" /></div>
                <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">Aguard. Estorno</span>
              </div>
              <p className="text-xl font-bold font-mono tracking-tighter truncate text-amber-600">{formatCurrency(summaryMetrics.pendingReversalValue)}</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card className="border-none shadow-glass bg-card/60 backdrop-blur-xl rounded-3xl overflow-hidden">
        <CardHeader className="bg-muted/10 border-b border-border/10">
          <CardTitle className="text-xl font-headline">Recebimentos Efetuados</CardTitle>
          <CardDescription>
            {loading ? "Carregando..." : `${filteredGroupedInstallments.length} de ${groupedInstallments.length} pedidos encontrados.`}
          </CardDescription>
          <div className="relative pt-4">
              <div className="bg-background/80 backdrop-blur-sm p-1 rounded-2xl border border-border/50 shadow-soft overflow-hidden focus-within:ring-2 focus-within:ring-primary/20 transition-all flex items-center">
                  <Search className="ml-3 h-4 w-4 text-muted-foreground/60" />
                  <Input
                    placeholder="Buscar por nome do cliente ou nº do pedido..."
                    className="border-none bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 h-10 text-sm"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
              </div>
            </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>
          ) : (
            <Accordion type="multiple" className="w-full space-y-3">
              {filteredGroupedInstallments.map((group) => {
                  const totalReceivedInOrder = group.payments.reduce((sum, p) => sum + p.installments.reduce((ps, i) => ps + i.value, 0), 0);
                  return (
                  <AccordionItem value={group.orderId} key={group.orderId} className="border border-border/50 rounded-2xl overflow-hidden transition-all hover:border-primary/20 hover:shadow-sm bg-background/40">
                    <AccordionTrigger className="p-5 hover:no-underline hover:bg-muted/5 group">
                       <div className="flex flex-col md:flex-row md:items-center justify-between w-full gap-4 pr-4">
                          <div className="flex-1 space-y-1 text-left">
                            <p className="font-bold text-lg">Pedido #{group.orderNumber}</p>
                            <div className="text-sm font-medium text-muted-foreground/80">{group.customerName}</div>
                            <div className="text-[10px] text-muted-foreground/60 flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
                              <span className="flex items-center gap-1.5 bg-muted/50 px-2 py-0.5 rounded-md uppercase font-bold"><ShoppingCart className="h-3 w-3"/> {group.saleTypeName}</span>
                              <span className="flex items-center gap-1.5 bg-muted/50 px-2 py-0.5 rounded-md uppercase font-bold"><GitFork className="h-3 w-3"/> {group.branchName}</span>
                              <span className="flex items-center gap-1.5 bg-muted/50 px-2 py-0.5 rounded-md uppercase font-bold"><UserIcon className="h-3 w-3"/> {group.sellerName}</span>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1 self-start md:self-center">
                               <p className="text-xl font-bold font-mono tracking-tight text-foreground/80 group-hover:text-primary transition-colors">{formatCurrency(totalReceivedInOrder)}</p>
                               <div className="text-[9px] flex items-center gap-1 font-bold text-muted-foreground/60 uppercase tracking-wider">
                                   Total Realizado
                               </div>
                            </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="p-4 pt-0">
                      {group.payments.map(payment => {
                        const areAllSelected = payment.installments.every(inst => 
                            inst.reversalStatus === 'reversal_pending' || 
                            selectedForReversal.some(sel => sel.orderId === group.orderId && sel.paymentId === payment.paymentId && sel.installmentNumber === inst.number)
                        );
                        return (
                          <div key={payment.paymentId} className="mt-4 first:mt-0 border border-border/30 rounded-2xl overflow-hidden bg-background/50 shadow-sm transition-all hover:bg-background/80">
                             <Table>
                                <TableHeader>
                                  <TableRow className="bg-muted/30 hover:bg-muted/30 border-none">
                                    <TableHead className="w-12 py-4">
                                        <Checkbox
                                          checked={areAllSelected}
                                          onCheckedChange={() => handleToggleAllInPaymentGroup(group.orderId, payment)}
                                          disabled={payment.installments.every(inst => inst.reversalStatus === 'reversal_pending')}
                                          className="rounded-md"
                                        />
                                    </TableHead>
                                    <TableHead colSpan={4} className="font-bold text-foreground/80 py-4 uppercase text-[10px] tracking-widest">
                                       <div className="flex items-center gap-2"><CreditCard className="h-4 w-4 text-primary/60"/> {payment.paymentMethodName}</div>
                                    </TableHead>
                                  </TableRow>
                                  <TableRow className="border-border/10">
                                    <TableHead></TableHead>
                                    <TableHead className="text-[10px] uppercase font-bold tracking-wider">Nº Parcela</TableHead>
                                    <TableHead className="text-[10px] uppercase font-bold tracking-wider">Valor</TableHead>
                                    <TableHead className="text-[10px] uppercase font-bold tracking-wider">Data Recebimento</TableHead>
                                    <TableHead className="text-[10px] uppercase font-bold tracking-wider">Recebido Por</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {payment.installments.map(inst => {
                                      const isPendingReversal = inst.reversalStatus === 'reversal_pending';
                                      const isSelected = selectedForReversal.some(item => item.orderId === group.orderId && item.paymentId === payment.paymentId && item.installmentNumber === inst.number);
                                      return (
                                      <TableRow key={inst.number} className={cn("hover:bg-primary/5 transition-colors border-border/5", isSelected && "bg-destructive/5")}>
                                          <TableCell className="py-3">
                                              <Checkbox 
                                                  checked={isSelected}
                                                  onCheckedChange={() => handleToggleReversal(group.orderId, payment.paymentId, inst)}
                                                  disabled={isPendingReversal}
                                                  className={cn("rounded-md", isSelected && "border-destructive text-destructive")}
                                              />
                                          </TableCell>
                                          <TableCell className="font-mono text-xs font-bold">{inst.number}</TableCell>
                                          <TableCell className="font-bold font-mono text-foreground/80">{formatCurrency(inst.value)}</TableCell>
                                          <TableCell className="text-xs text-muted-foreground/80 font-medium">{formatDate(inst.paidAt)}</TableCell>
                                          <TableCell>
                                              {isPendingReversal ? (
                                                  <Badge variant="outline" className="text-[9px] uppercase font-bold h-5 bg-amber-500/10 text-amber-600 border-amber-500/30 animate-pulse">Pendente de Estorno</Badge>
                                              ) : (
                                                 <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground/70">
                                                     <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                                         <UserIcon className="h-3 w-3"/>
                                                     </div>
                                                     {getUserName(inst.paidByUserId)}
                                                 </div>
                                              )}
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
              )})}
               {filteredGroupedInstallments.length === 0 && (
                  <div className="text-center h-24 text-muted-foreground flex items-center justify-center">Nenhum recebimento encontrado.</div>
                )}
            </Accordion>
          )}
        </CardContent>
      </Card>
      
       <AlertDialog open={isReversalModalOpen} onOpenChange={setIsReversalModalOpen}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Solicitar Estorno</AlertDialogTitle>
                <AlertDialogDescription>
                    Você está solicitando o estorno de <strong>{selectedForReversal.length} parcela(s)</strong>, totalizando <strong>{formatCurrency(totalReversalValue)}</strong>. Por favor, informe o motivo.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="py-4">
                <Label htmlFor="reversal-reason">Motivo do Estorno</Label>
                <Textarea id="reversal-reason" value={reversalReason} onChange={e => setReversalReason(e.target.value)} placeholder="Ex: Pagamento duplicado, valor incorreto, etc." />
            </div>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleRequestReversal} disabled={!reversalReason.trim() || isSubmitting}>
                   {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                    Enviar Solicitação
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
       </AlertDialog>
    </div>
  );
}

    