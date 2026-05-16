"use client";

import * as React from "react";
import { Loader2, Search, Plus, Trash2, Printer, Tag, LayoutTemplate, ShoppingCart } from "lucide-react";
import {
  collection,
  getDocs,
  query,
  orderBy,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import type { Product, LabelTemplate, SalesOrder } from "@/lib/definitions";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useRouter } from "next/navigation";


interface PrintQueueItem {
    product: Product;
    quantity: number;
}

export default function PrintLabelsPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [loading, setLoading] = React.useState(true);
  const [isPrinting, setIsPrinting] = React.useState(false);
  
  const [products, setProducts] = React.useState<Product[]>([]);
  const [templates, setTemplates] = React.useState<LabelTemplate[]>([]);
  const [salesOrders, setSalesOrders] = React.useState<SalesOrder[]>([]);

  const [selectedTemplateId, setSelectedTemplateId] = React.useState<string>("");
  const [printQueue, setPrintQueue] = React.useState<PrintQueueItem[]>([]);
  const [productSearchTerm, setProductSearchTerm] = React.useState("");
  const [orderSearchTerm, setOrderSearchTerm] = React.useState("");
  const [selectedOrderId, setSelectedOrderId] = React.useState<string | null>(null);


  const fetchData = React.useCallback(async () => {
    try {
      setLoading(true);
      const [productsSnap, templatesSnap, ordersSnap] = await Promise.all([
        getDocs(query(collection(db, "products"), orderBy("name"))),
        getDocs(query(collection(db, "labelTemplates"), orderBy("name"))),
        getDocs(query(collection(db, "salesOrders"), where("status", "==", "billed"))),
      ]);
      setProducts(productsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
      setTemplates(templatesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as LabelTemplate)));
      setSalesOrders(ordersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as SalesOrder)));
    } catch (error) {
      toast({ title: "Erro ao buscar dados", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filteredProducts = React.useMemo(() => {
    if (!productSearchTerm) return [];
    const term = productSearchTerm.toLowerCase();
    return products.filter(
      (p) =>
        p.isActive && (
            p.name.toLowerCase().includes(term) ||
            p.internalCode?.toLowerCase().includes(term)
        )
    );
  }, [products, productSearchTerm]);

  const filteredOrders = React.useMemo(() => {
    if (!orderSearchTerm) return [];
    const term = orderSearchTerm.toLowerCase();
    return salesOrders.filter(
      (o) =>
        o.orderNumber.toString().includes(term) ||
        o.customerName.toLowerCase().includes(term)
    );
  }, [salesOrders, orderSearchTerm]);

  const handleAddProductToQueue = (product: Product) => {
    setPrintQueue(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item => item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      } else {
        return [...prev, { product, quantity: 1 }];
      }
    });
    setProductSearchTerm("");
    setSelectedOrderId(null); // Clear order selection if manually adding
  };
  
  const handleAddOrderToQueue = (order: SalesOrder) => {
    const itemsFromOrder: PrintQueueItem[] = order.items.map(item => {
        const product = products.find(p => p.id === item.productId);
        if (!product) return null;
        return { product, quantity: item.quantity };
    }).filter((item): item is PrintQueueItem => item !== null);

    setPrintQueue(itemsFromOrder);
    setOrderSearchTerm("");
    setSelectedOrderId(order.id);
    toast({
        title: "Pedido Adicionado à Fila",
        description: `${itemsFromOrder.length} produtos do pedido #${order.orderNumber} foram adicionados.`
    })
  };


  const handleQuantityChange = (productId: string, quantity: number) => {
    if (quantity < 1) return;
    setPrintQueue(prev => prev.map(item => item.product.id === productId ? { ...item, quantity } : item));
  };
  
  const handleRemoveItem = (productId: string) => {
    setPrintQueue(prev => prev.filter(item => item.product.id !== productId));
  };
  
  const handleGeneratePrint = () => {
    if (!selectedTemplateId) {
        toast({ title: "Selecione um modelo de etiqueta", variant: "destructive" });
        return;
    }
    if (printQueue.length === 0) {
        toast({ title: "Adicione produtos para imprimir", variant: "destructive" });
        return;
    }

    const template = templates.find(t => t.id === selectedTemplateId);
    if (!template) return;
    
    const selectedOrder = selectedOrderId ? salesOrders.find(o => o.id === selectedOrderId) : null;
    
    const printData = {
        template,
        items: printQueue,
        order: selectedOrder,
    };

    const encodedData = btoa(JSON.stringify(printData));
    router.push(`/dashboard/print-labels/preview?data=${encodeURIComponent(encodedData)}`);
  };

  if (loading) {
    return <div className="flex justify-center items-center h-96"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }
  
  return (
    <div className="flex flex-col gap-6">
      <CardHeader className="p-0">
        <CardTitle className="text-3xl font-bold font-headline flex items-center gap-3">
          <Printer /> Imprimir Etiquetas
        </CardTitle>
        <CardDescription>Selecione um modelo, adicione produtos e gere as etiquetas para impressão.</CardDescription>
      </CardHeader>
      
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-2 space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="text-xl">1. Seleção de Modelo</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="template" className="flex items-center gap-2"><LayoutTemplate className="h-4 w-4"/> Modelo de Etiqueta</Label>
                        <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId} disabled={isPrinting}>
                            <SelectTrigger id="template"><SelectValue placeholder="Selecione um modelo"/></SelectTrigger>
                            <SelectContent>{templates.map(t => <SelectItem key={t.id} value={t.id}>{t.name} ({t.width}x{t.height}mm)</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-xl">2. Adicionar Itens</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="order-search" className="flex items-center gap-2"><ShoppingCart className="h-4 w-4"/> Buscar por Pedido</Label>
                   <div className="relative">
                      <Input 
                          id="order-search"
                          placeholder="Busque por nº do pedido ou cliente..." 
                          value={orderSearchTerm} 
                          onChange={e => setOrderSearchTerm(e.target.value)} 
                          disabled={!selectedTemplateId || isPrinting}
                      />
                  </div>
                  {orderSearchTerm && (
                      <div className="max-h-60 overflow-y-auto mt-2 space-y-1 pr-2 rounded-md border">
                          {filteredOrders.map(order => (
                              <Button key={order.id} variant="ghost" className="w-full justify-start h-auto py-2" onClick={() => handleAddOrderToQueue(order)}>
                                  <div className="flex flex-col text-left">
                                      <p>Pedido #{order.orderNumber}</p>
                                      <p className="text-xs text-muted-foreground">{order.customerName}</p>
                                  </div>
                              </Button>
                          ))}
                          {filteredOrders.length === 0 && <p className="text-sm text-center text-muted-foreground p-4">Nenhum pedido encontrado.</p>}
                      </div>
                  )}
                </div>
                
                 <div className="relative flex items-center">
                    <div className="flex-grow border-t"></div>
                    <span className="flex-shrink mx-4 text-muted-foreground text-xs">OU</span>
                    <div className="flex-grow border-t"></div>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="product-search" className="flex items-center gap-2"><Tag className="h-4 w-4"/> Adicionar Produto Manualmente</Label>
                    <div className="relative">
                        <Input 
                            id="product-search"
                            placeholder="Busque por nome ou código..." 
                            value={productSearchTerm} 
                            onChange={e => setProductSearchTerm(e.target.value)} 
                            disabled={!selectedTemplateId || isPrinting}
                        />
                    </div>
                    {productSearchTerm && (
                        <div className="max-h-60 overflow-y-auto mt-2 space-y-1 pr-2 rounded-md border">
                            {filteredProducts.map(product => (
                                <Button key={product.id} variant="ghost" className="w-full justify-start h-auto py-2" onClick={() => handleAddProductToQueue(product)}>
                                    <div className="flex flex-col text-left">
                                        <p>{product.name}</p>
                                        <p className="text-xs text-muted-foreground font-mono">Cód: {product.internalCode}</p>
                                    </div>
                                </Button>
                            ))}
                            {filteredProducts.length === 0 && <p className="text-sm text-center text-muted-foreground p-4">Nenhum produto encontrado.</p>}
                        </div>
                    )}
                </div>
              </CardContent>
            </Card>
        </div>

        <div className="lg:col-span-3">
             <Card className="h-full flex flex-col">
                <CardHeader>
                    <CardTitle className="text-xl">3. Fila de Impressão</CardTitle>
                </CardHeader>
                <CardContent className="flex-1 overflow-y-auto">
                   {printQueue.length > 0 ? (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Produto</TableHead>
                                <TableHead className="w-40">Nº de Conjuntos</TableHead>
                                <TableHead className="w-12 text-right">Ação</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {printQueue.map(item => (
                                <TableRow key={item.product.id}>
                                    <TableCell className="font-medium">{item.product.name}</TableCell>
                                    <TableCell>
                                        <Input type="number" value={item.quantity} onChange={e => handleQuantityChange(item.product.id, parseInt(e.target.value, 10) || 1)} className="h-8 w-20 text-center" min="1"/>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="icon" className="text-destructive h-8 w-8" onClick={() => handleRemoveItem(item.product.id)}><Trash2 className="h-4 w-4"/></Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                   ) : (
                    <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                        Selecione produtos para adicionar à fila de impressão.
                    </div>
                   )}
                </CardContent>
                <CardFooter>
                    <Button className="w-full" size="lg" disabled={printQueue.length === 0 || isPrinting} onClick={handleGeneratePrint}>
                        {isPrinting ? <Loader2 className="h-4 w-4 animate-spin mr-2"/> : <Printer className="h-4 w-4 mr-2"/>}
                        Gerar Impressão
                    </Button>
                </CardFooter>
            </Card>
        </div>
      </div>
    </div>
  );
}
