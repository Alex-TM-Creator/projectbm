"use client";

import * as React from "react";
import {
  Loader2,
  GitFork,
  Package,
  Search,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  Send,
  ArrowDown,
  ArrowUp,
  Save,
  SlidersHorizontal,
  X,
  BadgeCheck,
  ListTree,
} from "lucide-react";
import {
  collection,
  getDocs,
  query,
  orderBy,
  addDoc,
  serverTimestamp,
  doc,
  getDoc,
  where,
  writeBatch,
  limit,
  startAt,
  endAt,
} from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { useAuthState } from "react-firebase-hooks/auth";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import type { Product, Branch, User, StockingLocation, ProductStock, Brand, ProductCategory, Lot } from "@/lib/definitions";

interface AdjustmentItem {
  id: string; // Internal unique ID for the list
  product: Product;
  type: "entry" | "exit";
  quantity: number;
  reason: string;
  lotId?: string;
  currentStock: number;
}

export default function StockAdjustmentPage() {
  const { toast } = useToast();
  const [user, authLoading] = useAuthState(auth);
  const [userData, setUserData] = React.useState<User | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const [searchResults, setSearchResults] = React.useState<Product[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);
  const [branches, setBranches] = React.useState<Branch[]>([]);
  const [stockingLocations, setStockingLocations] = React.useState<StockingLocation[]>([]);
  const [brands, setBrands] = React.useState<Brand[]>([]);
  const [categories, setCategories] = React.useState<ProductCategory[]>([]);
  const [lots, setLots] = React.useState<Lot[]>([]);
  const [stockCache, setStockCache] = React.useState<Record<string, number>>({});
  const [lotBalances, setLotBalances] = React.useState<Record<string, number>>({});

  const [selectedBranchId, setSelectedBranchId] = React.useState<string>("");
  const [selectedLocationId, setSelectedLocationId] = React.useState<string>("");
  const [selectedBrandId, setSelectedBrandId] = React.useState<string>("all");
  const [selectedCategoryId, setSelectedCategoryId] = React.useState<string>("all");
  const [adjustmentItems, setAdjustmentItems] = React.useState<AdjustmentItem[]>([]);
  const [searchTerm, setSearchTerm] = React.useState("");


  const fetchData = React.useCallback(async (uid?: string) => {
    try {
      setLoading(true);
      const [branchesSnap, locationsSnap, brandsSnap, categoriesSnap, lotsSnap] = await Promise.all([
        getDocs(query(collection(db, "branches"), orderBy("name"))),
        getDocs(query(collection(db, "stockingLocations"))),
        getDocs(collection(db, "brands")),
        getDocs(collection(db, "productCategories")),
        getDocs(query(collection(db, "lots"), orderBy("registrationDate", "desc"), limit(50))),
      ]);
      setBranches(branchesSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Branch)));
      setStockingLocations(locationsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() } as StockingLocation)));
      setBrands(brandsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Brand)).sort((a, b) => a.name.localeCompare(b.name)));
      setCategories(categoriesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProductCategory)).sort((a, b) => a.name.localeCompare(b.name)));
      setLots(lotsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Lot)));

      if (uid) {
        const userSnap = await getDoc(doc(db, "users", uid));
        if (userSnap.exists()) {
          setUserData(userSnap.data() as User);
        }
      }

    } catch (error) {
      toast({ title: "Erro ao buscar dados", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  React.useEffect(() => {
    if (user?.uid) {
      fetchData(user.uid);
    } else if (!authLoading) {
      setLoading(false);
    }
  }, [fetchData, user, authLoading]);

  const filteredLocations = React.useMemo(() => {
    if (!selectedBranchId) return [];
    return stockingLocations.filter(loc => loc.branchId === selectedBranchId && loc.isActive);
  }, [stockingLocations, selectedBranchId]);

  React.useEffect(() => {
    const handleSearch = async () => {
      const term = searchTerm.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const hasFilter = selectedBrandId !== "all" || selectedCategoryId !== "all";

      if (!term && !hasFilter) {
        setSearchResults([]);
        return;
      }

      if (term.length < 2 && !hasFilter) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);
      try {
        const productsRef = collection(db, "products");
        let foundProducts: Product[] = [];

        if (term.length >= 2) {
          const searchWords = term.split(/\s+/).filter(w => w.length >= 2);
          const firstWord = searchWords[0];
          const termCapitalized = firstWord.charAt(0).toUpperCase() + firstWord.slice(1);
          const termUpper = firstWord.toUpperCase();

          const queries = [
            query(productsRef, where("name", ">=", firstWord), where("name", "<=", firstWord + "\uf8ff"), limit(50)),
            query(productsRef, where("name", ">=", termCapitalized), where("name", "<=", termCapitalized + "\uf8ff"), limit(50)),
            query(productsRef, where("name", ">=", termUpper), where("name", "<=", termUpper + "\uf8ff"), limit(50)),
            query(productsRef, where("keywords", "array-contains", firstWord), limit(50))
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
            q = query(productsRef, where("productCategoryId", "==", selectedCategoryId), limit(100));
          } else {
            q = query(productsRef, where("brandId", "==", selectedBrandId), limit(100));
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

        setSearchResults(foundProducts.sort((a, b) => a.name.localeCompare(b.name)));
      } catch (error) {
        console.error("Search error:", error);
      } finally {
        setIsSearching(false);
      }
    };

    const timer = setTimeout(handleSearch, 500);
    return () => clearTimeout(timer);
  }, [searchTerm, selectedBrandId, selectedCategoryId]);

  const clearSearchFilters = () => {
    setSearchTerm("");
    setSelectedBrandId("all");
    setSelectedCategoryId("all");
  };

  const fetchStockForProductAndLocation = React.useCallback(async (productId: string, locationId: string) => {
    const cacheKey = `${productId}_${locationId}`;
    if (stockCache[cacheKey] !== undefined) return stockCache[cacheKey];

    try {
      const q = query(
        collection(db, "productStock"),
        where("productId", "==", productId),
        where("stockingLocationId", "==", locationId)
      );
      const snap = await getDocs(q);
      let quantity = 0;
      if (!snap.empty) {
        quantity = (snap.docs[0].data() as ProductStock).quantity || 0;
      }
      setStockCache(prev => ({ ...prev, [cacheKey]: quantity }));
      return quantity;
    } catch (error) {
      console.error("Error fetching stock:", error);
      return 0;
    }
  }, [stockCache]);

  const getStockFromCache = (productId: string, locationId: string): number | null => {
    const cacheKey = `${productId}_${locationId}`;
    return stockCache[cacheKey] !== undefined ? stockCache[cacheKey] : null;
  };

  const fetchLotBalancesForProduct = React.useCallback(async (productId: string, locationId: string) => {
    try {
      const movSnap = await getDocs(query(
        collection(db, "stockMovements"),
        where("productId", "==", productId),
        where("stockingLocationId", "==", locationId)
      ));
      const balances: Record<string, number> = {};
      movSnap.docs.forEach(d => {
        const data = d.data();
        if (data.lotId) {
          balances[data.lotId] = (balances[data.lotId] || 0) + (data.quantityChange || 0);
        }
      });
      setLotBalances(prev => ({ ...prev, ...balances }));
    } catch (e) {
      console.error("Erro ao buscar saldos por lote:", e);
    }
  }, []);

  const handleAddProduct = async (product: Product) => {
    if (!selectedLocationId) return;
    
    // Check if already in list
    if (adjustmentItems.find(item => item.product.id === product.id)) {
        toast({ title: "Produto já está na lista" });
        return;
    }

    const stock = await fetchStockForProductAndLocation(product.id, selectedLocationId);
    fetchLotBalancesForProduct(product.id, selectedLocationId);
    
    setAdjustmentItems(prev => [...prev, {
        id: Math.random().toString(36).substring(2, 9),
        product,
        type: "entry",
        quantity: 1,
        reason: "",
        lotId: "none",
        currentStock: stock || 0
    }]);
    setSearchTerm("");
  };

  const removeItem = (id: string) => {
    setAdjustmentItems(prev => prev.filter(item => item.id !== id));
  };

  const updateItem = (id: string, field: keyof AdjustmentItem, value: any) => {
    setAdjustmentItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const handleSubmit = async () => {
    if (adjustmentItems.length === 0) {
      toast({ title: "Lista vazia", variant: "destructive" });
      return;
    }

    // Basic validation
    for (const item of adjustmentItems) {
        if (!item.reason || item.reason.trim() === "") {
            toast({ title: "Justificativa obrigatória", description: `O produto ${item.product.name} não possui justificativa.`, variant: "destructive" });
            return;
        }
        if (item.type === 'exit' && item.quantity > item.currentStock) {
            toast({ title: "Estoque insuficiente", description: `A quantidade de saída para ${item.product.name} (${item.quantity}) é maior que o estoque atual (${item.currentStock}).`, variant: "destructive" });
            return;
        }
    }

    if (!user || !userData) {
      toast({ title: "Erro de Autenticação", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const batch = writeBatch(db);
      const movementType = 'inventory_adjustment';

      for (const item of adjustmentItems) {
        const quantityChange = item.type === 'entry' ? item.quantity : -item.quantity;
        const stockQuery = query(collection(db, "productStock"), where("productId", "==", item.product.id), where("stockingLocationId", "==", selectedLocationId));
        const stockSnap = await getDocs(stockQuery);

        if (!stockSnap.empty) {
            const stockDoc = stockSnap.docs[0];
            batch.update(stockDoc.ref, { quantity: stockDoc.data().quantity + quantityChange });
        } else {
            batch.set(doc(collection(db, "productStock")), {
                productId: item.product.id,
                stockingLocationId: selectedLocationId,
                quantity: quantityChange,
            });
        }

        const lotRef = lots.find(l => l.id === item.lotId);
        const lotInfo = lotRef ? ` (Lote: ${lotRef.lotNumber})` : "";

        batch.set(doc(collection(db, "stockMovements")), {
            productId: item.product.id,
            stockingLocationId: selectedLocationId,
            type: movementType,
            quantityChange,
            reason: `${item.reason}${lotInfo}`,
            lotId: (item.lotId && item.lotId !== "none") ? item.lotId : undefined,
            createdAt: serverTimestamp(),
            userId: user.uid,
            userName: userData.name,
        });
      }

      await batch.commit();
      toast({ title: "Ajustes de Estoque Realizados!", description: `${adjustmentItems.length} produtos foram atualizados com sucesso.` });

      // Reset form
      setAdjustmentItems([]);
      setStockCache({});
      fetchData(user.uid);

    } catch (error) {
      toast({ title: "Erro ao ajustar estoque", variant: "destructive" });
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (loading || authLoading) {
    return <div className="flex justify-center items-center h-96"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <CardTitle className="text-3xl font-bold font-headline flex items-center gap-3">
            <SlidersHorizontal className="text-primary" />
            Ajuste de Estoque
          </CardTitle>
          <CardDescription className="text-lg">Faça entradas ou saídas manuais com precisão e controle.</CardDescription>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full">
        {/* Card 1: Configuração e Busca */}
        <div className="w-full space-y-6">
            <Card className="border-none shadow-md overflow-hidden bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm h-full">
                <CardHeader className="bg-primary/5 border-b border-primary/10">
                    <CardTitle className="text-xl flex items-center gap-2">
                        <GitFork className="h-5 w-5 text-primary" /> 
                        1. Localização e Produto
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                    <div className="grid grid-cols-1 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="branch" className="text-sm font-semibold">Filial</Label>
                            <Select value={selectedBranchId} onValueChange={setSelectedBranchId} disabled={isSubmitting}>
                                <SelectTrigger id="branch" className="h-11"><SelectValue placeholder="Escolher filial"/></SelectTrigger>
                                <SelectContent>{branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="location" className="text-sm font-semibold">Local de Estocagem</Label>
                            <Select value={selectedLocationId} onValueChange={setSelectedLocationId} disabled={isSubmitting || !selectedBranchId}>
                                <SelectTrigger id="location" className="h-11"><SelectValue placeholder="Escolher local"/></SelectTrigger>
                                <SelectContent>{filteredLocations.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-3 pt-2">
                        <Label htmlFor="product-search" className="text-sm font-semibold flex items-center gap-2"><Search className="h-4 w-4 text-primary"/> Buscar Produto</Label>
                        <div className="space-y-4">
                            <div className="relative">
                                <Input 
                                    id="product-search"
                                    placeholder="Nome ou código..."
                                    className="h-11 pl-4 bg-background shadow-inner"
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    disabled={isSubmitting || !selectedLocationId}
                                />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <Select value={selectedBrandId} onValueChange={setSelectedBrandId} disabled={isSubmitting || !selectedLocationId}>
                                    <SelectTrigger className="h-9 text-xs">
                                        <SelectValue placeholder="Marca" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Todas as Marcas</SelectItem>
                                        {brands.map(brand => (
                                            <SelectItem key={brand.id} value={brand.id}>{brand.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId} disabled={isSubmitting || !selectedLocationId}>
                                    <SelectTrigger className="h-9 text-xs">
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
                            {(searchTerm || selectedBrandId !== "all" || selectedCategoryId !== "all") && (
                                <div className="flex justify-end">
                                    <Button variant="ghost" size="sm" onClick={clearSearchFilters} className="text-primary hover:text-primary/80 h-auto py-0 text-xs font-semibold">
                                        <X className="h-3 w-3 mr-1"/> LIMPAR FILTROS
                                    </Button>
                                </div>
                            )}
                        </div>

                        {isSearching ? (
                            <div className="flex justify-center p-8 bg-background/50 rounded-xl border border-dashed"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                        ) : (searchTerm || selectedBrandId !== "all" || selectedCategoryId !== "all") && (
                            <div className="max-h-60 overflow-y-auto mt-2 p-1 space-y-1 rounded-xl bg-background shadow-inner border border-zinc-100 dark:border-zinc-800">
                                {searchResults.map(product => (
                                    <Button
                                        key={product.id}
                                        variant="ghost"
                                        className="w-full justify-start text-left h-auto py-3 px-4 hover:bg-primary/5 rounded-lg border-b border-transparent last:border-0 hover:border-primary/10 transition-all group"
                                        onClick={() => handleAddProduct(product)}
                                    >
                                        <div className="flex items-center w-full">
                                            <Plus className="h-4 w-4 mr-3 text-muted-foreground group-hover:text-primary transition-colors" />
                                            <div className="flex flex-col flex-1 overflow-hidden">
                                                <span className="font-semibold text-sm truncate">{product.name}</span>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <Badge variant="secondary" className="text-[10px] h-4 py-0 px-1 font-normal opacity-70">
                                                        {brands.find(b => b.id === product.brandId)?.name || 'S/M'}
                                                    </Badge>
                                                    {product.internalCode && <span className="text-[10px] text-muted-foreground font-mono">[{product.internalCode}]</span>}
                                                </div>
                                            </div>
                                        </div>
                                    </Button>
                                ))}
                                {searchResults.length === 0 && (
                                    <div className="flex flex-col items-center justify-center py-10 opacity-40">
                                        <Search className="h-10 w-10 mb-2"/>
                                        <p className="text-xs font-medium">Nenhum produto encontrado.</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>

        {/* Card 2: Ajuste e Confirmação */}
        <div className="lg:col-span-12 xl:col-span-7">
          <Card className="h-full border-none shadow-xl overflow-hidden flex flex-col bg-white dark:bg-zinc-900">
            <CardHeader className="bg-zinc-50 dark:bg-zinc-800/50 border-b p-8">
              <CardTitle className="text-2xl font-bold flex items-center gap-3">
                <ShoppingCart className="h-8 w-8 text-primary p-2 bg-primary/10 rounded-xl" />
                Carrinho de Ajustes
              </CardTitle>
              <CardDescription className="text-base">
                Configure os detalhes de cada produto antes de confirmar o ajuste em massa.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 p-0 overflow-hidden flex flex-col min-h-[400px]">
              {adjustmentItems.length > 0 ? (
                <div className="flex-1 overflow-y-auto">
                    <div className="space-y-0 divide-y divide-zinc-100 dark:divide-zinc-800">
                        {adjustmentItems.map((item) => (
                            <div key={item.id} className="p-6 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20 transition-all space-y-4">
                                <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                                    <div className="flex gap-4 items-start">
                                        <div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-xl text-zinc-500 shadow-inner">
                                            <Package className="h-6 w-6" />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-lg text-zinc-900 dark:text-zinc-100">{item.product.name}</h4>
                                            <div className="flex gap-2 items-center mt-1">
                                                <Badge variant="outline" className="text-[10px] py-0">{item.product.internalCode || 'S/ID'}</Badge>
                                                <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Estoque Atual: {item.currentStock}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <Button variant="ghost" size="icon" className="h-10 w-10 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-2xl" onClick={() => removeItem(item.id)}>
                                        <X className="h-5 w-5" />
                                    </Button>
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                                    <div className="md:col-span-3 space-y-1.5">
                                        <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Operação</Label>
                                        <Select value={item.type} onValueChange={(v) => updateItem(item.id, 'type', v)}>
                                            <SelectTrigger className="h-10 font-semibold shadow-sm border-2">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="entry" className="text-green-600 font-bold">ENTRADA</SelectItem>
                                                <SelectItem value="exit" className="text-red-600 font-bold">SAÍDA</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    
                                    <div className="md:col-span-2 space-y-1.5">
                                        <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Qtd</Label>
                                        <Input 
                                            type="number" 
                                            value={item.quantity} 
                                            onChange={(e) => updateItem(item.id, 'quantity', Math.max(1, parseInt(e.target.value) || 1))} 
                                            className="h-10 text-center font-black border-2"
                                            min="1"
                                        />
                                    </div>

                                    <div className="md:col-span-3 space-y-1.5">
                                        <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                          {item.type === 'exit' ? 'Lote (Saída)' : 'Lote (Entrada)'}
                                        </Label>
                                        <Select 
                                            value={item.lotId || "none"} 
                                            onValueChange={(v) => updateItem(item.id, 'lotId', v)}
                                        >
                                            <SelectTrigger className={`h-10 text-xs shadow-sm border-2 ${item.type === 'exit' ? 'border-red-300 dark:border-red-800' : ''}`}>
                                                <SelectValue placeholder="Selecione..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="none">Nenhum Lote</SelectItem>
                                                {lots
                                                  .filter(l => {
                                                    if (item.type === 'exit') {
                                                      return (lotBalances[l.id] ?? 0) > 0;
                                                    }
                                                    return true;
                                                  })
                                                  .map(l => (
                                                    <SelectItem key={l.id} value={l.id}>
                                                      {l.lotNumber}{item.type === 'exit' && lotBalances[l.id] !== undefined ? ` (Saldo: ${lotBalances[l.id]})` : ''}
                                                    </SelectItem>
                                                  ))
                                                }
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="md:col-span-4 space-y-1.5">
                                        <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Justificativa</Label>
                                        <Input 
                                            value={item.reason} 
                                            onChange={(e) => updateItem(item.id, 'reason', e.target.value)}
                                            placeholder="Ex: Quebra, Inventário..."
                                            className="h-10 border-2"
                                        />
                                    </div>
                                </div>
                                {item.type === 'exit' && item.quantity > item.currentStock && (
                                    <div className="text-[10px] text-destructive font-black animate-pulse flex items-center gap-1 mt-2">
                                        <X className="h-3 w-3" /> ESTOQUE INSUFICIENTE PARA SAÍDA
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-20 opacity-20 space-y-6">
                  <div className="p-8 rounded-full border-4 border-dashed border-zinc-400 rotate-12">
                    <Plus className="h-12 w-12" />
                  </div>
                  <p className="text-center font-black uppercase tracking-[0.2em]">Sua lista de ajustes está vazia</p>
                </div>
              )}
            </CardContent>
            <CardFooter className="p-8 bg-zinc-50 dark:bg-zinc-800/20 border-t">
              <Button
                className="w-full h-16 rounded-2xl text-xl font-black shadow-xl shadow-primary/20 hover:scale-[1.01] active:scale-95 transition-all group"
                onClick={handleSubmit}
                disabled={isSubmitting || adjustmentItems.length === 0}
              >
                {isSubmitting ? <Loader2 className="mr-3 h-6 w-6 animate-spin" /> : <Save className="mr-3 h-6 w-6 group-hover:rotate-12 transition-transform" />}
                CONFIRMAR TODOS OS AJUSTES
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}
