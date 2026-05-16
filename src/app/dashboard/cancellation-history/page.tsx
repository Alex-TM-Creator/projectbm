
"use client";

import * as React from "react";
import {
  Loader2,
  RefreshCw,
  Frown,
  XCircle,
  FileX,
  User as UserIcon,
  ShoppingCart,
  GitFork,
  CreditCard,
} from "lucide-react";
import {
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import type { SalesOrder, Installment, PaymentMethod, User as UserType, Branch, CompanyBranch, SaleType } from "@/lib/definitions";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";

type GroupedCancelledInfo = {
  orderId: string;
  orderNumber: number;
  customerName: string;
  saleTypeName: string;
  branchName: string;
  sellerName: string;
  cancelledAt?: any;
  payments: {
    paymentId: string;
    paymentMethodName: string;
    installments: Installment[];
  }[];
}[]


export default function CancellationHistoryPage() {
  const { toast } = useToast();
  const [orders, setOrders] = React.useState<SalesOrder[]>([]);
  const [allUsers, setAllUsers] = React.useState<UserType[]>([]);
  const [paymentMethods, setPaymentMethods] = React.useState<PaymentMethod[]>([]);
  const [saleTypes, setSaleTypes] = React.useState<SaleType[]>([]);
  const [branches, setBranches] = React.useState<Branch[]>([]);
  const [companyBranches, setCompanyBranches] = React.useState<CompanyBranch[]>([]);
  const [loading, setLoading] = React.useState(true);
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
    try {
      setLoading(true);
      const ordersQuery = query(collection(db, "salesOrders"), where("status", "==", "cancelled"));
      const [ordersSnap, usersSnap, paymentMethodsSnap, saleTypesSnap, branchesSnap, companyBranchesSnap] = await Promise.all([
        getDocs(ordersQuery),
        getDocs(collection(db, "users")),
        getDocs(collection(db, "paymentMethods")),
        getDocs(collection(db, "saleTypes")),
        getDocs(collection(db, "branches")),
        getDocs(collection(db, "companyBranches")),
      ]);

      const fetchedOrders = ordersSnap.docs.map(d => ({ id: d.id, ...d.data() } as SalesOrder));
      setOrders(fetchedOrders);
      setAllUsers(usersSnap.docs.map(d => ({ id: d.id, ...d.data() } as UserType)));
      setPaymentMethods(paymentMethodsSnap.docs.map(d => ({ id: d.id, ...d.data() } as PaymentMethod)));
      setSaleTypes(saleTypesSnap.docs.map(d => ({ id: d.id, ...d.data() } as SaleType)));
      setBranches(branchesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Branch)));
      setCompanyBranches(companyBranchesSnap.docs.map(d => ({ id: d.id, ...d.data() } as CompanyBranch)));

    } catch (error) {
      toast({ title: "Erro ao carregar histórico", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const groupedAndFilteredOrders: GroupedCancelledInfo = React.useMemo(() => {
    const filtered = orders.filter(order => 
        order.customerName.toLowerCase().includes(searchTerm.toLowerCase()) || 
        order.orderNumber.toString().includes(searchTerm)
    );

    return filtered.map(order => {
        return {
            orderId: order.id,
            orderNumber: order.orderNumber,
            customerName: order.customerName,
            saleTypeName: getSaleTypeName(order.saleTypeId),
            branchName: getBranchName(order.companyBranchId),
            sellerName: order.createdByUserName,
            cancelledAt: order.cancelledAt,
            payments: (order.payments || []).map(p => ({
                paymentId: p.id,
                paymentMethodName: getPaymentMethodName(p.paymentMethodId),
                installments: p.installments,
            }))
        };
    }).sort((a,b) => b.orderNumber - a.orderNumber);
  }, [orders, searchTerm, branches, companyBranches, paymentMethods, saleTypes]);


  const formatCurrency = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  const formatDate = (timestamp: any) => {
    if (!timestamp) return "N/A";
    try {
      // Handle both Firestore Timestamp and ISO string
      const date = timestamp.toDate ? timestamp.toDate() : parseISO(timestamp as string);
      return format(date, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    } catch {
      return "Data inválida";
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-headline tracking-tight flex items-center gap-2">
            <FileX /> Histórico de Cancelamento
          </h1>
          <p className="text-muted-foreground">
            Audite todos os pedidos que foram cancelados.
          </p>
        </div>
        <Button variant="outline" size="icon" onClick={fetchData} disabled={loading}>
          <RefreshCw className={loading ? "animate-spin h-4 w-4" : "h-4 w-4"} />
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pedidos Cancelados</CardTitle>
          <CardDescription>
            {loading ? "Carregando..." : `${groupedAndFilteredOrders.length} de ${orders.length} pedidos cancelados.`}
          </CardDescription>
           <div className="relative pt-4">
              <Input
                placeholder="Buscar por nome do cliente ou nº do pedido..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : groupedAndFilteredOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 rounded-lg border border-dashed">
                <Frown className="h-16 w-16 text-muted-foreground" />
                <h2 className="mt-4 text-xl font-semibold">Nenhum registro encontrado</h2>
                <p className="mt-2 text-sm text-muted-foreground">Nenhum pedido cancelado corresponde à sua busca.</p>
            </div>
          ) : (
            <Accordion type="multiple" className="w-full space-y-3">
              {groupedAndFilteredOrders.map((group) => (
                  <AccordionItem value={group.orderId} key={group.orderId} className="border rounded-lg">
                    <AccordionTrigger className="p-4 hover:no-underline text-left">
                       <div className="flex flex-col md:flex-row md:items-center justify-between w-full gap-2">
                          <div className="flex-1 space-y-1">
                            <p className="font-semibold text-lg">Pedido #{group.orderNumber}</p>
                            <div className="text-sm text-muted-foreground">{group.customerName}</div>
                            <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
                              <span className="flex items-center gap-1.5"><ShoppingCart className="h-3 w-3"/> {group.saleTypeName}</span>
                              <span className="flex items-center gap-1.5"><GitFork className="h-3 w-3"/> {group.branchName}</span>
                              <span className="flex items-center gap-1.5"><UserIcon className="h-3 w-3"/> {group.sellerName}</span>
                            </div>
                          </div>
                           <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground">Cancelado em:</span>
                                <Badge variant="destructive">{formatDate(group.cancelledAt)}</Badge>
                           </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="p-4 pt-0">
                      {group.payments.length > 0 ? (
                        group.payments.map(payment => (
                          <div key={payment.paymentId} className="mt-2">
                             <Table>
                                <TableHeader>
                                  <TableRow className="bg-muted/50">
                                    <TableHead colSpan={6} className="font-semibold">
                                       <div className="flex items-center gap-2"><CreditCard className="h-4 w-4"/> Detalhes do Pagamento</div>
                                    </TableHead>
                                  </TableRow>
                                  <TableRow>
                                    <TableHead>Forma de Pgto.</TableHead>
                                    <TableHead>Nº Parcela</TableHead>
                                    <TableHead>Valor</TableHead>
                                    <TableHead>Recebimento Original</TableHead>
                                    <TableHead>Recebido Por</TableHead>
                                    <TableHead>Status</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {payment.installments.map(inst => (
                                      <TableRow key={inst.number}>
                                          <TableCell>{payment.paymentMethodName}</TableCell>
                                          <TableCell>{inst.number}</TableCell>
                                          <TableCell>{formatCurrency(inst.value)}</TableCell>
                                          <TableCell>{inst.paidAt ? formatDate(inst.paidAt) : 'Não recebido'}</TableCell>
                                          <TableCell>
                                            <div className="flex items-center gap-2">
                                              <UserIcon className="h-4 w-4 text-muted-foreground" />
                                              {getUserName(inst.paidByUserId)}
                                            </div>
                                          </TableCell>
                                          <TableCell>
                                            <Badge variant="destructive" className="gap-1.5"><XCircle className="h-3 w-3"/>Cancelado</Badge>
                                          </TableCell>
                                      </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                          </div>
                        ))
                      ) : (
                        <div className="text-center text-sm text-muted-foreground p-4">
                          Este pedido foi cancelado antes de qualquer pagamento ser registrado.
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>
              ))}
            </Accordion>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
