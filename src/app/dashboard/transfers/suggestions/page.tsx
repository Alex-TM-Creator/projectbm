
"use client";

import * as React from "react";
import {
  Loader2,
  GitFork,
  ArrowRight,
  Package,
  WandSparkles,
  RefreshCw,
  Frown,
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
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import type { TransferSuggestion, Product, ProductStock, StockingLocation, Branch } from "@/lib/definitions";
import { Button } from "@/components/ui/button";

export default function TransferSuggestionsPage() {
  const { toast } = useToast();
  const [suggestions, setSuggestions] = React.useState<TransferSuggestion[]>([]);
  const [loading, setLoading] = React.useState(true);

  const generateSuggestions = React.useCallback(async () => {
    try {
      setLoading(true);
      const [productsSnap, stocksSnap, locationsSnap, branchesSnap] = await Promise.all([
        getDocs(query(collection(db, "products"))),
        getDocs(query(collection(db, "productStock"))),
        getDocs(query(collection(db, "stockingLocations"))),
        getDocs(query(collection(db, "branches"))),
      ]);
      
      const products = productsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      const stocks = stocksSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProductStock));
      const locations = locationsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as StockingLocation));
      const branches = branchesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Branch));

      const newSuggestions: TransferSuggestion[] = [];

      for (const product of products) {
        const productStocks = stocks.filter(s => s.productId === product.id);
        
        const overstocked = productStocks.filter(s => s.maximumQuantity && s.quantity > s.maximumQuantity);
        const understocked = productStocks.filter(s => s.minimumQuantity && s.quantity < s.minimumQuantity);

        for (const source of overstocked) {
          const excessQuantity = source.quantity - (source.maximumQuantity || source.quantity);
          if (excessQuantity <= 0) continue;

          for (const dest of understocked) {
            if (source.stockingLocationId === dest.stockingLocationId) continue;
            
            const shortageQuantity = (dest.minimumQuantity || 0) - dest.quantity;
            if (shortageQuantity <= 0) continue;

            const quantityToTransfer = Math.min(excessQuantity, shortageQuantity);
            
            if (quantityToTransfer > 0) {
              const fromLocation = locations.find(l => l.id === source.stockingLocationId);
              const toLocation = locations.find(l => l.id === dest.stockingLocationId);
              
              if (fromLocation && toLocation) {
                 newSuggestions.push({
                    productId: product.id,
                    productName: product.name,
                    fromLocationId: fromLocation.id,
                    fromBranchId: fromLocation.branchId,
                    toLocationId: toLocation.id,
                    toBranchId: toLocation.branchId,
                    quantityToTransfer,
                    excessQuantity,
                    shortageQuantity,
                 });
              }
            }
          }
        }
      }
      
      setSuggestions(newSuggestions);

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

  const getBranchName = (branchId: string) => branches.find(b => b.id === branchId)?.name || 'N/A';
  const getLocationName = (locationId: string) => locations.find(l => l.id === locationId)?.name || 'N/A';

  return (
    <div className="flex flex-col gap-6">
       <div className="flex items-center justify-between">
        <div>
            <h1 className="text-3xl font-bold font-headline tracking-tight flex items-center gap-2">
                <WandSparkles /> Sugestões de Transferência
            </h1>
            <p className="text-muted-foreground">
                Otimize seu estoque com sugestões inteligentes de transferência entre filiais.
            </p>
        </div>
        <Button variant="outline" size="icon" onClick={generateSuggestions} disabled={loading}>
            <RefreshCw className={loading ? "animate-spin" : ""} />
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Oportunidades de Otimização</CardTitle>
          <CardDescription>
            {loading ? "Analisando estoque..." : `${suggestions.length} sugestões encontradas com base nos seus níveis de estoque mínimo e máximo.`}
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
                    Seu estoque parece otimizado no momento, ou os níveis mínimo/máximo não foram definidos.
                </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Destino</TableHead>
                  <TableHead className="text-right">Qtd. Sugerida</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {suggestions.map((s, index) => (
                  <TableRow key={`${s.productId}-${s.fromLocationId}-${s.toLocationId}-${index}`}>
                    <TableCell className="font-medium">{s.productName}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="gap-2">
                        <GitFork className="h-3 w-3" />
                        {getBranchName(s.fromBranchId)}
                      </Badge>
                       <p className="text-xs text-muted-foreground mt-1">{getLocationName(s.fromLocationId)}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="gap-2">
                        <GitFork className="h-3 w-3" />
                        {getBranchName(s.toBranchId)}
                      </Badge>
                      <p className="text-xs text-muted-foreground mt-1">{getLocationName(s.toLocationId)}</p>
                    </TableCell>
                    <TableCell className="text-right font-bold text-primary text-lg">
                      {s.quantityToTransfer}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
