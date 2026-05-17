
"use client";

import * as React from "react";
import {
  Loader2,
  Undo2,
  RefreshCw,
  Frown,
  Check,
  X,
  CreditCard,
  User as UserIcon,
  ShieldAlert,
  GitFork,
} from "lucide-react";
import {
  collection,
  getDocs,
  query,
  orderBy,
  where,
  doc,
  writeBatch,
  updateDoc,
  getDoc,
  deleteField,
} from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import type { ReversalRequest, SalesOrder, PaymentMethod, User as UserType, SalesPermissions, Branch, CompanyBranch } from "@/lib/definitions";
import { useAuthState } from "react-firebase-hooks/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export default function ReversalReleasePage() {
  const { toast } = useToast();
  const [user, authLoading] = useAuthState(auth);
  const [userData, setUserData] = React.useState<UserType | null>(null);
  const [requests, setRequests] = React.useState<ReversalRequest[]>([]);
  const [orders, setOrders] = React.useState<Map<string, SalesOrder>>(new Map());
  const [paymentMethods, setPaymentMethods] = React.useState<PaymentMethod[]>([]);
  const [branches, setBranches] = React.useState<Branch[]>([]);
  const [companyBranches, setCompanyBranches] = React.useState<CompanyBranch[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState<string | null>(null);
  const [hasPermission, setHasPermission] = React.useState(false);

  const fetchData = React.useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      
      const [userSnap, permsSnap] = await Promise.all([
        getDoc(doc(db, "users", user.uid)),
        getDoc(doc(db, "settings", "salesPermissions")),
      ]);

      const currentUser = userSnap.exists() ? userSnap.data() as UserType : null;
      setUserData(currentUser);
      const permissions = permsSnap.exists() ? permsSnap.data() as SalesPermissions : {};
      
      const canRelease = currentUser?.isAdmin || 
                         permissions.canReleaseReversal?.roleIds?.includes(currentUser?.roleId || '') || 
                         permissions.canReleaseReversal?.userIds?.includes(currentUser?.id || '');
      
      setHasPermission(!!canRelease);

      if (canRelease) {
        const [reqsSnap, ordersSnap, paymentMethodsSnap, branchesSnap, companyBranchesSnap] = await Promise.all([
          getDocs(query(collection(db, "reversalRequests"))),
          getDocs(collection(db, "salesOrders")),
          getDocs(collection(db, "paymentMethods")),
          getDocs(collection(db, "branches")),
          getDocs(collection(db, "companyBranches")),
        ]);
        
        const allRequests = reqsSnap.docs.map(d => ({ id: d.id, ...d.data() } as ReversalRequest));
        const pendingRequests = allRequests
            .filter(r => r.status === 'pending')
            .sort((a,b) => (b.requestedAt?.seconds || 0) - (a.requestedAt?.seconds || 0));

        setRequests(pendingRequests);
        
        const ordersMap = new Map<string, SalesOrder>();
        ordersSnap.docs.forEach(doc => ordersMap.set(doc.id, { id: doc.id, ...doc.data()} as SalesOrder));
        setOrders(ordersMap);

        setPaymentMethods(paymentMethodsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as PaymentMethod)));
        setBranches(branchesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Branch)));
        setCompanyBranches(companyBranchesSnap.docs.map(d => ({ id: d.id, ...d.data() } as CompanyBranch)));
      } else {
        setRequests([]);
      }
    } catch (error) {
      toast({ title: "Erro ao carregar solicitações", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);


  React.useEffect(() => {
    if (user && !authLoading) {
      fetchData();
    }
  }, [fetchData, user, authLoading]);

  const handleProcessRequest = async (request: ReversalRequest, action: 'approve' | 'deny') => {
    setIsSubmitting(request.id);
    const batch = writeBatch(db);
    try {
      const requestRef = doc(db, "reversalRequests", request.id);
      
      if (action === 'approve') {
        const orderIds = [...new Set(request.items.map(item => item.orderId))];
        
        for (const orderId of orderIds) {
          const orderRef = doc(db, "salesOrders", orderId);
          const orderData = orders.get(orderId);
          if (!orderData) continue;

          const updatedPayments = orderData.payments.map(payment => {
            const itemsToRevert = request.items.filter(item => item.orderId === orderId && item.paymentId === payment.id);
            if (itemsToRevert.length === 0) return payment;

            const updatedInstallments = payment.installments.map(inst => {
              if (itemsToRevert.some(i => i.installmentNumber === inst.number)) {
                const revertedInstallment: any = { 
                  ...inst, 
                  paid: false, 
                  reversalStatus: 'reversal_approved' as const 
                };
                delete revertedInstallment.paidAt;
                delete revertedInstallment.paidByUserId;
                delete revertedInstallment.paidInCaixaId;
                return revertedInstallment;
              }
              return inst;
            });
            return { ...payment, installments: updatedInstallments };
          });
           batch.update(orderRef, { payments: updatedPayments });
        }
        batch.update(requestRef, { status: "approved", processedAt: new Date().toISOString(), processedByUserId: user?.uid, processedByUserName: userData?.name });
        toast({ title: "Estorno Aprovado!", description: "As parcelas foram retornadas ao estado pendente." });

      } else { // Deny
        batch.update(requestRef, { status: "denied", processedAt: new Date().toISOString(), processedByUserId: user?.uid, processedByUserName: userData?.name });
        toast({ title: "Solicitação Negada", variant: "default" });
      }

      await batch.commit();
      fetchData();
    } catch (error) {
      console.error(error);
      toast({ title: "Erro ao processar a solicitação", variant: "destructive" });
    } finally {
      setIsSubmitting(null);
    }
  };

  const formatCurrency = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  const formatDate = (timestamp: any) => {
    if (!timestamp?.toDate && typeof timestamp !== 'string') return "N/A";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return format(date, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  };
  
  const getPaymentMethodName = (orderId: string, paymentId: string) => {
    const order = orders.get(orderId);
    const payment = order?.payments.find(p => p.id === paymentId);
    if (!payment) return "N/A";
    return paymentMethods.find(pm => pm.id === payment.paymentMethodId)?.name || "N/A";
  };
  
  const getBranchName = (companyBranchId?: string) => {
    if (!companyBranchId) return 'N/A';
    const companyBranch = companyBranches.find(cb => cb.id === companyBranchId);
    if (!companyBranch) return 'N/A';
    return branches.find(b => b.id === companyBranch.branchId)?.name || 'N/A';
  };


  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-headline tracking-tight flex items-center gap-2">
            <Undo2 /> Liberação de Estornos
          </h1>
          <p className="text-muted-foreground">
            Aprove ou negue as solicitações de estorno de recebimentos.
          </p>
        </div>
        <Button variant="outline" size="icon" onClick={fetchData} disabled={loading}>
          <RefreshCw className={loading ? "animate-spin" : ""} />
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Solicitações Pendentes</CardTitle>
          <CardDescription>
            {hasPermission ? `${requests.length} solicitações aguardando sua análise.` : "Você não tem permissão para acessar esta página."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading || authLoading ? (
            <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>
          ) : !hasPermission ? (
             <div className="flex flex-col items-center justify-center h-64 rounded-lg border border-dashed">
                <ShieldAlert className="h-16 w-16 text-destructive" />
                <h2 className="mt-4 text-xl font-semibold">Acesso Negado</h2>
                <p className="mt-2 text-sm text-muted-foreground text-center">
                    Seu perfil não tem permissão para liberar estornos.
                </p>
            </div>
          ) : requests.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 rounded-lg border border-dashed">
                <Frown className="h-16 w-16 text-muted-foreground" />
                <h2 className="mt-4 text-xl font-semibold">Nenhuma pendência</h2>
                <p className="mt-2 text-sm text-muted-foreground">Não há solicitações de estorno no momento.</p>
            </div>
          ) : (
            <Accordion type="multiple" className="w-full space-y-4">
              {requests.map(req => {
                const order = orders.get(req.items[0]?.orderId || '');
                return (
                <AccordionItem value={req.id} key={req.id} className="border rounded-lg">
                  <AccordionTrigger className="p-4 hover:no-underline">
                    <div className="flex flex-col md:flex-row md:items-center justify-between w-full gap-2">
                      <div className="flex-1 text-left">
                        <p className="font-semibold">Pedido #{order?.orderNumber || 'N/A'}</p>
                         <div className="text-sm text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1">
                            <span className="flex items-center gap-1.5"><UserIcon className="h-4 w-4"/> {order?.customerName || 'N/A'}</span>
                            <span className="flex items-center gap-1.5"><GitFork className="h-4 w-4"/> {getBranchName(order?.companyBranchId)}</span>
                         </div>
                         <div className="text-xs text-muted-foreground mt-1">Solicitado por: {req.requestedByUserName} em {formatDate(req.requestedAt)}</div>
                      </div>
                      <Badge variant="destructive" className="text-lg">{formatCurrency(req.totalValue)}</Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="p-4 pt-0">
                    <div className="space-y-4">
                       <div className="p-3 rounded-md bg-muted">
                        <p className="font-semibold text-sm">Motivo da Solicitação:</p>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{req.reason}</p>
                       </div>
                       <div>
                        <h4 className="font-medium mb-2">Parcelas a Estornar:</h4>
                         <ul className="space-y-1 text-sm list-disc list-inside">
                          {req.items.map(item => (
                            <li key={`${item.orderId}-${item.paymentId}-${item.installmentNumber}`} className="flex items-center gap-2">
                               <span>Parcela {item.installmentNumber} ({formatCurrency(item.value)})</span>
                               <Badge variant="outline" className="gap-1.5"><CreditCard className="h-3 w-3"/>{getPaymentMethodName(item.orderId, item.paymentId)}</Badge>
                            </li>
                          ))}
                         </ul>
                       </div>
                       <div className="flex justify-end gap-2 pt-4 border-t">
                          <Button 
                            variant="destructive" 
                            onClick={() => handleProcessRequest(req, 'deny')}
                            disabled={isSubmitting === req.id}
                          >
                             {isSubmitting === req.id ? <Loader2 className="animate-spin" /> : <X className="mr-2 h-4 w-4"/>}
                             Negar
                          </Button>
                          <Button 
                            onClick={() => handleProcessRequest(req, 'approve')}
                            disabled={isSubmitting === req.id}
                          >
                             {isSubmitting === req.id ? <Loader2 className="animate-spin" /> : <Check className="mr-2 h-4 w-4"/>}
                             Aprovar Estorno
                          </Button>
                       </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              )})}
            </Accordion>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
