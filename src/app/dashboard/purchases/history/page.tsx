
"use client";

import * as React from "react";
import {
  Loader2,
  Package,
  Truck,
  User,
  RefreshCw,
  GitFork,
} from "lucide-react";
import {
  collection,
  getDocs,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
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
import type { PurchaseOrder, Branch, StockingLocation } from "@/lib/definitions";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function PurchaseHistoryPage() {
  const { toast } = useToast();
  const [orders, setOrders] = React.useState<PurchaseOrder[]>([]);
  const [branches, setBranches] = React.useState<Branch[]>([]);
  const [locations, setLocations] = React.useState<StockingLocation[]>([]);
  const [loading, setLoading] = React.useState(true);

  const fetchData = React.useCallback(async () => {
    try {
      setLoading(true);
      const [ordersSnap, branchesSnap, locationsSnap] = await Promise.all([
        getDocs(query(collection(db, "purchaseOrders"), orderBy("createdAt", "desc"))),
        getDocs(collection(db, "branches")),
        getDocs(collection(db, "stockingLocations")),
      ]);
      setOrders(ordersSnap.docs.map(d => ({ id: d.id, ...d.data() } as PurchaseOrder)));
      setBranches(branchesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Branch)));
      setLocations(locationsSnap.docs.map(d => ({ id: d.id, ...d.data() } as StockingLocation)));
    } catch (error) {
      toast({ title: "Erro ao buscar histórico", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getBranchName = (branchId: string) => branches.find(b => b.id === branchId)?.name || 'N/A';
  const getLocationName = (locationId: string) => locations.find(l => l.id === locationId)?.name || 'N/A';

  const formatDate = (timestamp: any) => {
    if (!timestamp?.toDate) return "Data inválida";
    return format(timestamp.toDate(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  };
  
  const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);


  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-headline tracking-tight flex items-center gap-2">
            <Package /> Histórico de Compras
          </h1>
          <p className="text-muted-foreground">
            Visualize todos os lançamentos de notas de compra realizados.
          </p>
        </div>
        <Button variant="outline" size="icon" onClick={fetchData} disabled={loading}>
          <RefreshCw className={loading ? "animate-spin" : ""} />
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Compras Registradas</CardTitle>
          <CardDescription>Total de {orders.length} lançamentos encontrados.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>
          ) : orders.length === 0 ? (
            <div className="text-center text-muted-foreground py-16">Nenhuma compra encontrada.</div>
          ) : (
            <Accordion type="multiple" className="w-full space-y-3">
              {orders.map(order => (
                <AccordionItem value={order.id} key={order.id} className="border rounded-lg">
                  <AccordionTrigger className="p-4 hover:no-underline text-left">
                    <div className="flex flex-col md:flex-row md:items-center justify-between w-full gap-2">
                      <div className="flex-1">
                        <p className="font-semibold text-lg">{order.supplierName}</p>
                        <div className="text-sm text-muted-foreground flex items-center gap-2">
                          <GitFork className="h-4 w-4" />
                          <span>{getBranchName(order.destinationBranchId)}</span>
                          <span className="mx-1">·</span>
                          <span>{formatDate(order.createdAt)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <Badge variant="outline" className="gap-1.5"><User className="h-3 w-3"/>{order.createdByUserName}</Badge>
                        <p className="text-lg font-bold text-primary">{formatCurrency(order.totalValue)}</p>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="p-4 pt-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Produto</TableHead>
                          <TableHead className="text-right">Quantidade</TableHead>
                          <TableHead className="text-right">Custo Unitário</TableHead>
                          <TableHead className="text-right">Subtotal</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {order.items.map(item => (
                          <TableRow key={item.productId}>
                            <TableCell>{item.productName}</TableCell>
                            <TableCell className="text-right">{item.quantity}</TableCell>
                            <TableCell className="text-right">{formatCurrency(item.costPrice)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(item.costPrice * item.quantity)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                      <TableFooter>
                        <TableRow className="font-bold">
                            <TableCell colSpan={3} className="text-right">Total</TableCell>
                            <TableCell className="text-right">{formatCurrency(order.totalValue)}</TableCell>
                        </TableRow>
                      </TableFooter>
                    </Table>
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
