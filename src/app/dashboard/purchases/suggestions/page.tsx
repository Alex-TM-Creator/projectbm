
"use client";

import * as React from "react";
import {
  Loader2,
  Package,
  WandSparkles,
  RefreshCw,
  Frown,
  Truck,
  ShoppingCart,
  PlusCircle,
} from "lucide-react";
import {
  collection,
  getDocs,
  query,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import type { Product, ProductStock, StockingLocation, Supplier, PurchaseSuggestion } from "@/lib/definitions";
import { Button } from "@/components/ui/button";

export default function PurchaseSuggestionsPage() {
  const { toast } = useToast();
  const [suggestions, setSuggestions] = React.useState<PurchaseSuggestion[]>([]);
  const [loading, setLoading] = React.useState(true);

  const generateSuggestions = React.useCallback(async () => {
    try {
      setLoading(true);
      const [productsSnap, stocksSnap, locationsSnap, suppliersSnap] = await Promise.all([
        getDocs(query(collection(db, "products"))),
        getDocs(query(collection(db, "productStock"))),
        getDocs(query(collection(db, "stockingLocations"))),
        getDocs(query(collection(db, "suppliers"))),
      ]);
      
      const products = productsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      const stocks = stocksSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProductStock));
      const locations = locationsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as StockingLocation));
      const suppliers = suppliersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Supplier));

      const newSuggestionsMap = new Map<string, PurchaseSuggestion>();

      for (const product of products) {
        const productStocks = stocks.filter(s => s.productId === product.id);
        const totalStock = productStocks.reduce((sum, s) => sum + s.quantity, 0);
        
        // This logic can be more complex, e.g., summing min/max across locations
        const totalMinimumStock = productStocks.reduce((sum, s) => sum + (s.minimumQuantity || 0), 0);
        const totalMaximumStock = productStocks.reduce((sum, s) => sum + (s.maximumQuantity || 0), 0);
        
        if (totalMinimumStock > 0 && totalStock < totalMinimumStock) {
            const quantityToOrder = (totalMaximumStock > totalStock) 
                ? totalMaximumStock - totalStock 
                : totalMinimumStock - totalStock;
                
            // This is a simplification. A real app might have a product-supplier relationship.
            // Here, we just assign it to the first supplier for demonstration.
            const supplier = suppliers[0]; // Simplified: assumes at least one supplier and links to the first.
            if (!supplier) continue;
            
            if (!newSuggestionsMap.has(supplier.id)) {
                newSuggestionsMap.set(supplier.id, {
                    supplierId: supplier.id,
                    supplierName: supplier.name,
                    products: [],
                });
            }
            
            const suggestion = newSuggestionsMap.get(supplier.id)!;
            suggestion.products.push({
                productId: product.id,
                productName: product.name,
                quantityToOrder,
                currentStock: totalStock,
                minimumStock: totalMinimumStock,
                maximumStock: totalMaximumStock,
            });
        }
      }
      
      setSuggestions(Array.from(newSuggestionsMap.values()));

    } catch (error) {
      console.error(error);
      toast({ title: "Erro ao gerar sugestões", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);
  
  React.useEffect(() => {
    generateSuggestions();
  }, [generateSuggestions]);

  return (
    <div className="flex flex-col gap-6">
       <div className="flex items-center justify-between">
        <div>
            <h1 className="text-3xl font-bold font-headline tracking-tight flex items-center gap-2">
                <WandSparkles /> Sugestão de Compras
            </h1>
            <p className="text-muted-foreground">
                Recomendações de compra com base nos níveis de estoque mínimo e máximo.
            </p>
        </div>
        <Button variant="outline" size="icon" onClick={generateSuggestions} disabled={loading}>
            <RefreshCw className={loading ? "animate-spin" : ""} />
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Oportunidades de Compra</CardTitle>
          <CardDescription>
            {loading ? "Analisando estoque..." : `${suggestions.reduce((acc, s) => acc + s.products.length, 0)} produtos precisam de reposição.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>
          ) : suggestions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 rounded-lg border border-dashed">
                <Frown className="h-16 w-16 text-muted-foreground" />
                <h2 className="mt-4 text-xl font-semibold">Nenhuma sugestão encontrada</h2>
                <p className="mt-2 text-sm text-muted-foreground text-center">
                    Seu estoque parece estar em dia com base nos níveis definidos.
                </p>
            </div>
          ) : (
            <Accordion type="multiple" defaultValue={suggestions.map(s => s.supplierId)} className="space-y-4">
              {suggestions.map(suggestion => (
                <AccordionItem value={suggestion.supplierId} key={suggestion.supplierId} className="border rounded-lg">
                  <AccordionTrigger className="p-4 hover:no-underline text-lg">
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-3">
                        <Truck className="h-5 w-5" />
                        <span>{suggestion.supplierName}</span>
                      </div>
                       <Badge variant="secondary" className="mr-4">{suggestion.products.length} produto(s)</Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="p-4 pt-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Produto</TableHead>
                          <TableHead className="text-center">Estoque Atual</TableHead>
                          <TableHead className="text-center">Estoque Mínimo</TableHead>
                          <TableHead className="text-right">Sugerido Comprar</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {suggestion.products.map(p => (
                          <TableRow key={p.productId}>
                            <TableCell className="font-medium">{p.productName}</TableCell>
                            <TableCell className="text-center">
                              <Badge variant={p.currentStock < (p.minimumStock || 0) ? "destructive" : "secondary"}>
                                {p.currentStock}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">{p.minimumStock}</TableCell>
                            <TableCell className="text-right font-bold text-primary">{p.quantityToOrder}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
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
