
"use client";

import * as React from "react";
import { Loader2, Package, GitFork, User, RefreshCw } from "lucide-react";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import type { StockMovement, Product, StockingLocation, Branch } from "@/lib/definitions";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function StockMovementHistoryPage() {
  const { toast } = useToast();
  const [movements, setMovements] = React.useState<StockMovement[]>([]);
  const [products, setProducts] = React.useState<Product[]>([]);
  const [locations, setLocations] = React.useState<StockingLocation[]>([]);
  const [branches, setBranches] = React.useState<Branch[]>([]);
  const [loading, setLoading] = React.useState(true);

  const fetchData = React.useCallback(async () => {
    try {
      setLoading(true);
      const [movementsSnap, productsSnap, locationsSnap, branchesSnap] = await Promise.all([
        getDocs(query(collection(db, "stockMovements"), orderBy("createdAt", "desc"))),
        getDocs(collection(db, "products")),
        getDocs(collection(db, "stockingLocations")),
        getDocs(collection(db, "branches")),
      ]);
      setMovements(movementsSnap.docs.map(d => ({ id: d.id, ...d.data() } as StockMovement)));
      setProducts(productsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Product)));
      setLocations(locationsSnap.docs.map(d => ({ id: d.id, ...d.data() } as StockingLocation)));
      setBranches(branchesSnap.docs.map(d => ({ id: d.id, ...d.data() } as Branch)));
    } catch (error) {
      toast({ title: "Erro ao buscar histórico", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);
  
  const getProductName = (productId: string) => products.find(p => p.id === productId)?.name || 'N/A';
  const getLocationName = (locationId: string) => locations.find(l => l.id === locationId)?.name || 'N/A';
  const getBranchName = (locationId: string) => {
    const location = locations.find(l => l.id === locationId);
    if (!location) return 'N/A';
    return branches.find(b => b.id === location.branchId)?.name || 'N/A';
  }
  const formatDate = (timestamp: any) => {
    if (!timestamp?.toDate) return "Data inválida";
    return format(timestamp.toDate(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-headline tracking-tight flex items-center gap-2">
            <Package /> Histórico de Movimentações
          </h1>
          <p className="text-muted-foreground">
            Audite todas as entradas e saídas de estoque entre locais.
          </p>
        </div>
        <Button variant="outline" size="icon" onClick={fetchData} disabled={loading}>
            <RefreshCw className={loading ? "animate-spin" : ""} />
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Registros de Movimentação</CardTitle>
          <CardDescription>
            {loading ? "Carregando..." : `${movements.length} movimentações encontradas.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Local</TableHead>
                  <TableHead>Filial</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-center">Alteração</TableHead>
                  <TableHead>Usuário</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movements.map(mov => (
                  <TableRow key={mov.id}>
                    <TableCell>{formatDate(mov.createdAt)}</TableCell>
                    <TableCell className="font-medium">{getProductName(mov.productId)}</TableCell>
                    <TableCell>{getLocationName(mov.stockingLocationId)}</TableCell>
                    <TableCell>{getBranchName(mov.stockingLocationId)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{mov.reason || mov.type}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                       <Badge variant={mov.quantityChange > 0 ? "default" : "destructive"} className={mov.quantityChange > 0 ? "bg-green-600" : ""}>
                         {mov.quantityChange > 0 ? `+${mov.quantityChange}` : mov.quantityChange}
                       </Badge>
                    </TableCell>
                    <TableCell className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        {mov.userName}
                    </TableCell>
                  </TableRow>
                ))}
                {movements.length === 0 && (
                    <TableRow>
                        <TableCell colSpan={7} className="text-center h-24">Nenhuma movimentação encontrada.</TableCell>
                    </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
