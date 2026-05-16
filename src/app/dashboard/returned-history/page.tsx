
"use client";

import * as React from "react";
import {
  Loader2,
  RefreshCw,
  Frown,
  Undo2,
  User as UserIcon,
  ShoppingCart,
  GitFork,
  CreditCard,
  Search,
  ArrowDownLeft,
  TrendingDown,
  Calendar,
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

type GroupedReturnedInfo = {
  orderId: string;
  orderNumber: number;
  customerName: string;
  saleTypeName: string;
  branchName: string;
  sellerName: string;
  returnedAt?: any;
  payments: {
    paymentId: string;
    paymentMethodName: string;
    installments: Installment[];
  }[];
}[]


export default function ReturnedHistoryPage() {
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
      const ordersQuery = query(collection(db, "salesOrders"), where("status", "==", "returned"));
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

  const groupedAndFilteredOrders: GroupedReturnedInfo = React.useMemo(() => {
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
            returnedAt: order.returnedAt,
            payments: (order.payments || []).map(p => ({
                paymentId: p.id,
                paymentMethodName: getPaymentMethodName(p.paymentMethodId),
                installments: p.installments,
            }))
        };
    }).sort((a,b) => b.orderNumber - a.orderNumber);
  }, [orders, searchTerm, branches, companyBranches, paymentMethods, saleTypes]);

  const summaryMetrics = React.useMemo(() => {
    let totalReturnedValue = 0;
    let totalOrdersCount = orders.length;
    
    orders.forEach(order => {
        (order.payments || []).forEach(p => {
            (p.installments || []).forEach(inst => {
                totalReturnedValue += inst.value;
            });
        });
    });

    return { totalReturnedValue, totalOrdersCount };
  }, [orders]);


  const formatCurrency = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  const formatDate = (timestamp: any) => {
    if (!timestamp) return "Não recebido";
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
            <Undo2 /> Histórico de Devoluções
          </h1>
          <p className="text-muted-foreground">
            Audite todos os pedidos que foram devolvidos e geraram crédito.
          </p>
        </div>
        <Button variant="outline" size="icon" onClick={fetchData} disabled={loading}>
          <RefreshCw className={loading ? "animate-spin h-4 w-4" : "h-4 w-4"} />
        </Button>
      </div>

      <Card className="border-none shadow-glass bg-card/60 backdrop-blur-xl rounded-3xl overflow-hidden">
        <CardHeader className="bg-muted/10 border-b border-border/10 pb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                  <CardTitle className="text-xl font-headline">Registro de Devoluções</CardTitle>
                  <CardDescription>
                    {loading ? "Carregando..." : `${groupedAndFilteredOrders.length} atendimentos encontrados.`}
                  </CardDescription>
              </div>
              <div className="relative w-full md:w-96">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar cliente ou pedido..."
                  className="pl-10 bg-background/50 border-border/50 rounded-xl focus-visible:ring-primary/20"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
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
                <p className="mt-2 text-sm text-muted-foreground">Nenhum pedido devolvido corresponde à sua busca.</p>
            </div>
          ) : (
            <Accordion type="multiple" className="w-full space-y-4">
              {groupedAndFilteredOrders.map((group) => (
                  <AccordionItem value={group.orderId} key={group.orderId} className="border border-border/50 rounded-2xl overflow-hidden transition-all hover:border-primary/20 hover:shadow-sm bg-background/40">
                    <AccordionTrigger className="p-5 hover:no-underline hover:bg-muted/5 group">
                       <div className="flex flex-col md:flex-row md:items-center justify-between w-full gap-4 pr-4 text-left">
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center gap-2">
                                <p className="font-bold text-lg text-foreground/80 group-hover:text-primary transition-colors">Pedido #{group.orderNumber}</p>
                            </div>
                            <div className="text-sm font-medium text-muted-foreground/80">{group.customerName}</div>
                            <div className="text-[10px] text-muted-foreground/60 flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
                              <span className="flex items-center gap-1.5 bg-muted/50 px-2 py-0.5 rounded-md uppercase font-bold tracking-wider"><ShoppingCart className="h-3 w-3"/> {group.saleTypeName}</span>
                              <span className="flex items-center gap-1.5 bg-muted/50 px-2 py-0.5 rounded-md uppercase font-bold tracking-wider"><GitFork className="h-3 w-3"/> {group.branchName}</span>
                              <span className="flex items-center gap-1.5 bg-muted/50 px-2 py-0.5 rounded-md uppercase font-bold tracking-wider"><UserIcon className="h-3 w-3"/> {group.sellerName}</span>
                            </div>
                          </div>
                           <div className="flex flex-col items-end gap-2">
                                <span className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-widest">Data Devolução</span>
                                <Badge variant="outline" className="text-destructive border-destructive/20 bg-destructive/5 text-[10px] font-bold px-2 py-1 gap-1.5">
                                    <Calendar className="h-3 w-3" /> {formatDate(group.returnedAt)}
                                </Badge>
                           </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="p-4 pt-0">
                      {group.payments.length > 0 ? (
                        group.payments.map(payment => (
                           <div key={payment.paymentId} className="mt-4 border border-border/10 rounded-2xl overflow-hidden bg-background/50 shadow-sm">
                              <Table>
                                 <TableHeader>
                                   <TableRow className="bg-muted/10 border-b border-border/10">
                                     <TableHead colSpan={6} className="py-4">
                                        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-foreground/70 review-ignore">
                                            <CreditCard className="h-4 w-4 text-primary" /> Pagamentos Estornados (Crédito Gerado)
                                        </div>
                                     </TableHead>
                                   </TableRow>
                                   <TableRow className="bg-muted/5 text-[10px] uppercase font-bold tracking-wider">
                                     <TableHead className="h-10">Forma de Pgto.</TableHead>
                                     <TableHead className="h-10">Nº Parcela</TableHead>
                                     <TableHead className="h-10">Valor</TableHead>
                                     <TableHead className="h-10">Recebimento Original</TableHead>
                                     <TableHead className="h-10 text-center">Badges</TableHead>
                                   </TableRow>
                                 </TableHeader>
                                 <TableBody>
                                   {payment.installments.map(inst => (
                                       <TableRow key={inst.number} className="border-border/5">
                                           <TableCell className="text-sm font-medium text-foreground/80">{payment.paymentMethodName}</TableCell>
                                           <TableCell className="font-mono text-xs">{inst.number}</TableCell>
                                           <TableCell className="font-bold font-mono text-foreground/90">{formatCurrency(inst.value)}</TableCell>
                                           <TableCell>
                                               <div className="flex flex-col">
                                                   <span className="text-[11px] font-medium text-foreground/70">{inst.paidAt ? formatDate(inst.paidAt) : 'Não recebido'}</span>
                                                   <span className="text-[9px] text-muted-foreground/60 flex items-center gap-1"><UserIcon className="h-3 w-3" /> {getUserName(inst.paidByUserId)}</span>
                                               </div>
                                           </TableCell>
                                           <TableCell className="text-center">
                                             <Badge className="gap-1.5 bg-primary/10 text-primary border-primary/20 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 shadow-sm">
                                                 <Undo2 className="h-3 w-3"/> Estornado
                                             </Badge>
                                           </TableCell>
                                       </TableRow>
                                   ))}
                                 </TableBody>
                               </Table>
                           </div>
                        ))
                      ) : (
                        <div className="text-center text-sm text-muted-foreground p-4">
                          Este pedido foi devolvido e não possuía pagamentos registrados no momento da ação.
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
