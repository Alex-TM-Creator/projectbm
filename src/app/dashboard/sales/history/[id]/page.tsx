
"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc, getDocs, collection } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Loader2, Printer, ArrowLeft, Building2, User, Home, Phone, MapPin, AlertCircle, CreditCard, Package, GitFork, ShoppingCart, Undo2, Info } from "lucide-react";
import type { SalesOrder, CompanyBranch, SaleType, DeliveryType, Branch, PaymentMethod, ProductModality } from "@/lib/definitions";
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
import { format, parseISO, isPast } from "date-fns";
import { ptBR } from "date-fns/locale";
import Image from "next/image";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter as TableFoot } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

const statusParcelaConfig: { [key: string]: { label: string; variant: "default" | "secondary" | "outline" | "destructive"; className?: string } } = {
  paid: { label: "Pago", variant: "default", className: "bg-green-600 hover:bg-green-700" },
  pending: { label: "Em Aberto", variant: "outline", className: "text-yellow-600 border-yellow-500" },
  overdue: { label: "Atrasado", variant: "destructive" },
};

export default function PrintSalesOrderPage() {
  const { id } = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const [order, setOrder] = React.useState<SalesOrder | null>(null);
  const [companyBranch, setCompanyBranch] = React.useState<CompanyBranch | null>(null);
  const [saleTypes, setSaleTypes] = React.useState<SaleType[]>([]);
  const [deliveryTypes, setDeliveryTypes] = React.useState<DeliveryType[]>([]);
  const [paymentMethods, setPaymentMethods] = React.useState<PaymentMethod[]>([]);
  const [branches, setBranches] = React.useState<Branch[]>([]);
  const [companyBranches, setCompanyBranches] = React.useState<CompanyBranch[]>([]);
  const [productModalities, setProductModalities] = React.useState<ProductModality[]>([]);
  const [globalObservation, setGlobalObservation] = React.useState<string>("");
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (typeof id !== 'string') return;
    const fetchOrder = async () => {
      try {
        setLoading(true);
        const [orderDocSnap, saleTypesSnap, deliveryTypesSnap, paymentMethodsSnap, branchesSnap, companyBranchesSnap, modalitiesSnap, globalObsSnap] = await Promise.all([
          getDoc(doc(db, "salesOrders", id)),
          getDocs(collection(db, "saleTypes")),
          getDocs(collection(db, "deliveryTypes")),
          getDocs(collection(db, "paymentMethods")),
          getDocs(collection(db, "branches")),
          getDocs(collection(db, "companyBranches")),
          getDocs(collection(db, "productModalities")),
          getDoc(doc(db, "settings", "globalObservations")),
        ]);
        
        setSaleTypes(saleTypesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as SaleType)));
        setDeliveryTypes(deliveryTypesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as DeliveryType)));
        setPaymentMethods(paymentMethodsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as PaymentMethod)));
        setBranches(branchesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Branch)));
        setCompanyBranches(companyBranchesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as CompanyBranch)));
        setProductModalities(modalitiesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProductModality)));

        if (globalObsSnap.exists()) {
          setGlobalObservation(globalObsSnap.data().text || "");
        }

        if (!orderDocSnap.exists()) {
          toast({ title: "Pedido não encontrado", variant: "destructive" });
          router.push('/dashboard/sales/history');
          return;
        }
        
        const orderData = orderDocSnap.data() as SalesOrder;
        setOrder(orderData);
        
        if (orderData.companyBranchId) {
            const companyBranchData = companyBranchesSnap.docs.find(doc => doc.id === orderData.companyBranchId)?.data() as CompanyBranch | undefined;
            if (companyBranchData) {
              setCompanyBranch(companyBranchData);
            }
        }

      } catch (error) {
        toast({ title: "Erro ao buscar dados do pedido", variant: "destructive" });
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchOrder();
  }, [id, router, toast]);

  const getSaleTypeName = (id: string) => saleTypes.find(st => st.id === id)?.name || id;
  const getDeliveryTypeName = (id: string) => deliveryTypes.find(dt => dt.id === id)?.name || id;
  const getPaymentMethod = (id: string) => paymentMethods.find(pm => pm.id === id);
  const getBranchName = (companyBranchId?: string) => {
    if (!companyBranchId) return 'N/A';
    const companyBranchForOrder = companyBranches.find(cb => cb.id === companyBranchId);
    if (!companyBranchForOrder) return 'N/A';
    return branches.find(b => b.id === companyBranchForOrder.branchId)?.name || 'N/A';
  };
  const getModalityName = (modalityId?: string) => {
    if (!modalityId) return "N/A";
    return productModalities.find(m => m.id === modalityId)?.name || 'N/A';
  }


  const formatCurrency = (value: number | undefined) => {
    if (value === undefined) return "R$ 0,00";
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  }

  const formatDate = (timestamp: any) => {
    if (!timestamp?.toDate) return "Data inválida";
    return format(timestamp.toDate(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  };
  
  const formatPhone = (value: string | undefined) => {
    if (!value) return "";
    value = value.replace(/\D/g, "");
    if (value.length > 11) return value.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
    return value.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3");
};

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p>Pedido de venda não encontrado.</p>
      </div>
    );
  }
  
  const totalItemDiscounts = order.items.reduce((sum, item) => {
      if (item.discountType === 'percentage') {
          return sum + (item.unitPrice * item.quantity * (item.discountValue / 100));
      }
      return sum + item.discountValue;
  }, 0);
  
  const totalGeneralDiscount = order.generalDiscountType === 'percentage' 
    ? order.subtotal * (order.generalDiscountValue / 100) 
    : order.generalDiscountValue;
  
  const totalDiscounts = totalItemDiscounts + totalGeneralDiscount;
  
  const totalInterest = (order.payments || []).reduce((acc, p) => {
      const baseValue = p.value;
      const totalInstallmentValue = (p.installments || []).reduce((sum, inst) => sum + inst.value, 0);
      const interestForPayment = totalInstallmentValue - baseValue;
      return acc + (interestForPayment > 0 ? interestForPayment : 0);
  }, 0);

  const hasAdjustments = (order.extraBonus || 0) > 0 || (order.extraDiscount || 0) > 0 || totalInterest > 0;


  return (
    <div className="bg-background text-foreground min-h-screen p-4 sm:p-8 print:p-2 print:text-xs">
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

        <Card className="print:shadow-none print:border-none">
           <CardHeader className="flex flex-row items-start justify-between p-6 print:p-2 gap-4">
              <div className="w-32 print:w-24 flex-shrink-0 flex items-center">
                {companyBranch?.logoUrl && (
                    <Image src={companyBranch.logoUrl} alt="Logo da Empresa" width={128} height={64} className="object-contain" priority />
                )}
              </div>
              <div className="text-center flex-grow">
                  <h2 className="font-bold text-base print:text-sm">{companyBranch?.razao_social || 'Empresa'}</h2>
                  <p className="text-xs text-muted-foreground print:text-[10px]">{companyBranch?.cnpj}</p>
                  <p className="text-xs text-muted-foreground print:text-[10px]">{`${companyBranch?.logradouro || ''}, ${companyBranch?.numero || ''} - ${companyBranch?.bairro || ''}, ${companyBranch?.cidade || ''} - ${companyBranch?.uf || ''}`}</p>
                  <p className="text-xs text-muted-foreground print:text-[10px]">{formatPhone(companyBranch?.telefone)}</p>
              </div>
              <div className="w-32 print:w-24 flex-shrink-0" />
          </CardHeader>
          <CardContent className="space-y-4 print:space-y-2 p-6 print:p-2">
            <div className="text-center">
              {order.status === 'cancelled' && (
                <p className="text-2xl print:text-lg font-bold text-destructive mb-2 flex items-center justify-center gap-2">
                  <AlertCircle className="h-6 w-6"/> PEDIDO CANCELADO
                </p>
              )}
               {order.status === 'returned' && (
                <p className="text-2xl print:text-lg font-bold text-blue-600 mb-2 flex items-center justify-center gap-2">
                  <Undo2 className="h-6 w-6"/> PEDIDO DEVOLVIDO
                </p>
              )}
              <CardTitle className="text-xl font-bold print:text-base">Pedido de Venda Nº {order.orderNumber}</CardTitle>
              <CardDescription className="print:text-xs">
                Emitido em: {formatDate(order.createdAt)}
              </CardDescription>
            </div>
            <div className="grid grid-cols-2 gap-4 rounded-lg border p-4 print:p-2 print:grid-cols-2">
                <div className="space-y-1">
                    <h3 className="font-semibold flex items-center gap-2 text-sm print:text-xs"><User className="h-4 w-4 text-muted-foreground"/> Cliente</h3>
                    <p className="text-sm print:text-xs"><strong>{order.customerName}</strong></p>
                    {order.deliveryAddress && (
                        <div className="text-xs text-muted-foreground print:text-[10px]">
                            <p className="flex items-center gap-2"><Home className="h-3 w-3"/>{order.deliveryAddress.address}, {order.deliveryAddress.number} {order.deliveryAddress.complement && `(${order.deliveryAddress.complement})`}</p>
                            <p>{order.deliveryAddress.neighborhood}, {order.deliveryAddress.city} - {order.deliveryAddress.state}</p>
                        </div>
                    )}
                    {order.deliveryPhone && (
                        <p className="text-xs text-muted-foreground flex items-center gap-2 print:text-[10px]"><Phone className="h-3 w-3"/>{formatPhone(order.deliveryPhone.number)}</p>
                    )}
                </div>
                <div className="space-y-1">
                     <h3 className="font-semibold flex items-center gap-2 text-sm print:text-xs"><ShoppingCart className="h-4 w-4 text-muted-foreground"/> Informações da Venda</h3>
                     <p className="text-xs"><strong>Operação:</strong> {getSaleTypeName(order.saleTypeId)}</p>
                     <p className="text-xs"><strong>Entrega:</strong> {getDeliveryTypeName(order.deliveryTypeId)} {order.deliveryDate && `em ${format(parseISO(order.deliveryDate), "dd/MM/yyyy")}`}</p>
                     <p className="text-xs"><strong>Vendedor:</strong> {order.createdByUserName}</p>
                     <p className="text-xs"><strong>Filial:</strong> {getBranchName(order.companyBranchId)}</p>
                </div>
            </div>
            
             <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2 text-sm print:text-xs"><Package className="h-4 w-4 text-muted-foreground"/> Itens do Pedido</h3>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="print:p-1">Produto</TableHead>
                            <TableHead className="print:p-1">Modalidade</TableHead>
                            <TableHead className="print:p-1">Entrega</TableHead>
                            <TableHead className="text-center print:p-1">Qtd.</TableHead>
                            <TableHead className="text-right print:p-1">Preço Unit.</TableHead>
                             <TableHead className="text-right print:p-1">Desconto</TableHead>
                            <TableHead className="text-right print:p-1">Subtotal</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {order.items.map((item, index) => (
                           <TableRow key={`item-${index}`}>
                                <TableCell className="print:p-1">{item.productName}</TableCell>
                                <TableCell className="print:p-1">{getModalityName(item.productModalityId)}</TableCell>
                                <TableCell className="print:p-1">{item.deliveryOption || "N/A"}</TableCell>
                                <TableCell className="text-center print:p-1">{item.quantity}</TableCell>
                                <TableCell className="text-right print:p-1">{formatCurrency(item.unitPrice)}</TableCell>
                                <TableCell className="text-right text-destructive print:p-1">
                                  - {item.discountType === 'fixed' ? formatCurrency(item.discountValue) : `${item.discountValue}%`}
                                </TableCell>
                                <TableCell className="text-right print:p-1">{formatCurrency(item.total)}</TableCell>
                            </TableRow>
                        ))}
                        {order.services.map((service, index) => (
                            <TableRow key={`service-${index}`}>
                                <TableCell className="print:p-1">{service.serviceName} <Badge variant="outline">Serviço</Badge></TableCell>
                                <TableCell colSpan={5}></TableCell>
                                <TableCell className="text-right print:p-1">{formatCurrency(service.price)}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                     <TableFoot>
                        <TableRow><TableCell colSpan={6} className="text-right print:p-1">Subtotal</TableCell><TableCell className="text-right print:p-1">{formatCurrency(order.subtotal)}</TableCell></TableRow>
                        <TableRow><TableCell colSpan={6} className="text-right print:p-1">Frete</TableCell><TableCell className="text-right print:p-1">{formatCurrency(order.freightValue)}</TableCell></TableRow>
                        <TableRow><TableCell colSpan={6} className="text-right text-destructive print:p-1">Descontos Totais</TableCell><TableCell className="text-right text-destructive print:p-1">- {formatCurrency(totalDiscounts)}</TableCell></TableRow>
                        {totalInterest > 0 && <TableRow><TableCell colSpan={6} className="text-right text-blue-600 print:p-1">Acréscimo (Juros)</TableCell><TableCell className="text-right text-blue-600 print:p-1">+ {formatCurrency(totalInterest)}</TableCell></TableRow>}
                        {hasAdjustments && (
                            <>
                                {(order.extraBonus || 0) > 0 && <TableRow><TableCell colSpan={6} className="text-right text-blue-600 print:p-1">Outras Despesas</TableCell><TableCell className="text-right text-blue-600 print:p-1">+ {formatCurrency(order.extraBonus)}</TableCell></TableRow>}
                                {(order.extraDiscount || 0) > 0 && <TableRow><TableCell colSpan={6} className="text-right text-destructive print:p-1">Desconto Adicional</TableCell><TableCell className="text-right text-destructive print:p-1">- {formatCurrency(order.extraDiscount)}</TableCell></TableRow>}
                            </>
                        )}
                        <TableRow className="font-bold text-base print:text-sm"><TableCell colSpan={6} className="text-right print:p-1">Total</TableCell><TableCell className="text-right print:p-1">{formatCurrency(order.total)}</TableCell></TableRow>
                    </TableFoot>
                </Table>
             </div>
             
             {order.payments && order.payments.length > 0 && (
                 <div className="space-y-2">
                     <h3 className="font-semibold mb-2 flex items-center gap-2 text-sm print:text-xs"><CreditCard className="h-4 w-4 text-muted-foreground"/> Pagamento</h3>
                     {order.payments.map((payment, index) => {
                        const paymentMethod = getPaymentMethod(payment.paymentMethodId);
                        const totalInstallmentValue = payment.installments.reduce((sum, inst) => sum + inst.value, 0);
                        const hasInterest = Math.abs(totalInstallmentValue - payment.value) > 0.01;
                        return (
                            <div key={payment.id || index} className="text-sm print:text-xs mb-2">
                                <p><strong>Forma:</strong> {paymentMethod?.name || 'N/A'}</p>
                                {payment.installments && payment.installments.length > 1 ? (
                                    paymentMethod?.isGrouped ? (
                                        <>
                                            <p><strong>Parcelamento:</strong> {payment.installments.length}x de {formatCurrency(payment.installments[0].value)}</p>
                                            <p className="text-xs text-muted-foreground">(Total: {formatCurrency(totalInstallmentValue)})</p>
                                        </>
                                    ) : (
                                        <Table className="mt-1">
                                            <TableHeader><TableRow><TableHead className="print:p-1 h-8">Parcela</TableHead><TableHead className="print:p-1 h-8">Vencimento</TableHead><TableHead className="text-right print:p-1 h-8">Valor</TableHead></TableRow></TableHeader>
                                            <TableBody>
                                                {payment.installments.map(inst => (
                                                    <TableRow key={inst.number}>
                                                        <TableCell className="print:p-1">{inst.number}</TableCell>
                                                        <TableCell className="print:p-1">{format(parseISO(inst.dueDate), "dd/MM/yyyy")}</TableCell>
                                                        <TableCell className="text-right print:p-1">{formatCurrency(inst.value)}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                            <TableFoot>
                                                <TableRow className="font-semibold">
                                                    <TableCell colSpan={2} className="text-right">Total {hasInterest && "(com juros)"}</TableCell>
                                                    <TableCell className="text-right">{formatCurrency(totalInstallmentValue)}</TableCell>
                                                </TableRow>
                                            </TableFoot>
                                        </Table>
                                    )
                                ) : (
                                    <p><strong>Valor:</strong> {formatCurrency(payment.value)}</p>
                                )}
                            </div>
                        )
                     })}
                </div>
             )}

             {globalObservation && (
                 <div className="space-y-1 pt-4 border-t border-dashed">
                    <h3 className="font-semibold text-sm print:text-xs flex items-center gap-2"><Info className="h-4 w-4"/> Observações Adicionais</h3>
                    <p className="text-xs text-muted-foreground whitespace-pre-wrap">{globalObservation}</p>
                 </div>
             )}

             {order.observations && (
                 <div className="space-y-1 pt-2">
                    <h3 className="font-semibold text-sm print:text-xs">Observações Internas</h3>
                    <p className="text-xs text-muted-foreground whitespace-pre-wrap">{order.observations}</p>
                 </div>
             )}

          </CardContent>
           <CardFooter className="flex-col items-center justify-center text-xs text-muted-foreground pt-12 print:pt-4">
             <p className="text-center print:text-[9px]">Este é um documento gerado pelo sistema Conect para fins de controle de venda.</p>
             <p className="mt-8 border-t border-dashed w-full max-w-xs mx-auto pt-2 text-center print:mt-4 print:text-[9px]">Assinatura do Cliente</p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
