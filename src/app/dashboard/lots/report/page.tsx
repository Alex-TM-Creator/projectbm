"use client";

import * as React from "react";
import {
  Loader2,
  Package,
  FileBarChart2,
  TrendingUp,
  Box,
  ClipboardList,
  Tags,
  PackageSearch,
  RefreshCw
} from "lucide-react";
import {
  collection,
  getDocs,
  query,
  orderBy,
  where,
  doc,
  getDoc
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Lot, StockMovement, Product } from "@/lib/definitions";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

type SaleDetail = {
    orderId: string;
    orderDesc: string;
    qty: number;
    amount: number;
    createdAt: Date | null;
};

type ReportItem = {
    productId: string;
    productCode: string;
    productName: string;
    launchedQty: number; // Foram colocadas no lote
    soldQty: number;     // Foram vendidas deste lote
    unitPrice: number;   // PreÃ§o de venda atual (ou da venda)
    soldAmount: number;  // unitPrice * soldQty
    totalPotential: number; // (launchedQty - soldQty) * unitPrice (Potencial de estoque)
    salesDetails: SaleDetail[];
};

export default function LotReportPage() {
  const { toast } = useToast();
  const [expandedProductId, setExpandedProductId] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [dataLoading, setDataLoading] = React.useState(false);
  
  const [lots, setLots] = React.useState<Lot[]>([]);
  const [selectedLotId, setSelectedLotId] = React.useState<string>("");
  const [reportItems, setReportItems] = React.useState<ReportItem[]>([]);
  
  // Totals
  const [totals, setTotals] = React.useState({
    qtyLaunched: 0,
    qtySold: 0,
    amountSold: 0,
    amountPotential: 0,
    productCount: 0
  });

  const fetchLots = React.useCallback(async () => {
    try {
      setLoading(true);
      const lotsSnap = await getDocs(query(collection(db, "lots"), orderBy("registrationDate", "desc")));
      setLots(lotsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Lot)));
    } catch (error) {
      console.error(error);
      toast({ title: "Erro ao buscar lotes", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    fetchLots();
  }, [fetchLots]);

  const generateReport = React.useCallback(async (lotId: string) => {
    if (!lotId || lotId === "none") {
        setReportItems([]);
        setTotals({ qtyLaunched: 0, qtySold: 0, amountSold: 0, amountPotential: 0, productCount: 0 });
        return;
    }
    
    setDataLoading(true);
    try {
      const movementsRef = collection(db, "stockMovements");
      const q = query(movementsRef, where("lotId", "==", lotId));
      const movementsSnap = await getDocs(q);
      const movements = movementsSnap.docs.map(d => ({ id: d.id, ...d.data() } as StockMovement));

      // Aggregating by Product
      const productMap = new Map<string, { launched: number, sold: number, revenue: number, name: string, code: string, price: number, salesDetails: SaleDetail[] }>();
      
      const productIds = Array.from(new Set(movements.map(m => m.productId)));
      
      const productDataMap = new Map<string, { name: string, code: string, price: number }>();
      await Promise.all(productIds.map(async (pid) => {
          const pDoc = await getDoc(doc(db, "products", pid));
          if (pDoc.exists()) {
              const p = pDoc.data() as Product;
              productDataMap.set(pid, { name: p.name, code: p.internalCode || 'N/A', price: p.salePrice || 0 });
          }
      }));

      movements.forEach(m => {
          const pData = productDataMap.get(m.productId);
          if (pData) {
              const current = productMap.get(m.productId) || { launched: 0, sold: 0, revenue: 0, name: pData.name, code: pData.code, price: pData.price, salesDetails: [] };
              
              if (m.type === 'edit_reversal' || m.type === 'sale_reversal' || m.type === 'return') {
                  // ReversÃ£o de ediÃ§Ã£o, cancelamento ou devoluÃ§Ã£o de pedido: reduz totalizadores
                  const qtySold = Math.abs(m.quantityChange);
                  const rev = m.valueChange !== undefined ? Math.abs(m.valueChange) : (qtySold * pData.price);
                  current.sold -= qtySold;
                  current.revenue -= rev;
                  
                  // Insere uma linha no histÃ³rico exclusivamente para evidenciar o cancelamento
                  current.salesDetails.push({
                      orderId: `rev-${m.id}`,
                      orderDesc: m.reason || 'Estorno/Cancelamento',
                      qty: -qtySold,
                      amount: -rev,
                      createdAt: m.createdAt?.toDate ? m.createdAt.toDate() : (m.createdAt ? new Date(m.createdAt as any) : null)
                  });
              } else if (m.quantityChange > 0) {
                  current.launched += m.quantityChange;
              } else if (m.quantityChange < 0 && (m.type === 'sale' || m.type === 'return' || !m.type)) {
                  const qtySold = Math.abs(m.quantityChange);
                  const rev = m.valueChange !== undefined ? m.valueChange : (qtySold * pData.price);
                  current.sold += qtySold;
                  current.revenue += rev;
                  
                  const existingDetail = current.salesDetails.find(d => d.orderId === m.relatedDocId);
                  if (existingDetail) {
                      existingDetail.qty += qtySold;
                      existingDetail.amount += rev;
                      if(m.reason && existingDetail.orderDesc === 'MovimentaÃ§Ã£o SaÃ­da') existingDetail.orderDesc = m.reason;
                      // Se a data existente estiver em branco, utiliza a data mais antiga aplicÃ¡vel a esta venda original
                      if (m.createdAt && (!existingDetail.createdAt || m.createdAt.toDate() < existingDetail.createdAt)) {
                          existingDetail.createdAt = m.createdAt.toDate();
                      }
                  } else {
                      current.salesDetails.push({
                          orderId: m.relatedDocId || m.id,
                          orderDesc: m.reason || 'MovimentaÃ§Ã£o SaÃ­da',
                          qty: qtySold,
                          amount: rev,
                          createdAt: m.createdAt?.toDate ? m.createdAt.toDate() : (m.createdAt ? new Date(m.createdAt as any) : null)
                      });
                  }
              }

              productMap.set(m.productId, current);
          }
      });

      const items: ReportItem[] = Array.from(productMap.entries()).map(([pid, data]) => ({
          productId: pid,
          productCode: (data as any).code,
          productName: data.name,
          launchedQty: Math.max(0, data.launched),
          soldQty: Math.max(0, data.sold),
          unitPrice: data.price,
          soldAmount: Math.max(0, (data as any).revenue || 0),
          totalPotential: Math.max(0, (data.launched - data.sold) * data.price),
          salesDetails: (data as any).salesDetails.filter((d: any) => d.qty !== 0)
      })).sort((a, b) => b.soldAmount - a.soldAmount);

      setReportItems(items);
      
      const totalLaunched = items.reduce((acc, curr) => acc + curr.launchedQty, 0);
      const totalSold = items.reduce((acc, curr) => acc + curr.soldQty, 0);
      const totalAmountSold = items.reduce((acc, curr) => acc + curr.soldAmount, 0);
      const totalAmountPotential = items.reduce((acc, curr) => acc + curr.totalPotential, 0);
      
      setTotals({
          qtyLaunched: totalLaunched,
          qtySold: totalSold,
          amountSold: totalAmountSold,
          amountPotential: totalAmountPotential,
          productCount: items.length
      });

    } catch (error) {
      console.error(error);
      toast({ title: "Erro ao gerar relatÃ³rio", variant: "destructive" });
    } finally {
      setDataLoading(false);
    }
  }, [toast]);

  const selectedLot = React.useMemo(() => lots.find(l => l.id === selectedLotId), [lots, selectedLotId]);

  React.useEffect(() => {
    generateReport(selectedLotId);
  }, [selectedLotId, generateReport]);

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  if (loading) return <div className="flex justify-center items-center h-96"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <CardTitle className="text-3xl font-bold font-headline flex items-center gap-3">
            <FileBarChart2 className="text-primary" />
            RelatÃ³rio de Lote
          </CardTitle>
          <CardDescription className="text-lg">Analise produtos, quantidades e valores por IdentificaÃ§Ã£o de Lote.</CardDescription>
        </div>
        <div className="flex gap-2">
            <button 
                onClick={() => {
                    fetchLots();
                    if (selectedLotId) generateReport(selectedLotId);
                }}
                disabled={loading || dataLoading}
                className="flex items-center gap-2 px-4 h-12 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl font-bold text-sm hover:bg-zinc-50 transition-all shadow-sm active:scale-95 disabled:opacity-50"
            >
                <RefreshCw className={cn("h-4 w-4 text-primary", (loading || dataLoading) && "animate-spin")} />
                ATUALIZAR DADOS
            </button>
        </div>
      </div>

      <Card className="border-none shadow-premium bg-white/50 dark:bg-zinc-900/50 backdrop-blur-md">
        <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                <div className="space-y-2">
                    <Label className="text-sm font-semibold flex items-center gap-2"> <Tags className="h-4 w-4 text-primary" /> Selecione o Lote </Label>
                    <Select value={selectedLotId} onValueChange={setSelectedLotId}>
                        <SelectTrigger className="h-12 text-lg font-bold">
                            <SelectValue placeholder="Escolha um lote para analisar..." />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none">Nenhum selecionado</SelectItem>
                            {lots.map(lot => (
                                <SelectItem key={lot.id} value={lot.id}>
                                    #{lot.lotNumber} ({format(new Date(lot.registrationDate + 'T12:00:00'), 'dd/MM/yyyy')})
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>
        </CardContent>
      </Card>

      {/* Linha de Totais (Topo do RelatÃ³rio) */}
      <div className={`grid grid-cols-1 md:grid-cols-${selectedLot?.lotValue !== undefined ? 5 : 4} gap-4 animate-in fade-in slide-in-from-top-4 duration-500`}>
        <Card className="border-none shadow-lg bg-emerald-600 text-white overflow-hidden relative">
            <div className="absolute right-0 top-0 p-4 opacity-20"><TrendingUp size={48}/></div>
            <CardHeader className="pb-2">
                <CardDescription className="text-white/80 font-semibold uppercase text-[10px] tracking-widest text-center">Faturamento Real (Vendido)</CardDescription>
                <CardTitle className="text-2xl font-black text-center">{formatCurrency(totals.amountSold)}</CardTitle>
            </CardHeader>
        </Card>

        <Card className="border-none shadow-lg bg-primary text-primary-foreground overflow-hidden relative">
            <div className="absolute right-0 top-0 p-4 opacity-20"><Box size={48}/></div>
            <CardHeader className="pb-2">
                <CardDescription className="text-primary-foreground/70 font-semibold uppercase text-[10px] tracking-widest text-center">Potencial em Estoque</CardDescription>
                <CardTitle className="text-2xl font-black text-center">{formatCurrency(totals.amountPotential)}</CardTitle>
            </CardHeader>
        </Card>

        {selectedLot?.lotValue !== undefined && (
          <Card className="border-none shadow-lg bg-amber-500 text-white overflow-hidden relative">
              <div className="absolute right-0 top-0 p-4 opacity-20"><Tags size={48}/></div>
              <CardHeader className="pb-2">
                  <CardDescription className="text-white/80 font-semibold uppercase text-[10px] tracking-widest text-center">Valor do Lote</CardDescription>
                  <CardTitle className="text-2xl font-black text-center">{formatCurrency(selectedLot.lotValue)}</CardTitle>
              </CardHeader>
          </Card>
        )}

        <Card className="border-none shadow-lg bg-zinc-900 text-white overflow-hidden relative">
            <div className="absolute right-0 top-0 p-4 opacity-20"><Package size={48}/></div>
            <CardHeader className="pb-2">
                <CardDescription className="text-white/60 font-semibold uppercase text-[10px] tracking-widest text-center">Qtd Original do Lote</CardDescription>
                <CardTitle className="text-2xl font-black text-center">{totals.qtyLaunched} un.</CardTitle>
            </CardHeader>
        </Card>

        <Card className="border-none shadow-lg bg-white dark:bg-zinc-800 overflow-hidden relative text-zinc-900 dark:text-white">
            <div className="absolute right-0 top-0 p-4 opacity-10 text-primary"><ClipboardList size={48}/></div>
            <CardHeader className="pb-2">
                <CardDescription className="text-muted-foreground font-semibold uppercase text-[10px] tracking-widest text-center">Tipos de Produtos</CardDescription>
                <CardTitle className="text-2xl font-black text-center">{totals.productCount}</CardTitle>
            </CardHeader>
        </Card>
      </div>

      <Card className="border-none shadow-premium bg-white/50 dark:bg-zinc-900/50 backdrop-blur-md overflow-hidden">
        <CardHeader className="border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/20">
            <CardTitle className="text-lg flex items-center gap-2"> <PackageSearch className="h-5 w-5 text-primary" /> Detalhamento de Itens no Lote </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
            {dataLoading ? (
                <div className="flex justify-center p-20"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>
            ) : selectedLotId && reportItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-20 opacity-40"><Package className="h-12 w-12 mb-4"/><p className="text-sm font-medium">Nenhum movimento vinculado a este lote.</p></div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-zinc-50 dark:bg-zinc-900/40 text-[10px] uppercase font-black tracking-widest text-muted-foreground">
                                <th className="px-6 py-4">CÃ³digo</th>
                                <th className="px-6 py-4">Produto</th>
                                <th className="px-6 py-4 text-center">Qtd Original</th>
                                <th className="px-6 py-4 text-center">Qtd Vendida</th>
                                <th className="px-6 py-4 text-right">PreÃ§o Unit.</th>
                                <th className="px-6 py-4 text-right">Faturamento</th>
                                <th className="px-6 py-4 text-right">Potencial Restante</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                            {reportItems.map((item, idx) => (
                                <React.Fragment key={item.productId}>
                                   <tr 
                                      onClick={() => setExpandedProductId(expandedProductId === item.productId ? null : item.productId)}
                                      className={cn("group transition-colors cursor-pointer", expandedProductId === item.productId ? "bg-primary/5 border-l-4 border-l-primary" : "hover:bg-zinc-50 dark:hover:bg-zinc-900/30", item.salesDetails.length === 0 && "cursor-default")}
                                   >
                                      <td className="px-6 py-4">
                                          <Badge variant="outline" className="font-bold text-xs border-primary/20 text-primary/80">{item.productCode}</Badge>
                                      </td>
                                      <td className="px-6 py-4">
                                          <div className="flex items-center gap-3">
                                              <span className={cn("font-bold text-sm tracking-tight", expandedProductId === item.productId && "text-primary")}>{item.productName}</span>
                                              {item.salesDetails.length > 0 && (
                                                <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary hover:bg-primary/20 ml-2">VER SAÃDAS</Badge>
                                              )}
                                          </div>
                                      </td>
                                      <td className="px-6 py-4 text-center">
                                          <Badge variant="outline" className="font-bold text-sm h-8 px-3 border-zinc-200">{item.launchedQty}</Badge>
                                      </td>
                                      <td className="px-6 py-4 text-center">
                                          <Badge variant="secondary" className="font-bold text-sm h-8 px-3">{item.soldQty}</Badge>
                                      </td>
                                      <td className="px-6 py-4 text-right font-medium text-sm text-muted-foreground">{formatCurrency(item.unitPrice)}</td>
                                      <td className="px-6 py-4 text-right">
                                          <span className="font-black text-sm text-primary">{formatCurrency(item.soldAmount)}</span>
                                      </td>
                                      <td className="px-6 py-4 text-right">
                                          <span className="font-bold text-sm text-muted-foreground/60">{formatCurrency(item.totalPotential)}</span>
                                      </td>
                                  </tr>
                                  {/* Linha de Detalhes ExpansÃ­vel */}
                                  {expandedProductId === item.productId && item.salesDetails.length > 0 && (
                                     <tr>
                                         <td colSpan={7} className="p-0 border-b-2 border-primary/20 overflow-hidden">
                                            <div className="bg-primary/5 dark:bg-primary/10 px-8 py-5 animate-in slide-in-from-top-2">
                                                <h4 className="font-bold text-sm text-primary uppercase tracking-widest mb-3 flex items-center gap-2">
                                                   <PackageSearch className="w-4 h-4" /> HistÃ³rico de SaÃ­das ({item.productName})
                                                </h4>
                                                <div className="w-full mt-3 bg-white dark:bg-black/20 rounded-xl overflow-hidden shadow-inner border border-primary/10">
                                                  <table className="w-full text-left text-sm">
                                                    <thead className="bg-primary/5 text-primary text-[10px] uppercase font-bold tracking-widest border-b border-primary/10">
                                                      <tr>
                                                        <th className="px-4 py-2">DescriÃ§Ã£o</th>
                                                        <th className="px-4 py-2">Data da OperaÃ§Ã£o</th>
                                                        <th className="px-4 py-2 text-right">Quantidade</th>
                                                        <th className="px-4 py-2 text-right">Faturamento</th>
                                                      </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-primary/5">
                                                     {item.salesDetails.map(detail => (
                                                        <tr key={detail.orderId} className={cn("hover:bg-primary/5 transition-colors", detail.qty < 0 && "bg-destructive/5 hover:bg-destructive/10")}>
                                                           <td className={cn("px-4 py-3 font-semibold text-foreground/80", detail.qty < 0 && "text-destructive font-bold text-xs")}>{detail.orderDesc}</td>
                                                           <td className="px-4 py-3 text-muted-foreground">{detail.createdAt ? format(detail.createdAt, "dd/MM/yyyy 'Ã s' HH:mm") : 'Sem data registrada'}</td>
                                                           <td className="px-4 py-3 text-right">
                                                              <span className={cn("font-bold bg-zinc-100 dark:bg-zinc-800 px-3 py-1 rounded shadow-sm", detail.qty < 0 && "bg-transparent text-destructive")}>{detail.qty} un.</span>
                                                           </td>
                                                           <td className={cn("px-4 py-3 text-right font-black text-emerald-600 dark:text-emerald-400", detail.qty < 0 && "text-destructive dark:text-destructive")}>{formatCurrency(detail.amount)}</td>
                                                        </tr>
                                                     ))}
                                                    </tbody>
                                                  </table>
                                                </div>
                                            </div>
                                         </td>
                                     </tr>
                                  )}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </CardContent>
      </Card>
    </div>
  );
}
