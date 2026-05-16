
"use client";

import * as React from "react";
import {
  Loader2,
  DollarSign,
  Frown,
  RefreshCw,
  Car,
  BadgePercent,
  Calculator,
  ChevronLeft,
  ChevronRight,
  CalendarIcon,
  Wrench,
} from "lucide-react";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  getDoc,
} from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { useAuthState } from "react-firebase-hooks/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import type { SalesOrder, Driver, User as UserType, AssistanceRequest } from "@/lib/definitions";
import { format, parseISO, startOfWeek, endOfWeek, addDays, isWithinInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type FreightDetail = {
  order: SalesOrder | AssistanceRequest;
  baseFreight: number;
  discount: number;
  finalFreight: number;
  discountDetails: string;
  type: 'order' | 'astec';
};

export default function DriverFreightPage() {
  const { toast } = useToast();
  const [user, authLoading] = useAuthState(auth);
  const [loading, setLoading] = React.useState(true);
  const [allFreightDetails, setAllFreightDetails] = React.useState<FreightDetail[]>([]);
  const [weekOffset, setWeekOffset] = React.useState(0);

  const formatCurrency = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  const formatDate = (dateString?: string) => dateString ? format(parseISO(dateString), "dd/MM/yyyy", { locale: ptBR }) : 'N/A';

  const fetchData = React.useCallback(async () => {
    if (!user) return;

    try {
      setLoading(true);

      const driversQuery = query(collection(db, "drivers"), where("userId", "==", user.uid));
      const driversSnap = await getDocs(driversQuery);

      if (driversSnap.empty) {
        setAllFreightDetails([]);
        setLoading(false);
        return;
      }
      
      const driverData = { id: driversSnap.docs[0].id, ...driversSnap.docs[0].data() } as Driver;

      const ordersQuery = query(
        collection(db, "salesOrders"),
        where("driverId", "==", driverData.id),
        where("deliveryStatus", "==", "concluido")
      );
      
      const astecQuery = query(
        collection(db, "astec"),
        where("driverId", "==", driverData.id),
        where("status", "==", "finished")
      );

      const [ordersSnap, astecSnap] = await Promise.all([
        getDocs(ordersQuery),
        getDocs(astecQuery),
      ]);
      
      const completedOrders = ordersSnap.docs.map(d => ({ id: d.id, ...d.data() } as SalesOrder));
      const finishedAstecs = astecSnap.docs.map(d => ({ id: d.id, ...d.data() } as AssistanceRequest));
      
      const calculateFreight = (baseFreight: number): { finalFreight: number, discount: number, discountDetails: string } => {
        let finalFreight = baseFreight;
        let discountDetails = "Nenhum";

        if (driverData.discounts && driverData.discounts.length > 0) {
            const applicableDiscounts = driverData.discounts;
            
            applicableDiscounts.forEach(discount => {
                if (discount.type === 'fixed') {
                    finalFreight -= discount.value;
                } else if (discount.type === 'percentage') {
                    finalFreight -= finalFreight * (discount.value / 100);
                }
            });
            
            const detailsParts = applicableDiscounts.map(d => 
              `${d.name} (${d.type === 'fixed' ? formatCurrency(d.value) : `${d.value}%`})`
            );
            if(detailsParts.length > 0) discountDetails = detailsParts.join('; ');
        }
        
        const totalDiscount = baseFreight - finalFreight;
        return { finalFreight, discount: totalDiscount, discountDetails };
      };

      const orderDetails: FreightDetail[] = completedOrders.map(order => {
        const baseFreight = order.freightValue || 0;
        const { finalFreight, discount, discountDetails } = calculateFreight(baseFreight);
        return {
          order,
          baseFreight,
          discount,
          finalFreight,
          discountDetails,
          type: 'order',
        };
      });
      
      const astecDetails: FreightDetail[] = finishedAstecs.map(astec => {
        const baseFreight = astec.freightValue || 0;
        const { finalFreight, discount, discountDetails } = calculateFreight(baseFreight);
        return {
          order: astec,
          baseFreight,
          discount,
          finalFreight,
          discountDetails,
          type: 'astec',
        };
      });

      setAllFreightDetails([...orderDetails, ...astecDetails]);

    } catch (error) {
      toast({ title: "Erro ao buscar dados", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  React.useEffect(() => {
    if (user) {
      fetchData();
    } else if (!authLoading) {
        setLoading(false);
    }
  }, [fetchData, user, authLoading]);

  const { weekStartDate, weekEndDate, currentWeekFreightDetails, totalToReceive } = React.useMemo(() => {
    const startOfBaseWeek = startOfWeek(new Date(), { locale: ptBR, weekStartsOn: 1 });
    const weekStartDate = addDays(startOfBaseWeek, weekOffset * 7);
    const weekEndDate = endOfWeek(weekStartDate, { locale: ptBR, weekStartsOn: 1 });

    const currentWeekFreightDetails = allFreightDetails.filter(detail => {
      let deliveryDateStr: string | undefined;
      if(detail.type === 'order') {
        deliveryDateStr = (detail.order as SalesOrder).deliveryDate;
      } else {
        deliveryDateStr = (detail.order as AssistanceRequest).scheduledDate;
      }
      if (!deliveryDateStr) return false;
      const deliveryDate = parseISO(deliveryDateStr);
      return isWithinInterval(deliveryDate, { start: weekStartDate, end: weekEndDate });
    });

    const totalToReceive = currentWeekFreightDetails.reduce((sum, detail) => sum + detail.finalFreight, 0);

    return { weekStartDate, weekEndDate, currentWeekFreightDetails, totalToReceive };
  }, [allFreightDetails, weekOffset]);


  if (loading || authLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }
  
  if (!user) {
      return (
        <Card className="flex flex-col items-center justify-center h-96 text-center">
            <CardContent>
                <Frown className="h-16 w-16 text-muted-foreground mb-4" />
                <p className="font-semibold">Usuário não encontrado.</p>
            </CardContent>
        </Card>
      );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-headline tracking-tight flex items-center gap-2">
            <DollarSign /> Meu Frete
          </h1>
          <p className="text-muted-foreground">
            Acompanhe os valores a receber por cada entrega concluída.
          </p>
        </div>
        <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setWeekOffset(prev => prev - 1)}><ChevronLeft className="h-4 w-4 mr-2"/>Semana Anterior</Button>
            <Button variant="outline" onClick={() => setWeekOffset(prev => prev + 1)}>Próxima Semana<ChevronRight className="h-4 w-4 ml-2"/></Button>
            <Button variant="outline" size="icon" onClick={fetchData} disabled={loading}><RefreshCw className={loading ? "animate-spin" : ""} /></Button>
        </div>
      </div>
      
       <Card>
          <CardHeader className="text-center">
              <CardTitle className="text-4xl font-bold text-primary">{formatCurrency(totalToReceive)}</CardTitle>
              <CardDescription>
                Total a Receber na Semana <br/>
                <span className="font-semibold">{format(weekStartDate, "dd/MM")} - {format(weekEndDate, "dd/MM/yyyy")}</span>
              </CardDescription>
          </CardHeader>
       </Card>

      <Card>
        <CardHeader>
          <CardTitle>Entregas e Atendimentos Concluídos na Semana</CardTitle>
          <CardDescription>
            {currentWeekFreightDetails.length} atividades encontradas para o período selecionado.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {currentWeekFreightDetails.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 rounded-lg border border-dashed">
                <Frown className="h-16 w-16 text-muted-foreground" />
                <h2 className="mt-4 text-xl font-semibold">Nenhuma atividade concluída</h2>
                <p className="mt-2 text-sm text-muted-foreground text-center">
                    Não há entregas ou atendimentos com status "Concluído" nesta semana.
                </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nº</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Valor do Frete</TableHead>
                  <TableHead>Descontos</TableHead>
                  <TableHead className="text-right">Valor Final a Receber</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentWeekFreightDetails.map((detail) => {
                  const isOrder = detail.type === 'order';
                  const item = detail.order;
                  const date = isOrder ? (item as SalesOrder).deliveryDate : (item as AssistanceRequest).scheduledDate;
                  
                  return (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono flex items-center gap-2">
                       {isOrder ? <Badge variant="secondary">Pedido #{item.orderNumber}</Badge> : <Badge variant="outline" className="text-amber-600 border-amber-500">ASTEC #{item.assistanceNumber}</Badge>}
                    </TableCell>
                    <TableCell>{formatDate(date)}</TableCell>
                    <TableCell>{item.customerName}</TableCell>
                    <TableCell>{formatCurrency(detail.baseFreight)}</TableCell>
                    <TableCell>
                      {detail.discount > 0 ? (
                        <Badge variant="destructive" className="gap-1.5">
                           - {formatCurrency(detail.discount)}
                        </Badge>
                      ) : (
                        <span>-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-bold text-green-600">{formatCurrency(detail.finalFreight)}</TableCell>
                  </TableRow>
                )})}
              </TableBody>
              <TableFooter>
                <TableRow className="text-lg font-bold">
                    <TableCell colSpan={5} className="text-right">Total da Semana</TableCell>
                    <TableCell className="text-right">{formatCurrency(totalToReceive)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
