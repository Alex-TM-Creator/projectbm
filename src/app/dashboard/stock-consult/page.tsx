
"use client";

import * as React from "react";
import {
  Loader2,
  Package,
  Search,
  Frown,
  RefreshCw,
  GitFork,
  X,
  DollarSign,
} from "lucide-react";
import {
  collection,
  getDocs,
  query,
  where,
  limit,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
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
import type { Product, ProductStock, StockingLocation, Branch, Brand, ProductCategory } from "@/lib/definitions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type ProductWithStock = {
    product: Product;
    totalStock: number;
    stockByBranch: {
        branchId: string;
        branchName: string;
        quantity: number;
    }[];
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

export default function StockConsultPage() {
  const { toast } = useToast();
  const [productWithStocks, setProductWithStocks] = React.useState<ProductWithStock[]>([]);
  const [branches, setBranches] = React.useState<Branch[]>([]);
  const [locations, setLocations] = React.useState<StockingLocation[]>([]);
  const [brands, setBrands] = React.useState<Brand[]>([]);
  const [categories, setCategories] = React.useState<ProductCategory[]>([]);
  
  const [loading, setLoading] = React.useState(true);
  const [isSearching, setIsSearching] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [selectedBrandId, setSelectedBrandId] = React.useState<string>("all");
  const [selectedCategoryId, setSelectedCategoryId] = React.useState<string>("all");

  const fetchMetaData = React.useCallback(async () => {
    try {
      setLoading(true);
      const [locationsSnap, branchesSnap, brandsSnap, categoriesSnap] = await Promise.all([
        getDocs(collection(db, "stockingLocations")),
        getDocs(collection(db, "branches")),
        getDocs(collection(db, "brands")),
        getDocs(collection(db, "productCategories")),
      ]);
      
      setLocations(locationsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as StockingLocation)));
      setBranches(branchesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Branch)));
      setBrands(brandsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Brand)).sort((a, b) => a.name.localeCompare(b.name)));
      setCategories(categoriesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProductCategory)).sort((a, b) => a.name.localeCompare(b.name)));
    } catch (error) {
      console.error(error);
      toast({ title: "Erro ao carregar configurações", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    fetchMetaData();
  }, [fetchMetaData]);

  const handleSearch = React.useCallback(async () => {
    const term = searchTerm.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const hasFilter = selectedBrandId !== "all" || selectedCategoryId !== "all";
    
    if (term.length < 3 && !hasFilter) {
      setProductWithStocks([]);
      return;
    }

    setIsSearching(true);
    try {
      const productsRef = collection(db, "products");
      let foundProducts: Product[] = [];

      if (term.length >= 3) {
        const searchWords = term.split(/\s+/).filter(w => w.length >= 2);
        const firstWord = searchWords[0];
        const termCapitalized = firstWord.charAt(0).toUpperCase() + firstWord.slice(1);
        const termUpper = firstWord.toUpperCase();

        const queries = [
          query(productsRef, where("name", ">=", firstWord), where("name", "<=", firstWord + "\uf8ff"), limit(100)),
          query(productsRef, where("name", ">=", termCapitalized), where("name", "<=", termCapitalized + "\uf8ff"), limit(100)),
          query(productsRef, where("name", ">=", termUpper), where("name", "<=", termUpper + "\uf8ff"), limit(100)),
          query(productsRef, where("keywords", "array-contains", firstWord), limit(100))
        ];

        const snapshots = await Promise.all(queries.map(q => getDocs(q)));
        const foundProductsMap = new Map<string, Product>();
        
        snapshots.forEach(snap => {
            snap.docs.forEach((docSnap) => {
                foundProductsMap.set(docSnap.id, { id: docSnap.id, ...docSnap.data() } as Product);
            });
        });

        foundProducts = Array.from(foundProductsMap.values()).filter(p => {
          const pText = `${p.name} ${p.internalCode || ""} ${p.barcode || ""}`.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
          return searchWords.every(word => pText.includes(word));
        });
      } else if (hasFilter) {
        let q;
        if (selectedCategoryId !== "all") {
          q = query(productsRef, where("productCategoryId", "==", selectedCategoryId), limit(200));
        } else {
          q = query(productsRef, where("brandId", "==", selectedBrandId), limit(200));
        }
        const snap = await getDocs(q);
        foundProducts = snap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Product));
      }

      // Final client-side filtering for combined filters
      if (selectedBrandId !== "all") {
        foundProducts = foundProducts.filter(p => p.brandId === selectedBrandId);
      }
      if (selectedCategoryId !== "all") {
        foundProducts = foundProducts.filter(p => p.productCategoryId === selectedCategoryId);
      }

      if (foundProducts.length === 0) {
          setProductWithStocks([]);
          return;
      }

      // Otimização: buscar apenas o estoque dos produtos encontrados separando em LOTES de 30 (limite do 'in' no firestore)
      const productIds = foundProducts.map(p => p.id);
      const stockPromises = [];
      const chunkSize = 30;
      
      for (let i = 0; i < productIds.length; i += chunkSize) {
        const chunk = productIds.slice(i, i + chunkSize);
        const qStock = query(collection(db, "productStock"), where("productId", "in", chunk));
        stockPromises.push(getDocs(qStock));
      }

      const stockSnaps = await Promise.all(stockPromises);
      const allStocks = stockSnaps.flatMap(snap => snap.docs.map(docSnap => docSnap.data() as ProductStock));
      const getBranchName = (branchId: string) => branches.find(b => b.id === branchId)?.name || 'N/A';

      const processedData: ProductWithStock[] = foundProducts.map(product => {
        const stocksForProduct = allStocks.filter(s => s.productId === product.id);
        const totalStock = stocksForProduct.reduce((sum, s) => sum + s.quantity, 0);

        const stockByBranchMap = new Map<string, number>();
        for (const stock of stocksForProduct) {
          const location = locations.find(l => l.id === stock.stockingLocationId);
          if (location) {
            const currentQuantity = stockByBranchMap.get(location.branchId) || 0;
            stockByBranchMap.set(location.branchId, currentQuantity + stock.quantity);
          }
        }
        
        const stockByBranch = Array.from(stockByBranchMap.entries()).map(([branchId, quantity]) => ({
          branchId,
          branchName: getBranchName(branchId),
          quantity,
        })).sort((a,b) => a.branchName.localeCompare(b.branchName));

        return { product, totalStock, stockByBranch };
      });

      setProductWithStocks(processedData.sort((a, b) => a.product.name.localeCompare(b.product.name)));

    } catch (error) {
      console.error(error);
      toast({ title: "Erro na pesquisa", variant: "destructive" });
    } finally {
      setIsSearching(false);
    }
  }, [searchTerm, selectedBrandId, selectedCategoryId, branches, locations, toast]);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      handleSearch();
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm, selectedBrandId, selectedCategoryId, handleSearch]);

  const clearFilters = () => {
    setSearchTerm("");
    setSelectedBrandId("all");
    setSelectedCategoryId("all");
  };

  return (
    <div className="flex flex-col gap-6">
       <div className="flex items-center justify-between">
        <div>
            <h1 className="text-3xl font-bold font-headline tracking-tight flex items-center gap-2">
                <Package /> Consulta de Estoque
            </h1>
            <p className="text-muted-foreground">
                Visualize o estoque por filial, marca ou categoria.
            </p>
        </div>
        <Button variant="outline" size="icon" onClick={() => handleSearch()} disabled={isSearching}>
            <RefreshCw className={isSearching ? "animate-spin" : ""} />
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros de Busca</CardTitle>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4">
            <div className="relative md:col-span-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                    placeholder="Buscar por nome ou código..." 
                    className="pl-10" 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
            <Select value={selectedBrandId} onValueChange={setSelectedBrandId}>
                <SelectTrigger>
                    <SelectValue placeholder="Marca" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">Todas as Marcas</SelectItem>
                    {brands.map(brand => (
                        <SelectItem key={brand.id} value={brand.id}>{brand.name}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
            <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
                <SelectTrigger>
                    <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">Todas as Categorias</SelectItem>
                    {categories.map(category => (
                        <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end pt-2">
            <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground">
                <X className="h-4 w-4 mr-2"/> Limpar Filtros
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>
          ) : searchTerm.length < 3 && selectedBrandId === "all" && selectedCategoryId === "all" ? (
            <div className="flex flex-col items-center justify-center h-64 text-center text-muted-foreground">
                <Package className="h-12 w-12 mb-4 opacity-20" />
                <p>Utilize a busca ou os filtros para consultar o estoque.</p>
            </div>
          ) : productWithStocks.length === 0 && !isSearching ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
                <Frown className="h-12 w-12 text-muted-foreground mb-4" />
                <h2 className="mt-4 text-xl font-semibold">Nenhum produto encontrado</h2>
                <p className="text-sm text-muted-foreground">Tente ajustar os filtros ou o termo de busca.</p>
            </div>
          ) : (
            <Accordion type="single" collapsible className="w-full space-y-2">
              {productWithStocks.map(item => (
                <AccordionItem value={item.product.id} key={item.product.id} className="border rounded-lg">
                  <AccordionTrigger className="p-4 hover:no-underline text-base">
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-3">
                        <Package className="h-5 w-5 text-muted-foreground"/>
                        <div className="flex flex-col text-left">
                           <span className="font-medium">{item.product.name}</span>
                           <div className="flex items-center gap-2 mt-1">
                                {item.product.internalCode && <Badge variant="outline" className="font-mono text-[10px] h-5">Cód: {item.product.internalCode}</Badge>}
                                <Badge variant="secondary" className="text-[10px] h-5">{brands.find(b => b.id === item.product.brandId)?.name || 'S/M'}</Badge>
                           </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 mr-4">
                        <Badge variant="secondary" className="text-green-600 bg-green-50 dark:bg-green-950 font-bold border-green-200">
                            <DollarSign className="h-3 w-3 mr-1" />
                            {formatCurrency(item.product.salePrice)}
                        </Badge>
                        <Badge variant={item.totalStock > 0 ? "default" : "destructive"}>
                            Estoque: {item.totalStock}
                        </Badge>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="p-4 pt-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Filial</TableHead>
                          <TableHead className="text-right">Quantidade em Estoque</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {item.stockByBranch.map(stock => (
                          <TableRow key={stock.branchId}>
                            <TableCell className="flex items-center gap-2">
                                <GitFork className="h-4 w-4 text-muted-foreground"/>
                                {stock.branchName}
                            </TableCell>
                            <TableCell className="text-right font-semibold">{stock.quantity}</TableCell>
                          </TableRow>
                        ))}
                         {item.stockByBranch.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={2} className="text-center text-muted-foreground">
                                    Sem estoque registrado para este produto.
                                </TableCell>
                            </TableRow>
                         )}
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
